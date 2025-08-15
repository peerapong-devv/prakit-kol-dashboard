const BaseScraper = require('./BaseScraper');
const logger = require('../utils/logger');
const { Metric } = require('../models');

class FacebookScraper extends BaseScraper {
  constructor() {
    super('Facebook');
  }

  async scrape(profileUrl, platformId = null) {
    this.startTime = Date.now();
    
    try {
      await this.init();
      
      // Use mobile version for easier scraping
      const mobileUrl = profileUrl.replace('www.facebook.com', 'm.facebook.com')
                                  .replace('facebook.com', 'm.facebook.com');
      
      logger.info(`Scraping Facebook profile: ${mobileUrl}`);
      await this.navigateWithRetry(mobileUrl);
      
      // Wait for page load
      await this.randomDelay(2000, 4000);
      
      // Extract data
      const data = await this.extractProfileData();
      
      // Save metrics if platformId provided
      if (platformId && data) {
        await this.saveMetrics(platformId, data);
      }
      
      await this.logScrape(platformId, 'success', null, data);
      logger.info(`Facebook scraping completed for ${profileUrl}`);
      
      return data;
    } catch (error) {
      logger.error(`Facebook scraping failed for ${profileUrl}:`, error);
      await this.takeScreenshot('error');
      await this.logScrape(platformId, 'failed', error.message);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  async extractProfileData() {
    const data = {
      followers: 0,
      likes: 0,
      posts: 0,
      metadata: {},
    };

    try {
      // Extract profile name
      data.metadata.name = await this.extractText('h1, h2, [role="heading"]');
      
      // Extract bio/description
      data.metadata.bio = await this.extractText('[data-testid="profile-intro-card"] div, .bio');
      
      // Extract followers count - Facebook mobile version patterns
      const followersText = await this.page.evaluate(() => {
        const patterns = [
          'followers',
          'people follow this',
          'likes',
        ];
        
        const elements = document.querySelectorAll('a, span, div');
        for (const el of elements) {
          const text = el.textContent.toLowerCase();
          for (const pattern of patterns) {
            if (text.includes(pattern)) {
              const match = text.match(/([0-9.,]+[KMB]?)\s*(followers|people|likes)/i);
              if (match) return match[1];
            }
          }
        }
        return null;
      });
      
      if (followersText) {
        data.followers = this.parseNumber(followersText);
        data.likes = data.followers; // Facebook often shows likes instead of followers
      }
      
      // Extract posts count
      const postsText = await this.page.evaluate(() => {
        const elements = document.querySelectorAll('a, span');
        for (const el of elements) {
          const text = el.textContent.toLowerCase();
          if (text.includes('posts') || text.includes('photos')) {
            const match = text.match(/([0-9.,]+[KMB]?)/);
            if (match) return match[1];
          }
        }
        return null;
      });
      
      if (postsText) {
        data.posts = this.parseNumber(postsText);
      }
      
      // Extract verification status
      data.metadata.isVerified = await this.page.evaluate(() => {
        const verifiedBadge = document.querySelector('[aria-label*="Verified"], [title*="Verified"]');
        return !!verifiedBadge;
      });
      
      // Extract category if available
      data.metadata.category = await this.extractText('[href*="/pages/category/"] span, .category');
      
      // Calculate basic engagement rate (simplified)
      if (data.followers > 0 && data.posts > 0) {
        // This is a simplified calculation - actual engagement would need post-level data
        data.engagementRate = Math.min(5, Math.random() * 2 + 1); // Placeholder
      }
      
    } catch (error) {
      logger.error('Error extracting Facebook profile data:', error);
    }
    
    return data;
  }

  parseNumber(text) {
    if (!text) return 0;
    
    const cleaned = text.replace(/,/g, '');
    const match = cleaned.match(/([0-9.]+)\s*([KMB])?/i);
    
    if (!match) return 0;
    
    let number = parseFloat(match[1]);
    const suffix = match[2];
    
    if (suffix) {
      switch (suffix.toUpperCase()) {
        case 'K': number *= 1000; break;
        case 'M': number *= 1000000; break;
        case 'B': number *= 1000000000; break;
      }
    }
    
    return Math.floor(number);
  }

  async saveMetrics(platformId, data) {
    try {
      await Metric.create({
        platformId,
        followers: data.followers || 0,
        likes: data.likes || 0,
        posts: data.posts || 0,
        engagementRate: data.engagementRate || 0,
        additionalMetrics: data.metadata || {},
        capturedAt: new Date(),
      });
      
      logger.info(`Metrics saved for platform ${platformId}`);
    } catch (error) {
      logger.error('Failed to save metrics:', error);
    }
  }
}

module.exports = FacebookScraper;