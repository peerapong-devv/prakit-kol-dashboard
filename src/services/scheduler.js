const cron = require('node-cron');
const { Op } = require('sequelize');
const config = require('../config');
const logger = require('../utils/logger');
const { Platform, Kol } = require('../models');
const { addScrapeJob } = require('../queue/scrapeQueue');

class Scheduler {
  constructor() {
    this.tasks = new Map();
  }

  start() {
    // Schedule weekly scraping
    this.scheduleWeeklyScrape();
    
    // Schedule daily priority scraping for top KOLs
    this.scheduleDailyScrape();
    
    // Schedule health check
    this.scheduleHealthCheck();
    
    logger.info('Scheduler started');
  }

  scheduleWeeklyScrape() {
    // Run every Sunday at midnight (or as configured)
    const task = cron.schedule(config.schedule.scrapeSchedule, async () => {
      logger.info('Starting weekly scrape job');
      
      try {
        // Get all active platforms
        const platforms = await Platform.findAll({
          include: [{
            model: Kol,
            as: 'kol',
            where: { isActive: true },
          }],
        });
        
        logger.info(`Found ${platforms.length} platforms to scrape`);
        
        // Add scrape jobs for each platform
        for (const platform of platforms) {
          await addScrapeJob(
            platform.id,
            platform.platformType,
            platform.profileUrl,
            platform.username,
            {
              priority: 1, // Normal priority
              delay: Math.random() * 60000, // Random delay up to 1 minute
            }
          );
        }
        
        logger.info('Weekly scrape jobs queued successfully');
      } catch (error) {
        logger.error('Failed to queue weekly scrape jobs:', error);
      }
    });
    
    this.tasks.set('weekly-scrape', task);
  }

  scheduleDailyScrape() {
    // Run every day at 2 AM for high-priority KOLs
    const task = cron.schedule('0 2 * * *', async () => {
      logger.info('Starting daily priority scrape job');
      
      try {
        // Get top KOLs (those with high engagement or marked as priority)
        const platforms = await Platform.findAll({
          include: [{
            model: Kol,
            as: 'kol',
            where: { 
              isActive: true,
              [Op.or]: [
                { '$kol.metadata.priority$': true },
                { '$kol.metadata.tier$': 'top' },
              ],
            },
          }],
          limit: 50, // Limit to top 50 KOLs
        });
        
        logger.info(`Found ${platforms.length} priority platforms to scrape`);
        
        // Add high-priority scrape jobs
        for (const platform of platforms) {
          await addScrapeJob(
            platform.id,
            platform.platformType,
            platform.profileUrl,
            platform.username,
            {
              priority: 0, // High priority
              delay: Math.random() * 30000, // Random delay up to 30 seconds
            }
          );
        }
        
        logger.info('Daily priority scrape jobs queued successfully');
      } catch (error) {
        logger.error('Failed to queue daily scrape jobs:', error);
      }
    });
    
    this.tasks.set('daily-scrape', task);
  }

  scheduleHealthCheck() {
    // Run health check every hour
    const task = cron.schedule('0 * * * *', async () => {
      logger.info('Running health check');
      
      try {
        // Check failed scrapes in last 24 hours
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const failedPlatforms = await Platform.findAll({
          where: {
            scrapeStatus: 'failed',
            lastScrapedAt: {
              [Op.gte]: yesterday,
            },
          },
        });
        
        if (failedPlatforms.length > 0) {
          logger.warn(`Found ${failedPlatforms.length} failed scrapes in last 24 hours`);
          
          // Retry failed scrapes
          for (const platform of failedPlatforms) {
            await addScrapeJob(
              platform.id,
              platform.platformType,
              platform.profileUrl,
              platform.username,
              {
                priority: 2, // Low priority
                delay: Math.random() * 120000, // Random delay up to 2 minutes
              }
            );
          }
        }
        
        // Check platforms that haven't been scraped in over 2 weeks
        const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        const stalePlatforms = await Platform.findAll({
          where: {
            [Op.or]: [
              { lastScrapedAt: null },
              { lastScrapedAt: { [Op.lt]: twoWeeksAgo } },
            ],
          },
          include: [{
            model: Kol,
            as: 'kol',
            where: { isActive: true },
          }],
        });
        
        if (stalePlatforms.length > 0) {
          logger.warn(`Found ${stalePlatforms.length} stale platforms`);
          
          // Queue stale platforms for scraping
          for (const platform of stalePlatforms) {
            await addScrapeJob(
              platform.id,
              platform.platformType,
              platform.profileUrl,
              platform.username,
              {
                priority: 1,
                delay: Math.random() * 180000, // Random delay up to 3 minutes
              }
            );
          }
        }
        
        logger.info('Health check completed');
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    });
    
    this.tasks.set('health-check', task);
  }

  // Manual trigger methods
  async triggerWeeklyScrape() {
    logger.info('Manually triggering weekly scrape');
    const task = this.tasks.get('weekly-scrape');
    if (task) {
      await task.now();
    }
  }

  async triggerDailyScrape() {
    logger.info('Manually triggering daily scrape');
    const task = this.tasks.get('daily-scrape');
    if (task) {
      await task.now();
    }
  }

  async triggerSingleKolScrape(kolId) {
    logger.info(`Manually triggering scrape for KOL ${kolId}`);
    
    try {
      const platforms = await Platform.findAll({
        where: { kolId },
      });
      
      for (const platform of platforms) {
        await addScrapeJob(
          platform.id,
          platform.platformType,
          platform.profileUrl,
          platform.username,
          {
            priority: 0, // High priority for manual triggers
          }
        );
      }
      
      logger.info(`Queued ${platforms.length} scrape jobs for KOL ${kolId}`);
    } catch (error) {
      logger.error(`Failed to trigger scrape for KOL ${kolId}:`, error);
      throw error;
    }
  }

  stop() {
    // Stop all scheduled tasks
    for (const [name, task] of this.tasks) {
      task.stop();
      logger.info(`Stopped scheduled task: ${name}`);
    }
    
    this.tasks.clear();
    logger.info('Scheduler stopped');
  }

  getStatus() {
    const status = {};
    for (const [name, task] of this.tasks) {
      status[name] = {
        running: task.running,
      };
    }
    return status;
  }
}

module.exports = new Scheduler();