/**
 * Bundle Analysis Script
 * 
 * Analyzes webpack bundle sizes and generates reports.
 * Helps track size changes between builds to enforce performance budgets.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const chalk = require('chalk');
const Table = require('cli-table3');
const filesize = require('filesize');

// Configuration
const BUILD_DIR = path.resolve(__dirname, '../dist');
const STATS_FILE = path.resolve(__dirname, '../reports/bundle-stats.json');
const HISTORY_FILE = path.resolve(__dirname, '../reports/bundle-history.json');
const MAX_BUNDLE_SIZE = 500 * 1024; // 500KB
const MAX_INITIAL_LOAD = 1024 * 1024; // 1MB

/**
 * Run webpack build with analyzer
 */
function runBuildWithAnalyzer() {
  return new Promise((resolve, reject) => {
    console.log(chalk.blue('Building and analyzing bundle...'));
    
    // Make sure reports directory exists
    const reportsDir = path.resolve(__dirname, '../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    // Run production build with analyzer flag
    exec('npm run build -- --env ANALYZE=true', (error, stdout, stderr) => {
      if (error) {
        console.error(chalk.red('Build failed:'), error);
        return reject(error);
      }
      
      console.log(stdout);
      resolve();
    });
  });
}

/**
 * Load stats file
 */
function loadStats() {
  if (!fs.existsSync(STATS_FILE)) {
    throw new Error(`Stats file not found: ${STATS_FILE}`);
  }
  
  return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
}

/**
 * Analyze bundle sizes
 */
function analyzeBundleSizes(stats) {
  // Get all JS chunks
  const assets = stats.assets
    .filter(asset => asset.name.endsWith('.js'))
    .sort((a, b) => b.size - a.size);
  
  // Calculate total size
  const totalSize = assets.reduce((sum, asset) => sum + asset.size, 0);
  
  // Calculate initial load size (entry chunk + framework + vendors)
  const initialLoadAssets = assets.filter(asset => 
    asset.name.includes('main') || 
    asset.name.includes('framework') || 
    asset.name.includes('vendors') ||
    asset.name.includes('commons')
  );
  
  const initialLoadSize = initialLoadAssets.reduce((sum, asset) => sum + asset.size, 0);
  
  // Prepare report data
  const report = {
    timestamp: new Date().toISOString(),
    totalSize,
    initialLoadSize,
    largestChunks: assets.slice(0, 10).map(asset => ({
      name: asset.name,
      size: asset.size
    }))
  };
  
  return report;
}

/**
 * Update bundle history
 */
function updateBundleHistory(report) {
  let history = [];
  
  // Load existing history if available
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    } catch (e) {
      console.warn(chalk.yellow('Failed to parse history file, creating new one'));
    }
  }
  
  // Add current report to history (keep last 10 entries)
  history.push(report);
  if (history.length > 10) {
    history = history.slice(history.length - 10);
  }
  
  // Save updated history
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  
  // Return previous build for comparison
  return history.length > 1 ? history[history.length - 2] : null;
}

/**
 * Print bundle analysis report
 */
function printReport(report, previousReport) {
  console.log(chalk.bold('\n=== Bundle Size Analysis ===\n'));
  
  // Print summary
  console.log(chalk.bold('Summary:'));
  console.log(`Total bundle size: ${chalk.cyan(filesize(report.totalSize))}`);
  console.log(`Initial load size: ${chalk.cyan(filesize(report.initialLoadSize))}`);
  
  // Show comparison with previous build if available
  if (previousReport) {
    const totalDiff = report.totalSize - previousReport.totalSize;
    const initialDiff = report.initialLoadSize - previousReport.initialLoadSize;
    
    const totalDiffStr = totalDiff > 0 
      ? chalk.red(`+${filesize(totalDiff)}`)
      : chalk.green(`${filesize(totalDiff)}`);
      
    const initialDiffStr = initialDiff > 0
      ? chalk.red(`+${filesize(initialDiff)}`)
      : chalk.green(`${filesize(initialDiff)}`);
    
    console.log(`Change in total size: ${totalDiffStr}`);
    console.log(`Change in initial load: ${initialDiffStr}`);
  }
  
  // Check against performance budgets
  const isInitialLoadTooLarge = report.initialLoadSize > MAX_INITIAL_LOAD;
  const hasChunksTooLarge = report.largestChunks.some(chunk => chunk.size > MAX_BUNDLE_SIZE);
  
  if (isInitialLoadTooLarge) {
    console.log(chalk.red(`\n⚠️ WARNING: Initial load size exceeds budget of ${filesize(MAX_INITIAL_LOAD)}`));
  }
  
  if (hasChunksTooLarge) {
    console.log(chalk.red(`\n⚠️ WARNING: Some chunks exceed individual size budget of ${filesize(MAX_BUNDLE_SIZE)}`));
  }
  
  // Print largest chunks
  console.log(chalk.bold('\nLargest chunks:'));
  const table = new Table({
    head: ['Chunk', 'Size', 'Budget'],
    colWidths: [40, 20, 20]
  });
  
  report.largestChunks.forEach(chunk => {
    const isOverBudget = chunk.size > MAX_BUNDLE_SIZE;
    const sizeStr = isOverBudget 
      ? chalk.red(filesize(chunk.size)) 
      : filesize(chunk.size);
      
    const budgetStr = isOverBudget
      ? chalk.red(`${Math.round(chunk.size / MAX_BUNDLE_SIZE * 100)}% of budget`)
      : `${Math.round(chunk.size / MAX_BUNDLE_SIZE * 100)}% of budget`;
      
    table.push([chunk.name, sizeStr, budgetStr]);
  });
  
  console.log(table.toString());
  
  console.log(chalk.bold('\nRecommendations:'));
  if (isInitialLoadTooLarge) {
    console.log('- Move more components to lazy loading');
    console.log('- Consider using dynamic imports for large libraries');
    console.log('- Review and remove unused dependencies');
  }
  
  if (hasChunksTooLarge) {
    console.log('- Check dependencies in large chunks and consider alternatives');
    console.log('- Review code splitting configuration');
    console.log('- Consider further modularizing your components');
  }
  
  // Print success message if everything is good
  if (!isInitialLoadTooLarge && !hasChunksTooLarge) {
    console.log(chalk.green('\n✅ All bundle sizes are within performance budgets!'));
  }
  
  console.log(chalk.blue('\nDetailed report available at:'));
  console.log(path.resolve(__dirname, '../reports/bundle-report.html'));
}

/**
 * Main function
 */
async function main() {
  try {
    // Run build with analyzer
    await runBuildWithAnalyzer();
    
    // Load stats and analyze
    const stats = loadStats();
    const report = analyzeBundleSizes(stats);
    
    // Update history and get previous report
    const previousReport = updateBundleHistory(report);
    
    // Print report
    printReport(report, previousReport);
    
    // Check for performance budget violations
    const isInitialLoadTooLarge = report.initialLoadSize > MAX_INITIAL_LOAD;
    const hasChunksTooLarge = report.largestChunks.some(chunk => chunk.size > MAX_BUNDLE_SIZE);
    
    if (isInitialLoadTooLarge || hasChunksTooLarge) {
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('Bundle analysis failed:'), error);
    process.exit(1);
  }
}

// Run main function
main();
