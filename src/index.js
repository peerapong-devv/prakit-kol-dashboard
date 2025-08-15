const { startServer } = require('./api/server');
const logger = require('./utils/logger');

// Start the application
(async () => {
  try {
    logger.info('Starting KOL Directory application...');
    await startServer();
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
})();