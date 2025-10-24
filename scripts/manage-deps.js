const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const PACKAGE_PATHS = [
  path.join(ROOT_DIR, 'package.json'),
  path.join(ROOT_DIR, 'frontend', 'package.json'),
  path.join(ROOT_DIR, 'backend', 'package.json')
];

// Load package.json files
const packages = PACKAGE_PATHS.map(filePath => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return {
      path: filePath,
      data: JSON.parse(content)
    };
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error.message);
    process.exit(1);
  }
});

// Find duplicate dependencies
const findDuplicates = () => {
  const allDeps = new Map();
  
  packages.forEach(pkg => {
    const pkgName = path.relative(ROOT_DIR, pkg.path);
    
    // Process regular dependencies
    for (const [dep, version] of Object.entries({
      ...pkg.data.dependencies || {},
      ...pkg.data.devDependencies || {}
    })) {
      if (!allDeps.has(dep)) {
        allDeps.set(dep, []);
      }
      allDeps.get(dep).push({ pkgName, version });
    }
  });
  
  // Find and log duplicates with version mismatches
  console.log('Analyzing dependencies across package.json files...\n');
  let hasMismatches = false;
  
  for (const [dep, instances] of allDeps) {
    if (instances.length > 1) {
      const versions = new Set(instances.map(i => i.version));
      
      if (versions.size > 1) {
        hasMismatches = true;
        console.log(`⚠️ Dependency "${dep}" has version mismatches:`);
        instances.forEach(({ pkgName, version }) => {
          console.log(`  - ${pkgName}: ${version}`);
        });
        console.log('');
      }
    }
  }
  
  if (!hasMismatches) {
    console.log('✅ No dependency version mismatches found.\n');
  }
  
  return hasMismatches;
};

// Execute command
const command = process.argv[2];

if (command === 'check') {
  findDuplicates();
} else if (command === 'install-all') {
  console.log('Installing dependencies in all packages...\n');
  
  const dirs = [ROOT_DIR, path.join(ROOT_DIR, 'frontend'), path.join(ROOT_DIR, 'backend')];
  
  dirs.forEach(dir => {
    const relativePath = path.relative(ROOT_DIR, dir);
    const displayPath = relativePath || 'root';
    
    console.log(`📦 Installing dependencies in ${displayPath}...`);
    try {
      execSync('npm install', { cwd: dir, stdio: 'inherit' });
      console.log(`✅ Successfully installed dependencies in ${displayPath}\n`);
    } catch (error) {
      console.error(`❌ Failed to install dependencies in ${displayPath}\n`);
    }
  });
} else {
  console.log(`
EMRsim Dependency Manager

Commands:
  check        - Check for dependency version mismatches
  install-all  - Install dependencies in all packages
  
Example:
  node scripts/manage-deps.js check
`);
}
