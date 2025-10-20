import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { safeReadJson } from './fsUtils.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MODULE_LIBRARY_ROOT = path.join(__dirname, '..', '..', 'content', 'banks', 'modules');

export interface ModuleReference {
  module_id: string;
  version: string;
}

export interface ModuleRegistry {
  schema_version: string;
  generated_at: string;
  modules: Record<
    string,
    {
      versions: Record<
        string,
        {
          file: string;
          checksum: string;
          description: string;
          clinical_domains: string[];
          created_at: string;
          status: string;
        }
      >;
      latest: string;
    }
  >;
}

let cachedModuleRegistry: ModuleRegistry | null = null;

export function loadModuleRegistry(): ModuleRegistry | null {
  if (cachedModuleRegistry) return cachedModuleRegistry;

  const registryPath = path.join(MODULE_LIBRARY_ROOT, 'index.json');
  const registry = safeReadJson<ModuleRegistry>(registryPath);

  if (!registry) {
    console.warn('[sps][modules] Module registry not found:', registryPath);
    return null;
  }

  cachedModuleRegistry = registry;
  return cachedModuleRegistry;
}

export function clearModuleRegistryCache(): void {
  cachedModuleRegistry = null;
}

export function resolveModule(moduleRef: ModuleReference | string): any | null {
  if (typeof moduleRef === 'string') {
    return null;
  }

  const { module_id, version } = moduleRef;
  const registry = loadModuleRegistry();

  if (!registry) {
    console.warn('[sps][modules] Module registry unavailable, cannot resolve:', module_id);
    return null;
  }

  const moduleEntry = registry.modules[module_id];
  if (!moduleEntry) {
    console.warn(`[sps][modules] Module not found in registry: ${module_id}`);
    return null;
  }

  const versionToUse = version || moduleEntry.latest;
  const versionEntry = moduleEntry.versions[versionToUse];

  if (!versionEntry) {
    console.warn(`[sps][modules] Version ${versionToUse} not found for module ${module_id}`);
    return null;
  }

  const modulePath = path.join(MODULE_LIBRARY_ROOT, versionEntry.file);
  const moduleData = safeReadJson(modulePath);

  if (!moduleData) {
    console.warn(`[sps][modules] Failed to load module file: ${modulePath}`);
    return null;
  }

  if (process.env.DEBUG) {
    console.log(`[sps][modules] Loaded module: ${module_id}@${versionToUse}`);
  }

  return moduleData;
}

export function loadContextModules(moduleRefs: Array<ModuleReference | string> | undefined): any[] {
  if (!Array.isArray(moduleRefs) || !moduleRefs.length) {
    return [];
  }

  const modules: any[] = [];
  for (const ref of moduleRefs) {
    const moduleData = resolveModule(ref);
    if (moduleData) {
      modules.push(moduleData);
    }
  }

  return modules;
}
