import fs from 'fs';
import path from 'path';

// Constants
const CONTENT_ROOT = path.join(__dirname, '../../../content');
const MANIFEST_PATH = path.join(CONTENT_ROOT, 'manifest.json');
const DEPENDENCIES_PATH = path.join(CONTENT_ROOT, 'dependencies.json');

// In-memory cache
let manifestCache: ContentManifest | null = null;
let dependencyCache: DependencyManifest | null = null;

/**
 * Content manifest structure containing version information for all content assets
 */
export interface ContentManifest {
  version: string;
  generated_at: string;
  content: {
    personas: Record<string, ContentVersionEntry>;
    scenarios: Record<string, ContentVersionEntry>;
    modules: Record<string, ContentVersionEntry>;
    catalogs: Record<string, ContentVersionEntry>;
    challenges: Record<string, ContentVersionEntry>;
    special_questions: Record<string, ContentVersionEntry>;
  };
}

/**
 * Dependency manifest structure tracking relationships between content items
 */
export interface DependencyManifest {
  version: string;
  generated_at: string;
  scenario_dependencies: Record<string, ScenarioDependencies>;
}

/**
 * Content version metadata for a specific content item
 */
export interface ContentVersionEntry {
  content_version: string;
  updated_at: string;
  checksum: string;
  change_notes?: string[];
}

/**
 * Tracked dependencies for a scenario
 */
export interface ScenarioDependencies {
  personas: Record<string, string>; // persona_id -> checksum
  modules: Record<string, { version: string; checksum: string }>;
  catalogs: Record<string, string>; // catalog_id -> checksum
  challenges: string[];
  special_questions: string[];
}

/**
 * Content type identifier for versioning
 */
export type ContentType = 'persona' | 'scenario' | 'module' | 'catalog' | 'challenge' | 'special_question';

/**
 * Options for resolving content version
 */
export interface ResolveContentVersionOptions {
  throwIfMissing?: boolean;
  useCache?: boolean;
}

/**
 * Loads the content manifest file with optional caching
 * 
 * @param options Loading options
 * @returns ContentManifest object
 */
export async function loadContentManifest(options: { useCache?: boolean } = {}): Promise<ContentManifest> {
  const { useCache = true } = options;
  
  if (useCache && manifestCache) {
    return manifestCache;
  }
  
  try {
    if (!fs.existsSync(MANIFEST_PATH)) {
      console.warn(`Content manifest not found at ${MANIFEST_PATH}. Using empty manifest.`);
      const emptyManifest: ContentManifest = {
        version: '0.0.0',
        generated_at: new Date().toISOString(),
        content: {
          personas: {},
          scenarios: {},
          modules: {},
          catalogs: {},
          challenges: {},
          special_questions: {}
        }
      };
      
      if (useCache) {
        manifestCache = emptyManifest;
      }
      
      return emptyManifest;
    }
    
    const manifestContent = await fs.promises.readFile(MANIFEST_PATH, 'utf-8');
    const manifest = JSON.parse(manifestContent) as ContentManifest;
    
    if (useCache) {
      manifestCache = manifest;
    }
    
    return manifest;
  } catch (error) {
    console.error('Failed to load content manifest:', error);
    throw new Error(`Failed to load content manifest: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Loads the dependency manifest file with optional caching
 * 
 * @param options Loading options
 * @returns DependencyManifest object
 */
export async function loadDependencyManifest(options: { useCache?: boolean } = {}): Promise<DependencyManifest> {
  const { useCache = true } = options;
  
  if (useCache && dependencyCache) {
    return dependencyCache;
  }
  
  try {
    if (!fs.existsSync(DEPENDENCIES_PATH)) {
      console.warn(`Dependency manifest not found at ${DEPENDENCIES_PATH}. Using empty dependencies.`);
      const emptyDependencies: DependencyManifest = {
        version: '0.0.0',
        generated_at: new Date().toISOString(),
        scenario_dependencies: {}
      };
      
      if (useCache) {
        dependencyCache = emptyDependencies;
      }
      
      return emptyDependencies;
    }
    
    const dependenciesContent = await fs.promises.readFile(DEPENDENCIES_PATH, 'utf-8');
    const dependencies = JSON.parse(dependenciesContent) as DependencyManifest;
    
    if (useCache) {
      dependencyCache = dependencies;
    }
    
    return dependencies;
  } catch (error) {
    console.error('Failed to load dependency manifest:', error);
    throw new Error(`Failed to load dependency manifest: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Resolves the version information for a specific content item
 * 
 * @param contentType Type of content (persona, scenario, etc.)
 * @param id Content item identifier
 * @param options Resolution options
 * @returns Content version entry or default if not found
 */
export async function resolveContentVersion(
  contentType: ContentType,
  id: string,
  options: ResolveContentVersionOptions = {}
): Promise<ContentVersionEntry> {
  const { throwIfMissing = false, useCache = true } = options;
  
  try {
    const manifest = await loadContentManifest({ useCache });
    
    // Get the content collection based on type
    const contentCollection = manifest.content[`${contentType}s`];
    if (!contentCollection) {
      throw new Error(`Invalid content type: ${contentType}`);
    }
    
    // Look up the version entry
    const versionEntry = contentCollection[id];
    
    if (!versionEntry) {
      if (throwIfMissing) {
        throw new Error(`No version information found for ${contentType} with id '${id}'`);
      }
      
      // Return default version entry if not found
      return {
        content_version: '0.0.0',
        updated_at: new Date().toISOString(),
        checksum: 'missing'
      };
    }
    
    return versionEntry;
  } catch (error) {
    if (throwIfMissing) {
      throw error;
    }
    
    console.error(`Error resolving content version for ${contentType} '${id}':`, error);
    
    // Return default version entry on error
    return {
      content_version: '0.0.0',
      updated_at: new Date().toISOString(),
      checksum: 'error'
    };
  }
}

/**
 * Asserts that all dependencies for a scenario are current based on manifest checksums
 * 
 * @param scenarioId Scenario identifier
 * @throws Error if any dependency is out of date or missing
 */
export async function assertDependenciesCurrent(scenarioId: string): Promise<void> {
  const dependencies = await loadDependencyManifest();
  const manifest = await loadContentManifest();
  
  const scenarioDeps = dependencies.scenario_dependencies[scenarioId];
  if (!scenarioDeps) {
    throw new Error(`No dependency information found for scenario '${scenarioId}'`);
  }
  
  // Check persona dependencies
  for (const [personaId, expectedChecksum] of Object.entries(scenarioDeps.personas)) {
    const personaEntry = manifest.content.personas[personaId];
    if (!personaEntry) {
      throw new Error(`Missing persona dependency '${personaId}' for scenario '${scenarioId}'`);
    }
    
    if (personaEntry.checksum !== expectedChecksum) {
      throw new Error(
        `Persona '${personaId}' has been modified (checksum ${personaEntry.checksum}) ` +
        `but scenario '${scenarioId}' was compiled with version ${expectedChecksum}`
      );
    }
  }
  
  // Check module dependencies
  for (const [moduleId, { version, checksum }] of Object.entries(scenarioDeps.modules)) {
    const moduleEntry = manifest.content.modules[moduleId];
    if (!moduleEntry) {
      throw new Error(`Missing module dependency '${moduleId}' for scenario '${scenarioId}'`);
    }
    
    if (moduleEntry.checksum !== checksum) {
      throw new Error(
        `Module '${moduleId}' has been modified (checksum ${moduleEntry.checksum}) ` +
        `but scenario '${scenarioId}' was compiled with version ${checksum}`
      );
    }
  }
  
  // Check catalog dependencies (if any)
  for (const [catalogId, expectedChecksum] of Object.entries(scenarioDeps.catalogs || {})) {
    const catalogEntry = manifest.content.catalogs[catalogId];
    if (!catalogEntry) {
      throw new Error(`Missing catalog dependency '${catalogId}' for scenario '${scenarioId}'`);
    }
    
    if (catalogEntry.checksum !== expectedChecksum) {
      throw new Error(
        `Catalog '${catalogId}' has been modified (checksum ${catalogEntry.checksum}) ` +
        `but scenario '${scenarioId}' was compiled with version ${expectedChecksum}`
      );
    }
  }
  
  // Other dependencies could be checked similarly
}

/**
 * Bumps the content version for a specific content item
 * 
 * @param type Content type
 * @param id Content identifier
 * @param increment Version increment type (major, minor, patch)
 * @param changeNote Optional note about the change
 * @returns Updated version string
 */
export function bumpContentVersion(
  type: ContentType,
  id: string,
  increment: 'major' | 'minor' | 'patch',
  changeNote?: string
): string {
  // This is a stub that would be implemented as part of the manifest generation
  // The actual implementation would:
  // 1. Load the content file
  // 2. Increment its version field based on semver rules
  // 3. Add the change note if provided
  // 4. Save the file back
  // 5. Return the new version
  
  console.log(`Would bump ${increment} version for ${type} ${id} with note: ${changeNote || 'N/A'}`);
  return '0.0.0'; // Placeholder
}

/**
 * Invalidates the in-memory cache for manifests
 */
export function invalidateVersionCache(): void {
  manifestCache = null;
  dependencyCache = null;
}

/**
 * Generates a deterministic checksum for content
 * 
 * @param content Content to hash
 * @returns Checksum string
 */
export function generateContentChecksum(content: any): string {
  // This would normally use a crypto hash function
  // For now, we'll return a placeholder
  return 'checksum-placeholder';
}
