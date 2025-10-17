import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import { glob } from 'glob';

import { normalizePersona } from '../core/normalization';
import { 
  generateContentChecksum, 
  ContentVersionEntry,
  resolveContentVersion,
  loadContentManifest,
  loadDependencyManifest
} from '../core/versioning';

// Constants
const CONTENT_ROOT = path.join(__dirname, '../../sps/content');
const SCENARIOS_SRC_PATH = path.join(CONTENT_ROOT, 'authoring/bundles_src');
const SCENARIOS_COMPILED_PATH = path.join(CONTENT_ROOT, 'scenarios/compiled');
const PERSONAS_REALTIME_PATH = path.join(CONTENT_ROOT, 'personas/realtime');
const PERSONAS_SHARED_PATH = path.join(CONTENT_ROOT, 'personas/shared');
const PERSONAS_BASE_PATH = path.join(CONTENT_ROOT, 'personas/base');
const MODULES_PATH = path.join(CONTENT_ROOT, 'banks/modules');

// Temporary build directory
const TMP_BUILD_DIR = path.join(__dirname, '../../../dist/tmp/sps-compile');

// Output paths
const OUTPUT_DIR = SCENARIOS_COMPILED_PATH;
const INDEX_PATH = path.join(OUTPUT_DIR, 'index.json');

// CLI options
const program = new Command();

program
  .name('sps-compile')
  .description('SPS Scenario Compiler')
  .version('1.0.0')
  .option('-s, --scenario <id>', 'Compile a specific scenario by ID')
  .option('-a, --all', 'Compile all scenarios (default)')
  .option('-f, --force', 'Force recompilation even if up-to-date')
  .option('-t, --tmp', 'Output to temporary directory instead of content folder')
  .option('-v, --verbose', 'Enable verbose logging')
  .parse(process.argv);

const options = program.opts();

// Types
interface ScenarioBundle {
  id: string;
  header: any;
  context: any;
  content: any;
  module_configs?: Record<string, any>;
  persona?: any;
}

interface CompiledScenario {
  id: string;
  schema_version: string;
  content_version: string;
  updated_at: string;
  checksum: string;
  header: any;
  context: any;
  content: any;
  persona: any;
  modules: Record<string, any>;
  [key: string]: any;
}

interface ScenarioIndex {
  version: string;
  generated_at: string;
  scenarios: Array<{
    id: string;
    title: string;
    schema_version: string;
    content_version: string;
    updated_at: string;
    checksum: string;
    dependencies: {
      persona?: string;
      modules: string[];
      catalogs: string[];
      challenges: string[];
      special_questions: string[];
    }
  }>;
}

/**
 * Loads all bundle files for a scenario
 * 
 * @param scenarioId The scenario ID
 * @returns The loaded scenario bundle
 */
async function loadScenarioBundle(scenarioId: string): Promise<ScenarioBundle> {
  const scenarioDir = path.join(SCENARIOS_SRC_PATH, scenarioId);
  
  if (!fs.existsSync(scenarioDir)) {
    throw new Error(`Scenario directory not found: ${scenarioDir}`);
  }
  
  const bundle: ScenarioBundle = {
    id: scenarioId,
    header: null,
    context: null,
    content: null,
    module_configs: {}
  };
  
  // Load header
  const headerPath = path.join(scenarioDir, `${scenarioId}.header.json`);
  if (fs.existsSync(headerPath)) {
    bundle.header = JSON.parse(fs.readFileSync(headerPath, 'utf8'));
  } else {
    throw new Error(`Scenario header not found: ${headerPath}`);
  }
  
  // Load context
  const contextPath = path.join(scenarioDir, `${scenarioId}.context.json`);
  if (fs.existsSync(contextPath)) {
    bundle.context = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
  } else {
    throw new Error(`Scenario context not found: ${contextPath}`);
  }
  
  // Load content
  const contentPath = path.join(scenarioDir, `${scenarioId}.content.json`);
  if (fs.existsSync(contentPath)) {
    bundle.content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
  } else {
    throw new Error(`Scenario content not found: ${contentPath}`);
  }
  
  // Load module configs (optional)
  const moduleFiles = glob.sync(`${scenarioId}.module.*.json`, {
    cwd: scenarioDir
  });
  
  for (const moduleFile of moduleFiles) {
    const moduleId = moduleFile.replace(`${scenarioId}.module.`, '').replace('.json', '');
    const modulePath = path.join(scenarioDir, moduleFile);
    bundle.module_configs[moduleId] = JSON.parse(fs.readFileSync(modulePath, 'utf8'));
  }
  
  // Load persona if exists (optional, may reference shared persona)
  if (bundle.header.persona?.persona_id) {
    const personaId = bundle.header.persona.persona_id;
    
    // Try to load from shared personas first, then from realtime
    let personaPath = path.join(PERSONAS_SHARED_PATH, `${personaId}.json`);
    if (!fs.existsSync(personaPath)) {
      personaPath = path.join(PERSONAS_REALTIME_PATH, `${personaId}.json`);
    }
    
    if (fs.existsSync(personaPath)) {
      const rawPersona = JSON.parse(fs.readFileSync(personaPath, 'utf8'));
      bundle.persona = normalizePersona(rawPersona);
    } else {
      console.warn(`Persona not found: ${personaId}`);
    }
  }
  
  return bundle;
}

/**
 * Loads a module by its ID and version
 * 
 * @param moduleId Module ID
 * @param version Module version
 * @returns The module definition or null if not found
 */
function loadModule(moduleId: string, version: string): any {
  const modulePath = path.join(MODULES_PATH, `${moduleId}.v${version}.json`);
  
  if (!fs.existsSync(modulePath)) {
    console.warn(`Module not found: ${moduleId} v${version}`);
    return null;
  }
  
  return JSON.parse(fs.readFileSync(modulePath, 'utf8'));
}

/**
 * Compiles a scenario bundle into a single compiled scenario
 * 
 * @param bundle The scenario bundle to compile
 * @returns The compiled scenario
 */
async function compileScenario(bundle: ScenarioBundle): Promise<CompiledScenario> {
  console.log(chalk.blue(`Compiling scenario: ${bundle.id}`));
  
  // Start with basic structure
  const compiled: CompiledScenario = {
    id: bundle.id,
    schema_version: '1.0',
    content_version: '1.0.0',
    updated_at: new Date().toISOString(),
    checksum: '',
    header: bundle.header,
    context: bundle.context,
    content: bundle.content,
    persona: bundle.persona || null,
    modules: {},
  };
  
  // Load and embed modules
  if (bundle.header.modules && Array.isArray(bundle.header.modules)) {
    for (const moduleRef of bundle.header.modules) {
      if (moduleRef.module_id && moduleRef.version) {
        const moduleId = moduleRef.module_id;
        const version = moduleRef.version;
        
        // Load the module definition
        const moduleDefinition = loadModule(moduleId, version);
        if (moduleDefinition) {
          // Apply module configuration if available
          const moduleConfig = bundle.module_configs[moduleId] || {};
          
          // Merge module definition with config
          compiled.modules[moduleId] = {
            ...moduleDefinition,
            ...moduleConfig,
            module_id: moduleId,
            version
          };
          
          console.log(chalk.green(`  - Embedded module: ${moduleId} v${version}`));
        } else {
          console.warn(chalk.yellow(`  - Failed to load module: ${moduleId} v${version}`));
        }
      }
    }
  }
  
  // Get content version information
  try {
    const versionInfo = await resolveContentVersion('scenario', bundle.id);
    compiled.content_version = versionInfo.content_version;
    compiled.updated_at = versionInfo.updated_at;
  } catch (error) {
    console.warn(chalk.yellow(`  - Failed to get version info: ${error.message}`));
  }
  
  // Calculate checksum
  compiled.checksum = generateContentChecksum(compiled);
  
  return compiled;
}

/**
 * Writes a compiled scenario to disk
 * 
 * @param scenario The compiled scenario
 * @param outputDir The output directory
 * @returns The path where the scenario was written
 */
function writeCompiledScenario(scenario: CompiledScenario, outputDir: string): string {
  const outputPath = path.join(outputDir, `${scenario.id}.json`);
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Write the compiled scenario
  fs.writeFileSync(outputPath, JSON.stringify(scenario, null, 2));
  
  console.log(chalk.green(`Wrote compiled scenario: ${outputPath}`));
  return outputPath;
}

/**
 * Creates an index file for all compiled scenarios
 * 
 * @param scenarios List of compiled scenarios
 * @param outputPath Path to write the index file
 * @returns True if successful
 */
async function createScenarioIndex(scenarios: CompiledScenario[], outputPath: string): Promise<boolean> {
  // Load dependency manifest to get relationship info
  const dependencies = await loadDependencyManifest();
  
  // Build the index
  const index: ScenarioIndex = {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    scenarios: scenarios.map(scenario => {
      // Get dependencies from the manifest
      const deps = dependencies.scenario_dependencies[scenario.id] || {
        personas: {},
        modules: {},
        catalogs: {},
        challenges: [],
        special_questions: []
      };
      
      return {
        id: scenario.id,
        title: scenario.header.title || scenario.id,
        schema_version: scenario.schema_version,
        content_version: scenario.content_version,
        updated_at: scenario.updated_at,
        checksum: scenario.checksum,
        dependencies: {
          persona: Object.keys(deps.personas)[0],
          modules: Object.keys(deps.modules),
          catalogs: Object.keys(deps.catalogs),
          challenges: deps.challenges,
          special_questions: deps.special_questions
        }
      };
    })
  };
  
  // Write the index file
  fs.writeFileSync(outputPath, JSON.stringify(index, null, 2));
  
  console.log(chalk.green(`Created scenario index: ${outputPath}`));
  return true;
}

/**
 * Gets a list of all scenario IDs (directories in bundles_src)
 * 
 * @returns Array of scenario IDs
 */
function getAllScenarioIds(): string[] {
  return fs.readdirSync(SCENARIOS_SRC_PATH)
    .filter(item => {
      const itemPath = path.join(SCENARIOS_SRC_PATH, item);
      return fs.statSync(itemPath).isDirectory();
    });
}

/**
 * Main function to compile scenarios
 */
async function main() {
  console.log(chalk.blue('SPS Content Compiler'));
  
  // Determine which scenarios to compile
  let scenarioIds: string[] = [];
  
  if (options.scenario) {
    scenarioIds = [options.scenario];
    console.log(chalk.blue(`Compiling single scenario: ${options.scenario}`));
  } else {
    scenarioIds = getAllScenarioIds();
    console.log(chalk.blue(`Compiling all scenarios: ${scenarioIds.length} found`));
  }
  
  // Determine output directory
  const outputDir = options.tmp ? TMP_BUILD_DIR : OUTPUT_DIR;
  console.log(chalk.blue(`Output directory: ${outputDir}`));
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Compile each scenario
  const compiledScenarios: CompiledScenario[] = [];
  let successCount = 0;
  let failCount = 0;
  
  for (const scenarioId of scenarioIds) {
    try {
      // Load scenario bundle
      const bundle = await loadScenarioBundle(scenarioId);
      
      // Compile scenario
      const compiled = await compileScenario(bundle);
      
      // Write compiled scenario
      writeCompiledScenario(compiled, outputDir);
      
      // Add to compiled list
      compiledScenarios.push(compiled);
      successCount++;
    } catch (error) {
      console.error(chalk.red(`Error compiling scenario ${scenarioId}: ${error.message}`));
      failCount++;
    }
  }
  
  // Create index file
  await createScenarioIndex(compiledScenarios, path.join(outputDir, 'index.json'));
  
  // Print summary
  console.log(chalk.blue('\nCompilation complete!'));
  console.log(chalk.green(`  - Successfully compiled: ${successCount} scenarios`));
  
  if (failCount > 0) {
    console.log(chalk.red(`  - Failed to compile: ${failCount} scenarios`));
  }
  
  console.log(chalk.blue(`  - Index file created at: ${path.join(outputDir, 'index.json')}`));
  
  if (options.tmp) {
    console.log(chalk.yellow('\nScenarios compiled to temporary directory.'));
    console.log(chalk.yellow('To update the content folder, copy files from:'));
    console.log(chalk.yellow(`  ${TMP_BUILD_DIR}`));
    console.log(chalk.yellow('To:'));
    console.log(chalk.yellow(`  ${SCENARIOS_COMPILED_PATH}`));
  }
}

// Run the compiler
main().catch(error => {
  console.error(chalk.red(`Fatal error: ${error.message}`));
  process.exit(1);
});
