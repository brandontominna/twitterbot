# Twitter Profile Refresh Bot

A Node.js application that logs into Twitter/X accounts and refreshes a target profile at random intervals. The bot uses Puppeteer for browser automation and can handle multiple accounts simultaneously.

## Features

- Automatically logs into Twitter accounts
- Navigates directly to a target profile
- Refreshes the page at random intervals (15-20 seconds by default)
- Handles security verification prompts
- Supports multiple simultaneous accounts
- Includes a REST API for management
- Persists account data
- Recovers from errors automatically

## Setup

### Prerequisites

1. Node.js 14+ installed
2. Chrome or Chromium browser installed

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/twitterbot.git
   cd twitterbot
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create or edit .env file:
   ```
   cp .env.example .env
   ```
   
4. Configure your .env file:
   ```
   TARGET_PROFILE=https://x.com/u235___
   PORT=3000
   MIN_REFRESH_TIME=15
   MAX_REFRESH_TIME=20
   BOT_LAUNCH_DELAY=10
   HEADLESS=false
   ```

## Running the Bot

1. Start the application:
   ```
   npm start
   ```

2. For testing a single account:
   ```
   npm run test-bot
   ```

## Managing Accounts

Once the bot is running, you can manage accounts through the API:

### View Status
```
curl http://localhost:3000/api/status
```

### Add Account
```
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{"username":"email@example.com","password":"your_password","handle":"twitter_handle"}'
```

### Remove Account
```
curl -X DELETE http://localhost:3000/api/accounts/email@example.com
```

### Start Bot
```
curl -X POST http://localhost:3000/api/bots/email@example.com/start
```

### Stop Bot
```
curl -X POST http://localhost:3000/api/bots/email@example.com/stop
```

### Start All Bots
```
curl -X POST http://localhost:3000/api/bots/start-all
```

### Stop All Bots
```
curl -X POST http://localhost:3000/api/bots/stop-all
```

### Get Refresh Statistics
```
curl http://localhost:3000/api/stats/refreshes
```

## Configuration Options

You can customize the bot's behavior by changing the following environment variables:

- `TARGET_PROFILE`: The Twitter/X profile to refresh (e.g., https://x.com/u235___)
- `PORT`: Port for the API server (default: 3000)
- `MIN_REFRESH_TIME`: Minimum seconds between refreshes (default: 15)
- `MAX_REFRESH_TIME`: Maximum seconds between refreshes (default: 20)
- `BOT_LAUNCH_DELAY`: Seconds to wait between launching bots (default: 10)
- `HEADLESS`: Whether to run browsers in headless mode (true/false)

## Troubleshooting

If you encounter issues:

1. Check the console for error messages
2. Ensure your Twitter/X credentials are correct
3. If you see login failures, Twitter might be showing additional security challenges
4. Try running with HEADLESS=false to see exactly what's happening in the browser
5. Increase timeout values in the code if you're experiencing timeout errors