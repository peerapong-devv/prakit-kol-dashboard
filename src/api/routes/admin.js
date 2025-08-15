const express = require('express');
const { getQueueStatus, clearQueue, pauseQueue, resumeQueue } = require('../../queue/scrapeQueue');
const scheduler = require('../../services/scheduler');
const { ScrapeLog, Platform } = require('../../models');
const { Op } = require('sequelize');
const logger = require('../../utils/logger');

const router = express.Router();

// Get queue status
router.get('/queue/status', async (req, res) => {
  try {
    const status = await getQueueStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Error getting queue status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get queue status',
    });
  }
});

// Clear queue
router.post('/queue/clear', async (req, res) => {
  try {
    await clearQueue();
    res.json({
      success: true,
      message: 'Queue cleared successfully',
    });
  } catch (error) {
    logger.error('Error clearing queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear queue',
    });
  }
});

// Pause queue
router.post('/queue/pause', async (req, res) => {
  try {
    await pauseQueue();
    res.json({
      success: true,
      message: 'Queue paused successfully',
    });
  } catch (error) {
    logger.error('Error pausing queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pause queue',
    });
  }
});

// Resume queue
router.post('/queue/resume', async (req, res) => {
  try {
    await resumeQueue();
    res.json({
      success: true,
      message: 'Queue resumed successfully',
    });
  } catch (error) {
    logger.error('Error resuming queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resume queue',
    });
  }
});

// Get scheduler status
router.get('/scheduler/status', async (req, res) => {
  try {
    const status = scheduler.getStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Error getting scheduler status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scheduler status',
    });
  }
});

// Trigger weekly scrape
router.post('/scheduler/trigger/weekly', async (req, res) => {
  try {
    await scheduler.triggerWeeklyScrape();
    res.json({
      success: true,
      message: 'Weekly scrape triggered successfully',
    });
  } catch (error) {
    logger.error('Error triggering weekly scrape:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger weekly scrape',
    });
  }
});

// Trigger daily scrape
router.post('/scheduler/trigger/daily', async (req, res) => {
  try {
    await scheduler.triggerDailyScrape();
    res.json({
      success: true,
      message: 'Daily scrape triggered successfully',
    });
  } catch (error) {
    logger.error('Error triggering daily scrape:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger daily scrape',
    });
  }
});

// Get scrape logs
router.get('/logs/scrapes', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status = '',
      platform = '',
      startDate = '',
      endDate = '',
    } = req.query;
    
    const offset = (page - 1) * limit;
    const whereClause = {};
    
    if (status) {
      whereClause.status = status;
    }
    if (platform) {
      whereClause.platform = platform;
    }
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        whereClause.createdAt[Op.lte] = new Date(endDate);
      }
    }
    
    const { count, rows } = await ScrapeLog.findAndCountAll({
      where: whereClause,
      include: [{
        model: Platform,
        as: 'platform',
        attributes: ['id', 'platformType', 'username'],
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
    });
    
    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching scrape logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scrape logs',
    });
  }
});

// Get system stats
router.get('/stats', async (req, res) => {
  try {
    const [
      totalKols,
      totalPlatforms,
      totalMetrics,
      recentScrapes,
      failedScrapes,
    ] = await Promise.all([
      require('../../models').Kol.count(),
      Platform.count(),
      require('../../models').Metric.count(),
      ScrapeLog.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
          status: 'success',
        },
      }),
      ScrapeLog.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
          status: 'failed',
        },
      }),
    ]);
    
    const queueStatus = await getQueueStatus();
    
    res.json({
      success: true,
      data: {
        totalKols,
        totalPlatforms,
        totalMetrics,
        recentScrapes,
        failedScrapes,
        queue: queueStatus,
      },
    });
  } catch (error) {
    logger.error('Error fetching system stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system stats',
    });
  }
});

// Retry failed scrapes
router.post('/retry-failed', async (req, res) => {
  try {
    const { hours = 24 } = req.body;
    
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const failedPlatforms = await Platform.findAll({
      where: {
        scrapeStatus: 'failed',
        lastScrapedAt: {
          [Op.gte]: since,
        },
      },
    });
    
    for (const platform of failedPlatforms) {
      await require('../../queue/scrapeQueue').addScrapeJob(
        platform.id,
        platform.platformType,
        platform.profileUrl,
        platform.username,
        {
          priority: 2,
          delay: Math.random() * 60000,
        }
      );
    }
    
    res.json({
      success: true,
      message: `Queued ${failedPlatforms.length} failed scrapes for retry`,
    });
  } catch (error) {
    logger.error('Error retrying failed scrapes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retry scrapes',
    });
  }
});

module.exports = router;