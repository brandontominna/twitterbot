const express = require('express');
const BotManager = require('./botManager');
require('dotenv').config();

// Initialize Express app
const app = express();
app.use(express.json());

// Initialize bot manager
const botManager = new BotManager();

// Middleware for error handling
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Routes
app.get('/api/status', asyncHandler(async (req, res) => {
  const status = botManager.getStatus();
  res.json(status);
}));

// New endpoint for refresh statistics
app.get('/api/stats/refreshes', asyncHandler(async (req, res) => {
  const totalRefreshes = botManager.getTotalRefreshCount();
  const accounts = botManager.accounts.map(acc => ({
    username: acc.username,
    handle: acc.handle,
    refreshCount: botManager.bots.get(acc.username)?.refreshCount || 0
  }));
  
  res.json({
    totalRefreshes,
    accounts,
    startTime: botManager.startTime,
    uptime: Math.floor((Date.now() - botManager.startTime) / 1000)
  });
}));

app.post('/api/accounts', asyncHandler(async (req, res) => {
  const { username, password, handle } = req.body;
  
  if (!username || !password || !handle) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  await botManager.addAccount(username, password, handle);
  res.json({ success: true, message: `Account ${handle} added successfully` });
}));

app.delete('/api/accounts/:username', asyncHandler(async (req, res) => {
  const { username } = req.params;
  const success = await botManager.removeAccount(username);
  
  if (success) {
    res.json({ success: true, message: `Account ${username} removed successfully` });
  } else {
    res.status(404).json({ error: `Account ${username} not found` });
  }
}));

app.post('/api/bots/:username/start', asyncHandler(async (req, res) => {
  const { username } = req.params;
  const success = await botManager.startBot(username);
  
  if (success) {
    res.json({ success: true, message: `Bot for ${username} started successfully` });
  } else {
    res.status(404).json({ error: `Failed to start bot for ${username}` });
  }
}));

app.post('/api/bots/:username/stop', asyncHandler(async (req, res) => {
  const { username } = req.params;
  const success = await botManager.stopBot(username);
  
  if (success) {
    res.json({ success: true, message: `Bot for ${username} stopped successfully` });
  } else {
    res.status(404).json({ error: `Failed to stop bot for ${username}` });
  }
}));

app.post('/api/bots/start-all', asyncHandler(async (req, res) => {
  const count = await botManager.startAllBots();
  res.json({ success: true, message: `Started ${count} bots` });
}));

app.post('/api/bots/stop-all', asyncHandler(async (req, res) => {
  const count = await botManager.stopAllBots();
  res.json({ success: true, message: `Stopped ${count} bots` });
}));

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Server error', message: err.message });
});

// Start server function
async function startServer() {
  try {
    // Record start time
    botManager.startTime = Date.now();
    
    // Load accounts from storage
    await botManager.loadAccounts();
    
    // Start the server
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API available at http://localhost:${PORT}`);
      console.log(`To check status: http://localhost:${PORT}/api/status`);
      console.log(`To check refresh stats: http://localhost:${PORT}/api/stats/refreshes`);
    });
    
    // Start all active bots
    const botCount = await botManager.startAllBots();
    console.log(`Started ${botCount} bots automatically`);
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Shutting down server...');
      await botManager.stopAllBots();
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
      
      // Force exit after 10 seconds if something hangs
      setTimeout(() => {
        console.error('Forced shutdown after 10-second timeout');
        process.exit(1);
      }, 10000);
    });
    
    process.on('SIGTERM', async () => {
      console.log('Shutting down server...');
      await botManager.stopAllBots();
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
      
      // Force exit after 10 seconds if something hangs
      setTimeout(() => {
        console.error('Forced shutdown after 10-second timeout');
        process.exit(1);
      }, 10000);
    });
    
    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Export functions
module.exports = {
  start: startServer,
  app // Export for testing
}; 