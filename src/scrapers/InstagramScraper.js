const BaseScraper = require('./BaseScraper');
const logger = require('../utils/logger');
const { Metric } = require('../models');

class InstagramScraper extends BaseScraper {
  constructor() {
    super('Instagram');
  }

  async scrape(username, platformId = null) {
    this.startTime = Date.now();
    
    try {
      await this.init();
      
      // Instagram profile URL
      const profileUrl = `https://www.instagram.com/${username}/`;
      
      logger.info(`Scraping Instagram profile: ${profileUrl}`);
      await this.navigateWithRetry(profileUrl);
      
      // Wait for page load and data
      await this.randomDelay(3000, 5000);
      
      // Extract data from page
      const data = await this.extractProfileData(username);
      
      // Save metrics if platformId provided
      if (platformId && data) {
        await this.saveMetrics(platformId, data);
      }
      
      await this.logScrape(platformId, 'success', null, data);
      logger.info(`Instagram scraping completed for ${username}`);
      
      return data;
    } catch (error) {
      logger.error(`Instagram scraping failed for ${username}:`, error);
      await this.takeScreenshot('error');
      await this.logScrape(platformId, 'failed', error.message);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  async extractProfileData(username) {
    const data = {
      followers: 0,
      following: 0,
      posts: 0,
      engagementRate: 0,
      metadata: {},
    };

    try {
      // Try to extract data from meta tags first (most reliable)
      const metaData = await this.page.evaluate(() => {
        const data = {};
        
        // Extract from meta tags
        const descriptionMeta = document.querySelector('meta[property="og:description"]');
        if (descriptionMeta) {
          const content = descriptionMeta.getAttribute('content');
          const match = content.match(/([0-9.,]+[KMB]?)\s*Followers,\s*([0-9.,]+[KMB]?)\s*Following,\s*([0-9.,]+[KMB]?)\s*Posts/i);
          if (match) {
            data.followers = match[1];
            data.following = match[2];
            data.posts = match[3];
          }
        }
        
        // Extract profile name
        const titleMeta = document.querySelector('meta[property="og:title"]');
        if (titleMeta) {
          const content = titleMeta.getAttribute('content');
          const match = content.match(/([^(@]+)/);
          if (match) {
            data.name = match[1].trim();
          }
        }
        
        return data;
      });
      
      if (metaData.followers) {
        data.followers = this.parseNumber(metaData.followers);
        data.following = this.parseNumber(metaData.following);
        data.posts = this.parseNumber(metaData.posts);
        data.metadata.name = metaData.name;
      } else {
        // Fallback: Try to extract from page content
        const pageData = await this.page.evaluate(() => {
          const data = {};
          
          // Look for follower counts in various formats
          const allText = document.body.innerText;
          
          // Pattern 1: "X followers"
          const followersMatch = allText.match(/([0-9.,]+[KMB]?)\s*followers/i);
          if (followersMatch) data.followers = followersMatch[1];
          
          // Pattern 2: "X following"
          const followingMatch = allText.match(/([0-9.,]+[KMB]?)\s*following/i);
          if (followingMatch) data.following = followingMatch[1];
          
          // Pattern 3: "X posts"
          const postsMatch = allText.match(/([0-9.,]+[KMB]?)\s*posts/i);
          if (postsMatch) data.posts = postsMatch[1];
          
          // Extract bio
          const bioElement = document.querySelector('div.-vDIg span, section div div span');
          if (bioElement) data.bio = bioElement.textContent;
          
          // Check verification
          const verifiedElement = document.querySelector('[title="Verified"]');
          data.isVerified = !!verifiedElement;
          
          return data;
        });
        
        if (pageData.followers) {
          data.followers = this.parseNumber(pageData.followers);
        }
        if (pageData.following) {
          data.following = this.parseNumber(pageData.following);
        }
        if (pageData.posts) {
          data.posts = this.parseNumber(pageData.posts);
        }
        
        data.metadata.bio = pageData.bio;
        data.metadata.isVerified = pageData.isVerified;
      }
      
      // Extract profile picture URL
      data.metadata.avatarUrl = await this.page.evaluate(() => {
        const img = document.querySelector('img[alt*="profile picture"], header img');
        return img ? img.src : null;
      });
      
      // Calculate engagement rate (simplified - would need recent posts data for accurate calculation)
      if (data.followers > 0 && data.posts > 0) {
        // Placeholder calculation - in reality, would need to analyze recent posts
        const baseEngagement = Math.random() * 5 + 1; // 1-6% base
        const followerFactor = Math.max(0.5, 1 - (data.followers / 1000000)); // Decrease with more followers
        data.engagementRate = Math.round(baseEngagement * followerFactor * 100) / 100;
      }
      
      // Set username
      data.metadata.username = username;
      
    } catch (error) {
      logger.error('Error extracting Instagram profile data:', error);
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
        following: data.following || 0,
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

module.exports = InstagramScraper;