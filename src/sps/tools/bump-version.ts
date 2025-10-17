import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { Command } from 'commander';
import { ContentType, CONTENT_PATHS } from '../core/constants';
import { loadContentManifest, resolveContentVersion } from '../core/versioning';

// Constants
const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

// CLI setup
const program = new Command();

program
  .name('sps-bump-version')
  .description('SPS Content Version Bumping Tool')
  .version('1.0.0')
  .requiredOption('-t, --type <contentType>', 'Content type (persona, scenario, module, catalog, challenge, special_question)')
  .requiredOption('-i, --id <id>', 'Content identifier')
  .requiredOption('-b, --bump <level>', 'Version level to bump (major, minor, patch)')
  .option('-n, --note <message>', 'Change note to add to version history')
  .option('-f, --force', 'Force update even if content is not found in manifest')
  .option('-s, --skip-manifest', 'Skip updating the manifest after version bump')
  .option('-v, --verbose', 'Enable verbose logging')
  .parse(process.argv);

const options = program.opts();

/**
 * Maps content type to its file path
 */
function resolveContentPath(type: ContentType, id: string): string | null {
  switch (type) {
    case 'persona':
      // Try realtime first, then shared
      const realtimePath = path.join(CONTENT_PATHS.personas.realtime, `${id}.json`);
      if (fs.existsSync(realtimePath)) return realtimePath;
      
      const sharedPath = path.join(CONTENT_PATHS.personas.shared, `${id}.json`);
      if (fs.existsSync(sharedPath)) return sharedPath;
      
      return null;
      
    case 'scenario':
      // Use compiled scenario
      const scenarioPath = path.join(CONTENT_PATHS.scenarios.compiled, `${id}.json`);
      if (fs.existsSync(scenarioPath)) return scenarioPath;
      
      // Also check bundle source header
      const bundleHeaderPath = path.join(CONTENT_PATHS.authoring.bundles_src, id, `${id}.header.json`);
      if (fs.existsSync(bundleHeaderPath)) return bundleHeaderPath;
      
      return null;
      
    case 'module':
      // Find the latest version of the module
      const moduleDir = CONTENT_PATHS.banks.modules;
      if (!fs.existsSync(moduleDir)) return null;
      
      const moduleFiles = fs.readdirSync(moduleDir)
        .filter(file => file.startsWith(`${id}.v`) && file.endsWith('.json'))
        .sort(); // Sort to get the latest version
      
      if (moduleFiles.length > 0) {
        return path.join(moduleDir, moduleFiles[moduleFiles.length - 1]);
      }
      
      return null;
      
    case 'catalog':
      const catalogPath = path.join(CONTENT_PATHS.banks.catalogs, `${id}.library.json`);
      if (fs.existsSync(catalogPath)) return catalogPath;
      
      return null;
      
    case 'challenge':
      const challengesPath = path.join(CONTENT_PATHS.banks.challenges, 'challenges.json');
      if (fs.existsSync(challengesPath)) return challengesPath;
      
      return null;
      
    case 'special_question':
      const specialQuestionPath = path.join(CONTENT_PATHS.banks.special_questions, `${id}.json`);
      if (fs.existsSync(specialQuestionPath)) return specialQuestionPath;
      
      return null;
      
    default:
      return null;
  }
}

/**
 * Increments a semantic version
 */
function incrementVersion(version: string, level: 'major' | 'minor' | 'patch'): string {
  const match = VERSION_PATTERN.exec(version);
  
  if (!match) {
    console.warn(chalk.yellow(`Invalid version format: ${version}, using default 0.1.0`));
    return level === 'major' ? '1.0.0' : level === 'minor' ? '0.1.0' : '0.0.1';
  }
  
  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  const patch = parseInt(match[3], 10);
  
  switch (level) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      return version;
  }
}

/**
 * Updates a content file with a new version
 */
async function updateContentVersion(
  contentType: ContentType, 
  contentId: string, 
  filePath: string, 
  level: 'major' | 'minor' | 'patch',
  changeNote?: string
): Promise<{ oldVersion: string; newVersion: string }> {
  // Read the current file
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  // Get current version
  const currentVersion = content.content_version || '0.0.0';
  
  // Calculate new version
  const newVersion = incrementVersion(currentVersion, level);
  
  // Update version fields
  content.content_version = newVersion;
  content.updated_at = new Date().toISOString();
  
  // Add change note if provided
  if (changeNote) {
    if (!content.change_notes) {
      content.change_notes = [];
    }
    
    content.change_notes.unshift(`${newVersion}: ${changeNote}`);
    
    // Keep only the last 10 change notes to prevent bloat
    if (content.change_notes.length > 10) {
      content.change_notes = content.change_notes.slice(0, 10);
    }
  }
  
  // Write the updated file
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
  
  console.log(chalk.green(`✅ Updated ${contentType} '${contentId}' version from ${currentVersion} to ${newVersion}`));
  
  return { oldVersion: currentVersion, newVersion };
}

/**
 * Special handling for module versions which are encoded in filenames
 */
async function updateModuleVersion(
  moduleId: string, 
  filePath: string, 
  level: 'major' | 'minor' | 'patch',
  changeNote?: string
): Promise<{ oldVersion: string; newVersion: string }> {
  // Extract current version from filename
  const filename = path.basename(filePath);
  const match = filename.match(/\.v(\d+\.\d+\.\d+)\.json$/);
  
  if (!match) {
    throw new Error(`Cannot parse version from module filename: ${filename}`);
  }
  
  const currentVersion = match[1];
  const newVersion = incrementVersion(currentVersion, level);
  
  // Read the module content
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  // Update version fields
  content.content_version = newVersion;
  content.version = newVersion; // Modules often have both fields
  content.updated_at = new Date().toISOString();
  
  // Add change note if provided
  if (changeNote) {
    if (!content.change_notes) {
      content.change_notes = [];
    }
    
    content.change_notes.unshift(`${newVersion}: ${changeNote}`);
    
    // Keep only the last 10 change notes
    if (content.change_notes.length > 10) {
      content.change_notes = content.change_notes.slice(0, 10);
    }
  }
  
  // Create new filename with updated version
  const newFilename = filename.replace(/\.v\d+\.\d+\.\d+\.json$/, `.v${newVersion}.json`);
  const newFilePath = path.join(path.dirname(filePath), newFilename);
  
  // Write the module to the new path
  fs.writeFileSync(newFilePath, JSON.stringify(content, null, 2), 'utf8');
  
  console.log(chalk.green(`✅ Created new module version: ${newFilename}`));
  
  return { oldVersion: currentVersion, newVersion };
}

/**
 * Main function to execute version bumping
 */
async function bumpVersion() {
  const contentType = options.type as ContentType;
  const contentId = options.id;
  const level = options.bump as 'major' | 'minor' | 'patch';
  const changeNote = options.note;
  const force = options.force || false;
  const skipManifest = options.skipManifest || false;
  const verbose = options.verbose || false;
  
  console.log(chalk.blue(`SPS Version Bumping Tool`));
  console.log(chalk.blue(`Content Type: ${contentType}`));
  console.log(chalk.blue(`Content ID: ${contentId}`));
  console.log(chalk.blue(`Version Increment: ${level}`));
  
  if (changeNote) {
    console.log(chalk.blue(`Change Note: ${changeNote}`));
  }
  
  // Validate content type
  if (!['persona', 'scenario', 'module', 'catalog', 'challenge', 'special_question'].includes(contentType)) {
    console.error(chalk.red(`Invalid content type: ${contentType}`));
    process.exit(1);
  }
  
  // Validate bump level
  if (!['major', 'minor', 'patch'].includes(level)) {
    console.error(chalk.red(`Invalid version increment: ${level}, must be 'major', 'minor', or 'patch'`));
    process.exit(1);
  }
  
  // Check if content exists in manifest
  try {
    const versionInfo = await resolveContentVersion(contentType, contentId, { throwIfMissing: !force });
    
    if (verbose) {
      console.log(chalk.blue(`Current version info:`, versionInfo));
    }
  } catch (error) {
    if (!force) {
      console.error(chalk.red(`Content not found in manifest: ${contentType} ${contentId}`));
      console.error(chalk.yellow(`Use --force to create/update anyway`));
      process.exit(1);
    }
  }
  
  // Resolve content path
  const contentPath = resolveContentPath(contentType, contentId);
  
  if (!contentPath && !force) {
    console.error(chalk.red(`Content file not found for ${contentType} ${contentId}`));
    console.error(chalk.yellow(`Use --force to create anyway`));
    process.exit(1);
  }
  
  if (!contentPath && force) {
    console.log(chalk.yellow(`Content file not found, but --force specified. Would create new file.`));
    // Implementation for creating new content files would go here
    console.error(chalk.red(`Creating new content files is not yet implemented.`));
    process.exit(1);
  }
  
  // Update version
  try {
    let versionResult;
    
    if (contentType === 'module') {
      versionResult = await updateModuleVersion(contentId, contentPath!, level, changeNote);
    } else {
      versionResult = await updateContentVersion(contentType, contentId, contentPath!, level, changeNote);
    }
    
    console.log(chalk.green(`Successfully updated version from ${versionResult.oldVersion} to ${versionResult.newVersion}`));
    
    // Update manifest
    if (!skipManifest) {
      console.log(chalk.blue(`Updating content manifest...`));
      
      // Execute the manifest generation script
      const { execSync } = require('child_process');
      try {
        execSync('npm run sps:generate-manifests', { stdio: verbose ? 'inherit' : 'pipe' });
        console.log(chalk.green(`✅ Updated content manifest`));
      } catch (error) {
        console.error(chalk.red(`Failed to update manifest: ${error instanceof Error ? error.message : String(error)}`));
      }
    }
    
    // If scenario was updated, trigger recompilation
    if (contentType === 'scenario' && !skipManifest) {
      console.log(chalk.blue(`Recompiling scenario...`));
      
      try {
        const { execSync } = require('child_process');
        execSync(`npm run sps:compile -- --scenario=${contentId}`, { stdio: verbose ? 'inherit' : 'pipe' });
        console.log(chalk.green(`✅ Recompiled scenario ${contentId}`));
      } catch (error) {
        console.error(chalk.red(`Failed to recompile scenario: ${error instanceof Error ? error.message : String(error)}`));
      }
    }
    
  } catch (error) {
    console.error(chalk.red(`Failed to update version: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

// Execute the version bumping
bumpVersion().catch(error => {
  console.error(chalk.red(`Fatal error: ${error.message}`));
  process.exit(1);
});
