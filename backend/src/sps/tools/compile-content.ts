#!/usr/bin/env tsx
/// <reference types="node" />

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  generateContentArtifacts,
  saveCatalogAnalysis,
  saveDependencyManifest,
  saveManifest,
  loadManifest,
  loadDependencyManifest,
  loadCatalogAnalysis,
  type ContentManifest,
  type DependencyManifest,
  type CatalogAnalysisReport,
} from '../utils/manifestGenerator.ts';
import type {
  CompiledModuleArtifact,
  CompiledPersonaArtifact,
  CompiledScenarioArtifact,
  CompiledScenarioIndex,
  CompiledScenarioIndexEntry,
} from './compiledTypes.ts';
import type { PatientPersona } from '../core/types.ts';
import { formatChecksum, generateObjectChecksum } from '../utils/checksum.ts';
import { convertPersonaBundle } from '../runtime/content/personas.ts';
import { convertScenarioBundle } from '../runtime/content/scenarios.ts';

interface CLIOptions {
  scenarioFilter: Set<string> | null;
  skipManifests: boolean;
}

interface PersonaBundle {
  source: string;
  raw: any;
  persona: PatientPersona;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SPS_ROOT = path.resolve(__dirname, '..');
const CONTENT_ROOT = path.resolve(SPS_ROOT, 'content');
const SCENARIO_SOURCE_ROOT = path.join(CONTENT_ROOT, 'scenarios', 'bundles_src');
const SCENARIO_COMPILED_ROOT = path.join(CONTENT_ROOT, 'scenarios', 'compiled');
const MANIFEST_PATH = path.join(CONTENT_ROOT, 'manifest.json');
const DEPENDENCIES_PATH = path.join(CONTENT_ROOT, 'dependencies.json');
const CATALOG_REPORT_PATH = path.join(CONTENT_ROOT, 'catalogs', 'report.json');
const INDEX_PATH = path.join(SCENARIO_COMPILED_ROOT, 'index.json');

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const scenarioIds: string[] = [];
  let skipManifests = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--scenario=')) {
      const value = arg.substring('--scenario='.length).trim();
      if (value) scenarioIds.push(value);
    } else if (arg === '--scenario' || arg === '-s') {
      const value = args[i + 1];
      if (!value) {
        throw new Error('Missing value for --scenario flag');
      }
      scenarioIds.push(value.trim());
      i++;
    } else if (arg === '--skip-manifests') {
      skipManifests = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      console.warn(`[compile] Unknown flag ignored: ${arg}`);
    }
  }

  const scenarioFilter = scenarioIds.length ? new Set(scenarioIds) : null;
  return { scenarioFilter, skipManifests };
}

function printUsage(): void {
  console.log(`SPS Content Compiler\n\n` +
    `Usage: npx tsx src/sps/tools/compile-content.ts [options]\n\n` +
    `Options:\n` +
    `  --scenario <id>      Compile only the specified scenario (can repeat)\n` +
    `  --skip-manifests     Use existing manifest files instead of regenerating\n` +
    `  -h, --help           Show this help message`);
}

function readJsonOrThrow(filePath: string, description: string): any {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`[compile] Failed to read ${description} at ${filePath}: ${(error as Error).message}`);
  }
}

function readJsonIfExists(filePath: string): any {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return readJsonOrThrow(filePath, path.basename(filePath));
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function toRelativeContentPath(absPath: string): string {
  return path.relative(CONTENT_ROOT, absPath).split(path.sep).join('/');
}

function loadPersonaBundles(): Map<string, PersonaBundle> {
  const personaDirs = ['personas/shared', 'personas/base', 'personas/realtime'];
  const map = new Map<string, PersonaBundle>();

  for (const dir of personaDirs) {
    const absDir = path.join(CONTENT_ROOT, dir);
    if (!fs.existsSync(absDir)) continue;

    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const filePath = path.join(absDir, entry.name);
      const raw = readJsonOrThrow(filePath, `persona ${entry.name}`);
      const persona = convertPersonaBundle(raw, undefined, undefined, undefined);
      if (!persona) {
        throw new Error(`[compile] Persona conversion failed for ${entry.name}`);
      }
      map.set(persona.patient_id, {
        source: toRelativeContentPath(filePath),
        raw,
        persona,
      });
    }
  }

  return map;
}

function getScenarioDirectories(): string[] {
  if (!fs.existsSync(SCENARIO_SOURCE_ROOT)) {
    return [];
  }
  return fs.readdirSync(SCENARIO_SOURCE_ROOT, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .sort();
}

function loadExistingIndex(): CompiledScenarioIndex | null {
  if (!fs.existsSync(INDEX_PATH)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(INDEX_PATH, 'utf8');
    return JSON.parse(raw) as CompiledScenarioIndex;
  } catch (error) {
    console.warn(`[compile] Failed to parse existing index.json: ${(error as Error).message}`);
    return null;
  }
}

function writeJson(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function compileScenario(
  scenarioId: string,
  manifest: ContentManifest,
  dependencies: DependencyManifest,
  personaBundles: Map<string, PersonaBundle>,
  generatedAt: string,
): { artifact: CompiledScenarioArtifact; checksum: string } {
  const bundleDir = path.join(SCENARIO_SOURCE_ROOT, scenarioId);
  if (!fs.existsSync(bundleDir)) {
    throw new Error(`[compile] Scenario directory not found: ${scenarioId}`);
  }

  const headerPath = path.join(bundleDir, 'scenario.header.json');
  if (!fs.existsSync(headerPath)) {
    throw new Error(`[compile] scenario.header.json missing for ${scenarioId}`);
  }

  const header = readJsonOrThrow(headerPath, 'scenario.header.json');
  const linkage = header.linkage || {};

  const manifestEntry = manifest.content.scenarios[scenarioId];
  if (!manifestEntry) {
    throw new Error(`[compile] Scenario ${scenarioId} missing from manifest. Regenerate manifests first.`);
  }

  const dependencyEntry = dependencies.scenarios[scenarioId];
  if (!dependencyEntry) {
    throw new Error(`[compile] Scenario ${scenarioId} missing from dependency manifest. Regenerate manifests first.`);
  }

  const personaId = typeof linkage.persona_id === 'string' && linkage.persona_id.trim()
    ? linkage.persona_id.trim()
    : null;

  let personaArtifact: CompiledPersonaArtifact | null = null;
  let personaObj: PatientPersona | null = null;
  let personaRaw: any = null;

  if (personaId) {
    const bundle = personaBundles.get(personaId);
    if (!bundle) {
      throw new Error(`[compile] Persona ${personaId} referenced by ${scenarioId} not found in personas/`);
    }

    const personaManifest = manifest.content.personas[personaId];
    if (!personaManifest) {
      throw new Error(`[compile] Persona ${personaId} missing from manifest. Regenerate manifests first.`);
    }

    personaObj = bundle.persona;
    personaRaw = bundle.raw;

    personaArtifact = {
      id: personaId,
      content_version: personaManifest.content_version,
      checksum: personaManifest.checksum,
      updated_at: personaManifest.updated_at ?? null,
      file: personaManifest.file,
      data: personaObj,
    };
  }

  const instructionsPath = path.join(bundleDir, linkage.instructions_file || 'instructions.json');
  const subjectivePath = path.join(bundleDir, linkage.soap_subjective_file || 'soap.subjective.json');
  const objectivePath = path.join(bundleDir, linkage.soap_objective_file || 'soap.objective.json');
  const assessmentPath = path.join(bundleDir, linkage.soap_assessment_file || 'soap.assessment.json');
  const planPath = path.join(bundleDir, linkage.soap_plan_file || 'soap.plan.json');

  const instructions = readJsonIfExists(instructionsPath);
  const subjective = readJsonIfExists(subjectivePath);
  const objective = readJsonIfExists(objectivePath);
  const assessment = readJsonIfExists(assessmentPath);
  const plan = readJsonIfExists(planPath);

  type ModuleRef = { module_id: string; version: string };
  const moduleRefs: ModuleRef[] = [];
  if (Array.isArray(linkage.active_context_modules)) {
    for (const entry of linkage.active_context_modules) {
      const moduleId = typeof entry?.module_id === 'string' ? entry.module_id.trim() : '';
      if (!moduleId) continue;
      const version = typeof entry?.version === 'string' ? entry.version.trim() : '';
      moduleRefs.push({ module_id: moduleId, version });
    }
  }

  const modules: CompiledModuleArtifact[] = [];
  const contextModules: any[] = [];

  for (const ref of moduleRefs) {
    const moduleCollection = manifest.content.modules[ref.module_id];
    if (!moduleCollection) {
      throw new Error(`[compile] Module ${ref.module_id} referenced by ${scenarioId} missing from manifest.`);
    }

    const versionKey = ref.version || moduleCollection ? Object.keys(moduleCollection)[0] : '';
    const moduleManifest = moduleCollection[ref.version] || moduleCollection[versionKey];
    if (!moduleManifest) {
      throw new Error(`[compile] Module ${ref.module_id}@${ref.version || 'latest'} missing from manifest.`);
    }

    const modulePath = path.join(CONTENT_ROOT, moduleManifest.file);
    if (!fs.existsSync(modulePath)) {
      throw new Error(`[compile] Module file not found: ${moduleManifest.file}`);
    }

    const moduleData = readJsonOrThrow(modulePath, `module ${moduleManifest.file}`);

    modules.push({
      module_id: ref.module_id,
      version: ref.version || moduleManifest.module_version,
      module_version: moduleManifest.module_version,
      content_version: moduleManifest.content_version,
      checksum: moduleManifest.checksum,
      updated_at: moduleManifest.updated_at,
      file: moduleManifest.file,
      data: moduleData,
    });
    contextModules.push(moduleData);
  }

  const scenario = convertScenarioBundle(
    scenarioId,
    header,
    personaId,
    personaObj,
    personaRaw,
    instructions,
    subjective,
    objective,
    assessment,
    plan,
    contextModules,
  );

  if (!scenario) {
    throw new Error(`[compile] Failed to convert scenario bundle for ${scenarioId}`);
  }

  const dependenciesChecksum = dependencyEntry ? formatChecksum(generateObjectChecksum(dependencyEntry)) : null;

  const artifact: CompiledScenarioArtifact = {
    schema_version: '1.0.0',
    generator: 'sps-compiler',
    compiled_at: generatedAt,
    scenario_id: scenarioId,
    content_version: manifestEntry.content_version || header.content_version || '1.0.0',
    manifest_checksum: manifestEntry.checksum,
    dependencies_checksum: dependenciesChecksum,
    source_bundle: toRelativeContentPath(bundleDir),
    scenario,
    persona: personaArtifact,
    modules,
    source_files: {
      header: toRelativeContentPath(headerPath),
      instructions: fs.existsSync(instructionsPath) ? toRelativeContentPath(instructionsPath) : null,
      soap_subjective: fs.existsSync(subjectivePath) ? toRelativeContentPath(subjectivePath) : null,
      soap_objective: fs.existsSync(objectivePath) ? toRelativeContentPath(objectivePath) : null,
      soap_assessment: fs.existsSync(assessmentPath) ? toRelativeContentPath(assessmentPath) : null,
      soap_plan: fs.existsSync(planPath) ? toRelativeContentPath(planPath) : null,
    },
  };

  const checksum = formatChecksum(generateObjectChecksum(artifact));
  return { artifact, checksum };
}

function buildIndex(
  existingIndex: CompiledScenarioIndex | null,
  scenarioEntries: Record<string, CompiledScenarioIndexEntry>,
  generatedAt: string,
): CompiledScenarioIndex {
  const scenarios = { ...(existingIndex?.scenarios ?? {}), ...scenarioEntries };
  const entries = Object.values(scenarios);

  const statistics = {
    total_scenarios: entries.length,
    scenarios_with_persona: entries.filter(entry => Boolean(entry.persona_id)).length,
    total_modules: entries.reduce((sum, entry) => sum + entry.modules.length, 0),
    total_compiled_files: entries.length,
  };

  return {
    schema_version: '1.0.0',
    generated_at: generatedAt,
    generator: 'sps-compiler',
    scenarios,
    statistics,
  };
}

async function main() {
  const options = parseArgs();
  const generatedAt = new Date().toISOString();

  ensureDir(SCENARIO_COMPILED_ROOT);

  let manifest: ContentManifest;
  let dependencies: DependencyManifest;
  let catalogReport: CatalogAnalysisReport | null = null;

  if (options.skipManifests) {
    manifest = loadManifest(MANIFEST_PATH);
    dependencies = loadDependencyManifest(DEPENDENCIES_PATH);
    try {
      catalogReport = loadCatalogAnalysis(CATALOG_REPORT_PATH);
    } catch (error) {
      console.warn(`[compile] Catalog analysis not found (${(error as Error).message}). Continuing.`);
    }
  } else {
    const artifacts = generateContentArtifacts(CONTENT_ROOT);
    manifest = artifacts.manifest;
    dependencies = artifacts.dependencies;
    catalogReport = artifacts.catalogReport;
    saveManifest(manifest, MANIFEST_PATH);
    saveDependencyManifest(dependencies, DEPENDENCIES_PATH);
    saveCatalogAnalysis(catalogReport, CATALOG_REPORT_PATH);
  }

  const personaBundles = loadPersonaBundles();
  const availableScenarios = getScenarioDirectories();

  const targetScenarios = options.scenarioFilter
    ? availableScenarios.filter(id => options.scenarioFilter?.has(id))
    : availableScenarios;

  if (!targetScenarios.length) {
    if (options.scenarioFilter && options.scenarioFilter.size) {
      throw new Error(`[compile] No matching scenarios found for filter: ${Array.from(options.scenarioFilter).join(', ')}`);
    }
    console.warn('[compile] No scenarios found to compile.');
    return;
  }

  const scenarioIndexEntries: Record<string, CompiledScenarioIndexEntry> = {};

  for (const scenarioId of targetScenarios) {
    console.log(`[compile] Compiling ${scenarioId}...`);
    const { artifact, checksum } = compileScenario(scenarioId, manifest, dependencies, personaBundles, generatedAt);

    const outputPath = path.join(SCENARIO_COMPILED_ROOT, `${scenarioId}.json`);
    writeJson(outputPath, artifact);

    const moduleRefs = artifact.modules.map(mod => ({
      module_id: mod.module_id,
      version: mod.version,
      checksum: mod.checksum,
    }));

    scenarioIndexEntries[scenarioId] = {
      scenario_id: scenarioId,
      file: toRelativeContentPath(outputPath),
      checksum,
      content_version: artifact.content_version,
      compiled_at: artifact.compiled_at,
      manifest_checksum: artifact.manifest_checksum,
      dependencies_checksum: artifact.dependencies_checksum,
      persona_id: artifact.persona?.id ?? null,
      persona_checksum: artifact.persona?.checksum ?? null,
      modules: moduleRefs,
    };
  }

  const existingIndex = options.scenarioFilter ? loadExistingIndex() : null;
  const index = buildIndex(existingIndex, scenarioIndexEntries, generatedAt);
  writeJson(INDEX_PATH, index);

  if (!options.scenarioFilter) {
    // Clean up stale compiled files not present in index
    const existingFiles = fs.readdirSync(SCENARIO_COMPILED_ROOT, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json')
      .map(entry => entry.name);

    for (const fileName of existingFiles) {
      const scenarioId = fileName.replace(/\.json$/, '');
      if (!index.scenarios[scenarioId]) {
        fs.unlinkSync(path.join(SCENARIO_COMPILED_ROOT, fileName));
        console.log(`[compile] Removed stale compiled scenario: ${fileName}`);
      }
    }
  }

  console.log('[compile] ✅ Compilation complete');
  console.log(`[compile] Scenarios compiled: ${Object.keys(scenarioIndexEntries).length}`);
  console.log(`[compile] Compiled index written to ${toRelativeContentPath(INDEX_PATH)}`);

  if (catalogReport) {
    console.log('[compile] Catalog analysis refreshed.');
  }
}

main().catch(error => {
  console.error('[compile] ❌ Compilation failed');
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
