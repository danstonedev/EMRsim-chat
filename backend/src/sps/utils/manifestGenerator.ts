import fs from 'fs';
import path from 'path';
import {
  generateFileChecksum,
  generateBundleChecksum,
  generateObjectChecksum,
  formatChecksum
} from './checksum';

/**
 * Persona entry in the content manifest
 */
interface PersonaManifestEntry {
  content_version: string;
  file: string;
  checksum: string;
  updated_at: string;
  patient_id: string;
}

/**
 * Scenario entry in the content manifest
 */
interface ScenarioManifestEntry {
  content_version: string;
  bundle_dir: string;
  checksum: string;
  updated_at: string;
  schema_version: string;
  status: string;
  persona_id?: string | null;
  modules?: Array<{ module_id: string; version: string }>;
}

/**
 * Module version entry in the content manifest
 */
interface ModuleVersionEntry {
  module_version: string;
  content_version: string;
  file: string;
  checksum: string;
  updated_at: string;
}

/**
 * Complete content manifest structure
 */
export interface ContentManifest {
  schema_version: string;
  generated_at: string;
  generator: string;
  content: {
    personas: Record<string, PersonaManifestEntry>;
    scenarios: Record<string, ScenarioManifestEntry>;
    modules: Record<string, Record<string, ModuleVersionEntry>>;
  };
  statistics: {
    total_personas: number;
    total_scenarios: number;
    total_modules: number;
    total_files_tracked: number;
  };
}

export interface ScenarioPersonaDependency {
  id: string;
  content_version: string | null;
  checksum: string | null;
  updated_at: string | null;
}

export interface ScenarioModuleDependency {
  module_id: string;
  version: string;
  content_version: string | null;
  checksum: string | null;
  updated_at: string | null;
}

export interface ScenarioCatalogDependency {
  id: string;
  checksum: string;
  source: string;
  path: string;
}

export interface ScenarioDependencyManifestEntry {
  persona: ScenarioPersonaDependency | null;
  modules: ScenarioModuleDependency[];
  catalogs: {
    subjective?: ScenarioCatalogDependency[];
  };
  special_questions: Array<{ prompt: string; checksum: string }>;
  media_assets: Array<{ id: string; type: string; checksum: string; url?: string }>;
}

export interface DependencyManifest {
  schema_version: string;
  generated_at: string;
  generator: string;
  scenarios: Record<string, ScenarioDependencyManifestEntry>;
  statistics: {
    total_scenarios: number;
    scenarios_with_persona: number;
    total_modules: number;
    total_catalog_entries: number;
    total_special_questions: number;
    total_media_assets: number;
  };
}

interface CatalogAccumulatorEntry {
  scenarioId: string;
  id: string;
  checksum: string;
  source: string;
  path: string;
}

interface CatalogAccumulator {
  subjective: CatalogAccumulatorEntry[];
}

interface CatalogBucketById {
  occurrences: number;
  scenarios: Set<string>;
  checksums: Set<string>;
}

interface CatalogBucketByChecksum {
  occurrences: number;
  ids: Set<string>;
  scenarios: Set<string>;
}

export interface CatalogAnalysisReport {
  schema_version: string;
  generated_at: string;
  generator: string;
  catalogs: {
    subjective: {
      total_occurrences: number;
      by_id: Record<string, { occurrences: number; scenarios: string[]; checksums: string[] }>;
      by_checksum: Record<string, { occurrences: number; ids: string[]; scenarios: string[] }>;
    };
  };
  statistics: {
    total_entries: number;
    unique_ids: number;
    unique_checksums: number;
    duplicate_ids: string[];
    duplicate_checksums: string[];
  };
}

export interface ContentArtifacts {
  manifest: ContentManifest;
  dependencies: DependencyManifest;
  catalogReport: CatalogAnalysisReport;
}

interface ModuleMetadata {
  moduleId: string;
  version: string;
  file: string;
  module_version: string;
  content_version: string;
  updated_at: string;
  checksum: string;
}

function buildCatalogAnalysisReport(timestamp: string, accumulator: CatalogAccumulator): CatalogAnalysisReport {
  const subjectiveById = new Map<string, CatalogBucketById>();
  const subjectiveByChecksum = new Map<string, CatalogBucketByChecksum>();

  accumulator.subjective.forEach(entry => {
    if (!subjectiveById.has(entry.id)) {
      subjectiveById.set(entry.id, {
        occurrences: 0,
        scenarios: new Set<string>(),
        checksums: new Set<string>()
      });
    }
    const idBucket = subjectiveById.get(entry.id)!;
    idBucket.occurrences += 1;
    idBucket.scenarios.add(entry.scenarioId);
    idBucket.checksums.add(entry.checksum);

    if (!subjectiveByChecksum.has(entry.checksum)) {
      subjectiveByChecksum.set(entry.checksum, {
        occurrences: 0,
        ids: new Set<string>(),
        scenarios: new Set<string>()
      });
    }
    const checksumBucket = subjectiveByChecksum.get(entry.checksum)!;
    checksumBucket.occurrences += 1;
    checksumBucket.ids.add(entry.id);
    checksumBucket.scenarios.add(entry.scenarioId);
  });

  const byId: Record<string, { occurrences: number; scenarios: string[]; checksums: string[] }> = {};
  subjectiveById.forEach((bucket, id) => {
    byId[id] = {
      occurrences: bucket.occurrences,
      scenarios: Array.from(bucket.scenarios).sort(),
      checksums: Array.from(bucket.checksums).sort()
    };
  });

  const byChecksum: Record<string, { occurrences: number; ids: string[]; scenarios: string[] }> = {};
  subjectiveByChecksum.forEach((bucket, checksum) => {
    byChecksum[checksum] = {
      occurrences: bucket.occurrences,
      ids: Array.from(bucket.ids).sort(),
      scenarios: Array.from(bucket.scenarios).sort()
    };
  });

  const duplicateIds = Array.from(subjectiveById.entries())
    .filter(([, bucket]) => bucket.checksums.size > 1)
    .map(([id]) => id)
    .sort();

  const duplicateChecksums = Array.from(subjectiveByChecksum.entries())
    .filter(([, bucket]) => bucket.ids.size > 1)
    .map(([checksum]) => checksum)
    .sort();

  const totalEntries = accumulator.subjective.length;

  return {
    schema_version: '1.0.0',
    generated_at: timestamp,
    generator: 'sps-manifest-generator',
    catalogs: {
      subjective: {
        total_occurrences: totalEntries,
        by_id: byId,
        by_checksum: byChecksum
      }
    },
    statistics: {
      total_entries: totalEntries,
      unique_ids: subjectiveById.size,
      unique_checksums: subjectiveByChecksum.size,
      duplicate_ids: duplicateIds,
      duplicate_checksums: duplicateChecksums
    }
  };
}

function ensureCatalogAccumulator(): CatalogAccumulator {
  return {
    subjective: []
  };
}

export function generateContentArtifacts(contentRoot: string): ContentArtifacts {
  const generatedAt = new Date().toISOString();

  const manifest: ContentManifest = {
    schema_version: '1.0.0',
    generated_at: generatedAt,
    generator: 'sps-manifest-generator',
    content: {
      personas: {},
      scenarios: {},
      modules: {}
    },
    statistics: {
      total_personas: 0,
      total_scenarios: 0,
      total_modules: 0,
      total_files_tracked: 0
    }
  };

  const dependencyManifest: DependencyManifest = {
    schema_version: '1.0.0',
    generated_at: generatedAt,
    generator: 'sps-manifest-generator',
    scenarios: {},
    statistics: {
      total_scenarios: 0,
      scenarios_with_persona: 0,
      total_modules: 0,
      total_catalog_entries: 0,
      total_special_questions: 0,
      total_media_assets: 0
    }
  };

  const catalogAccumulator = ensureCatalogAccumulator();

  const personaDirectories = [
    'personas/base',
    'personas/shared',
    'personas/realtime'
  ];

  personaDirectories.forEach(subPath => {
    const personasDir = path.join(contentRoot, subPath);
    if (!fs.existsSync(personasDir)) {
      return;
    }
    const personaFiles = fs.readdirSync(personasDir).filter(f => f.endsWith('.json'));

    for (const file of personaFiles) {
      const filePath = path.join(personasDir, file);
      let data: any = {};
      try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch (error) {
        console.warn(`[manifest] Failed to parse persona file ${subPath}/${file}: ${error}`);
      }
      const personaKey = path.basename(file, '.json');

      if (manifest.content.personas[personaKey]) {
        console.warn(`[manifest] Duplicate persona id detected: ${personaKey}. Overwriting previous entry.`);
      }

      manifest.content.personas[personaKey] = {
        content_version: typeof data.content_version === 'string' && data.content_version.trim() ? data.content_version.trim() : '1.0.0',
        file: `${subPath}/${file}`,
        checksum: formatChecksum(generateFileChecksum(filePath)),
        updated_at: typeof data.updated_at === 'string' && data.updated_at.trim() ? data.updated_at.trim() : generatedAt,
        patient_id: data.patient_id
      };
      manifest.statistics.total_personas++;
    }
  });

  const modulesDir = path.join(contentRoot, 'banks/modules');
  const moduleMetadataCache = new Map<string, ModuleMetadata | null>();

  const loadModuleMetadata = (moduleId: string, version: string): ModuleMetadata | null => {
    const cacheKey = `${moduleId}@${version}`;
    if (moduleMetadataCache.has(cacheKey)) {
      return moduleMetadataCache.get(cacheKey) ?? null;
    }

    const fileName = `${moduleId}.${version}.json`;
    const filePath = path.join(modulesDir, fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`[manifest] Missing module file for ${moduleId}@${version} (${fileName})`);
      moduleMetadataCache.set(cacheKey, null);
      return null;
    }

    let moduleData: any = {};
    try {
      moduleData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) {
      console.warn(`[manifest] Failed to parse module file ${fileName}: ${error}`);
    }

    const moduleVersion = typeof moduleData.module_version === 'string' && moduleData.module_version.trim()
      ? moduleData.module_version.trim()
      : version;
    if (moduleVersion !== version) {
      console.warn(`[manifest] Module file ${fileName} reports module_version ${moduleVersion}; filename version ${version}`);
    }

    const contentVersion = typeof moduleData.content_version === 'string' && moduleData.content_version.trim()
      ? moduleData.content_version.trim()
      : '1.0.0';
    const updatedAt = typeof moduleData.updated_at === 'string' && moduleData.updated_at.trim()
      ? moduleData.updated_at.trim()
      : generatedAt;

    const metadata: ModuleMetadata = {
      moduleId,
      version,
      file: `banks/modules/${fileName}`,
      module_version: moduleVersion,
      content_version: contentVersion,
      updated_at: updatedAt,
      checksum: formatChecksum(generateFileChecksum(filePath))
    };

    moduleMetadataCache.set(cacheKey, metadata);
    return metadata;
  };

  const scenariosDir = path.join(contentRoot, 'scenarios/bundles_src');
  if (fs.existsSync(scenariosDir)) {
    const scenarioDirs = fs.readdirSync(scenariosDir).filter(f => {
      const fullPath = path.join(scenariosDir, f);
      return fs.statSync(fullPath).isDirectory();
    });

    for (const dir of scenarioDirs) {
      const bundleDir = path.join(scenariosDir, dir);
      const headerPath = path.join(bundleDir, 'scenario.header.json');

      if (!fs.existsSync(headerPath)) {
        console.warn(`[manifest] Skipping ${dir}: no scenario.header.json found`);
        continue;
      }

      const header = JSON.parse(fs.readFileSync(headerPath, 'utf-8'));

      const personaId = typeof header.linkage?.persona_id === 'string' && header.linkage.persona_id.trim()
        ? header.linkage.persona_id.trim()
        : null;

      const moduleRefs: Array<{ module_id: string; version: string }> = [];
      if (Array.isArray(header.linkage?.active_context_modules)) {
        header.linkage.active_context_modules.forEach((entry: any, idx: number) => {
          if (!entry || typeof entry !== 'object') {
            console.warn(`[manifest] Scenario ${dir} has invalid module reference at index ${idx}`);
            return;
          }
          const moduleId = typeof entry.module_id === 'string' && entry.module_id.trim() ? entry.module_id.trim() : '';
          if (!moduleId) {
            console.warn(`[manifest] Scenario ${dir} has module reference without module_id at index ${idx}`);
            return;
          }
          const versionRef = typeof entry.version === 'string' && entry.version.trim() ? entry.version.trim() : '';
          moduleRefs.push({ module_id: moduleId, version: versionRef });
        });
      }

      manifest.content.scenarios[dir] = {
        content_version: header.content_version || '1.0.0',
        bundle_dir: `scenarios/bundles_src/${dir}`,
        checksum: formatChecksum(generateBundleChecksum(bundleDir)),
        updated_at: header.meta?.updated_at || generatedAt,
        schema_version: header.schema_version,
        status: header.status,
        persona_id: personaId,
        modules: moduleRefs.length ? moduleRefs : undefined
      };
      manifest.statistics.total_scenarios++;

      const dependencyEntry: ScenarioDependencyManifestEntry = {
        persona: null,
        modules: [],
        catalogs: {},
        special_questions: [],
        media_assets: []
      };

      if (personaId) {
        const personaManifest = manifest.content.personas[personaId];
        if (!personaManifest) {
          console.warn(`[manifest] Scenario ${dir} references missing persona ${personaId}`);
          dependencyEntry.persona = {
            id: personaId,
            content_version: null,
            checksum: null,
            updated_at: null
          };
        } else {
          dependencyEntry.persona = {
            id: personaId,
            content_version: personaManifest.content_version,
            checksum: personaManifest.checksum,
            updated_at: personaManifest.updated_at ?? null
          };
          dependencyManifest.statistics.scenarios_with_persona++;
        }
      }

      moduleRefs.forEach(ref => {
        const metadata = loadModuleMetadata(ref.module_id, ref.version || '');
        dependencyEntry.modules.push({
          module_id: ref.module_id,
          version: ref.version || '',
          content_version: metadata?.content_version ?? null,
          checksum: metadata?.checksum ?? null,
          updated_at: metadata?.updated_at ?? null
        });
        dependencyManifest.statistics.total_modules += 1;
      });

      if (Array.isArray(header.subjective_catalog)) {
        const subjectiveEntries: ScenarioCatalogDependency[] = header.subjective_catalog.map((entry: any, idx: number) => {
          const catalogId = typeof entry?.id === 'string' && entry.id.trim() ? entry.id.trim() : `subjective_${idx}`;
          const checksum = formatChecksum(generateObjectChecksum(entry));
          const dependency: ScenarioCatalogDependency = {
            id: catalogId,
            checksum,
            source: 'scenario.header.json',
            path: `scenarios/bundles_src/${dir}/scenario.header.json#subjective_catalog[${idx}]`
          };
          catalogAccumulator.subjective.push({
            scenarioId: dir,
            id: catalogId,
            checksum,
            source: dependency.source,
            path: dependency.path
          });
          dependencyManifest.statistics.total_catalog_entries += 1;
          return dependency;
        });
        if (subjectiveEntries.length) {
          dependencyEntry.catalogs.subjective = subjectiveEntries;
        }
      }

      const soapSubjectivePath = (() => {
        const linkagePath = typeof header.linkage?.soap_subjective_file === 'string' && header.linkage.soap_subjective_file.trim()
          ? header.linkage.soap_subjective_file.trim()
          : './soap.subjective.json';
        const resolved = path.join(bundleDir, linkagePath);
        return fs.existsSync(resolved) ? resolved : null;
      })();

      if (soapSubjectivePath) {
        try {
          const subjective = JSON.parse(fs.readFileSync(soapSubjectivePath, 'utf-8'));
          if (Array.isArray(subjective.special_questions_region_specific)) {
            subjective.special_questions_region_specific.forEach((item: any, idx: number) => {
              if (typeof item !== 'string') {
                return;
              }
              const prompt = item.trim();
              if (!prompt) return;
              const checksum = formatChecksum(generateObjectChecksum({ prompt }));
              dependencyEntry.special_questions.push({ prompt, checksum });
              dependencyManifest.statistics.total_special_questions += 1;
            });
          }
        } catch (error) {
          console.warn(`[manifest] Failed to parse special questions for ${dir}: ${error}`);
        }
      }

      if (Array.isArray(header.media_library)) {
        header.media_library.forEach((entry: any, idx: number) => {
          if (!entry || typeof entry !== 'object') {
            return;
          }
          const mediaId = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : `media_${idx}`;
          const checksum = formatChecksum(generateObjectChecksum(entry));
          dependencyEntry.media_assets.push({
            id: mediaId,
            type: typeof entry.type === 'string' ? entry.type : 'unknown',
            checksum,
            url: typeof entry.url === 'string' ? entry.url : undefined
          });
          dependencyManifest.statistics.total_media_assets += 1;
        });
      }

      dependencyManifest.scenarios[dir] = dependencyEntry;
      dependencyManifest.statistics.total_scenarios += 1;
    }
  }

  if (fs.existsSync(modulesDir)) {
    const moduleFiles = fs.readdirSync(modulesDir).filter(f =>
      f.endsWith('.json') && f !== 'index.json' && f !== 'README.md'
    );

    for (const file of moduleFiles) {
      const match = file.match(/^(.+)\.(v\d+)\.json$/);
      if (!match) {
        console.warn(`[manifest] Skipping ${file}: filename doesn't match module pattern`);
        continue;
      }

      const [, moduleId, version] = match;
      const metadata = loadModuleMetadata(moduleId, version);
      if (!metadata) {
        continue;
      }

      if (!manifest.content.modules[moduleId]) {
        manifest.content.modules[moduleId] = {};
      }

      manifest.content.modules[moduleId][version] = {
        module_version: metadata.module_version,
        content_version: metadata.content_version,
        file: metadata.file,
        checksum: metadata.checksum,
        updated_at: metadata.updated_at
      };
      manifest.statistics.total_modules++;
    }
  }

  manifest.statistics.total_files_tracked =
    manifest.statistics.total_personas +
    manifest.statistics.total_scenarios +
    manifest.statistics.total_modules;

  const catalogReport = buildCatalogAnalysisReport(generatedAt, catalogAccumulator);

  return {
    manifest,
    dependencies: dependencyManifest,
    catalogReport
  };
}

export function generateContentManifest(contentRoot: string): ContentManifest {
  return generateContentArtifacts(contentRoot).manifest;
}

export function generateDependencyManifest(contentRoot: string): DependencyManifest {
  return generateContentArtifacts(contentRoot).dependencies;
}

export function generateCatalogAnalysis(contentRoot: string): CatalogAnalysisReport {
  return generateContentArtifacts(contentRoot).catalogReport;
}

/**
 * Save manifest to file
 * @param manifest - Content manifest to save
 * @param outputPath - Absolute path where manifest should be saved
 */
export function saveManifest(manifest: ContentManifest, outputPath: string): void {
  const json = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(outputPath, json, 'utf-8');
  console.log(`[manifest] Saved to ${outputPath}`);
  console.log(`[manifest] Tracked: ${manifest.statistics.total_files_tracked} files (${manifest.statistics.total_personas} personas, ${manifest.statistics.total_scenarios} scenarios, ${manifest.statistics.total_modules} modules)`);
}

function ensureDirForFile(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function saveDependencyManifest(dependencies: DependencyManifest, outputPath: string): void {
  ensureDirForFile(outputPath);
  const json = JSON.stringify(dependencies, null, 2);
  fs.writeFileSync(outputPath, json, 'utf-8');
  console.log(`[manifest] Saved dependency manifest to ${outputPath}`);
  console.log(`[manifest] Dependencies tracked: ${dependencies.statistics.total_scenarios} scenarios → ${dependencies.statistics.total_modules} modules / ${dependencies.statistics.total_catalog_entries} catalog entries`);
}

export function saveCatalogAnalysis(report: CatalogAnalysisReport, outputPath: string): void {
  ensureDirForFile(outputPath);
  const json = JSON.stringify(report, null, 2);
  fs.writeFileSync(outputPath, json, 'utf-8');
  console.log(`[manifest] Saved catalog analysis to ${outputPath}`);
  console.log(`[manifest] Catalog entries analyzed: ${report.statistics.total_entries}`);
}

/**
 * Load manifest from file
 * @param filePath - Absolute path to manifest file
 * @returns Content manifest
 */
export function loadManifest(filePath: string): ContentManifest {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Manifest not found: ${filePath}`);
  }
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data) as ContentManifest;
}

export function loadDependencyManifest(filePath: string): DependencyManifest {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Dependency manifest not found: ${filePath}`);
  }
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data) as DependencyManifest;
}

export function loadCatalogAnalysis(filePath: string): CatalogAnalysisReport {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Catalog analysis not found: ${filePath}`);
  }
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data) as CatalogAnalysisReport;
}

/**
 * Get content version from manifest for a specific content item
 * @param manifest - Content manifest
 * @param contentType - 'persona', 'scenario', or 'module'
 * @param contentId - ID of the content item
 * @param moduleVersion - Optional version for modules
 * @returns Content version string, or null if not found
 */
export function getContentVersion(
  manifest: ContentManifest,
  contentType: 'persona' | 'scenario' | 'module',
  contentId: string,
  moduleVersion?: string
): string | null {
  switch (contentType) {
    case 'persona':
      return manifest.content.personas[contentId]?.content_version || null;
    case 'scenario':
      return manifest.content.scenarios[contentId]?.content_version || null;
    case 'module':
      if (!moduleVersion) return null;
      return manifest.content.modules[contentId]?.[moduleVersion]?.content_version || null;
    default:
      return null;
  }
}

/**
 * Get content checksum from manifest for a specific content item
 * @param manifest - Content manifest
 * @param contentType - 'persona', 'scenario', or 'module'
 * @param contentId - ID of the content item
 * @param moduleVersion - Optional version for modules
 * @returns Checksum string, or null if not found
 */
export function getContentChecksum(
  manifest: ContentManifest,
  contentType: 'persona' | 'scenario' | 'module',
  contentId: string,
  moduleVersion?: string
): string | null {
  switch (contentType) {
    case 'persona':
      return manifest.content.personas[contentId]?.checksum || null;
    case 'scenario':
      return manifest.content.scenarios[contentId]?.checksum || null;
    case 'module':
      if (!moduleVersion) return null;
      return manifest.content.modules[contentId]?.[moduleVersion]?.checksum || null;
    default:
      return null;
  }
}
