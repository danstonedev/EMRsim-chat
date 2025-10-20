import type { SPSRegistry } from '../../core/registry.ts';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Fix relative imports to include file extensions
import { spsRegistry } from '../../core/registry.js';
import type { ClinicalScenario, PatientPersona } from '../../core/types.js';
import { convertPersonaBundle } from './personas.js';
import { convertScenarioBundle } from './scenarios.js';
import { safeReadJson } from './fsUtils.js';
import { loadContextModules } from './moduleRegistry.js';

// Handle different environments safely
const getModulePaths = () => {
  try {
    // In test environment, this might fail
    const filename = fileURLToPath(import.meta.url);
    const dirname = path.dirname(filename);
    return { filename, dirname };
  } catch (err) {
    // Fallback for test environments
    console.warn('Failed to resolve module path, using relative paths', err);
    return {
      filename: '.',
      dirname: '.',
    };
  }
};

const { filename: __filename, dirname: __dirname } = getModulePaths();

// Define paths with more robust path resolution
const BASE_CONTENT_DIR = path.resolve(__dirname, '..', '..');
const SCENARIO_V3_ROOT = path.resolve(BASE_CONTENT_DIR, 'content', 'scenarios', 'bundles_src');
const SCENARIO_PERSONA_ROOT = path.resolve(BASE_CONTENT_DIR, 'content', 'personas', 'shared');

// Adjust loadJson to use resolved base path (no test-time skipping; tests rely on real content)
const loadJson = <T = any>(relativePath: string): T => {
  try {
    const fullPath = path.resolve(BASE_CONTENT_DIR, relativePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`File does not exist: ${fullPath}`);
      return {} as T;
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(content) as T;
  } catch (err) {
    console.error(`Failed to load JSON from: ${relativePath}`, err);
    return {} as T;
  }
};

// Load JSON files directly instead of using import assertions
const challenges = loadJson('content/banks/challenges/red_yellow.core.json');
const sqAnkle = loadJson('content/banks/special_questions/ankle_foot.json');
const sqKnee = loadJson('content/banks/special_questions/knee.json');
const sqCspine = loadJson('content/banks/special_questions/cspine.json');
const sqShoulder = loadJson('content/banks/special_questions/shoulder.json');
const sqSports = loadJson('content/banks/special_questions/sports_general.json');
const realtimePersonas = loadJson('content/personas/realtime/realtime_personas.json');

type ScenarioPersonaBundle = {
  raw: any;
  persona: PatientPersona;
};

function loadScenarioPersonasFromDisk(): Map<string, ScenarioPersonaBundle> {
  try {
    // Always read from disk; tests expect real content
    const personas = new Map<string, ScenarioPersonaBundle>();
    if (!fs.existsSync(SCENARIO_PERSONA_ROOT)) return personas;

    const entries = fs.readdirSync(SCENARIO_PERSONA_ROOT, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const filePath = path.join(SCENARIO_PERSONA_ROOT, entry.name);
      const personaRaw = safeReadJson(filePath);
      if (!personaRaw) continue;
      const persona = convertPersonaBundle(personaRaw, undefined, undefined, undefined);
      if (!persona) continue;
      personas.set(persona.patient_id, { raw: personaRaw, persona });
    }

    return personas;
  } catch (error) {
    console.error('Error loading scenario personas:', error);
    return new Map<string, ScenarioPersonaBundle>();
  }
}

function loadScenarioBundlesFromDisk(personaBundles: Map<string, ScenarioPersonaBundle>) {
  try {
    // Always read from disk; tests expect real content
    if (!fs.existsSync(SCENARIO_V3_ROOT)) {
      return [] as ClinicalScenario[];
    }

    const scenarios: ClinicalScenario[] = [];

    const entries = fs.readdirSync(SCENARIO_V3_ROOT, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirPath = path.join(SCENARIO_V3_ROOT, entry.name);
      const header = safeReadJson(path.join(dirPath, 'scenario.header.json'));
      if (!header) continue;

      const linkage = header.linkage || {};
      const personaId =
        typeof linkage.persona_id === 'string' && linkage.persona_id.trim() ? String(linkage.persona_id).trim() : null;
      const personaBundle = personaId ? personaBundles.get(personaId) : undefined;
      if (personaId && !personaBundle) {
        console.warn('[sps][load] persona not found for scenario', entry.name, personaId);
      }
      const instructions = safeReadJson(path.join(dirPath, linkage.instructions_file || 'instructions.json')) || {};
      const subjective = safeReadJson(path.join(dirPath, linkage.soap_subjective_file || 'soap.subjective.json')) || {};
      const objective = safeReadJson(path.join(dirPath, linkage.soap_objective_file || 'soap.objective.json')) || {};
      const assessment = safeReadJson(path.join(dirPath, linkage.soap_assessment_file || 'soap.assessment.json')) || {};
      const plan = safeReadJson(path.join(dirPath, linkage.soap_plan_file || 'soap.plan.json')) || {};

      const contextModules = loadContextModules(linkage.active_context_modules);

      const persona = personaBundle?.persona || null;
      const personaRaw = personaBundle?.raw || null;

      const scenario = convertScenarioBundle(
        entry.name,
        header,
        personaId,
        persona,
        personaRaw,
        instructions,
        subjective,
        objective,
        assessment,
        plan,
        contextModules
      );
      if (scenario) {
        scenarios.push(scenario);
      }
    }

    return scenarios;
  } catch (error) {
    console.error('Error loading scenario bundles:', error);
    return [] as ClinicalScenario[];
  }
}

export function loadSPSContent(): SPSRegistry {
  try {
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST;
    console.log('Loading SPS content...');
    console.log(`Environment: ${isTestEnv ? 'TEST' : 'NORMAL'}`);

    // Create a safely constructed array for special questions
    const allSpecialQuestions = [
      ...(Array.isArray(sqAnkle) ? sqAnkle : []),
      ...(Array.isArray(sqKnee) ? sqKnee : []),
      ...(Array.isArray(sqCspine) ? sqCspine : []),
      ...(Array.isArray(sqShoulder) ? sqShoulder : []),
      ...(Array.isArray(sqSports) ? sqSports : []),
    ];

    // Safely initialize registry. Ensure challenges is an array.
    const challengeItems = Array.isArray(challenges)
      ? challenges
      : Array.isArray((challenges as any)?.items)
        ? (challenges as any).items
        : [];
    const registry = spsRegistry.addChallenges(challengeItems).addSpecialQuestions(allSpecialQuestions);

    // Always attempt to load real data (both normal and test environments)
    if (Array.isArray(realtimePersonas) && realtimePersonas.length) {
      console.log(`Loading ${realtimePersonas.length} realtime personas`);
      registry.addPersonas(realtimePersonas);
    } else {
      console.warn('No realtime personas found or invalid format');
    }

    const scenarioPersonas = loadScenarioPersonasFromDisk();
    console.log(`Loaded ${scenarioPersonas.size} scenario personas from disk`);
    if (scenarioPersonas.size) {
      registry.addPersonas(Array.from(scenarioPersonas.values()).map(bundle => bundle.persona));
    }

    const scenarios = loadScenarioBundlesFromDisk(scenarioPersonas);
    console.log(`Loaded ${scenarios.length} scenarios from disk`);
    if (scenarios.length) registry.addScenarios(scenarios);

    return registry;
  } catch (error) {
    console.error('Error in loadSPSContent:', error);
    // For errors, still return current registry state to avoid crashes in non-critical paths
    return spsRegistry;
  }
}
