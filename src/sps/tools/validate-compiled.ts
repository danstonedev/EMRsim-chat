import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { Command } from 'commander';
import { loadContentManifest, loadDependencyManifest, assertDependenciesCurrent } from '../core/versioning';

// Constants
const CONTENT_ROOT = path.join(__dirname, '../../sps/content');
const SCENARIOS_COMPILED_PATH = path.join(CONTENT_ROOT, 'scenarios/compiled');
const INDEX_PATH = path.join(SCENARIOS_COMPILED_PATH, 'index.json');

// CLI options
const program = new Command();

program
  .name('sps-validate-compiled')
  .description('Validates compiled SPS content assets')
  .version('1.0.0')
  .option('-v, --verbose', 'Enable verbose logging')
  .parse(process.argv);

const options = program.opts();

/**
 * Validates compiled scenario files against manifests
 */
async function validateCompiledScenarios() {
  console.log(chalk.blue('Validating compiled scenarios...'));
  
  // Check if index file exists
  if (!fs.existsSync(INDEX_PATH)) {
    console.error(chalk.red(`Index file not found: ${INDEX_PATH}`));
    console.error(chalk.red('Run "npm run sps:compile" to generate compiled scenarios'));
    return false;
  }
  
  try {
    // Load index
    const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    console.log(chalk.blue(`Found ${index.scenarios.length} scenarios in index`));
    
    // Load manifests
    const contentManifest = await loadContentManifest();
    const dependencyManifest = await loadDependencyManifest();
    
    // Validate each scenario
    let validCount = 0;
    let errorCount = 0;
    
    for (const scenarioEntry of index.scenarios) {
      const scenarioId = scenarioEntry.id;
      const scenarioPath = path.join(SCENARIOS_COMPILED_PATH, `${scenarioId}.json`);
      
      try {
        // Check if file exists
        if (!fs.existsSync(scenarioPath)) {
          throw new Error(`Compiled scenario file not found: ${scenarioPath}`);
        }
        
        // Load compiled scenario
        const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
        
        // Verify checksum
        if (scenario.checksum !== scenarioEntry.checksum) {
          throw new Error(`Checksum mismatch: ${scenarioId}`);
        }
        
        // Verify dependencies
        await assertDependenciesCurrent(scenarioId);
        
        if (options.verbose) {
          console.log(chalk.green(`✓ ${scenarioId} - Valid`));
        }
        validCount++;
      } catch (error) {
        console.error(chalk.red(`✗ ${scenarioId} - ${error.message}`));
        errorCount++;
      }
    }
    
    // Print summary
    console.log(chalk.blue('\nValidation complete!'));
    console.log(chalk.green(`  - Valid scenarios: ${validCount}`));
    
    if (errorCount > 0) {
      console.error(chalk.red(`  - Scenarios with errors: ${errorCount}`));
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(chalk.red(`Error validating compiled scenarios: ${error.message}`));
    return false;
  }
}

/**
 * Main validation function
 */
async function main() {
  const isValid = await validateCompiledScenarios();
  
  if (!isValid) {
    process.exit(1);
  }
  
  console.log(chalk.green('All compiled scenarios are valid!'));
}

// Run validation
main().catch(error => {
  console.error(chalk.red(`Fatal error: ${error.message}`));
  process.exit(1);
});
