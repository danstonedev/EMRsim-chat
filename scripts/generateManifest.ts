import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import glob from 'glob';
import {
  ContentManifest, 
  ContentVersionEntry,
  DependencyManifest,
  ScenarioDependencies
} from '../src/sps/core/versioning';

// Constants
const CONTENT_ROOT = path.join(__dirname, '../src/sps/content');
const SCENARIOS_SRC_PATH = path.join(CONTENT_ROOT, 'authoring/bundles_src');
const SCENARIOS_COMPILED_PATH = path.join(CONTENT_ROOT, 'scenarios/compiled');
const PERSONAS_REALTIME_PATH = path.join(CONTENT_ROOT, 'personas/realtime');
const PERSONAS_SHARED_PATH = path.join(CONTENT_ROOT, 'personas/shared');
const PERSONAS_BASE_PATH = path.join(CONTENT_ROOT, 'personas/base');
const MODULES_PATH = path.join(CONTENT_ROOT, 'banks/modules');
const CHALLENGES_PATH = path.join(CONTENT_ROOT, 'banks/challenges');
const SPECIAL_QUESTIONS_PATH = path.join(CONTENT_ROOT, 'banks/special_questions');
const CATALOGS_PATH = path.join(CONTENT_ROOT, 'banks/catalogs');

const MANIFEST_OUTPUT_PATH = path.join(CONTENT_ROOT, 'manifest.json');
const DEPENDENCIES_OUTPUT_PATH = path.join(CONTENT_ROOT, 'dependencies.json');
const CATALOG_REPORT_PATH = path.join(CONTENT_ROOT, 'catalogs/report.json');

// Default version if not specified in content
const DEFAULT_VERSION = '0.1.0';

/**
 * Calculates a SHA-256 checksum for a JSON object
 * 
 * @param content Object to checksum
 * @returns Hexadecimal checksum string
 */
function generateChecksum(content: any): string {
  // Sort keys for deterministic output regardless of property order
  const sortedJson = JSON.stringify(content, Object.keys(content).sort());
  return crypto.createHash('sha256').update(sortedJson).digest('hex');
}

/**
 * Extracts content version metadata from a file
 * 
 * @param filePath Path to the content file
 * @returns Version entry with checksum
 */
function extractVersionMetadata(filePath: string): ContentVersionEntry {
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const checksum = generateChecksum(content);
    
    return {
      content_version: content.content_version || DEFAULT_VERSION,
      updated_at: content.updated_at || new Date().toISOString(),
      checksum,
      change_notes: content.change_notes || []
    };
  } catch (error) {
    console.error(`Failed to extract version metadata from ${filePath}:`, error);
    return {
      content_version: DEFAULT_VERSION,
      updated_at: new Date().toISOString(),
      checksum: 'error-extracting',
      change_notes: [`Error extracting metadata: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}

/**
 * Scans a directory for JSON files and extracts their version metadata
 * 
 * @param directory Directory to scan
 * @param pattern File glob pattern
 * @param idExtractor Function to extract ID from filename or content
 * @returns Record of ID to version entry mappings
 */
async function scanDirectoryVersions(
  directory: string, 
  pattern: string, 
  idExtractor: (filePath: string, content: any) => string
): Promise<Record<string, ContentVersionEntry>> {
  const result: Record<string, ContentVersionEntry> = {};
  
  try {
    const files = glob.sync(pattern, { cwd: directory });
    
    for (const file of files) {
      const filePath = path.join(directory, file);
      try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const id = idExtractor(filePath, content);
        result[id] = extractVersionMetadata(filePath);
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${directory}:`, error);
  }
  
  return result;
}

/**
 * Extracts scenario dependencies from a scenario bundle
 * 
 * @param scenarioId Scenario ID
 * @param scenarioDir Scenario bundle directory
 * @returns Dependency information
 */
async function extractScenarioDependencies(
  scenarioId: string, 
  scenarioDir: string
): Promise<ScenarioDependencies> {
  const dependencies: ScenarioDependencies = {
    personas: {},
    modules: {},
    catalogs: {},
    challenges: [],
    special_questions: []
  };
  
  try {
    // Process header file to find dependencies
    const headerPath = path.join(scenarioDir, `${scenarioId}.header.json`);
    if (fs.existsSync(headerPath)) {
      const header = JSON.parse(fs.readFileSync(headerPath, 'utf8'));
      
      // Extract module references
      if (header.modules && Array.isArray(header.modules)) {
        for (const moduleRef of header.modules) {
          if (moduleRef.module_id && moduleRef.version) {
            // Find module and get checksum
            const moduleFile = path.join(MODULES_PATH, `${moduleRef.module_id}.v${moduleRef.version}.json`);
            if (fs.existsSync(moduleFile)) {
              const moduleContent = JSON.parse(fs.readFileSync(moduleFile, 'utf8'));
              dependencies.modules[moduleRef.module_id] = {
                version: moduleRef.version,
                checksum: generateChecksum(moduleContent)
              };
            }
          }
        }
      }
      
      // Extract personas (main)
      if (header.persona && header.persona.persona_id) {
        const personaId = header.persona.persona_id;
        // Try shared first, then realtime
        let personaPath = path.join(PERSONAS_SHARED_PATH, `${personaId}.json`);
        if (!fs.existsSync(personaPath)) {
          personaPath = path.join(PERSONAS_REALTIME_PATH, `${personaId}.json`);
        }
        
        if (fs.existsSync(personaPath)) {
          const personaContent = JSON.parse(fs.readFileSync(personaPath, 'utf8'));
          dependencies.personas[personaId] = generateChecksum(personaContent);
        }
      }
      
      // Extract challenges
      if (header.challenge_references && Array.isArray(header.challenge_references)) {
        dependencies.challenges = header.challenge_references;
      }
      
      // Extract special questions
      if (header.special_question_references && Array.isArray(header.special_question_references)) {
        dependencies.special_questions = header.special_question_references;
      }
    }
    
    // Process the catalog use in the scenario
    const contextPath = path.join(scenarioDir, `${scenarioId}.context.json`);
    if (fs.existsSync(contextPath)) {
      const context = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
      
      // Extract catalog references
      if (context.catalog_references && Array.isArray(context.catalog_references)) {
        for (const catalogRef of context.catalog_references) {
          if (catalogRef && typeof catalogRef === 'string') {
            // Find catalog and get checksum
            const catalogFile = path.join(CATALOGS_PATH, `${catalogRef}.library.json`);
            if (fs.existsSync(catalogFile)) {
              const catalogContent = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
              dependencies.catalogs[catalogRef] = generateChecksum(catalogContent);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error extracting dependencies for scenario ${scenarioId}:`, error);
  }
  
  return dependencies;
}

/**
 * Analyzes catalog usage and detects duplicates
 * 
 * @param dependencies Scenario dependencies
 * @returns Catalog usage report
 */
async function analyzeCatalogs(
  dependencies: Record<string, ScenarioDependencies>
): Promise<any> {
  const usageCounts: Record<string, number> = {};
  const checksumMap: Record<string, string[]> = {};
  const duplicates: Record<string, string[]> = {};
  
  // Count catalog usage across scenarios
  Object.values(dependencies).forEach(scenarioDeps => {
    Object.keys(scenarioDeps.catalogs).forEach(catalogId => {
      usageCounts[catalogId] = (usageCounts[catalogId] || 0) + 1;
      
      // Track checksums for duplicate detection
      const checksum = scenarioDeps.catalogs[catalogId];
      if (!checksumMap[checksum]) {
        checksumMap[checksum] = [];
      }
      
      if (!checksumMap[checksum].includes(catalogId)) {
        checksumMap[checksum].push(catalogId);
      }
    });
  });
  
  // Find duplicate catalogs (different IDs with same checksum)
  Object.entries(checksumMap).forEach(([checksum, catalogIds]) => {
    if (catalogIds.length > 1) {
      // These catalogs are duplicates
      const primary = catalogIds[0];
      const duplicateCatalogs = catalogIds.slice(1);
      duplicates[primary] = duplicateCatalogs;
    }
  });
  
  return {
    usage_counts: usageCounts,
    duplicate_sets: duplicates
  };
}

/**
 * Main function to generate manifests
 */
async function generateManifests() {
  console.log('Generating content manifests...');
  
  // 1. Collect version metadata for all content types
  console.log('Collecting content version metadata...');
  
  const personasRealtime = await scanDirectoryVersions(
    PERSONAS_REALTIME_PATH, 
    '*.json', 
    (_, content) => content.patient_id
  );
  
  const personasShared = await scanDirectoryVersions(
    PERSONAS_SHARED_PATH, 
    '*.json', 
    (_, content) => content.patient_id
  );
  
  const modules = await scanDirectoryVersions(
    MODULES_PATH, 
    '*.json', 
    (filePath) => path.basename(filePath).replace(/\.v\d+\.json$/, '')
  );
  
  const catalogs = await scanDirectoryVersions(
    CATALOGS_PATH, 
    '*.library.json', 
    (filePath) => path.basename(filePath).replace('.library.json', '')
  );
  
  const challenges = await scanDirectoryVersions(
    CHALLENGES_PATH, 
    '*.json', 
    (_, content) => content.id || path.basename(_, '.json')
  );
  
  const specialQuestions = await scanDirectoryVersions(
    SPECIAL_QUESTIONS_PATH, 
    '*.json', 
    (filePath) => path.basename(filePath, '.json')
  );
  
  // Compiled scenarios
  const scenarios = await scanDirectoryVersions(
    SCENARIOS_COMPILED_PATH, 
    '*.json', 
    (_, content) => content.id
  );
  
  // 2. Build the content manifest
  console.log('Building content manifest...');
  const contentManifest: ContentManifest = {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    content: {
      personas: { ...personasRealtime, ...personasShared },
      scenarios,
      modules,
      catalogs,
      challenges,
      special_questions: specialQuestions
    }
  };
  
  // 3. Extract dependency relationships
  console.log('Extracting scenario dependencies...');
  const scenarioDependencies: Record<string, ScenarioDependencies> = {};
  
  // Get all scenario directories
  const scenarioDirectories = fs.readdirSync(SCENARIOS_SRC_PATH);
  for (const scenarioId of scenarioDirectories) {
    const scenarioDir = path.join(SCENARIOS_SRC_PATH, scenarioId);
    if (fs.statSync(scenarioDir).isDirectory()) {
      scenarioDependencies[scenarioId] = await extractScenarioDependencies(
        scenarioId, 
        scenarioDir
      );
    }
  }
  
  // 4. Build the dependency manifest
  console.log('Building dependency manifest...');
  const dependencyManifest: DependencyManifest = {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    scenario_dependencies: scenarioDependencies
  };
  
  // 5. Analyze catalogs for usage and duplicates
  console.log('Analyzing catalogs...');
  const catalogReport = await analyzeCatalogs(scenarioDependencies);
  
  // 6. Write manifest files
  console.log('Writing manifest files...');
  fs.writeFileSync(
    MANIFEST_OUTPUT_PATH,
    JSON.stringify(contentManifest, null, 2),
    'utf8'
  );
  
  fs.writeFileSync(
    DEPENDENCIES_OUTPUT_PATH,
    JSON.stringify(dependencyManifest, null, 2),
    'utf8'
  );
  
  fs.writeFileSync(
    CATALOG_REPORT_PATH,
    JSON.stringify(catalogReport, null, 2),
    'utf8'
  );
  
  console.log('Content manifest generation complete!');
  console.log(`- Content manifest: ${MANIFEST_OUTPUT_PATH}`);
  console.log(`- Dependency manifest: ${DEPENDENCIES_OUTPUT_PATH}`);
  console.log(`- Catalog report: ${CATALOG_REPORT_PATH}`);
  
  // Report statistics
  console.log('\nContent statistics:');
  console.log(`- Personas: ${Object.keys(contentManifest.content.personas).length}`);
  console.log(`- Scenarios: ${Object.keys(contentManifest.content.scenarios).length}`);
  console.log(`- Modules: ${Object.keys(contentManifest.content.modules).length}`);
  console.log(`- Catalogs: ${Object.keys(contentManifest.content.catalogs).length}`);
  console.log(`- Challenges: ${Object.keys(contentManifest.content.challenges).length}`);
  console.log(`- Special questions: ${Object.keys(contentManifest.content.special_questions).length}`);
  
  if (Object.keys(catalogReport.duplicate_sets).length > 0) {
    console.log('\nWarning: Duplicate catalogs detected!');
    Object.entries(catalogReport.duplicate_sets).forEach(([primary, duplicates]) => {
      console.log(`- Catalog '${primary}' has duplicates: ${duplicates.join(', ')}`);
    });
  }
}

// Execute manifest generation
generateManifests().catch(error => {
  console.error('Error generating manifests:', error);
  process.exit(1);
});
