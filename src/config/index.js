require('dotenv').config();

module.exports = {
  database: {
    url: process.env.DATABASE_URL || 'sqlite://./data/kol_database.db',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
  },
  scraping: {
    delayMin: parseInt(process.env.SCRAPE_DELAY_MIN) || 2000,
    delayMax: parseInt(process.env.SCRAPE_DELAY_MAX) || 10000,
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_SCRAPES) || 2,
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS) || 3,
    userAgents: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    ],
  },
  proxy: {
    url: process.env.PROXY_URL || null,
    username: process.env.PROXY_USERNAME || null,
    password: process.env.PROXY_PASSWORD || null,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs/app.log',
  },
  security: {
    sessionSecret: process.env.SESSION_SECRET || 'default-secret-change-me',
  },
  schedule: {
    scrapeSchedule: process.env.SCRAPE_SCHEDULE || '0 0 * * 0', // Every Sunday at midnight
  },
};