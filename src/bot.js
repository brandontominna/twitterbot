const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
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
    
    // Create a unique user data directory for each bot/account
    this.userDataDir = path.join(__dirname, '..', 'chrome-data', this.account.handle);
    
    // Ensure the directory exists
    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
    }
  }

  async launch() {
    try {
      console.log(`User:${this.account.handle} - Launching bot`);
      
      // More thorough cleanup of Chrome lock files
      const lockFiles = [
        path.join(this.userDataDir, 'SingletonLock'),
        path.join(this.userDataDir, 'SingletonCookie'),
        path.join(this.userDataDir, 'SingletonSocket'),
        path.join(this.userDataDir, 'Singleton*')
      ];
      
      // Try to clean up any lock files
      lockFiles.forEach(lockPattern => {
        try {
          // For exact files
          if (!lockPattern.includes('*') && fs.existsSync(lockPattern)) {
            console.log(`User:${this.account.handle} - Removing stale Chrome lock file: ${lockPattern}`);
            fs.unlinkSync(lockPattern);
          } 
          // For wildcard patterns
          else if (lockPattern.includes('*')) {
            const dirPath = path.dirname(lockPattern);
            const filePattern = path.basename(lockPattern);
            if (fs.existsSync(dirPath)) {
              const basePattern = filePattern.replace('*', '');
              fs.readdirSync(dirPath)
                .filter(file => file.startsWith(basePattern))
                .forEach(file => {
                  const fullPath = path.join(dirPath, file);
                  console.log(`User:${this.account.handle} - Removing stale Chrome lock file: ${fullPath}`);
                  fs.unlinkSync(fullPath);
                });
            }
          }
        } catch (err) {
          console.log(`User:${this.account.handle} - Error removing lock file ${lockPattern}: ${err.message}`);
        }
      });
      
      // Use headless mode based on .env configuration
      const headless = process.env.HEADLESS === 'true' ? 'new' : false;
      
      // Launch browser with persistent user data directory
      console.log(`User:${this.account.handle} - Using persistent profile at: ${this.userDataDir}`);
      this.browser = await puppeteer.launch({
        headless,
        userDataDir: this.userDataDir,
        args: [
          '--disable-notifications',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-features=site-per-process',
          '--disable-gpu',
          `--user-data-dir=${this.userDataDir}`
        ]
      });
      
      // Create a new page
      this.page = await this.browser.newPage();
      
      // Set viewport size
      await this.page.setViewport({ width: 1280, height: 800 });
      
      // Check if already logged in by trying to go to twitter home
      console.log(`User:${this.account.handle} - Checking if already logged in...`);
      await this.page.goto('https://twitter.com/home', { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Check if we need to login
      const currentUrl = this.page.url();
      const needsLogin = currentUrl.includes('login') || currentUrl.includes('flow/login');
      
      if (needsLogin) {
        console.log(`User:${this.account.handle} - Login required`);
        
        // Login to Twitter
        console.log(`User:${this.account.handle} - Attempting to login...`);
        await this.login();
        
        // Brief pause after login to ensure we're properly authenticated
        console.log(`User:${this.account.handle} - Quick pause after login...`);
        await this.delay(2000);
      } else {
        console.log(`User:${this.account.handle} - Already logged in, session reused`);
      }
      
      // Print current URL for debugging
      console.log(`User:${this.account.handle} - Current URL after login check: ${this.page.url()}`);
      
      // Initialize pinned post URL for reference
      this.pinnedPostUrl = 'https://x.com/u235___/status/1905652172085203420';
      console.log(`User:${this.account.handle} - Pinned post URL set to: ${this.pinnedPostUrl}`);
      
      // Go straight to target profile (main profile)
      console.log(`User:${this.account.handle} - Going to main profile page...`);
      
      // Format profile URL correctly
      let profileUrl = this.targetProfile;
      if (!profileUrl.startsWith('http')) {
        // Support both twitter.com and x.com domains
        profileUrl = `https://x.com/${profileUrl.replace('@', '')}`;
      }
      
      console.log(`User:${this.account.handle} - Navigating to: ${profileUrl}`);
      await this.page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Check and log current URL
      const finalUrl = this.page.url();
      console.log(`User:${this.account.handle} - Now on page: ${finalUrl}`);
      
      // Start the profile and tweet interaction cycle
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
      await this.page.goto('https://twitter.com/i/flow/login', { waitUntil: 'networkidle2', timeout: 60000 });
      console.log(`User:${this.account.handle} - Login page loaded`);
      
      // Wait for the username input field to load
      await this.page.waitForSelector('input[autocomplete="username"]', { timeout: 60000 });
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
      await this.page.waitForSelector('input[name="password"]', { timeout: 60000 });
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
      // Format profile URL correctly
      let profileUrl = this.targetProfile;
      if (!profileUrl.startsWith('http')) {
        profileUrl = `https://x.com/${profileUrl.replace('@', '')}`;
      }
      
      console.log(`User:${this.account.handle} - Navigating to target profile: ${profileUrl}`);
      console.log(`User:${this.account.handle} - Using profile URL: ${profileUrl}`);
      
      // Log current URL
      console.log(`User:${this.account.handle} - Current URL before navigation: ${this.page.url()}`);
      
      // Navigate to profile URL
      console.log(`User:${this.account.handle} - Navigating to profile URL...`);
      await this.page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      console.log(`User:${this.account.handle} - Navigation command completed`);
      
      // Log current URL
      console.log(`User:${this.account.handle} - Current URL after navigation: ${this.page.url()}`);
      
      // Verify we're on the target profile
      const finalUrl = this.page.url();
      if (finalUrl.includes(profileUrl) || 
          (profileUrl.includes('twitter.com') && finalUrl.includes('x.com')) ||
          (profileUrl.includes('x.com') && finalUrl.includes('twitter.com'))) {
        console.log(`User:${this.account.handle} - URL check confirms we are on the target profile`);
        console.log(`User:${this.account.handle} - Successfully navigated to target profile: ${profileUrl}`);
        return true;
      } else {
        console.error(`User:${this.account.handle} - Navigation failed, ended up at: ${finalUrl}`);
        return false;
      }
    } catch (error) {
      console.error(`User:${this.account.handle} - Error navigating to profile:`, error);
      return false;
    }
  }
  
  startRefreshCycle() {
    console.log(`User:${this.account.handle} - Starting interactive navigation cycle`);
    
    const refreshPage = async () => {
      try {
        // Calculate random time for next refresh cycle
        const minTime = parseInt(process.env.MIN_REFRESH_TIME || 15);
        const maxTime = parseInt(process.env.MAX_REFRESH_TIME || 20);
        const nextRefresh = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
        
        console.log(`User:${this.account.handle} - Next cycle in ${nextRefresh} seconds`);
        
        // Set timeout for next refresh cycle
        this.refreshInterval = setTimeout(async () => {
          try {
            // Step 1: Navigate to main profile if not already there
            const currentUrl = this.page.url();
            const mainProfileUrl = this.targetProfile;
            
            if (!currentUrl.includes(mainProfileUrl) || currentUrl.includes('/status/')) {
              console.log(`User:${this.account.handle} - Navigating to main profile: ${mainProfileUrl}`);
              await this.page.goto(mainProfileUrl, { waitUntil: 'networkidle2', timeout: 60000 });
              
              // Wait 2 seconds on main profile
              console.log(`User:${this.account.handle} - Waiting on main profile...`);
              await this.delay(2000);
            }
            
            // Step 2: Find and click on the pinned post
            try {
              console.log(`User:${this.account.handle} - Looking for pinned post...`);
              
              // Try multiple selectors to find the pinned post
              // First try to find the pinned post indicator text
              const pinnedElement = await this.page.$x("//span[contains(text(), 'Pinned')]");
              
              if (pinnedElement && pinnedElement.length > 0) {
                // Find the closest tweet container
                console.log(`User:${this.account.handle} - Found pinned post indicator, clicking on the tweet...`);
                
                // Move up to find the article or closest clickable ancestor
                const tweetContainer = await this.page.evaluateHandle(el => {
                  let current = el;
                  // Walk up the DOM tree until we find an article element
                  while (current && current.tagName !== 'ARTICLE' && current.tagName !== 'DIV') {
                    current = current.parentElement;
                  }
                  return current;
                }, pinnedElement[0]);
                
                // Click on it
                await tweetContainer.click();
                console.log(`User:${this.account.handle} - Clicked on pinned post`);
              } else {
                // Alternative: Try to find first tweet on profile
                console.log(`User:${this.account.handle} - No pinned indicator found, looking for first tweet...`);
                
                // Try to click on first article element (usually a tweet)
                const articles = await this.page.$('article');
                if (articles) {
                  await articles.click();
                  console.log(`User:${this.account.handle} - Clicked on first tweet`);
                } else {
                  // If all else fails, go to known pinned post URL directly
                  console.log(`User:${this.account.handle} - No tweets found, going to pinned post URL directly`);
                  await this.page.goto(this.pinnedPostUrl, { waitUntil: 'networkidle2', timeout: 60000 });
                }
              }
              
              // Wait 2 seconds on the post page
              console.log(`User:${this.account.handle} - Waiting on tweet page...`);
              await this.delay(2000);
              
              // Step 3: Go back to main profile
              console.log(`User:${this.account.handle} - Returning to main profile...`);
              await this.page.goto(mainProfileUrl, { waitUntil: 'networkidle2', timeout: 60000 });
              
              // Wait 2 seconds before completing the cycle
              console.log(`User:${this.account.handle} - Waiting before next cycle...`);
              await this.delay(2000);
              
              // Increment refresh count
              this.refreshCount++;
              console.log(`User:${this.account.handle} - Completed cycle #${this.refreshCount}`);
              
            } catch (clickError) {
              console.error(`User:${this.account.handle} - Error clicking on pinned tweet:`, clickError);
              // Try direct navigation as fallback
              console.log(`User:${this.account.handle} - Falling back to direct navigation to pinned post`);
              await this.page.goto(this.pinnedPostUrl, { waitUntil: 'networkidle2', timeout: 60000 });
              await this.delay(2000);
              await this.page.goto(mainProfileUrl, { waitUntil: 'networkidle2', timeout: 60000 });
            }
            
            // Set the next refresh cycle
            refreshPage();
          } catch (error) {
            console.error(`User:${this.account.handle} - Error during navigation cycle:`, error);
            
            // Try to recover from the error
            await this.recoverFromError();
          }
        }, nextRefresh * 1000);
      } catch (error) {
        console.error(`User:${this.account.handle} - Error setting up navigation cycle:`, error);
      }
    };
    
    // Start the refresh cycle
    refreshPage();
  }
  
  async recoverFromError() {
    try {
      // Check current URL for known error states
      console.log(`User:${this.account.handle} - Recovery check - Current URL: ${this.page.url()}`);
      
      // If we're on a login screen or unexpected page, try to log in again and navigate back
      const currentUrl = this.page.url();
      if (currentUrl.includes('login') || currentUrl.includes('flow/login')) {
        console.log(`User:${this.account.handle} - Session expired, logging in again`);
        
        // Login again
        await this.login();
        
        // Navigate back to profile
        console.log(`User:${this.account.handle} - Navigating back to profile`);
        await this.page.goto(this.targetProfile, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Restart navigation cycle
        console.log(`User:${this.account.handle} - Restarting navigation cycle`);
        this.startRefreshCycle();
        
        return true;
      }
      
      // If we're on any other unexpected page, go back to main profile
      if (!currentUrl.includes(this.targetProfile) && !currentUrl.includes(this.pinnedPostUrl)) {
        console.log(`User:${this.account.handle} - On unexpected page, returning to main profile`);
        await this.page.goto(this.targetProfile, { waitUntil: 'networkidle2', timeout: 60000 });
      }
      
      // Restart the navigation cycle
      this.startRefreshCycle();
      return true;
    } catch (error) {
      console.error(`User:${this.account.handle} - Error recovering from previous error:`, error);
      
      // Last resort - try to shutdown and report failure
      await this.shutdown();
      return false;
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