const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');
const config = require('../config');
const logger = require('../utils/logger');
const { ScrapeLog } = require('../models');

puppeteer.use(StealthPlugin());

class BaseScraper {
  constructor(platformName) {
    this.platformName = platformName;
    this.browser = null;
    this.page = null;
    this.userAgent = new UserAgent();
  }

  async init() {
    try {
      const args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
      ];

      if (config.proxy.url) {
        args.push(`--proxy-server=${config.proxy.url}`);
      }

      this.browser = await puppeteer.launch({
        headless: 'new',
        args,
        executablePath: puppeteer.executablePath(),
      });

      this.page = await this.browser.newPage();

      // Set random user agent
      const randomUserAgent = config.scraping.userAgents[
        Math.floor(Math.random() * config.scraping.userAgents.length)
      ];
      await this.page.setUserAgent(randomUserAgent);

      // Set viewport
      await this.page.setViewport({
        width: 1920 + Math.floor(Math.random() * 100),
        height: 1080 + Math.floor(Math.random() * 100),
        deviceScaleFactor: 1,
      });

      // Additional stealth techniques
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });

        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });

        window.chrome = {
          runtime: {},
        };

        Object.defineProperty(navigator, 'permissions', {
          get: () => ({
            query: () => Promise.resolve({ state: 'granted' }),
          }),
        });
      });

      // Handle proxy authentication if needed
      if (config.proxy.username && config.proxy.password) {
        await this.page.authenticate({
          username: config.proxy.username,
          password: config.proxy.password,
        });
      }

      logger.info(`${this.platformName} scraper initialized`);
    } catch (error) {
      logger.error(`Failed to initialize ${this.platformName} scraper:`, error);
      throw error;
    }
  }

  async navigateWithRetry(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        await this.page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 30000,
        });
        return true;
      } catch (error) {
        logger.warn(`Navigation attempt ${i + 1} failed for ${url}:`, error.message);
        if (i === retries - 1) throw error;
        await this.randomDelay();
      }
    }
    return false;
  }

  async randomDelay(min = config.scraping.delayMin, max = config.scraping.delayMax) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async simulateHumanBehavior() {
    // Random mouse movements
    const x = Math.floor(Math.random() * 1000) + 100;
    const y = Math.floor(Math.random() * 700) + 100;
    await this.page.mouse.move(x, y);
    
    // Random scroll
    await this.page.evaluate(() => {
      window.scrollBy(0, Math.floor(Math.random() * 300) + 100);
    });
    
    await this.randomDelay(500, 1500);
  }

  async waitForSelector(selector, timeout = 10000) {
    try {
      await this.page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      logger.warn(`Selector ${selector} not found within ${timeout}ms`);
      return false;
    }
  }

  async extractText(selector, defaultValue = '') {
    try {
      const element = await this.page.$(selector);
      if (!element) return defaultValue;
      
      const text = await this.page.evaluate(el => el.textContent, element);
      return text ? text.trim() : defaultValue;
    } catch (error) {
      logger.warn(`Failed to extract text from ${selector}:`, error.message);
      return defaultValue;
    }
  }

  async extractNumber(selector, defaultValue = 0) {
    const text = await this.extractText(selector);
    if (!text) return defaultValue;
    
    // Parse numbers with K, M, B suffixes
    const match = text.match(/([0-9.,]+)\s*([KMB])?/i);
    if (!match) return defaultValue;
    
    let number = parseFloat(match[1].replace(/,/g, ''));
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

  async extractAttribute(selector, attribute, defaultValue = '') {
    try {
      const element = await this.page.$(selector);
      if (!element) return defaultValue;
      
      const value = await this.page.evaluate(
        (el, attr) => el.getAttribute(attr),
        element,
        attribute
      );
      return value || defaultValue;
    } catch (error) {
      logger.warn(`Failed to extract attribute ${attribute} from ${selector}:`, error.message);
      return defaultValue;
    }
  }

  async takeScreenshot(filename) {
    try {
      const screenshotPath = `./logs/screenshots/${this.platformName}_${filename}_${Date.now()}.png`;
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      logger.info(`Screenshot saved: ${screenshotPath}`);
      return screenshotPath;
    } catch (error) {
      logger.error('Failed to take screenshot:', error);
      return null;
    }
  }

  async logScrape(platformId, status, errorMessage = null, metadata = {}) {
    try {
      await ScrapeLog.create({
        platformId,
        platform: this.platformName,
        status,
        errorMessage,
        metadata,
        duration: Date.now() - this.startTime,
      });
    } catch (error) {
      logger.error('Failed to log scrape:', error);
    }
  }

  async cleanup() {
    try {
      if (this.page) await this.page.close();
      if (this.browser) await this.browser.close();
      logger.info(`${this.platformName} scraper cleaned up`);
    } catch (error) {
      logger.error(`Failed to cleanup ${this.platformName} scraper:`, error);
    }
  }

  async scrape(url) {
    throw new Error('Scrape method must be implemented by child class');
  }
}

module.exports = BaseScraper;