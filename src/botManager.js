const fs = require('fs').promises;
const path = require('path');
const TwitterBot = require('./bot');

class BotManager {
  constructor() {
    this.accounts = [];
    this.bots = new Map();
    this.accountsFilePath = path.join(__dirname, 'accounts.json');
    this.targetProfile = process.env.TARGET_PROFILE || 'https://x.com/u235___';
    this.startTime = Date.now();
  }

  async loadAccounts() {
    try {
      const data = await fs.readFile(this.accountsFilePath, 'utf8');
      this.accounts = JSON.parse(data);
      console.log(`Loaded ${this.accounts.length} accounts from storage`);
    } catch (error) {
      console.error('Error loading accounts:', error);
      this.accounts = [];
    }
    return this.accounts;
  }

  async saveAccounts() {
    try {
      await fs.writeFile(this.accountsFilePath, JSON.stringify(this.accounts, null, 2), 'utf8');
      console.log('Accounts saved successfully');
      return true;
    } catch (error) {
      console.error('Error saving accounts:', error);
      return false;
    }
  }

  async addAccount(username, password, handle) {
    // Check if account already exists
    const existingIndex = this.accounts.findIndex(acc => acc.username === username);
    
    if (existingIndex >= 0) {
      // Update existing account
      this.accounts[existingIndex] = {
        username,
        password,
        handle,
        active: true
      };
      console.log(`Updated existing account: ${handle}`);
    } else {
      // Add new account
      this.accounts.push({
        username,
        password,
        handle,
        active: true
      });
      console.log(`Added new account: ${handle}`);
    }
    
    // Save updated accounts
    await this.saveAccounts();
    
    // Start bot for the new/updated account if desired
    const shouldStartBot = this.accounts.find(acc => acc.username === username)?.active;
    if (shouldStartBot) {
      await this.startBot(username);
    }
    
    return true;
  }

  async removeAccount(username) {
    // Find account index
    const index = this.accounts.findIndex(acc => acc.username === username);
    
    if (index === -1) {
      console.log(`Account ${username} not found`);
      return false;
    }
    
    // Shut down bot if running
    await this.stopBot(username);
    
    // Remove from accounts list
    this.accounts.splice(index, 1);
    
    // Save updated accounts
    await this.saveAccounts();
    console.log(`Removed account: ${username}`);
    
    return true;
  }

  async startBot(username) {
    // Find account
    const account = this.accounts.find(acc => acc.username === username);
    
    if (!account) {
      console.log(`Account ${username} not found`);
      return false;
    }
    
    // Check if bot is already running
    if (this.bots.has(username)) {
      console.log(`Bot for ${username} is already running`);
      return true;
    }
    
    // Create new bot instance
    const bot = new TwitterBot(account, this.targetProfile);
    
    // Launch bot with direct profile navigation
    try {
      console.log(`Starting bot for ${account.handle} (${account.username})`);
      const success = await bot.launch();
      
      if (success) {
        // Store bot instance
        this.bots.set(username, bot);
        console.log(`Bot for ${account.handle} started successfully`);
        return true;
      } else {
        console.error(`Failed to start bot for ${account.handle}`);
        return false;
      }
    } catch (error) {
      console.error(`Error starting bot for ${account.handle}:`, error.message);
      return false;
    }
  }

  async stopBot(username) {
    // Check if bot exists
    if (!this.bots.has(username)) {
      console.log(`No running bot found for ${username}`);
      return false;
    }
    
    // Get bot instance
    const bot = this.bots.get(username);
    
    // Shut down bot
    try {
      await bot.shutdown();
      
      // Remove from bots map
      this.bots.delete(username);
      console.log(`Stopped bot for ${username}`);
      
      return true;
    } catch (error) {
      console.error(`Error stopping bot for ${username}:`, error.message);
      // Still remove from bots map
      this.bots.delete(username);
      return false;
    }
  }

  async startAllBots() {
    console.log('Starting all active bots...');
    
    // Get all active accounts
    const activeAccounts = this.accounts.filter(account => account.active);
    console.log(`Found ${activeAccounts.length} active accounts`);
    
    // Launch bots sequentially instead of in parallel
    let successful = 0;
    let failed = 0;
    
    // Get configured delay or use default
    const delaySeconds = parseInt(process.env.BOT_LAUNCH_DELAY) || 10;
    
    for (const account of activeAccounts) {
      console.log(`Starting bot for ${account.handle} (${account.username})...`);
      try {
        const success = await this.startBot(account.username);
        
        if (success) {
          successful++;
          console.log(`Bot ${successful}/${activeAccounts.length} started successfully`);
        } else {
          failed++;
          console.log(`Bot for ${account.handle} failed to start`);
        }
        
        // Add a delay between bot launches to avoid overwhelming the system
        if (successful + failed < activeAccounts.length) {
          console.log(`Waiting ${delaySeconds} seconds before starting next bot...`);
          await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
        }
      } catch (error) {
        failed++;
        console.error(`Error starting bot for ${account.handle}:`, error.message);
      }
    }
    
    console.log(`Started ${successful} bots successfully, ${failed} failed`);
    return successful;
  }

  async stopAllBots() {
    console.log('Stopping all bots...');
    const botUsernames = Array.from(this.bots.keys());
    
    if (botUsernames.length === 0) {
      console.log('No running bots to stop');
      return 0;
    }
    
    // Stop bots sequentially instead of in parallel
    let successful = 0;
    
    for (const username of botUsernames) {
      const account = this.accounts.find(acc => acc.username === username);
      const handle = account ? account.handle : username;
      
      console.log(`Stopping bot for ${handle}...`);
      try {
        const success = await this.stopBot(username);
        
        if (success) {
          successful++;
          console.log(`Bot ${successful}/${botUsernames.length} stopped successfully`);
        } else {
          console.log(`Failed to stop bot for ${handle} gracefully`);
        }
        
        // Small delay between stopping bots (just 1 second)
        if (successful < botUsernames.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Error stopping bot for ${handle}:`, error.message);
      }
    }
    
    console.log(`All bots stopped (${successful}/${botUsernames.length} successful)`);
    return successful;
  }

  getTotalRefreshCount() {
    let totalCount = 0;
    for (const bot of this.bots.values()) {
      totalCount += bot.refreshCount;
    }
    return totalCount;
  }

  getStatus() {
    return {
      totalAccounts: this.accounts.length,
      activeAccounts: this.accounts.filter(acc => acc.active).length,
      runningBots: this.bots.size,
      totalRefreshes: this.getTotalRefreshCount(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      targetProfile: this.targetProfile,
      accounts: this.accounts.map(acc => ({
        username: acc.username,
        handle: acc.handle,
        active: acc.active,
        running: this.bots.has(acc.username),
        refreshCount: this.bots.get(acc.username)?.refreshCount || 0
      }))
    };
  }
}

module.exports = BotManager; 