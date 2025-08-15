const express = require('express');
const { Op } = require('sequelize');
const { Kol, Platform, Metric } = require('../../models');
const { addScrapeJob } = require('../../queue/scrapeQueue');
const scheduler = require('../../services/scheduler');
const logger = require('../../utils/logger');

const router = express.Router();

// Get all KOLs with pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      category = '',
      platform = '',
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    // Build where clause
    const whereClause = {};
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { bio: { [Op.like]: `%${search}%` } },
      ];
    }
    if (category) {
      whereClause.category = category;
    }
    
    // Build platform include clause
    const platformInclude = {
      model: Platform,
      as: 'platforms',
      include: [{
        model: Metric,
        as: 'metrics',
        limit: 1,
        order: [['capturedAt', 'DESC']],
      }],
    };
    
    if (platform) {
      platformInclude.where = { platformType: platform };
    }
    
    const { count, rows } = await Kol.findAndCountAll({
      where: whereClause,
      include: [platformInclude],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder]],
      distinct: true,
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
    logger.error('Error fetching KOLs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch KOLs',
    });
  }
});

// Get single KOL with full details
router.get('/:id', async (req, res) => {
  try {
    const kol = await Kol.findByPk(req.params.id, {
      include: [{
        model: Platform,
        as: 'platforms',
        include: [{
          model: Metric,
          as: 'metrics',
          limit: 30,
          order: [['capturedAt', 'DESC']],
        }],
      }],
    });
    
    if (!kol) {
      return res.status(404).json({
        success: false,
        error: 'KOL not found',
      });
    }
    
    res.json({
      success: true,
      data: kol,
    });
  } catch (error) {
    logger.error('Error fetching KOL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch KOL',
    });
  }
});

// Create new KOL
router.post('/', async (req, res) => {
  try {
    const { name, category, bio, avatarUrl, platforms } = req.body;
    
    // Create KOL
    const kol = await Kol.create({
      name,
      category,
      bio,
      avatarUrl,
    });
    
    // Create platforms if provided
    if (platforms && platforms.length > 0) {
      for (const platform of platforms) {
        await Platform.create({
          kolId: kol.id,
          platformType: platform.type,
          username: platform.username,
          profileUrl: platform.url,
        });
      }
    }
    
    // Fetch with platforms
    const kolWithPlatforms = await Kol.findByPk(kol.id, {
      include: [{
        model: Platform,
        as: 'platforms',
      }],
    });
    
    res.status(201).json({
      success: true,
      data: kolWithPlatforms,
    });
  } catch (error) {
    logger.error('Error creating KOL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create KOL',
    });
  }
});

// Update KOL
router.put('/:id', async (req, res) => {
  try {
    const kol = await Kol.findByPk(req.params.id);
    
    if (!kol) {
      return res.status(404).json({
        success: false,
        error: 'KOL not found',
      });
    }
    
    await kol.update(req.body);
    
    res.json({
      success: true,
      data: kol,
    });
  } catch (error) {
    logger.error('Error updating KOL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update KOL',
    });
  }
});

// Delete KOL
router.delete('/:id', async (req, res) => {
  try {
    const kol = await Kol.findByPk(req.params.id);
    
    if (!kol) {
      return res.status(404).json({
        success: false,
        error: 'KOL not found',
      });
    }
    
    await kol.destroy();
    
    res.json({
      success: true,
      message: 'KOL deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting KOL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete KOL',
    });
  }
});

// Add platform to KOL
router.post('/:id/platforms', async (req, res) => {
  try {
    const { type, username, url } = req.body;
    
    const kol = await Kol.findByPk(req.params.id);
    if (!kol) {
      return res.status(404).json({
        success: false,
        error: 'KOL not found',
      });
    }
    
    const platform = await Platform.create({
      kolId: kol.id,
      platformType: type,
      username,
      profileUrl: url,
    });
    
    res.status(201).json({
      success: true,
      data: platform,
    });
  } catch (error) {
    logger.error('Error adding platform:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add platform',
    });
  }
});

// Trigger scrape for KOL
router.post('/:id/scrape', async (req, res) => {
  try {
    const kolId = req.params.id;
    
    const kol = await Kol.findByPk(kolId);
    if (!kol) {
      return res.status(404).json({
        success: false,
        error: 'KOL not found',
      });
    }
    
    await scheduler.triggerSingleKolScrape(kolId);
    
    res.json({
      success: true,
      message: 'Scrape jobs queued successfully',
    });
  } catch (error) {
    logger.error('Error triggering scrape:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger scrape',
    });
  }
});

// Get KOL metrics history
router.get('/:id/metrics', async (req, res) => {
  try {
    const { platform, days = 30 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const whereClause = {
      capturedAt: {
        [Op.gte]: startDate,
      },
    };
    
    const platformWhere = { kolId: req.params.id };
    if (platform) {
      platformWhere.platformType = platform;
    }
    
    const metrics = await Metric.findAll({
      where: whereClause,
      include: [{
        model: Platform,
        as: 'platform',
        where: platformWhere,
        attributes: ['id', 'platformType', 'username'],
      }],
      order: [['capturedAt', 'ASC']],
    });
    
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error('Error fetching metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics',
    });
  }
});

// Get trending KOLs
router.get('/trending/week', async (req, res) => {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // This is a simplified trending calculation
    // In production, you'd want more sophisticated algorithms
    const kols = await Kol.findAll({
      include: [{
        model: Platform,
        as: 'platforms',
        include: [{
          model: Metric,
          as: 'metrics',
          where: {
            capturedAt: {
              [Op.gte]: oneWeekAgo,
            },
          },
          required: false,
        }],
      }],
      limit: 10,
    });
    
    // Calculate growth rates
    const trending = kols.map(kol => {
      let totalGrowth = 0;
      let platformCount = 0;
      
      kol.platforms.forEach(platform => {
        if (platform.metrics && platform.metrics.length >= 2) {
          const latest = platform.metrics[0];
          const oldest = platform.metrics[platform.metrics.length - 1];
          
          if (oldest.followers > 0) {
            const growth = ((latest.followers - oldest.followers) / oldest.followers) * 100;
            totalGrowth += growth;
            platformCount++;
          }
        }
      });
      
      return {
        ...kol.toJSON(),
        growthRate: platformCount > 0 ? totalGrowth / platformCount : 0,
      };
    });
    
    // Sort by growth rate
    trending.sort((a, b) => b.growthRate - a.growthRate);
    
    res.json({
      success: true,
      data: trending,
    });
  } catch (error) {
    logger.error('Error fetching trending KOLs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trending KOLs',
    });
  }
});

module.exports = router;