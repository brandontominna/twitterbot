// Main entry point for the Twitter Bot application
// Simply requires the server module to start the application

require('dotenv').config();
const server = require('./src/server');

// Add proper error handling for global uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(error.name, error.message);
  console.error(error.stack);
  process.exit(1);
});

// Add proper handling for unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(error.name, error.message);
  console.error(error.stack);
  process.exit(1);
});

console.log('Twitter Profile Refresh Bot Service Started');
console.log('Target profile:', process.env.TARGET_PROFILE || 'https://x.com/u235___');
console.log('Refresh interval:', `${process.env.MIN_REFRESH_TIME || 20}-${process.env.MAX_REFRESH_TIME || 32} seconds`);
console.log('API port:', process.env.PORT || 3000);

// Start the server
server.start(); 