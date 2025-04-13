/**
 * Simple test script to run a single Twitter bot instance
 * 
 * Usage: node test-bot.js
 */

require('dotenv').config();
const TwitterBot = require('./src/bot');

async function runTest() {
  console.log('🤖 Starting Twitter Profile Refresh Bot test...');
  
  // Load configuration from .env file
  const targetProfile = process.env.TARGET_PROFILE || 'https://x.com/u235___';
  const minTime = parseInt(process.env.MIN_REFRESH_TIME) || 20;
  const maxTime = parseInt(process.env.MAX_REFRESH_TIME) || 32;
  
  console.log('Target profile:', targetProfile);
  console.log('Refresh interval:', `${minTime}-${maxTime} seconds`);
  
  // Load test account
  const testAccount = {
    username: 'sciloxyz@gmail.com',
    password: 'Turtles123**',
    handle: 'exavier12338935',
    active: true
  };
  
  console.log(`Using test account: ${testAccount.handle} (${testAccount.username})`);
  
  // Create bot instance
  const bot = new TwitterBot(testAccount, targetProfile);
  
  // Setup shutdown handler
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down bot...');
    await bot.shutdown();
    console.log('Goodbye! 👋');
    process.exit(0);
  });
  
  // Start the bot
  console.log('Launching bot...');
  const success = await bot.launch();
  
  if (success) {
    console.log('\n✅ Bot is now running');
    console.log('Press Ctrl+C to stop the bot');
  } else {
    console.error('\n❌ Bot failed to start');
    process.exit(1);
  }
}

// Run the test
runTest().catch(error => {
  console.error('Error running test:', error);
  process.exit(1);
}); 