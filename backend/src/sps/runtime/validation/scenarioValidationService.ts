import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ContentManifest, DependencyManifest } from '../../utils/manifestGenerator.ts';
import { loadManifest, loadDependencyManifest } from '../../utils/manifestGenerator.ts';
import { formatChecksum, generateObjectChecksum } from '../../utils/checksum.ts';
import type {
  CompiledScenarioArtifact,
  CompiledScenarioIndex,
  CompiledScenarioIndexEntry,
} from '../../tools/compiledTypes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPS_ROOT = path.resolve(__dirname, '..', '..');
const CONTENT_ROOT = path.join(SPS_ROOT, 'content');
const MANIFEST_PATH = path.join(CONTENT_ROOT, 'manifest.json');
const DEPENDENCY_PATH = path.join(CONTENT_ROOT, 'dependencies.json');
const INDEX_PATH = path.join(CONTENT_ROOT, 'scenarios', 'compiled', 'index.json');

export type ValidationLevel = 'error' | 'warning';

export interface ValidationIssue {
  level: ValidationLevel;
  code: string;
  message: string;
  scenarioId?: string;
  details?: Record<string, unknown>;
}

export interface ValidationSummary {
  issues: ValidationIssue[];
  errors: number;
  warnings: number;
}

interface ScenarioValidationServiceOptions {
  contentRoot?: string;
  manifestPath?: string;
  dependencyManifestPath?: string;
  compiledIndexPath?: string;
}

export class ScenarioValidationService {
  private readonly contentRoot: string;
  private readonly manifestPath: string;
  private readonly dependencyPath: string;
  private readonly indexPath: string;

  private manifestCache: ContentManifest | null = null;
  private dependencyCache: DependencyManifest | null = null;
  private indexCache: CompiledScenarioIndex | null = null;

  constructor(options: ScenarioValidationServiceOptions = {}) {
    this.contentRoot = options.contentRoot ?? CONTENT_ROOT;
    this.manifestPath = options.manifestPath ?? MANIFEST_PATH;
    this.dependencyPath = options.dependencyManifestPath ?? DEPENDENCY_PATH;
    this.indexPath = options.compiledIndexPath ?? INDEX_PATH;
  }

  getScenarioIds(): string[] {
    const manifest = this.getManifest();
    return Object.keys(manifest.content.scenarios).sort();
  }

  getCompiledScenarioIds(): string[] {
    const index = this.getCompiledIndex();
    return Object.keys(index.scenarios).sort();
  }

  validateScenarioDefinition(scenarioId: string): ValidationSummary {
    const issues: ValidationIssue[] = [];

    const manifest = this.getManifest();
    const dependencies = this.getDependencies();

    const manifestEntry = manifest.content.scenarios[scenarioId];
    const dependencyEntry = dependencies.scenarios[scenarioId] ?? null;

    if (!manifestEntry) {
      issues.push(
        this.issue(
          'error',
          'SCENARIO_MANIFEST_MISSING',
          `Scenario ${scenarioId} is not present in manifest.json`,
          scenarioId
        )
      );
    }

    if (!dependencyEntry) {
      issues.push(
        this.issue(
          'error',
          'SCENARIO_DEPENDENCY_MISSING',
          `Scenario ${scenarioId} is not present in dependencies.json`,
          scenarioId
        )
      );
    }

    const scenarioDir = this.scenarioSourceDir(scenarioId);
    if (!fs.existsSync(scenarioDir)) {
      issues.push(
        this.issue(
          'error',
          'SCENARIO_SOURCE_DIR_MISSING',
          `Scenario source directory not found for ${scenarioId}`,
          scenarioId,
          {
            path: scenarioDir,
          }
        )
      );
      return this.toSummary(issues);
    }

    const headerPath = path.join(scenarioDir, 'scenario.header.json');
    if (!fs.existsSync(headerPath)) {
      issues.push(
        this.issue(
          'error',
          'SCENARIO_HEADER_MISSING',
          `scenario.header.json missing for scenario ${scenarioId}`,
          scenarioId
        )
      );
      return this.toSummary(issues);
    }

    const { data: header, error: headerError } = this.readJson(headerPath);
    if (!header) {
      issues.push(
        this.issue(
          'error',
          'SCENARIO_HEADER_INVALID',
          `Failed to parse scenario.header.json for ${scenarioId}: ${headerError?.message ?? 'unknown error'}`,
          scenarioId
        )
      );
      return this.toSummary(issues);
    }

    if (
      typeof header.scenario_id === 'string' &&
      header.scenario_id.trim() &&
      header.scenario_id.trim() !== scenarioId
    ) {
      issues.push(
        this.issue(
          'warning',
          'SCENARIO_HEADER_ID_MISMATCH',
          `Scenario header scenario_id ${header.scenario_id} does not match directory name ${scenarioId}`,
          scenarioId,
          {
            headerScenarioId: header.scenario_id,
          }
        )
      );
    }

    const linkage = typeof header.linkage === 'object' && header.linkage ? header.linkage : {};
    const personaId =
      typeof linkage.persona_id === 'string' && linkage.persona_id.trim() ? linkage.persona_id.trim() : null;

    if (personaId) {
      const personaEntry = manifest.content.personas[personaId];
      if (!personaEntry) {
        issues.push(
          this.issue(
            'error',
            'PERSONA_MISSING_FROM_MANIFEST',
            `Persona ${personaId} referenced by ${scenarioId} is not present in manifest`,
            scenarioId,
            { personaId }
          )
        );
      }

      if (dependencyEntry?.persona?.id !== personaId) {
        issues.push(
          this.issue(
            'error',
            'PERSONA_DEPENDENCY_MISMATCH',
            `Dependency manifest persona for ${scenarioId} does not match linkage.persona_id`,
            scenarioId,
            {
              dependencyPersonaId: dependencyEntry?.persona?.id ?? null,
              linkagePersonaId: personaId,
            }
          )
        );
      }

      if (
        personaEntry &&
        dependencyEntry?.persona?.checksum &&
        personaEntry.checksum !== dependencyEntry.persona.checksum
      ) {
        issues.push(
          this.issue(
            'warning',
            'PERSONA_CHECKSUM_MISMATCH',
            `Persona checksum mismatch between manifest and dependency manifest for ${personaId}`,
            scenarioId,
            {
              manifestChecksum: personaEntry.checksum,
              dependencyChecksum: dependencyEntry.persona.checksum,
            }
          )
        );
      }
    } else if (manifestEntry?.persona_id) {
      issues.push(
        this.issue(
          'warning',
          'PERSONA_EXPECTED',
          `Manifest lists persona ${manifestEntry.persona_id} but header linkage.persona_id is missing`,
          scenarioId,
          {
            manifestPersonaId: manifestEntry.persona_id,
          }
        )
      );
    }

    const moduleRefs: Array<{ module_id: string; version: string }> = [];
    if (Array.isArray(linkage.active_context_modules)) {
      for (const rawEntry of linkage.active_context_modules) {
        const moduleId = typeof rawEntry?.module_id === 'string' ? rawEntry.module_id.trim() : '';
        if (!moduleId) continue;
        const version = typeof rawEntry?.version === 'string' ? rawEntry.version.trim() : '';
        moduleRefs.push({ module_id: moduleId, version });
      }
    }

    const manifestModuleRefs = Array.isArray(manifestEntry?.modules) ? manifestEntry.modules : [];
    const dependencyModules = dependencyEntry?.modules ?? [];

    for (const ref of moduleRefs) {
      const moduleCollection = manifest.content.modules[ref.module_id];
      if (!moduleCollection) {
        issues.push(
          this.issue(
            'error',
            'MODULE_MISSING_FROM_MANIFEST',
            `Module ${ref.module_id} referenced by ${scenarioId} is not present in manifest`,
            scenarioId,
            {
              moduleId: ref.module_id,
              requestedVersion: ref.version || null,
            }
          )
        );
        continue;
      }

      if (ref.version && !moduleCollection[ref.version]) {
        issues.push(
          this.issue(
            'error',
            'MODULE_VERSION_MISSING',
            `Module ${ref.module_id} version ${ref.version} referenced by ${scenarioId} is not present in manifest`,
            scenarioId,
            {
              moduleId: ref.module_id,
              requestedVersion: ref.version,
              availableVersions: Object.keys(moduleCollection),
            }
          )
        );
      }

      const dependencyMatch = dependencyModules.find(
        entry => entry.module_id === ref.module_id && (!ref.version || entry.version === ref.version)
      );
      if (!dependencyMatch) {
        issues.push(
          this.issue(
            'warning',
            'MODULE_DEPENDENCY_MISSING',
            `Dependency manifest missing module ${ref.module_id}${ref.version ? `@${ref.version}` : ''} for scenario ${scenarioId}`,
            scenarioId,
            {
              moduleId: ref.module_id,
              version: ref.version || null,
            }
          )
        );
      }
    }

    if (!moduleRefs.length && manifestModuleRefs.length > 0) {
      issues.push(
        this.issue(
          'warning',
          'MODULE_LINKAGE_MISSING',
          `Manifest lists ${manifestModuleRefs.length} module(s) for ${scenarioId} but linkage.active_context_modules is empty`,
          scenarioId
        )
      );
    }

    if (manifestModuleRefs.length) {
      const moduleSet = new Set(moduleRefs.map(ref => `${ref.module_id}@${ref.version || ''}`));
      for (const manifestModule of manifestModuleRefs) {
        const key = `${manifestModule.module_id}@${manifestModule.version ?? ''}`;
        if (!moduleSet.has(key)) {
          issues.push(
            this.issue(
              'warning',
              'MODULE_LINKAGE_INCOMPLETE',
              `Manifest module ${manifestModule.module_id}@${manifestModule.version ?? 'latest'} is not present in linkage.active_context_modules`,
              scenarioId,
              {
                moduleId: manifestModule.module_id,
                version: manifestModule.version ?? null,
              }
            )
          );
        }
      }
    }

    return this.toSummary(issues);
  }

  validateScenarioBundle(scenarioId: string): ValidationSummary {
    const issues: ValidationIssue[] = [];

    const manifest = this.getManifest();
    const dependencies = this.getDependencies();

    const manifestEntry = manifest.content.scenarios[scenarioId];
    const dependencyEntry = dependencies.scenarios[scenarioId] ?? null;
    const index = this.tryGetCompiledIndex();

    if (!manifestEntry) {
      issues.push(
        this.issue(
          'error',
          'SCENARIO_MANIFEST_MISSING',
          `Scenario ${scenarioId} is not present in manifest.json`,
          scenarioId
        )
      );
    }

    if (!dependencyEntry) {
      issues.push(
        this.issue(
          'error',
          'SCENARIO_DEPENDENCY_MISSING',
          `Scenario ${scenarioId} is not present in dependencies.json`,
          scenarioId
        )
      );
    }

    const indexEntry = index?.scenarios?.[scenarioId] ?? null;
    if (!indexEntry) {
      issues.push(
        this.issue(
          'error',
          'SCENARIO_INDEX_MISSING',
          `Scenario ${scenarioId} is not present in compiled index`,
          scenarioId
        )
      );
      return this.toSummary(issues);
    }

    const compiledPath = this.scenarioCompiledPath(indexEntry, scenarioId);
    if (!fs.existsSync(compiledPath)) {
      issues.push(
        this.issue(
          'error',
          'SCENARIO_COMPILED_FILE_MISSING',
          `Compiled scenario file missing at ${compiledPath}`,
          scenarioId
        )
      );
      return this.toSummary(issues);
    }

    const { data: artifact, error: artifactError } = this.readJson(compiledPath);
    if (!artifact) {
      issues.push(
        this.issue(
          'error',
          'SCENARIO_COMPILED_FILE_INVALID',
          `Failed to parse compiled scenario file for ${scenarioId}: ${artifactError?.message ?? 'unknown error'}`,
          scenarioId
        )
      );
      return this.toSummary(issues);
    }

    const compiled = artifact as CompiledScenarioArtifact;

    if (compiled.scenario_id !== scenarioId) {
      issues.push(
        this.issue(
          'error',
          'SCENARIO_ID_MISMATCH',
          `Compiled scenario_id ${compiled.scenario_id} does not match expected ${scenarioId}`,
          scenarioId,
          {
            compiledScenarioId: compiled.scenario_id,
          }
        )
      );
    }

    const computedChecksum = formatChecksum(generateObjectChecksum(compiled));
    if (computedChecksum !== indexEntry.checksum) {
      issues.push(
        this.issue(
          'error',
          'COMPILED_CHECKSUM_MISMATCH',
          `Compiled scenario checksum does not match index entry for ${scenarioId}`,
          scenarioId,
          {
            indexChecksum: indexEntry.checksum,
            computedChecksum,
          }
        )
      );
    }

    if (manifestEntry) {
      if (compiled.manifest_checksum !== manifestEntry.checksum) {
        issues.push(
          this.issue(
            'error',
            'MANIFEST_CHECKSUM_MISMATCH',
            `Compiled manifest checksum for ${scenarioId} does not match manifest entry`,
            scenarioId,
            {
              compiledChecksum: compiled.manifest_checksum,
              manifestChecksum: manifestEntry.checksum,
            }
          )
        );
      }

      if (
        compiled.content_version &&
        manifestEntry.content_version &&
        compiled.content_version !== manifestEntry.content_version
      ) {
        issues.push(
          this.issue(
            'warning',
            'CONTENT_VERSION_MISMATCH',
            `Compiled content version ${compiled.content_version} differs from manifest version ${manifestEntry.content_version} for ${scenarioId}`,
            scenarioId,
            {
              compiledContentVersion: compiled.content_version,
              manifestContentVersion: manifestEntry.content_version,
            }
          )
        );
      }

      if (manifestEntry.persona_id && (!compiled.persona || compiled.persona.id !== manifestEntry.persona_id)) {
        issues.push(
          this.issue(
            'error',
            'PERSONA_COMPILED_MISMATCH',
            `Compiled persona does not match manifest persona ${manifestEntry.persona_id}`,
            scenarioId,
            {
              manifestPersonaId: manifestEntry.persona_id,
              compiledPersonaId: compiled.persona?.id ?? null,
            }
          )
        );
      }
    }

    if (dependencyEntry) {
      const expectedDependencyChecksum = formatChecksum(generateObjectChecksum(dependencyEntry));
      if (compiled.dependencies_checksum !== expectedDependencyChecksum) {
        issues.push(
          this.issue(
            'error',
            'DEPENDENCY_CHECKSUM_MISMATCH',
            `Compiled dependencies checksum does not match dependencies manifest for ${scenarioId}`,
            scenarioId,
            {
              compiledChecksum: compiled.dependencies_checksum,
              expectedChecksum: expectedDependencyChecksum,
            }
          )
        );
      }

      if (
        compiled.persona &&
        dependencyEntry.persona?.checksum &&
        compiled.persona.checksum !== dependencyEntry.persona.checksum
      ) {
        issues.push(
          this.issue(
            'warning',
            'PERSONA_DEPENDENCY_CHECKSUM_MISMATCH',
            `Compiled persona checksum does not match dependency manifest for ${scenarioId}`,
            scenarioId,
            {
              compiledChecksum: compiled.persona.checksum,
              dependencyChecksum: dependencyEntry.persona.checksum,
            }
          )
        );
      }

      const dependencyModuleChecksums = new Map<string, string>();
      dependencyEntry.modules.forEach(moduleEntry => {
        dependencyModuleChecksums.set(`${moduleEntry.module_id}@${moduleEntry.version}`, moduleEntry.checksum ?? '');
      });

      for (const moduleArtifact of compiled.modules) {
        const key = `${moduleArtifact.module_id}@${moduleArtifact.version}`;
        if (!dependencyModuleChecksums.has(key)) {
          issues.push(
            this.issue(
              'warning',
              'MODULE_DEPENDENCY_MISSING',
              `Compiled module ${key} is not listed in dependency manifest for ${scenarioId}`,
              scenarioId,
              {
                moduleId: moduleArtifact.module_id,
                version: moduleArtifact.version,
              }
            )
          );
          continue;
        }

        const expectedModuleChecksum = dependencyModuleChecksums.get(key)!;
        if (expectedModuleChecksum && expectedModuleChecksum !== moduleArtifact.checksum) {
          issues.push(
            this.issue(
              'warning',
              'MODULE_DEPENDENCY_CHECKSUM_MISMATCH',
              `Checksum mismatch for module ${key} between compiled artifact and dependency manifest`,
              scenarioId,
              {
                expectedChecksum: expectedModuleChecksum,
                compiledChecksum: moduleArtifact.checksum,
              }
            )
          );
        }
      }
    }

    if (compiled.persona && indexEntry.persona_id) {
      if (compiled.persona.id !== indexEntry.persona_id) {
        issues.push(
          this.issue(
            'error',
            'PERSONA_INDEX_MISMATCH',
            `Compiled persona ${compiled.persona.id} does not match index persona ${indexEntry.persona_id}`,
            scenarioId,
            {
              compiledPersonaId: compiled.persona.id,
              indexPersonaId: indexEntry.persona_id,
            }
          )
        );
      }

      if (compiled.persona.checksum !== indexEntry.persona_checksum) {
        issues.push(
          this.issue(
            'warning',
            'PERSONA_INDEX_CHECKSUM_MISMATCH',
            `Persona checksum mismatch between compiled artifact and index entry for ${scenarioId}`,
            scenarioId,
            {
              compiledChecksum: compiled.persona.checksum,
              indexChecksum: indexEntry.persona_checksum,
            }
          )
        );
      }
    }

    if (!compiled.persona && indexEntry.persona_id) {
      issues.push(
        this.issue(
          'warning',
          'PERSONA_INDEX_EXPECTED',
          `Compiled scenario lacks persona but index lists ${indexEntry.persona_id}`,
          scenarioId,
          {
            indexPersonaId: indexEntry.persona_id,
          }
        )
      );
    }

    if (compiled.persona && !indexEntry.persona_id) {
      issues.push(
        this.issue(
          'warning',
          'PERSONA_INDEX_MISSING',
          `Compiled scenario includes persona ${compiled.persona.id} but index omits persona reference`,
          scenarioId
        )
      );
    }

  // Coverage validation: ensure Subjective and Objective basics are present for novice-friendly differential
    try {
      const sc = compiled.scenario as any;
      // Subjective coverage
      const subj: any[] = Array.isArray(sc?.subjective_catalog) ? sc.subjective_catalog : [];
      const subjBuckets = new Map<string, number>();
      const categorizeSubjective = (item: any): string => {
        const id = String(item?.id || '').toLowerCase();
        const name = String(item?.label || '').toLowerCase();
        const text = `${id} ${name}`;
        if (
          /pain|hpi|history|onset|duration|aggravator|easer|24h|pattern|location|behavior|severity|opqrst/i.test(text)
        ) {
          return 'Pain/HPI';
        }
        if (/red *flag|night pain|weight loss|fever|cancer|cauda|saddle|incontinence/i.test(text)) {
          return 'Red flags';
        }
        if (/sdoh|work|job|role|caregiv|adl|sleep|stress|transport|home|environment/i.test(text)) {
          return 'Function & SDOH';
        }
        if (/med|medication|drug|allerg|pmh|psh|surgery|comorb|condition/i.test(text)) {
          return 'PMH/PSH/Medications/Allergies';
        }
        if (/systems? review|ros|cardio|pulmo|neuro|gi|gu|endo|psych|derm/i.test(text)) {
          return 'Systems review';
        }
        if (/imaging|x[- ]?ray|mri|ct|ultra|prior (tx|treatment)|previous (care|therapy)/i.test(text)) {
          return 'Prior imaging/treatment';
        }
        if (/goal/i.test(text)) {
          return 'Goals';
        }
        return 'Other subjective';
      };
      subj.forEach(item => {
        const cat = categorizeSubjective(item);
        subjBuckets.set(cat, (subjBuckets.get(cat) || 0) + 1);
      });
      const requiredSubj = [
        'Pain/HPI',
        'Red flags',
        'Function & SDOH',
        'PMH/PSH/Medications/Allergies',
        'Systems review',
        'Goals',
      ];
      for (const bucket of requiredSubj) {
        if (!subjBuckets.get(bucket)) {
          issues.push(
            this.issue(
              'warning',
              'S_SUBJECTIVE_COVERAGE_MISSING',
              `Subjective coverage missing for ${bucket}`,
              scenarioId,
              { bucket }
            )
          );
        }
      }

  // Objective coverage
      const obj: any[] = Array.isArray(sc?.objective_catalog) ? sc.objective_catalog : [];
      const objBuckets = new Map<string, number>();
      const categorizeObjective = (o: any): string => {
        const id = String(o?.test_id || '').toLowerCase();
        const name = String(o?.label || '').toLowerCase();
        const text = `${id} ${name}`;
        if (/neuro|myotome|dermatome|reflex|sensation|hoffmann|babinski|slump|slr|ulsnt|neural/i.test(text))
          return 'Neurological';
        if (
          /\brom\b|range of motion|flexion|extension|abduction|adduction|rotation|pronation|supination|dorsiflex|plantarflex/i.test(
            text
          )
        )
          return 'Range of motion';
        if (/strength|mmt|resisted|isometric|dynamometer|grip/i.test(text)) return 'Strength';
        if (/joint mobility|accessory|glide|posterior[- ]?anterior|pa spring|arthrokinematic/i.test(text))
          return 'Joint mobility';
        if (/palpation|ttp|tenderness|edema|swelling|effusion|ecchymosis|observation|posture|inspection/i.test(text))
          return 'Observation & palpation';
        if (/balance|y[- ]?balance|single[- ]leg balance|romberg/i.test(text)) return 'Balance';
        if (
          /functional|sit[- ]?to[- ]?stand|squat|step[- ]?down|lunge|hop|jump|gait|stairs|reach|lift|carry/i.test(text)
        )
          return 'Functional movement';
        if (
          /lachman|mcmurray|valgus|varus|thompson|hawkins|kennedy|neer|empty\s?can|drop\s?arm|apprehension|relocation|spurling|faber|faddir|ober|thomas|patellar|drawer|pivot|squeeze|talar|windlass|sulcus/i.test(
            text
          ) ||
          /\btest\b/.test(text)
        )
          return 'Special tests';
        return 'Other';
      };
      obj.forEach(o => {
        const cat = categorizeObjective(o);
        objBuckets.set(cat, (objBuckets.get(cat) || 0) + 1);
      });
      const requiredObj = [
        'Observation & palpation',
        'Functional movement',
        'Range of motion',
        'Strength',
        'Special tests',
      ];
      for (const bucket of requiredObj) {
        if (!objBuckets.get(bucket)) {
          issues.push(
            this.issue(
              'warning',
              'O_OBJECTIVE_COVERAGE_MISSING',
              `Objective coverage missing for ${bucket}`,
              scenarioId,
              { bucket }
            )
          );
        }
      }
      // Neurological required for spine regions
      const region = String(sc?.region || '').toLowerCase();
      if (/(cervical|thoracic|lumbar)_spine/.test(region) && !objBuckets.get('Neurological')) {
        issues.push(
          this.issue(
            'warning',
            'O_OBJECTIVE_NEURO_MISSING',
            'Objective neurological screen missing for spine scenario',
            scenarioId,
            { region }
          )
        );
      }

      // Region-specific must-haves (starter rules)
      const objText = obj.map(o => `${String(o?.test_id || '')} ${String(o?.label || '')}`.toLowerCase());
      const has = (re: RegExp) => objText.some(t => re.test(t));
      const requireAll = (rules: Array<{ code: string; message: string; tests: RegExp[] }>) => {
        for (const rule of rules) {
          const ok = rule.tests.every(rx => has(rx));
          if (!ok) {
            issues.push(this.issue('warning', rule.code, rule.message, scenarioId, { region }));
          }
        }
      };

      // Knee must-haves
      if (/^knee$/.test(region)) {
        requireAll([
          {
            code: 'O_KNEE_ROM_BASIC_MISSING',
            message: 'Knee ROM basics missing (flexion and extension)',
            tests: [/rom|range of motion|flexion/i, /rom|range of motion|extension/i],
          },
          {
            code: 'O_KNEE_STRENGTH_BASIC_MISSING',
            message: 'Knee MMT basics missing (quadriceps and hamstrings)',
            tests: [/strength|mmt|quad/i, /strength|mmt|ham/i],
          },
          {
            code: 'O_KNEE_PALPATION_BASIC_MISSING',
            message: 'Knee palpation basics missing (joint line or effusion)',
            tests: [/palpation|joint\s*line/i, /effusion|swelling/i],
          },
          {
            code: 'O_KNEE_FUNCTIONAL_BASIC_MISSING',
            message: 'Knee functional movement missing (squat or step-down)',
            tests: [/squat|sit\s*-?to\s*-?stand/i, /step\s*-?down/i],
          },
          {
            code: 'O_KNEE_LIGAMENT_TESTS_MISSING',
            message: 'Knee ligament special tests missing (Lachman/anterior drawer and valgus/varus)',
            tests: [/lachman|anterior\s*drawer|pivot/i, /valgus/i, /varus/i],
          },
          {
            code: 'O_KNEE_MENISCAL_TEST_MISSING',
            message: 'Knee meniscal test missing (McMurray)',
            tests: [/mcmurray/i],
          },
        ]);
      }

      // Shoulder must-haves
      if (/^shoulder$/.test(region)) {
        requireAll([
          {
            code: 'O_SHOULDER_ROM_BASIC_MISSING',
            message: 'Shoulder ROM basics missing (flexion and abduction)',
            tests: [/rom|range of motion|flexion/i, /rom|range of motion|abduction/i],
          },
          {
            code: 'O_SHOULDER_STRENGTH_ABD_MISSING',
            message: 'Shoulder strength basics missing (abduction/supraspinatus)',
            tests: [/strength|mmt|abduction|supraspinatus/i],
          },
          {
            code: 'O_SHOULDER_IMPINGEMENT_TESTS_MISSING',
            message: 'Shoulder impingement tests missing (Hawkins-Kennedy or Neer)',
            tests: [/hawkins|kennedy/i],
          },
          {
            code: 'O_SHOULDER_RTC_TESTS_MISSING',
            message: 'Shoulder RTC tests missing (Empty Can)',
            tests: [/empty\s*can/i],
          },
          {
            code: 'O_SHOULDER_INSTABILITY_TESTS_MISSING',
            message: 'Shoulder instability tests missing (Apprehension/Relocation)',
            tests: [/apprehension|relocation/i],
          },
        ]);
      }

      // Ankle/Foot must-haves
      if (/^(ankle|foot|ankle_foot)$/.test(region)) {
        requireAll([
          {
            code: 'O_ANKLE_ROM_BASIC_MISSING',
            message: 'Ankle/Foot ROM basics missing (dorsiflexion and plantarflexion)',
            tests: [
              /\b(rom|range of motion)\b|dorsi|dorsiflex|\bdf\b/i,
              /\b(rom|range of motion)\b|plantar|plantarflex|\bpf\b/i,
            ],
          },
          {
            code: 'O_ANKLE_STRENGTH_KEY_MMTS_MISSING',
            message: 'Ankle/Foot strength basics missing (tibialis ant/post, peroneals, gastroc/soleus)',
            tests: [
              /strength|mmt.*(tibialis|tib\.?\s*ant|tib\.?\s*post)/i,
              /(peroneal|fibularis)/i,
              /(gastroc|soleus|calf)/i,
            ],
          },
          {
            code: 'O_ANKLE_PALPATION_STRUCTURES_MISSING',
            message: 'Ankle/Foot palpation structures missing (ATFL/CFL/PTFL and navicular/base of 5th)',
            tests: [
              /(atfl|anterior\s*talo\s*-?fibular)/i,
              /(cfl|calcaneo\s*-?fibular)/i,
              /(ptfl|posterior\s*talo\s*-?fibular)/i,
              /(navicular|base\s*(of\s*)?5(th)?)/i,
            ],
          },
          {
            code: 'O_ANKLE_FUNCTIONAL_TESTS_MISSING',
            message: 'Ankle/Foot functional tests missing (single-leg balance and heel raise)',
            tests: [/(single\s*-?leg\s*balance|\bsls\b)/i, /(heel\s*-?raise|calf\s*-?raise)/i],
          },
          {
            code: 'O_ANKLE_SPECIAL_TESTS_MISSING',
            message: 'Ankle/Foot special tests missing (Anterior Drawer, Talar Tilt, Thompson)',
            tests: [/(anterior\s*drawer)/i, /(talar\s*tilt)/i, /(thompson)/i],
          },
        ]);
      }

      // Spine must-haves (cervical/lumbar specifics)
      if (/(cervical|lumbar)_spine/.test(region)) {
        // ROM: require flexion, extension, rotation, and side-bend present
        requireAll([
          {
            code: 'O_SPINE_ROM_PLANES_MISSING',
            message: 'Spine ROM planes missing (flexion, extension, rotation, side-bend)',
            tests: [/flexion/i, /extension/i, /(rotation|rotate|rot)/i, /(side\s*-?bend|lateral\s*flexion)/i],
          },
        ]);

        // Neuro screen details (beyond generic Neurological bucket)
        requireAll([
          {
            code: 'O_SPINE_NEURO_DETAILS_MISSING',
            message: 'Spine neuro screen details missing (myotomes, dermatomes/sensation, and reflexes)',
            tests: [/(myotome|motor)/i, /(dermatome|sensation)/i, /(reflex|dtr)/i],
          },
        ]);

        // Neural tension tests by region
        if (/lumbar_spine/.test(region)) {
          requireAll([
            {
              code: 'O_LUMBAR_NEURAL_TENSION_MISSING',
              message: 'Lumbar neural tension tests missing (SLR and Prone Knee Bend)',
              tests: [/(slr|straight\s*leg\s*raise)/i, /(prone\s*knee\s*bend|pkb)/i],
            },
          ]);
        }
        if (/cervical_spine/.test(region)) {
          requireAll([
            {
              code: 'O_CERVICAL_NEURAL_TENSION_MISSING',
              message: 'Cervical neural tension tests missing (ULTT)',
              tests: [/(ultt|upper\s*limb\s*tension\s*test|ulsnt)/i],
            },
          ]);
        }

        // Centralization/peripheralization noted (in objective or assessment)
        const assessmentText = JSON.stringify((sc?.soap as any)?.assessment || {}).toLowerCase();
        if (!has(/centralization|peripheralization/)) {
          const inAssessment = /centralization|peripheralization/.test(assessmentText);
          if (!inAssessment) {
            issues.push(
              this.issue(
                'warning',
                'O_SPINE_CENTRALIZATION_NOTE_MISSING',
                'Centralization/peripheralization response not documented for spine scenario',
                scenarioId,
                { region }
              )
            );
          }
        }

        // Emphasize red flags coverage for spine
        if (!subjBuckets.get('Red flags')) {
          issues.push(
            this.issue(
              'warning',
              'S_SPINE_REDFLAGS_MISSING',
              'Red flags screening not documented under Subjective for spine scenario',
              scenarioId,
              { region }
            )
          );
        }
      }
    } catch {}

    return this.toSummary(issues);
  }

  validateCompiledAssets(scenarioFilter?: Set<string> | null): ValidationSummary {
    const issues: ValidationIssue[] = [];

    const manifest = this.getManifest();
    const index = this.tryGetCompiledIndex();

    if (!index) {
      issues.push(
        this.issue('error', 'COMPILED_INDEX_MISSING', `Compiled scenarios index not found at ${this.indexPath}`)
      );
      return this.toSummary(issues);
    }

    const manifestScenarioIds = new Set(Object.keys(manifest.content.scenarios));
    const indexScenarioIds = new Set(Object.keys(index.scenarios));

    const targets =
      scenarioFilter && scenarioFilter.size
        ? Array.from(scenarioFilter)
        : Array.from(new Set([...manifestScenarioIds, ...indexScenarioIds]));

    for (const scenarioId of targets) {
      if (!manifestScenarioIds.has(scenarioId)) {
        issues.push(
          this.issue(
            'warning',
            'SCENARIO_ORPHANED_IN_INDEX',
            `Scenario ${scenarioId} is present in compiled index but missing from manifest`,
            scenarioId
          )
        );
      }
      if (!indexScenarioIds.has(scenarioId)) {
        issues.push(
          this.issue(
            'error',
            'SCENARIO_MISSING_FROM_INDEX',
            `Scenario ${scenarioId} is missing from compiled index`,
            scenarioId
          )
        );
      }
    }

    if (!scenarioFilter || scenarioFilter.size === 0) {
      const compiledDir = path.dirname(this.indexPath);
      if (fs.existsSync(compiledDir)) {
        const entries = fs.readdirSync(compiledDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name === 'index.json') {
            continue;
          }
          const scenarioIdFromFile = entry.name.replace(/\.json$/i, '');
          if (!indexScenarioIds.has(scenarioIdFromFile)) {
            issues.push(
              this.issue(
                'warning',
                'SCENARIO_COMPILED_FILE_ORPHANED',
                `Compiled file ${entry.name} is not referenced in index.json`,
                scenarioIdFromFile
              )
            );
          }
        }
      }
    }

    return this.toSummary(issues);
  }

  private getManifest(): ContentManifest {
    if (!this.manifestCache) {
      this.manifestCache = loadManifest(this.manifestPath);
    }
    return this.manifestCache;
  }

  private getDependencies(): DependencyManifest {
    if (!this.dependencyCache) {
      this.dependencyCache = loadDependencyManifest(this.dependencyPath);
    }
    return this.dependencyCache;
  }

  private getCompiledIndex(): CompiledScenarioIndex {
    if (!this.indexCache) {
      if (!fs.existsSync(this.indexPath)) {
        throw new Error(`Compiled index not found at ${this.indexPath}`);
      }
      const raw = fs.readFileSync(this.indexPath, 'utf8');
      this.indexCache = JSON.parse(raw) as CompiledScenarioIndex;
    }
    return this.indexCache;
  }

  private tryGetCompiledIndex(): CompiledScenarioIndex | null {
    try {
      return this.getCompiledIndex();
    } catch {
      return null;
    }
  }

  private toSummary(issues: ValidationIssue[]): ValidationSummary {
    const errors = issues.filter(issue => issue.level === 'error').length;
    const warnings = issues.filter(issue => issue.level === 'warning').length;
    return { issues, errors, warnings };
  }

  private readJson(filePath: string): { data: any | null; error?: Error } {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return { data: JSON.parse(raw) };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  private resolveContentPath(relativePath: string): string {
    return path.join(this.contentRoot, relativePath);
  }

  private scenarioSourceDir(scenarioId: string): string {
    return path.join(this.contentRoot, 'scenarios', 'bundles_src', scenarioId);
  }

  private scenarioCompiledPath(entry: CompiledScenarioIndexEntry | null, scenarioId: string): string {
    if (entry?.file) {
      return this.resolveContentPath(entry.file);
    }
    return path.join(this.contentRoot, 'scenarios', 'compiled', `${scenarioId}.json`);
  }

  private issue(
    level: ValidationLevel,
    code: string,
    message: string,
    scenarioId?: string,
    details?: Record<string, unknown>
  ): ValidationIssue {
    return { level, code, message, scenarioId, details };
  }
}
