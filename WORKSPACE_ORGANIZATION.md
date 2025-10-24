# VS Code Tasks and Environment Variables Organization

This document outlines how to organize your VS Code tasks and environment variables to eliminate redundancy and improve clarity in your EMRsim-chat workspace.

## Table of Contents
- [Fixing Redundant VS Code Tasks](#fixing-redundant-vs-code-tasks)
- [Centralizing Environment Variables](#centralizing-environment-variables)
- [Managing Multiple package.json Files](#managing-multiple-packagejson-files)

## Fixing Redundant VS Code Tasks

The issue appears to be duplicate tasks with identical labels in your tasks.json file. Here's how to consolidate them:

1. **Open your VS Code tasks file**:
   ```powershell
   code .vscode/tasks.json
   ```

2. **Replace with organized structure**:

```json
{
    "version": "2.0.0",
    "tasks": [
        // Frontend Tasks
        {
            "label": "Frontend: Dev Server",
            "type": "npm",
            "script": "dev",
            "path": "frontend/",
            "problemMatcher": [],
            "group": "build",
            "detail": "Run frontend development server"
        },
        {
            "label": "Frontend: Type Check",
            "type": "npm",
            "script": "typecheck",
            "path": "frontend/",
            "problemMatcher": ["$tsc"],
            "group": "build",
            "detail": "Run TypeScript type checking for frontend"
        },
        {
            "label": "Frontend: Build",
            "type": "npm",
            "script": "build",
            "path": "frontend/",
            "problemMatcher": [],
            "group": "build",
            "detail": "Build frontend for production"
        },
        {
            "label": "Frontend: Test",
            "type": "npm",
            "script": "test",
            "path": "frontend/",
            "problemMatcher": [],
            "group": "test",
            "detail": "Run frontend tests"
        },
        
        // Backend Tasks
        {
            "label": "Backend: Dev Server",
            "type": "npm",
            "script": "dev",
            "path": "backend/",
            "problemMatcher": [],
            "group": "build",
            "detail": "Run backend development server"
        },
        {
            "label": "Backend: Type Check",
            "type": "npm",
            "script": "build:types",
            "path": "backend/",
            "problemMatcher": ["$tsc"],
            "group": "build",
            "detail": "Run TypeScript type checking for backend"
        },
        {
            "label": "Backend: Build",
            "type": "npm",
            "script": "build",
            "path": "backend/",
            "problemMatcher": [],
            "group": "build",
            "detail": "Build backend for production"
        },
        {
            "label": "Backend: Test",
            "type": "npm",
            "script": "test",
            "path": "backend/",
            "problemMatcher": [],
            "group": "test",
            "detail": "Run backend tests"
        },
        {
            "label": "Backend: Validate SPS",
            "type": "npm",
            "script": "sps:validate",
            "path": "backend/",
            "problemMatcher": [],
            "group": "test",
            "detail": "Validate SPS content"
        },
        
        // Full-Stack Tasks
        {
            "label": "Full-Stack: Dev Environment",
            "dependsOn": [
                "Backend: Dev Server", 
                "Frontend: Dev Server"
            ],
            "problemMatcher": [],
            "group": {
                "kind": "build",
                "isDefault": true
            },
            "detail": "Start both frontend and backend development servers"
        },
        {
            "label": "Full-Stack: Type Check",
            "dependsOn": [
                "Backend: Type Check", 
                "Frontend: Type Check"
            ],
            "problemMatcher": [],
            "detail": "Run TypeScript type checking for frontend and backend"
        },
        {
            "label": "Full-Stack: Build All",
            "dependsOn": [
                "Backend: Build", 
                "Frontend: Build"
            ],
            "problemMatcher": [],
            "detail": "Build frontend and backend for production"
        },
        {
            "label": "Full-Stack: Test All",
            "dependsOn": [
                "Backend: Test",
                "Backend: Validate SPS",
                "Frontend: Test"
            ],
            "problemMatcher": [],
            "group": "test",
            "detail": "Run all tests for frontend and backend"
        }
    ]
}
```

## Centralizing Environment Variables

To simplify environment variable management:

### 1. Create Environment Setup Script

Create `scripts/setup-env.js`:

```javascript
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');

// Define the environment files to create/update
const ENV_FILES = [
  { 
    source: 'backend/.env.example', 
    target: 'backend/.env', 
    description: 'Backend environment file' 
  },
  { 
    source: 'frontend/.env.local.example', 
    target: 'frontend/.env.local', 
    description: 'Frontend environment file' 
  }
];

// Create interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('EMRsim Environment Setup');
console.log('========================');

// Process each environment file
const processNextFile = (index = 0) => {
  if (index >= ENV_FILES.length) {
    console.log('\nEnvironment setup complete! 🚀');
    console.log('\nNext steps:');
    console.log('1. Edit backend/.env with your API keys');
    console.log('2. Edit frontend/.env.local if needed');
    console.log('3. Run "npm run dev" to start the development servers');
    rl.close();
    return;
  }

  const { source, target, description } = ENV_FILES[index];
  
  // Check if source exists
  if (!fs.existsSync(source)) {
    console.log(`⚠️ Warning: ${source} not found, skipping...`);
    processNextFile(index + 1);
    return;
  }

  console.log(`\nSetting up ${description} (${target})`);
  
  // Check if target already exists
  if (fs.existsSync(target)) {
    rl.question(`${target} already exists. Overwrite? (y/N) `, (answer) => {
      if (answer.toLowerCase() === 'y') {
        copyAndEditFile(source, target, () => processNextFile(index + 1));
      } else {
        console.log(`Skipped ${target}`);
        processNextFile(index + 1);
      }
    });
  } else {
    copyAndEditFile(source, target, () => processNextFile(index + 1));
  }
};

// Copy and optionally edit environment file
const copyAndEditFile = (source, target, callback) => {
  fs.copyFile(source, target, (err) => {
    if (err) {
      console.error(`Error copying ${source} to ${target}:`, err);
      callback();
      return;
    }
    
    console.log(`✅ Created ${target}`);
    rl.question('Do you want to edit this file now? (y/N) ', (answer) => {
      if (answer.toLowerCase() === 'y') {
        exec(`code ${target}`, (err) => {
          if (err) {
            console.log(`Could not open ${target} in VS Code. Please edit it manually.`);
          }
          callback();
        });
      } else {
        callback();
      }
    });
  });
};

// Start processing files
processNextFile();
```

### 2. Add Script to package.json

Add to your root `package.json`:

```json
{
  "scripts": {
    "setup-env": "node scripts/setup-env.js"
  }
}
```

### 3. Environment Variables Documentation

#### Backend Environment Variables

| Variable           | Required | Default | Description                               |
|--------------------|----------|---------|-------------------------------------------|
| PORT               | No       | 3002    | Port for the backend server               |
| SOCKET_PORT        | No       | 3003    | Port for Socket.IO server                 |
| NODE_ENV           | No       | dev     | Node environment (dev/production)         |
| LOG_LEVEL          | No       | info    | Logging level                             |
| OPENAI_API_KEY     | Yes      | -       | OpenAI API key                            |
| ANTHROPIC_API_KEY  | No       | -       | Anthropic API key (optional)              |
| SQLITE_PATH        | No       | ./data/emrsim.db | SQLite database path           |
| CORS_ORIGIN        | No       | http://localhost:5173 | CORS allowed origin     |

#### Frontend Environment Variables

| Variable                   | Required | Default | Description                      |
|----------------------------|----------|---------|----------------------------------|
| VITE_API_URL               | No       | http://localhost:3002 | Backend API URL  |
| VITE_SOCKET_URL            | No       | http://localhost:3003 | Socket.IO URL    |

#### Usage

Run `npm run setup-env` from the project root to set up all environment files.

## Managing Multiple package.json Files

To prevent dependency sync issues:

### 1. Create Dependency Management Script

Create `scripts/manage-deps.js`:

```javascript
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
```

### 2. Add Scripts to package.json

Add to your root `package.json`:

```json
{
  "scripts": {
    "deps:check": "node scripts/manage-deps.js check",
    "deps:install-all": "node scripts/manage-deps.js install-all"
  }
}
```

## Implementation Steps

### Step 1: Backup Current Configuration
```powershell
# Create backup of tasks.json
Copy-Item .vscode\tasks.json .vscode\tasks.json.backup
```

### Step 2: Update tasks.json
Replace your `.vscode/tasks.json` with the organized structure above.

### Step 3: Create Scripts Directory
```powershell
# Create scripts directory if it doesn't exist
if (!(Test-Path scripts)) { New-Item -ItemType Directory -Path scripts }
```

### Step 4: Create Helper Scripts
- Copy the `setup-env.js` code to `scripts/setup-env.js`
- Copy the `manage-deps.js` code to `scripts/manage-deps.js`

### Step 5: Update package.json
Add the new scripts to your root `package.json`:

```json
{
  "scripts": {
    "setup-env": "node scripts/setup-env.js",
    "deps:check": "node scripts/manage-deps.js check",
    "deps:install-all": "node scripts/manage-deps.js install-all"
  }
}
```

### Step 6: Test the Changes
```powershell
# Test environment setup
npm run setup-env

# Test dependency checking
npm run deps:check

# Test VS Code tasks
# Press Ctrl+Shift+P -> "Tasks: Run Task" -> Select a task
```

## Summary

By implementing these changes, you'll have:

1. ✅ Organized VS Code tasks with clear structure and no duplicates
2. ✅ Centralized environment variable management with documentation
3. ✅ Tools to manage dependencies across multiple package.json files

## Troubleshooting

### Tasks Not Showing Up
- Reload VS Code window: `Ctrl+Shift+P` -> "Developer: Reload Window"
- Check tasks.json syntax: Ensure all JSON is valid

### Environment Setup Fails
- Ensure `.env.example` files exist in backend and frontend directories
- Run with administrator privileges if permission errors occur

### Dependency Conflicts
- Run `npm run deps:check` to identify version mismatches
- Update versions manually in package.json files to match
- Run `npm run deps:install-all` to reinstall all dependencies
