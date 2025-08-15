const BaseScraper = require('./BaseScraper');
const logger = require('../utils/logger');
const { Metric } = require('../models');

class TikTokScraper extends BaseScraper {
  constructor() {
    super('TikTok');
  }

  async scrape(username, platformId = null) {
    this.startTime = Date.now();
    
    try {
      await this.init();
      
      // TikTok profile URL
      const profileUrl = `https://www.tiktok.com/@${username}`;
      
      logger.info(`Scraping TikTok profile: ${profileUrl}`);
      
      // TikTok has strong anti-bot measures, need extra precautions
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      });
      
      await this.navigateWithRetry(profileUrl);
      
      // Wait for content to load
      await this.randomDelay(4000, 6000);
      
      // Handle potential age gate or login prompt
      await this.handlePopups();
      
      // Extract data
      const data = await this.extractProfileData(username);
      
      // Save metrics if platformId provided
      if (platformId && data) {
        await this.saveMetrics(platformId, data);
      }
      
      await this.logScrape(platformId, 'success', null, data);
      logger.info(`TikTok scraping completed for ${username}`);
      
      return data;
    } catch (error) {
      logger.error(`TikTok scraping failed for ${username}:`, error);
      await this.takeScreenshot('error');
      await this.logScrape(platformId, 'failed', error.message);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  async handlePopups() {
    try {
      // Close age gate if present
      const ageButton = await this.page.$('[data-e2e="age-gate-continue"]');
      if (ageButton) {
        await ageButton.click();
        await this.randomDelay(1000, 2000);
      }
      
      // Close login popup if present
      const closeButton = await this.page.$('[data-e2e="modal-close-inner-button"]');
      if (closeButton) {
        await closeButton.click();
        await this.randomDelay(1000, 2000);
      }
    } catch (error) {
      logger.debug('No popups to handle or error closing them:', error.message);
    }
  }

  async extractProfileData(username) {
    const data = {
      followers: 0,
      following: 0,
      likes: 0,
      posts: 0,
      avgViews: 0,
      engagementRate: 0,
      metadata: {},
    };

    try {
      // Extract user data from page
      const profileData = await this.page.evaluate(() => {
        const data = {};
        
        // Try to find follower count
        const followerElement = document.querySelector('[data-e2e="followers-count"], strong[title*="Follower"]');
        if (followerElement) {
          data.followers = followerElement.textContent || followerElement.getAttribute('title');
        } else {
          // Fallback: search in text
          const allText = document.body.innerText;
          const followerMatch = allText.match(/([0-9.,]+[KMB]?)\s*Followers/i);
          if (followerMatch) data.followers = followerMatch[1];
        }
        
        // Try to find following count
        const followingElement = document.querySelector('[data-e2e="following-count"], strong[title*="Following"]');
        if (followingElement) {
          data.following = followingElement.textContent || followingElement.getAttribute('title');
        } else {
          const allText = document.body.innerText;
          const followingMatch = allText.match(/([0-9.,]+[KMB]?)\s*Following/i);
          if (followingMatch) data.following = followingMatch[1];
        }
        
        // Try to find likes count
        const likesElement = document.querySelector('[data-e2e="likes-count"], strong[title*="Likes"]');
        if (likesElement) {
          data.likes = likesElement.textContent || likesElement.getAttribute('title');
        } else {
          const allText = document.body.innerText;
          const likesMatch = allText.match(/([0-9.,]+[KMB]?)\s*Likes/i);
          if (likesMatch) data.likes = likesMatch[1];
        }
        
        // Extract profile name
        const nameElement = document.querySelector('[data-e2e="user-subtitle"], h2[data-e2e="user-title"]');
        if (nameElement) {
          data.name = nameElement.textContent;
        }
        
        // Extract bio
        const bioElement = document.querySelector('[data-e2e="user-bio"], h2[data-e2e="user-bio"]');
        if (bioElement) {
          data.bio = bioElement.textContent;
        }
        
        // Check verification
        const verifiedElement = document.querySelector('[data-e2e="verified-badge"], svg[data-e2e="verified-badge"]');
        data.isVerified = !!verifiedElement;
        
        // Extract avatar URL
        const avatarElement = document.querySelector('[data-e2e="user-avatar"] img, .avatar img');
        if (avatarElement) {
          data.avatarUrl = avatarElement.src;
        }
        
        // Count visible videos
        const videoElements = document.querySelectorAll('[data-e2e="user-post-item"], div[class*="DivWrapper"]');
        data.posts = videoElements.length;
        
        // Try to extract view counts from visible videos
        const viewCounts = [];
        videoElements.forEach(video => {
          const viewElement = video.querySelector('strong, span[class*="StrongVideoCount"]');
          if (viewElement && viewElement.textContent) {
            viewCounts.push(viewElement.textContent);
          }
        });
        data.viewCounts = viewCounts;
        
        return data;
      });
      
      // Parse the extracted data
      if (profileData.followers) {
        data.followers = this.parseNumber(profileData.followers);
      }
      if (profileData.following) {
        data.following = this.parseNumber(profileData.following);
      }
      if (profileData.likes) {
        data.likes = this.parseNumber(profileData.likes);
      }
      
      data.posts = profileData.posts || 0;
      data.metadata.name = profileData.name;
      data.metadata.bio = profileData.bio;
      data.metadata.isVerified = profileData.isVerified;
      data.metadata.avatarUrl = profileData.avatarUrl;
      data.metadata.username = username;
      
      // Calculate average views if we have view data
      if (profileData.viewCounts && profileData.viewCounts.length > 0) {
        const views = profileData.viewCounts.map(v => this.parseNumber(v));
        const totalViews = views.reduce((sum, v) => sum + v, 0);
        data.avgViews = Math.floor(totalViews / views.length);
      }
      
      // Calculate engagement rate (simplified)
      if (data.followers > 0 && data.likes > 0) {
        // TikTok engagement is typically higher than other platforms
        const baseEngagement = (data.likes / (data.followers * Math.max(data.posts, 1))) * 100;
        data.engagementRate = Math.min(20, Math.round(baseEngagement * 100) / 100);
      }
      
    } catch (error) {
      logger.error('Error extracting TikTok profile data:', error);
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
        likes: data.likes || 0,
        posts: data.posts || 0,
        avgViews: data.avgViews || 0,
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

module.exports = TikTokScraper;