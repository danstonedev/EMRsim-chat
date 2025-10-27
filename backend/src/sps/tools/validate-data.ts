/*
  SPS Data Validator
  - Validates personas, scenarios, screening challenges, and special questions against Zod schemas
  - Cross-checks scenario references to challenges/special questions
  - Prints a concise report and exits non-zero on any error
*/
import { zScreeningChallenge, zSpecialQuestion, zPersona, zClinicalScenario } from '../core/schemas.js';
import { convertPersonaBundle, convertScenarioBundle, loadContextModules, resolveModule } from '../runtime/session.js';
import type { ModuleReference } from '../runtime/session.js';
import fs from 'node:fs';
import path from 'node:path';

type Issue = { level: 'ERROR' | 'WARN'; file: string; message: string };

const ROOT = path.resolve(process.cwd(), 'src', 'sps', 'content');
const PATHS = {
  challenges: path.join(ROOT, 'banks', 'challenges', 'red_yellow.core.json'),
  specials: path.join(ROOT, 'banks', 'special_questions'),
  personas: path.join(ROOT, 'personas'),
  scenarios: path.join(ROOT, 'scenarios'),
  scenariosV3: path.join(ROOT, 'scenarios', 'bundles_src'),
};

function readJson(file: string) {
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw);
}

function listJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(dir, f));
}

function listJsonFilesDeep(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...listJsonFilesDeep(full));
    else if (entry.endsWith('.json')) out.push(full);
  }
  return out;
}

function listDirectories(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .map(entry => path.join(dir, entry))
    .filter(fullPath => fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory());
}

async function main() {
  const issues: Issue[] = [];

  // 1) Challenges
  let challengeBank: any[] = [];
  try {
    if (fs.existsSync(PATHS.challenges)) {
      const arr = readJson(PATHS.challenges);
      if (!Array.isArray(arr)) throw new Error('challenges file must be an array');
      challengeBank = arr
        .map((it, idx) => {
          try {
            return zScreeningChallenge.parse(it);
          } catch (e: any) {
            issues.push({ level: 'ERROR', file: PATHS.challenges, message: `index ${idx}: ${e}` });
            return null;
          }
        })
        .filter(Boolean);
    } else {
      issues.push({ level: 'WARN', file: PATHS.challenges, message: 'challenges file not found' });
    }
  } catch (e: any) {
    issues.push({ level: 'ERROR', file: PATHS.challenges, message: String(e) });
  }
  const challengeIds = new Set(challengeBank.map((c: any) => c.id));

  // 2) Special questions (all region files)
  const specialsFiles = listJsonFiles(PATHS.specials);
  const specialBank: any[] = [];
  for (const f of specialsFiles) {
    try {
      const arr = readJson(f);
      if (!Array.isArray(arr)) throw new Error('special questions file must be an array');
      arr.forEach((it: any, idx: number) => {
        try {
          specialBank.push(zSpecialQuestion.parse(it));
        } catch (e: any) {
          issues.push({ level: 'ERROR', file: f, message: `index ${idx}: ${e}` });
        }
      });
    } catch (e: any) {
      issues.push({ level: 'ERROR', file: f, message: String(e) });
    }
  }
  const specialIds = new Set(specialBank.map((s: any) => s.id));

  // 3) Personas (all nested JSON)
  const personaFiles = listJsonFilesDeep(PATHS.personas);
  const scenarioPersonaDir = path.join(PATHS.personas, 'shared') + path.sep;
  const personaIds = new Set<string>();
  const scenarioPersonaBundles = new Map<string, { raw: any; persona: any }>();
  for (const f of personaFiles) {
    try {
      const obj = readJson(f);
      const basename = path.basename(f);
      const personasToValidate: unknown[] = [];

      if (basename === 'realtime_personas.json') {
        if (!Array.isArray(obj)) {
          issues.push({ level: 'ERROR', file: f, message: 'realtime_personas.json must be an array' });
        } else {
          // realtime_personas.json is already in canonical format, just validate directly
          obj.forEach((raw: any) => {
            personasToValidate.push(raw);
          });
        }
      } else if (f.startsWith(scenarioPersonaDir)) {
        const persona = convertPersonaBundle(obj, undefined, undefined, undefined);
        if (!persona) {
          issues.push({ level: 'ERROR', file: f, message: 'failed to convert scenario persona' });
        } else {
          scenarioPersonaBundles.set(persona.patient_id, { raw: obj, persona });
          personasToValidate.push(persona);
        }
      } else {
        personasToValidate.push(obj);
      }

      personasToValidate.forEach((candidate, idx) => {
        try {
          const p = zPersona.parse(candidate);
          if (personaIds.has(p.patient_id)) {
            issues.push({ level: 'ERROR', file: f, message: `duplicate patient_id: ${p.patient_id}` });
          }
          personaIds.add(p.patient_id);
        } catch (e: any) {
          const suffix = personasToValidate.length > 1 ? `index ${idx}: ` : '';
          issues.push({ level: 'ERROR', file: f, message: `${suffix}${String(e)}` });
        }
      });
    } catch (e: any) {
      issues.push({ level: 'ERROR', file: f, message: String(e) });
    }
  }

  // 4) Scenarios and cross-references
  const scenarioFiles = listJsonFiles(PATHS.scenarios);
  const scenarioIds = new Set<string>();
  for (const f of scenarioFiles) {
    try {
      const obj = readJson(f);
      try {
        const sc = zClinicalScenario.parse(obj) as any;
        if (scenarioIds.has(sc.scenario_id)) {
          issues.push({ level: 'ERROR', file: f, message: `duplicate scenario_id: ${sc.scenario_id}` });
        }
        scenarioIds.add(sc.scenario_id);
        // Cross-check referenced ids
        const screeningIds = Array.isArray(sc.screening_challenge_ids) ? sc.screening_challenge_ids : [];
        for (const cid of screeningIds) {
          if (!challengeIds.has(cid))
            issues.push({ level: 'ERROR', file: f, message: `unknown screening_challenge_id: ${cid}` });
        }
        const specialIdsRef = Array.isArray(sc.special_question_ids) ? sc.special_question_ids : [];
        for (const sid of specialIdsRef) {
          if (!specialIds.has(sid))
            issues.push({ level: 'ERROR', file: f, message: `unknown special_question_id: ${sid}` });
        }
        // Objective catalog sanity: at least one output channel present
        const objectiveCatalog = Array.isArray(sc.objective_catalog) ? sc.objective_catalog : [];
        objectiveCatalog.forEach((o: any, idx: number) => {
          const scr = o?.patient_output_script || ({} as any);
          if (!scr.numeric && !scr.binary_flags && !scr.qualitative) {
            issues.push({
              level: 'WARN',
              file: f,
              message: `objective_catalog[${idx}] has empty patient_output_script`,
            });
          }
        });
      } catch (e: any) {
        issues.push({ level: 'ERROR', file: f, message: String(e) });
      }
    } catch (e: any) {
      issues.push({ level: 'ERROR', file: f, message: String(e) });
    }
  }

  // 5) Scenario bundles (v3 directories)
  const scenarioV3Dirs = listDirectories(PATHS.scenariosV3);
  for (const dirPath of scenarioV3Dirs) {
    const bundleName = path.basename(dirPath);
    const headerPath = path.join(dirPath, 'scenario.header.json');
    let header: any;
    try {
      header = readJson(headerPath);
    } catch (e: any) {
      issues.push({ level: 'ERROR', file: headerPath, message: String(e) });
      continue;
    }
    if (!header || typeof header !== 'object') {
      issues.push({ level: 'ERROR', file: headerPath, message: 'invalid or missing header json' });
      continue;
    }

    const linkage = header.linkage || {};
    const personaId =
      typeof linkage.persona_id === 'string' && linkage.persona_id.trim() ? linkage.persona_id.trim() : null;

    if (personaId && !personaIds.has(personaId)) {
      issues.push({ level: 'ERROR', file: headerPath, message: `persona_id not found: ${personaId}` });
    }

    const personaBundle = personaId ? scenarioPersonaBundles.get(personaId) : undefined;
    if (personaId && !personaBundle) {
      issues.push({ level: 'ERROR', file: headerPath, message: `scenario persona bundle missing: ${personaId}` });
    }

    const readOrDefault = (fileName: unknown, fallback: any) => {
      const relative = typeof fileName === 'string' && fileName.trim() ? fileName.trim() : '';
      if (!relative) return fallback;
      const full = path.join(dirPath, relative);
      if (!fs.existsSync(full)) return fallback;
      try {
        return readJson(full);
      } catch (e: any) {
        issues.push({ level: 'ERROR', file: full, message: String(e) });
        return fallback;
      }
    };

    const instructions = readOrDefault(linkage.instructions_file || 'instructions.json', {});
    const subjective = readOrDefault(linkage.soap_subjective_file || 'soap.subjective.json', {});
    const objective = readOrDefault(linkage.soap_objective_file || 'soap.objective.json', {});
    const assessment = readOrDefault(linkage.soap_assessment_file || 'soap.assessment.json', {});
    const plan = readOrDefault(linkage.soap_plan_file || 'soap.plan.json', {});

    const moduleRefsRaw = Array.isArray(linkage.active_context_modules) ? linkage.active_context_modules : [];
    const moduleRefs: ModuleReference[] = [];
    moduleRefsRaw.forEach((ref: unknown, idx: number) => {
      if (typeof ref === 'string') {
        issues.push({
          level: 'ERROR',
          file: headerPath,
          message: `active_context_modules[${idx}] uses deprecated string reference (${ref}). Expected object with module_id/version.`,
        });
        return;
      }
      if (!ref || typeof ref !== 'object') {
        issues.push({
          level: 'ERROR',
          file: headerPath,
          message: `active_context_modules[${idx}] is not a valid module reference`,
        });
        return;
      }

      const moduleId = typeof (ref as any).module_id === 'string' ? (ref as any).module_id.trim() : '';
      const version = typeof (ref as any).version === 'string' ? (ref as any).version.trim() : '';
      if (!moduleId) {
        issues.push({
          level: 'ERROR',
          file: headerPath,
          message: `active_context_modules[${idx}] missing module_id`,
        });
        return;
      }

      const moduleRef: ModuleReference = { module_id: moduleId, version: version || '' };
      moduleRefs.push(moduleRef);
      const resolved = resolveModule(moduleRef);
      if (!resolved) {
        issues.push({
          level: 'ERROR',
          file: headerPath,
          message: `active_context_modules[${idx}] failed to resolve module ${moduleId}${version ? `@${version}` : ''}`,
        });
      }
    });

    const contextModules = loadContextModules(moduleRefs);

    const scenario = convertScenarioBundle(
      bundleName,
      header,
      personaId,
      personaBundle?.persona ?? null,
      personaBundle?.raw ?? null,
      instructions,
      subjective,
      objective,
      assessment,
      plan,
      contextModules
    );

    if (!scenario) {
      issues.push({ level: 'ERROR', file: headerPath, message: 'failed to convert scenario bundle' });
      continue;
    }

    try {
      const parsed = zClinicalScenario.parse(scenario) as any;
      if (scenarioIds.has(parsed.scenario_id)) {
        issues.push({ level: 'ERROR', file: headerPath, message: `duplicate scenario_id: ${parsed.scenario_id}` });
      }
      scenarioIds.add(parsed.scenario_id);
    } catch (e: any) {
      issues.push({ level: 'ERROR', file: headerPath, message: String(e) });
    }
  }

  // Report
  const errors = issues.filter(i => i.level === 'ERROR');
  const warns = issues.filter(i => i.level === 'WARN');
  if (issues.length === 0) {
    console.log('[sps][validate] OK - no issues found');
  } else {
    for (const i of issues) {
      const rel = i.file.replace(process.cwd() + path.sep, '');
      console.log(`${i.level}\t${rel}\t${i.message}`);
    }
    console.log(`\n[sps][validate] Summary: ${errors.length} error(s), ${warns.length} warning(s)`);
  }

  if (errors.length > 0) process.exit(1);
}

main().catch(e => {
  console.error('[sps][validate][fatal]', e);
  process.exit(1);
});
