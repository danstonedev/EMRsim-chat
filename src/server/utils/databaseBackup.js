const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { exec } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);
const mkdirPromise = promisify(fs.mkdir);
const existsPromise = promisify(fs.exists);

// Configuration
const config = {
  dbPath: process.env.DB_PATH || path.join(__dirname, '../../data/database.sqlite'),
  backupDir: process.env.BACKUP_DIR || path.join(__dirname, '../../backups'),
  retentionPolicy: {
    daily: 7,    // Keep 7 daily backups
    weekly: 4,   // Keep 4 weekly backups
    monthly: 6,  // Keep 6 monthly backups
  },
  verifyBackup: true,
};

// Ensure backup directory exists
async function ensureBackupDir() {
  const dirExists = await existsPromise(config.backupDir);
  if (!dirExists) {
    await mkdirPromise(config.backupDir, { recursive: true });
  }
  
  // Create subdirectories for different backup types
  const subDirs = ['daily', 'weekly', 'monthly'];
  for (const dir of subDirs) {
    const subDirPath = path.join(config.backupDir, dir);
    const subDirExists = await existsPromise(subDirPath);
    if (!subDirExists) {
      await mkdirPromise(subDirPath, { recursive: true });
    }
  }
}

// Generate backup filename based on date
function getBackupFilename() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  
  return `backup_${year}${month}${day}_${hour}${minute}.sqlite`;
}

// Create SQLite backup
async function createBackup() {
  try {
    // Ensure backup directories exist
    await ensureBackupDir();
    
    // Generate backup filename
    const filename = getBackupFilename();
    const backupPath = path.join(config.backupDir, 'daily', filename);
    
    console.log(`Creating SQLite backup: ${backupPath}`);
    
    // Create backup using SQLite .backup command
    const db = new sqlite3.Database(config.dbPath);
    
    return new Promise((resolve, reject) => {
      const backupDb = new sqlite3.Database(backupPath);
      
      db.serialize(() => {
        // Create a backup
        db.run('BEGIN IMMEDIATE TRANSACTION');
        db.backup(backupDb, 'main', 'main', -1, 
          (progress) => {
            if (progress.remaining === 0) {
              console.log('Backup completed successfully');
            }
          }, 
          (err) => {
            if (err) {
              console.error('Backup failed:', err);
              reject(err);
            } else {
              db.run('COMMIT', () => {
                db.close();
                backupDb.close();
                resolve(backupPath);
              });
            }
          }
        );
      });
    });
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
}

// Verify backup integrity
async function verifyBackup(backupPath) {
  try {
    console.log(`Verifying backup integrity: ${backupPath}`);
    
    // Try to open the database and run a simple query
    const db = new sqlite3.Database(backupPath);
    
    return new Promise((resolve, reject) => {
      db.get('PRAGMA integrity_check', (err, result) => {
        db.close();
        
        if (err) {
          console.error('Backup verification failed:', err);
          reject(err);
        } else if (result.integrity_check !== 'ok') {
          console.error('Backup is corrupted:', result);
          reject(new Error(`Backup integrity check failed: ${result.integrity_check}`));
        } else {
          console.log('Backup verified successfully');
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.error('Error verifying backup:', error);
    throw error;
  }
}

// Apply retention policy
async function applyRetentionPolicy() {
  try {
    console.log('Applying backup retention policy');
    
    // Get all backup files
    const dailyFiles = fs.readdirSync(path.join(config.backupDir, 'daily'))
      .filter(file => file.startsWith('backup_'))
      .sort()
      .reverse();
    
    // Remove old daily backups
    if (dailyFiles.length > config.retentionPolicy.daily) {
      const filesToRemove = dailyFiles.slice(config.retentionPolicy.daily);
      for (const file of filesToRemove) {
        fs.unlinkSync(path.join(config.backupDir, 'daily', file));
        console.log(`Removed old daily backup: ${file}`);
      }
    }
    
    // Create weekly backup (on Sundays)
    const now = new Date();
    if (now.getDay() === 0 && dailyFiles.length > 0) {
      const latestDaily = dailyFiles[0];
      const weeklyPath = path.join(config.backupDir, 'weekly', latestDaily);
      fs.copyFileSync(path.join(config.backupDir, 'daily', latestDaily), weeklyPath);
      console.log(`Created weekly backup: ${weeklyPath}`);
      
      // Apply weekly retention policy
      const weeklyFiles = fs.readdirSync(path.join(config.backupDir, 'weekly'))
        .filter(file => file.startsWith('backup_'))
        .sort()
        .reverse();
      
      if (weeklyFiles.length > config.retentionPolicy.weekly) {
        const filesToRemove = weeklyFiles.slice(config.retentionPolicy.weekly);
        for (const file of filesToRemove) {
          fs.unlinkSync(path.join(config.backupDir, 'weekly', file));
          console.log(`Removed old weekly backup: ${file}`);
        }
      }
    }
    
    // Create monthly backup (on 1st of the month)
    if (now.getDate() === 1 && dailyFiles.length > 0) {
      const latestDaily = dailyFiles[0];
      const monthlyPath = path.join(config.backupDir, 'monthly', latestDaily);
      fs.copyFileSync(path.join(config.backupDir, 'daily', latestDaily), monthlyPath);
      console.log(`Created monthly backup: ${monthlyPath}`);
      
      // Apply monthly retention policy
      const monthlyFiles = fs.readdirSync(path.join(config.backupDir, 'monthly'))
        .filter(file => file.startsWith('backup_'))
        .sort()
        .reverse();
      
      if (monthlyFiles.length > config.retentionPolicy.monthly) {
        const filesToRemove = monthlyFiles.slice(config.retentionPolicy.monthly);
        for (const file of filesToRemove) {
          fs.unlinkSync(path.join(config.backupDir, 'monthly', file));
          console.log(`Removed old monthly backup: ${file}`);
        }
      }
    }
  } catch (error) {
    console.error('Error applying retention policy:', error);
    throw error;
  }
}

// Main backup function
async function performBackup() {
  try {
    console.log('Starting database backup process');
    
    // Create backup
    const backupPath = await createBackup();
    
    // Verify backup if configured
    if (config.verifyBackup) {
      await verifyBackup(backupPath);
    }
    
    // Apply retention policy
    await applyRetentionPolicy();
    
    console.log('Backup process completed successfully');
    return { success: true, backupPath };
  } catch (error) {
    console.error('Backup process failed:', error);
    return { success: false, error };
  }
}

// Export the backup function
module.exports = {
  performBackup,
  config
};

// Execute backup if this script is run directly
if (require.main === module) {
  performBackup()
    .then(result => {
      if (result.success) {
        console.log('Backup executed successfully');
        process.exit(0);
      } else {
        console.error('Backup failed:', result.error);
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Unhandled error during backup:', err);
      process.exit(1);
    });
}
