// Add this to your server initialization code

// ... existing server code ...

// Import the scheduler
const { setupBackupSchedule } = require('./utils/scheduler');

// Initialize backup scheduler
setupBackupSchedule();

// ... rest of your server code ...
