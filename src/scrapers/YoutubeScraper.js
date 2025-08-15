const BaseScraper = require('./BaseScraper');
const logger = require('../utils/logger');
const { Metric } = require('../models');

class YoutubeScraper extends BaseScraper {
  constructor() {
    super('YouTube');
  }

  async scrape(channelUrl, platformId = null) {
    this.startTime = Date.now();
    
    try {
      await this.init();
      
      // Normalize channel URL
      let normalizedUrl = channelUrl;
      if (!channelUrl.startsWith('http')) {
        // Assume it's a channel ID or username
        if (channelUrl.startsWith('@')) {
          normalizedUrl = `https://www.youtube.com/${channelUrl}`;
        } else if (channelUrl.startsWith('UC') || channelUrl.startsWith('c/')) {
          normalizedUrl = `https://www.youtube.com/channel/${channelUrl.replace('c/', '')}`;
        } else {
          normalizedUrl = `https://www.youtube.com/@${channelUrl}`;
        }
      }
      
      logger.info(`Scraping YouTube channel: ${normalizedUrl}`);
      await this.navigateWithRetry(normalizedUrl);
      
      // Wait for page load
      await this.randomDelay(3000, 5000);
      
      // Accept cookies if prompted
      await this.handleCookieConsent();
      
      // Extract channel data
      const data = await this.extractChannelData();
      
      // Get additional data from about page
      const aboutData = await this.extractAboutData(normalizedUrl);
      data.metadata = { ...data.metadata, ...aboutData };
      
      // Save metrics if platformId provided
      if (platformId && data) {
        await this.saveMetrics(platformId, data);
      }
      
      await this.logScrape(platformId, 'success', null, data);
      logger.info(`YouTube scraping completed for ${channelUrl}`);
      
      return data;
    } catch (error) {
      logger.error(`YouTube scraping failed for ${channelUrl}:`, error);
      await this.takeScreenshot('error');
      await this.logScrape(platformId, 'failed', error.message);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  async handleCookieConsent() {
    try {
      // Look for cookie consent button
      const acceptButton = await this.page.$('button[aria-label*="Accept"], button[aria-label*="Agree"], tp-yt-paper-button[aria-label*="Accept"]');
      if (acceptButton) {
        await acceptButton.click();
        await this.randomDelay(1000, 2000);
      }
    } catch (error) {
      logger.debug('No cookie consent or error handling it:', error.message);
    }
  }

  async extractChannelData() {
    const data = {
      followers: 0,
      posts: 0,
      views: 0,
      avgViews: 0,
      engagementRate: 0,
      metadata: {},
    };

    try {
      const channelData = await this.page.evaluate(() => {
        const data = {};
        
        // Extract channel name
        const nameElement = document.querySelector('yt-formatted-string.ytd-channel-name, #channel-title');
        if (nameElement) {
          data.name = nameElement.textContent.trim();
        }
        
        // Extract subscriber count
        const subElement = document.querySelector('#subscriber-count, yt-formatted-string#subscriber-count');
        if (subElement) {
          data.subscribers = subElement.textContent.trim();
        } else {
          // Fallback: search in page
          const allText = document.body.innerText;
          const subMatch = allText.match(/([0-9.,]+[KMB]?)\s*subscribers/i);
          if (subMatch) data.subscribers = subMatch[1];
        }
        
        // Check verification
        const verifiedBadge = document.querySelector('[aria-label*="Verified"], .badge-style-type-verified');
        data.isVerified = !!verifiedBadge;
        
        // Extract channel handle
        const handleElement = document.querySelector('#channel-handle, yt-formatted-string#channel-handle');
        if (handleElement) {
          data.handle = handleElement.textContent.trim();
        }
        
        // Extract channel description
        const descElement = document.querySelector('#description-container yt-formatted-string, .channel-description');
        if (descElement) {
          data.description = descElement.textContent.trim();
        }
        
        // Extract avatar URL
        const avatarElement = document.querySelector('#channel-header img#img, #avatar img');
        if (avatarElement) {
          data.avatarUrl = avatarElement.src;
        }
        
        // Count visible videos (approximate)
        const videoElements = document.querySelectorAll('ytd-rich-item-renderer, ytd-grid-video-renderer');
        data.videoCount = videoElements.length;
        
        // Extract view counts from visible videos
        const viewCounts = [];
        videoElements.forEach((video, index) => {
          if (index < 10) { // Only get first 10 videos for average
            const viewElement = video.querySelector('#metadata-line span:first-child, span.ytd-grid-video-renderer');
            if (viewElement && viewElement.textContent.includes('view')) {
              const viewMatch = viewElement.textContent.match(/([0-9.,]+[KMB]?)\s*view/i);
              if (viewMatch) viewCounts.push(viewMatch[1]);
            }
          }
        });
        data.viewCounts = viewCounts;
        
        return data;
      });
      
      // Parse subscriber count
      if (channelData.subscribers) {
        data.followers = this.parseNumber(channelData.subscribers);
      }
      
      data.metadata.name = channelData.name;
      data.metadata.handle = channelData.handle;
      data.metadata.description = channelData.description;
      data.metadata.isVerified = channelData.isVerified;
      data.metadata.avatarUrl = channelData.avatarUrl;
      data.posts = channelData.videoCount || 0;
      
      // Calculate average views
      if (channelData.viewCounts && channelData.viewCounts.length > 0) {
        const views = channelData.viewCounts.map(v => this.parseNumber(v));
        const totalViews = views.reduce((sum, v) => sum + v, 0);
        data.avgViews = Math.floor(totalViews / views.length);
      }
      
      // Calculate engagement rate (simplified)
      if (data.followers > 0 && data.avgViews > 0) {
        // YouTube engagement based on view-to-subscriber ratio
        const viewRate = (data.avgViews / data.followers) * 100;
        data.engagementRate = Math.min(100, Math.round(viewRate * 100) / 100);
      }
      
    } catch (error) {
      logger.error('Error extracting YouTube channel data:', error);
    }
    
    return data;
  }

  async extractAboutData(channelUrl) {
    const aboutData = {};
    
    try {
      // Navigate to about page
      const aboutUrl = channelUrl.includes('/about') ? channelUrl : `${channelUrl}/about`;
      await this.navigateWithRetry(aboutUrl);
      await this.randomDelay(2000, 3000);
      
      const pageData = await this.page.evaluate(() => {
        const data = {};
        
        // Extract total views
        const statsElements = document.querySelectorAll('#right-column yt-formatted-string, .about-stats span');
        statsElements.forEach(el => {
          const text = el.textContent;
          if (text.includes('view')) {
            const viewMatch = text.match(/([0-9,]+)/);
            if (viewMatch) data.totalViews = viewMatch[1].replace(/,/g, '');
          }
        });
        
        // Extract join date
        const joinElement = document.querySelector('#right-column yt-formatted-string:last-child, .about-stats:last-child');
        if (joinElement && joinElement.textContent.includes('Joined')) {
          data.joinDate = joinElement.textContent.replace('Joined', '').trim();
        }
        
        // Extract location
        const detailsElements = document.querySelectorAll('#details-container yt-formatted-string');
        detailsElements.forEach(el => {
          const text = el.textContent.trim();
          if (text && !text.includes('http') && !text.includes('@')) {
            data.location = text;
          }
        });
        
        return data;
      });
      
      if (pageData.totalViews) {
        aboutData.totalViews = parseInt(pageData.totalViews);
      }
      aboutData.joinDate = pageData.joinDate;
      aboutData.location = pageData.location;
      
    } catch (error) {
      logger.debug('Could not extract about data:', error.message);
    }
    
    return aboutData;
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
        posts: data.posts || 0,
        avgViews: data.avgViews || 0,
        engagementRate: data.engagementRate || 0,
        additionalMetrics: {
          ...data.metadata,
          totalViews: data.views || 0,
        },
        capturedAt: new Date(),
      });
      
      logger.info(`Metrics saved for platform ${platformId}`);
    } catch (error) {
      logger.error('Failed to save metrics:', error);
    }
  }
}

module.exports = YoutubeScraper;