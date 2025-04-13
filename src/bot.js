const puppeteer = require('puppeteer');
require('dotenv').config();

class TwitterBot {
  constructor(account, targetProfile) {
    this.account = account;
    this.targetProfile = targetProfile;
    this.browser = null;
    this.page = null;
    this.isRunning = false;
    this.refreshInterval = null;
    this.refreshCount = 0;
  }

  async launch() {
    try {
      console.log(`User:${this.account.handle} - Launching bot`);
      
      // Always use headless mode for production deployments
      const headless = process.env.HEADLESS === 'true' ? 'new' : false;
      
      // Launch browser with additional arguments for better performance in cloud environments
      this.browser = await puppeteer.launch({
        headless, 
        args: [
          '--incognito',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-notifications',
          '--disable-extensions',
          '--disable-background-networking'
        ]
      });
      
      // Create a new page - simplified to use default browser context
      this.page = await this.browser.newPage();
      
      // Set viewport size
      await this.page.setViewport({ width: 1280, height: 800 });
      
      // Login to Twitter
      console.log(`User:${this.account.handle} - Attempting to login...`);
      await this.login();
      
      // Brief pause after login to ensure we're properly authenticated
      console.log(`User:${this.account.handle} - Quick pause after login...`);
      await this.delay(2000);
      
      // Print current URL for debugging
      console.log(`User:${this.account.handle} - Current URL after login: ${this.page.url()}`);
      
      // DIRECT METHOD: Go straight to target profile without navigation checks
      console.log(`User:${this.account.handle} - Going directly to target profile URL...`);
      
      // Format profile URL correctly
      let profileUrl = this.targetProfile;
      if (!profileUrl.startsWith('http')) {
        // Support both twitter.com and x.com domains
        profileUrl = `https://x.com/${profileUrl.replace('@', '')}`;
      }
      
      console.log(`User:${this.account.handle} - Navigating to: ${profileUrl}`);
      await this.page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Check and log current URL
      const finalUrl = this.page.url();
      console.log(`User:${this.account.handle} - Now on page: ${finalUrl}`);
      
      // Start refresh cycle
      this.startRefreshCycle();
      
      this.isRunning = true;
      console.log(`User:${this.account.handle} - Bot is now running on profile: ${profileUrl}`);
      
      return true;
    } catch (error) {
      console.error(`User:${this.account.handle} - Error launching bot:`, error);
      await this.shutdown();
      return false;
    }
  }
  
  // Helper function for delays
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Type text slowly like a human
  async typeSlowly(selector, text) {
    const element = await this.page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    
    // Focus the element
    await element.focus();
    
    // Clear any existing text
    await this.page.keyboard.down('Control');
    await this.page.keyboard.press('a');
    await this.page.keyboard.up('Control');
    await this.page.keyboard.press('Backspace');
    
    // Type each character with random delays
    for (const char of text) {
      await this.delay(Math.random() * 100 + 50); // 50-150ms between keystrokes
      await this.page.keyboard.type(char);
    }
    
    // Use a simplified log message for typing
    if (selector.includes('password')) {
      console.log(`User:${this.account.handle} - Typed password (hidden)`);
    } else {
      // Hide most of email/username for privacy in logs
      const hiddenText = text.length > 5 
        ? text.substring(0, 3) + '...' + text.substring(text.length - 2)
        : '...';
      console.log(`User:${this.account.handle} - Typed text: ${hiddenText}`);
    }
  }
  
  // Check for security verification prompt
  async checkSecurityVerification() {
    try {
      // Look for text related to unusual login activity
      const unusualActivityText = await this.page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('span, div'));
        for (const element of elements) {
          const text = element.textContent || '';
          if (text.includes('unusual login activity') || 
              text.includes('Enter your phone number or username') || 
              text.includes('verify it\'s you')) {
            return true;
          }
        }
        return false;
      });
      
      if (unusualActivityText) {
        console.log(`User:${this.account.handle} - Security verification prompt detected`);
        
        // Find the username input field
        const inputField = await this.page.$('input');
        if (inputField) {
          // Enter the username
          await this.typeSlowly('input', this.account.handle);
          console.log(`User:${this.account.handle} - Entered handle for verification`);
          
          // Wait a bit then press Enter
          await this.delay(1000);
          await this.page.keyboard.press('Enter');
          console.log(`User:${this.account.handle} - Pressed Enter after verification`);
          
          // Wait for the next screen
          await this.delay(3000);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error(`User:${this.account.handle} - Error checking for security verification:`, error);
      return false;
    }
  }
  
  async login() {
    try {
      console.log(`User:${this.account.handle} - Logging in as ${this.account.username}`);
      
      // Navigate to Twitter login page
      await this.page.goto('https://twitter.com/i/flow/login', { waitUntil: 'networkidle2' });
      console.log(`User:${this.account.handle} - Login page loaded`);
      
      // Wait for the username input field to load
      await this.page.waitForSelector('input[autocomplete="username"]', { timeout: 30000 });
      console.log(`User:${this.account.handle} - Username field found`);
      
      // Type username slowly like a human
      await this.typeSlowly('input[autocomplete="username"]', this.account.username);
      console.log(`User:${this.account.handle} - Username entered`);
      
      // Wait a bit before pressing Enter
      await this.delay(1000);
      
      // Press Enter instead of clicking Next
      await this.page.keyboard.press('Enter');
      console.log(`User:${this.account.handle} - Pressed Enter after username`);
      
      // Check for security verification prompt
      await this.delay(3000);
      const securityPrompt = await this.checkSecurityVerification();
      if (securityPrompt) {
        console.log(`User:${this.account.handle} - Handled security verification prompt`);
      }
      
      // Wait for password field to appear
      await this.page.waitForSelector('input[name="password"]', { timeout: 30000 });
      console.log(`User:${this.account.handle} - Password field found`);
      
      // Type password slowly
      await this.typeSlowly('input[name="password"]', this.account.password);
      console.log(`User:${this.account.handle} - Password entered`);
      
      // Wait a bit before pressing Enter
      await this.delay(1000);
      
      // Press Enter instead of clicking Login
      await this.page.keyboard.press('Enter');
      console.log(`User:${this.account.handle} - Pressed Enter after password`);
      
      // Check for additional security verification after password
      await this.delay(3000);
      const additionalVerification = await this.checkSecurityVerification();
      if (additionalVerification) {
        console.log(`User:${this.account.handle} - Handled additional security verification prompt`);
      }
      
      // Give login time to process without strict navigation checking
      console.log(`User:${this.account.handle} - Waiting for login to complete...`);
      await this.delay(5000);
      
      // Output the current URL 
      const currentUrl = this.page.url();
      console.log(`User:${this.account.handle} - Current URL after login: ${currentUrl}`);
      
      console.log(`User:${this.account.handle} - Login process completed`);
      return true;
    } catch (error) {
      console.error(`User:${this.account.handle} - Login failed:`, error);
      throw error;
    }
  }
  
  async navigateToProfile() {
    try {
      console.log(`User:${this.account.handle} - Navigating to target profile: ${this.targetProfile}`);
      
      // Make sure the target profile URL is correct
      let profileUrl = this.targetProfile;
      if (!profileUrl.startsWith('http')) {
        profileUrl = `https://twitter.com/${profileUrl.replace('@', '')}`;
      }
      
      console.log(`User:${this.account.handle} - Using profile URL: ${profileUrl}`);
      
      // Print some debugging info
      console.log(`User:${this.account.handle} - Current URL before navigation: ${this.page.url()}`);
      
      // Go directly to the profile URL
      console.log(`User:${this.account.handle} - Navigating to profile URL...`);
      await this.page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      console.log(`User:${this.account.handle} - Navigation command completed`);
      
      // Print current URL
      console.log(`User:${this.account.handle} - Current URL after navigation: ${this.page.url()}`);
      
      // Check if we're actually on the profile
      const isOnProfile = await this.page.evaluate((targetUrl) => {
        return window.location.href.includes(targetUrl);
      }, profileUrl);
      
      if (isOnProfile) {
        console.log(`User:${this.account.handle} - URL check confirms we are on the target profile`);
      } else {
        console.log(`User:${this.account.handle} - WARNING: URL check suggests we may not be on the target profile`);
      }
      
      console.log(`User:${this.account.handle} - Successfully navigated to target profile: ${profileUrl}`);
      return true;
    } catch (error) {
      console.error(`User:${this.account.handle} - Error navigating to profile:`, error);
      console.error(`User:${this.account.handle} - Error details:`, error.message);
      
      // Attempt an alternate approach if direct navigation fails
      try {
        console.log(`User:${this.account.handle} - Trying alternate navigation approach...`);
        
        // Go to twitter.com first
        console.log(`User:${this.account.handle} - Going to Twitter home...`);
        await this.page.goto('https://twitter.com/home', { waitUntil: 'networkidle2' });
        console.log(`User:${this.account.handle} - Current URL: ${this.page.url()}`);
        
        // Wait a moment
        console.log(`User:${this.account.handle} - Waiting before trying profile navigation...`);
        await this.delay(3000);
        
        // Try to navigate by manipulating the URL
        let handle = this.targetProfile;
        if (handle.includes('/')) {
          handle = handle.split('/').pop();
        }
        if (handle.startsWith('@')) {
          handle = handle.substring(1);
        }
        
        const simplifiedUrl = `https://twitter.com/${handle}`;
        console.log(`User:${this.account.handle} - Simplified profile URL: ${simplifiedUrl}`);
        
        // Go to the profile page
        console.log(`User:${this.account.handle} - Navigating to simplified profile URL...`);
        await this.page.goto(simplifiedUrl, { waitUntil: 'networkidle2' });
        console.log(`User:${this.account.handle} - Current URL after simplified navigation: ${this.page.url()}`);
        
        console.log(`User:${this.account.handle} - Successfully navigated to profile using alternate method: ${handle}`);
        return true;
      } catch (altError) {
        console.error(`User:${this.account.handle} - Both navigation methods failed`);
        console.error(`User:${this.account.handle} - First error:`, error.message);
        console.error(`User:${this.account.handle} - Alternate method error:`, altError.message);
        
        // Last resort attempt
        console.log(`User:${this.account.handle} - Attempting last resort URL manipulation...`);
        try {
          // Try with www.twitter.com
          const lastResortUrl = `https://www.twitter.com/u235___`;
          console.log(`User:${this.account.handle} - Trying last resort URL: ${lastResortUrl}`);
          await this.page.goto(lastResortUrl, { waitUntil: 'networkidle2' });
          console.log(`User:${this.account.handle} - Current URL after last resort attempt: ${this.page.url()}`);
          return true;
        } catch (finalError) {
          console.error(`User:${this.account.handle} - All navigation attempts failed`);
          throw error; // Throw the original error
        }
      }
    }
  }
  
  startRefreshCycle() {
    const minTime = parseInt(process.env.MIN_REFRESH_TIME) || 20;
    const maxTime = parseInt(process.env.MAX_REFRESH_TIME) || 32;
    
    console.log(`User:${this.account.handle} - Starting refresh cycle (${minTime}-${maxTime} seconds)`);
    
    const refreshPage = async () => {
      try {
        if (!this.isRunning) return;
        
        // Perform the refresh without logging the action
        await this.page.reload({ waitUntil: 'networkidle2' });
        
        // Increment and log refresh count
        this.refreshCount++;
        console.log(`User:${this.account.handle} - Total refreshes: ${this.refreshCount}`);
        
        // Calculate next refresh time without logging it
        const nextRefresh = Math.floor(Math.random() * (maxTime - minTime + 1) + minTime);
        
        // Schedule next refresh
        this.refreshInterval = setTimeout(refreshPage, nextRefresh * 1000);
      } catch (error) {
        console.error(`User:${this.account.handle} - Error during refresh:`, error);
        // Try to recover
        this.recoverFromError();
      }
    };
    
    // Start the first refresh cycle
    const initialDelay = Math.floor(Math.random() * (maxTime - minTime + 1) + minTime);
    console.log(`User:${this.account.handle} - First refresh in ${initialDelay} seconds`);
    this.refreshInterval = setTimeout(refreshPage, initialDelay * 1000);
  }
  
  async recoverFromError() {
    try {
      // Check if we're still logged in
      const currentUrl = this.page.url();
      console.log(`User:${this.account.handle} - Recovery check - Current URL: ${currentUrl}`);
      
      if (!currentUrl.includes('twitter.com') || currentUrl.includes('login')) {
        console.log(`User:${this.account.handle} - Session expired, logging in again`);
        await this.login();
      }
      
      // Navigate back to the profile
      console.log(`User:${this.account.handle} - Navigating back to profile`);
      await this.navigateToProfile();
      
      // Restart refresh cycle
      console.log(`User:${this.account.handle} - Restarting refresh cycle`);
      this.startRefreshCycle();
    } catch (error) {
      console.error(`User:${this.account.handle} - Recovery failed:`, error);
      // If recovery fails, shut down and restart
      await this.shutdown();
      setTimeout(() => this.launch(), 60000); // Try again in 1 minute
    }
  }
  
  async shutdown() {
    console.log(`User:${this.account.handle} - Shutting down bot`);
    this.isRunning = false;
    
    // Clear refresh interval
    if (this.refreshInterval) {
      clearTimeout(this.refreshInterval);
      this.refreshInterval = null;
    }
    
    // Close browser if open
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.error(`User:${this.account.handle} - Error closing browser:`, error);
      }
      this.browser = null;
      this.page = null;
    }
    
    console.log(`User:${this.account.handle} - Bot has been shut down - Total refreshes: ${this.refreshCount}`);
  }
}

module.exports = TwitterBot; 