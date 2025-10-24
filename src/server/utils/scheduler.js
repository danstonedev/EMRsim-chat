const cron = require('node-cron');
const { performBackup } = require('./databaseBackup');

// Configure backup schedule
function setupBackupSchedule() {
  // Schedule daily backup at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('Running scheduled database backup');
    try {
      const result = await performBackup();
      if (result.success) {
        console.log('Scheduled backup completed successfully');
      } else {
        console.error('Scheduled backup failed:', result.error);
      }
    } catch (error) {
      console.error('Error in scheduled backup:', error);
    }
  });
  
  console.log('Database backup scheduler initialized (daily at 2:00 AM)');
}

module.exports = {
  setupBackupSchedule
};
