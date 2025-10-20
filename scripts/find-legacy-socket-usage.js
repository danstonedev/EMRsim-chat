/**
 * Script to identify all remaining usages of BackendSocketManager in the codebase
 */
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);

// Configuration
const sourceDir = path.resolve(__dirname, '../src');
const pattern = /BackendSocketManager/g;
const extensions = ['.ts', '.tsx', '.js', '.jsx'];

// Results storage
const results = {
  files: [],
  totalOccurrences: 0
};

/**
 * Recursively search for files matching the extensions
 */
async function findFiles(dir) {
  const files = await readdir(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stats = await stat(filePath);
    
    if (stats.isDirectory()) {
      // Skip node_modules and other irrelevant directories
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'build') {
        await findFiles(filePath);
      }
    } else if (stats.isFile() && extensions.includes(path.extname(file))) {
      await scanFile(filePath);
    }
  }
}

/**
 * Scan a file for the legacy pattern
 */
async function scanFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    const matches = content.match(pattern);
    
    if (matches && matches.length > 0) {
      const lines = content.split('\n');
      const matchingLines = [];
      
      // Find the line numbers where pattern occurs
      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          matchingLines.push({
            lineNumber: index + 1,
            content: line.trim()
          });
          
          // Reset the regex lastIndex
          pattern.lastIndex = 0;
        }
      });
      
      results.files.push({
        path: path.relative(path.resolve(__dirname, '..'), filePath),
        occurrences: matches.length,
        lines: matchingLines
      });
      
      results.totalOccurrences += matches.length;
    }
  } catch (err) {
    console.error(`Error scanning file ${filePath}:`, err.message);
  }
}

/**
 * Generate a report
 */
function generateReport() {
  console.log('\n=== BackendSocketManager Usage Report ===\n');
  console.log(`Total files with occurrences: ${results.files.length}`);
  console.log(`Total occurrences found: ${results.totalOccurrences}\n`);
  
  if (results.files.length > 0) {
    console.log('Files to refactor:');
    results.files.forEach(file => {
      console.log(`\n${file.path} (${file.occurrences} occurrences):`);
      file.lines.forEach(line => {
        console.log(`  Line ${line.lineNumber}: ${line.content}`);
      });
    });
  } else {
    console.log('No occurrences found! Migration complete.');
  }
  
  // Write to report file
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: results.files.length,
      totalOccurrences: results.totalOccurrences
    },
    files: results.files
  };
  
  fs.writeFileSync(
    path.resolve(__dirname, '../socket-migration-report.json'),
    JSON.stringify(report, null, 2)
  );
  
  console.log('\nReport saved to socket-migration-report.json');
}

/**
 * Main execution
 */
async function main() {
  console.log('Scanning codebase for BackendSocketManager usage...');
  await findFiles(sourceDir);
  generateReport();
}

// Run the script
main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
