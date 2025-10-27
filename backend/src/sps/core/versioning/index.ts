import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import type {
  ContentManifest,
  DependencyManifest,
  ScenarioDependencyManifestEntry,
} from '../../utils/manifestGenerator.js';
import {
  getContentChecksum,
  getContentVersion,
  loadManifest,
  loadDependencyManifest,
} from '../../utils/manifestGenerator.js';

export type ContentKind = 'persona' | 'scenario' | 'module';

export interface ContentVersionDescriptor {
  id: string;
  kind: ContentKind;
  moduleVersion?: string;
  contentVersion: string;
  checksum: string;
  updatedAt: string | null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MANIFEST_PATH = path.join(__dirname, '..', '..', 'content', 'manifest.json');
const DEPENDENCIES_PATH = path.join(__dirname, '..', '..', 'content', 'dependencies.json');

let cachedManifest: ContentManifest | null = null;
let cachedManifestMtimeMs = 0;
let cachedDependencies: DependencyManifest | null = null;
let cachedDependenciesMtimeMs = 0;

function statSafe(filePath: string): fs.Stats | null {
  try {
    return fs.statSync(filePath);
  } catch (error) {
    if (process.env.DEBUG) {
      console.warn('[sps][versioning] stat failed for', filePath, error);
    }
    return null;
  }
}

function readManifestFromDisk(): ContentManifest {
  cachedManifest = loadManifest(MANIFEST_PATH);
  const stat = statSafe(MANIFEST_PATH);
  cachedManifestMtimeMs = stat ? stat.mtimeMs : Date.now();
  return cachedManifest;
}

export function refreshManifestCache(): void {
  readManifestFromDisk();
}

function ensureManifest(): ContentManifest {
  const stat = statSafe(MANIFEST_PATH);
  if (!cachedManifest || !stat || stat.mtimeMs !== cachedManifestMtimeMs) {
    return readManifestFromDisk();
  }
  return cachedManifest;
}

function readDependenciesFromDisk(): DependencyManifest {
  cachedDependencies = loadDependencyManifest(DEPENDENCIES_PATH);
  const stat = statSafe(DEPENDENCIES_PATH);
  cachedDependenciesMtimeMs = stat ? stat.mtimeMs : Date.now();
  return cachedDependencies;
}

function ensureDependencies(): DependencyManifest {
  const stat = statSafe(DEPENDENCIES_PATH);
  if (!cachedDependencies || !stat || stat.mtimeMs !== cachedDependenciesMtimeMs) {
    return readDependenciesFromDisk();
  }
  return cachedDependencies;
}

export function refreshDependencyCache(): void {
  readDependenciesFromDisk();
}

function resolveUpdatedAt(
  manifest: ContentManifest,
  kind: ContentKind,
  id: string,
  moduleVersion?: string
): string | null {
  switch (kind) {
    case 'persona':
      return manifest.content.personas[id]?.updated_at ?? null;
    case 'scenario':
      return manifest.content.scenarios[id]?.updated_at ?? null;
    case 'module':
      if (!moduleVersion) return null;
      return manifest.content.modules[id]?.[moduleVersion]?.updated_at ?? null;
    default:
      return null;
  }
}

export function resolveContentDescriptor(kind: 'persona', id: string): ContentVersionDescriptor | null;
export function resolveContentDescriptor(kind: 'scenario', id: string): ContentVersionDescriptor | null;
export function resolveContentDescriptor(
  kind: 'module',
  id: string,
  moduleVersion: string
): ContentVersionDescriptor | null;
export function resolveContentDescriptor(
  kind: ContentKind,
  id: string,
  moduleVersion?: string
): ContentVersionDescriptor | null {
  const manifest = ensureManifest();
  const contentVersion = getContentVersion(manifest, kind, id, moduleVersion);
  if (!contentVersion) {
    return null;
  }

  const checksum = getContentChecksum(manifest, kind, id, moduleVersion);
  const updatedAt = resolveUpdatedAt(manifest, kind, id, moduleVersion);

  return {
    id,
    kind,
    moduleVersion,
    contentVersion,
    checksum: checksum ?? '',
    updatedAt,
  };
}

export function getPersonaVersion(personaId: string): ContentVersionDescriptor | null {
  return resolveContentDescriptor('persona', personaId);
}

export function getScenarioVersion(scenarioId: string): ContentVersionDescriptor | null {
  return resolveContentDescriptor('scenario', scenarioId);
}

export function getModuleVersion(moduleId: string, version: string): ContentVersionDescriptor | null {
  return resolveContentDescriptor('module', moduleId, version);
}

export function getDependencyManifest(): DependencyManifest {
  return ensureDependencies();
}

export function getScenarioDependencies(scenarioId: string): ScenarioDependencyManifestEntry | null {
  const dependencyManifest = ensureDependencies();
  return dependencyManifest.scenarios[scenarioId] ?? null;
}

export function assertScenarioDependenciesUpToDate(
  scenarioId: string,
  expectedPersonaId: string | null,
  expectedModules: Array<{ module_id: string; version: string }>
): void {
  const manifest = ensureManifest();
  const manifestScenario = manifest.content.scenarios[scenarioId];
  if (!manifestScenario) {
    throw new Error(`Scenario not present in manifest: ${scenarioId}`);
  }

  if (expectedPersonaId && manifestScenario.persona_id !== expectedPersonaId) {
    throw new Error(
      `Scenario ${scenarioId} references persona ${expectedPersonaId} but manifest has ${manifestScenario.persona_id}`
    );
  }

  const manifestModules = new Set(
    Array.isArray(manifestScenario.modules)
      ? manifestScenario.modules.map((mod: { module_id: string; version: string }) => `${mod.module_id}@${mod.version}`)
      : []
  );

  for (const ref of expectedModules) {
    const key = `${ref.module_id}@${ref.version || ''}`;
    if (!manifestModules.has(key)) {
      throw new Error(`Scenario ${scenarioId} missing module dependency in manifest: ${key}`);
    }
  }
}
