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
