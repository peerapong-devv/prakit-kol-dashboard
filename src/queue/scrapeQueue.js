const Bull = require('bull');
const config = require('../config');
const logger = require('../utils/logger');
const FacebookScraper = require('../scrapers/FacebookScraper');
const InstagramScraper = require('../scrapers/InstagramScraper');
const TikTokScraper = require('../scrapers/TikTokScraper');
const YoutubeScraper = require('../scrapers/YoutubeScraper');
const { Platform, Metric } = require('../models');

// Create queue
const scrapeQueue = new Bull('scrape-queue', config.redis.url);

// Queue configuration
scrapeQueue.concurrency = config.scraping.maxConcurrent;

// Process jobs
scrapeQueue.process(async (job) => {
  const { platformId, platformType, url, username } = job.data;
  logger.info(`Processing scrape job for ${platformType}: ${url || username}`);
  
  let scraper;
  let result;
  
  try {
    // Update platform status
    await Platform.update(
      { scrapeStatus: 'pending', lastScrapedAt: new Date() },
      { where: { id: platformId } }
    );
    
    // Select appropriate scraper
    switch (platformType) {
      case 'facebook':
        scraper = new FacebookScraper();
        result = await scraper.scrape(url, platformId);
        break;
      
      case 'instagram':
        scraper = new InstagramScraper();
        result = await scraper.scrape(username, platformId);
        break;
      
      case 'tiktok':
        scraper = new TikTokScraper();
        result = await scraper.scrape(username, platformId);
        break;
      
      case 'youtube':
        scraper = new YoutubeScraper();
        result = await scraper.scrape(url || username, platformId);
        break;
      
      default:
        throw new Error(`Unknown platform type: ${platformType}`);
    }
    
    // Update platform status
    await Platform.update(
      { scrapeStatus: 'success' },
      { where: { id: platformId } }
    );
    
    logger.info(`Scrape job completed for ${platformType}: ${url || username}`);
    return result;
    
  } catch (error) {
    logger.error(`Scrape job failed for ${platformType}:`, error);
    
    // Update platform status
    await Platform.update(
      { scrapeStatus: 'failed' },
      { where: { id: platformId } }
    );
    
    throw error;
  }
});

// Event handlers
scrapeQueue.on('completed', (job, result) => {
  logger.info(`Job ${job.id} completed successfully`);
});

scrapeQueue.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed:`, err);
});

scrapeQueue.on('stalled', (job) => {
  logger.warn(`Job ${job.id} stalled`);
});

// Queue management functions
const addScrapeJob = async (platformId, platformType, url, username, options = {}) => {
  const jobOptions = {
    attempts: config.scraping.retryAttempts,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
    ...options,
  };
  
  const job = await scrapeQueue.add(
    {
      platformId,
      platformType,
      url,
      username,
    },
    jobOptions
  );
  
  logger.info(`Added scrape job ${job.id} for ${platformType}`);
  return job;
};

const getQueueStatus = async () => {
  const [waiting, active, completed, failed] = await Promise.all([
    scrapeQueue.getWaitingCount(),
    scrapeQueue.getActiveCount(),
    scrapeQueue.getCompletedCount(),
    scrapeQueue.getFailedCount(),
  ]);
  
  return {
    waiting,
    active,
    completed,
    failed,
  };
};

const clearQueue = async () => {
  await scrapeQueue.empty();
  logger.info('Queue cleared');
};

const pauseQueue = async () => {
  await scrapeQueue.pause();
  logger.info('Queue paused');
};

const resumeQueue = async () => {
  await scrapeQueue.resume();
  logger.info('Queue resumed');
};

module.exports = {
  scrapeQueue,
  addScrapeJob,
  getQueueStatus,
  clearQueue,
  pauseQueue,
  resumeQueue,
};