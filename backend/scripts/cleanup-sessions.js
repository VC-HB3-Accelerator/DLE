const sessionService = require('../services/session-service');
const db = require('../db');

async function cleanupSessions() {
  try {
    console.log('Starting session cleanup...');
    
    const result = await sessionService.cleanupProcessedGuestIds();
    
    if (result) {
      console.log('Session cleanup completed successfully');
    } else {
      console.log('Session cleanup failed');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupSessions(); 