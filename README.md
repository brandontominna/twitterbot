# Twitter Profile Refresh Bot

A Node.js application that logs into Twitter/X accounts and refreshes a target profile at random intervals. The bot uses Puppeteer for browser automation and can handle multiple accounts simultaneously.

## Features

- Automatically logs into Twitter accounts
- Navigates directly to a target profile
- Refreshes the page at random intervals
- Handles security verification prompts
- Supports multiple simultaneous accounts
- Includes a REST API for management
- Persists account data
- Recovers from errors automatically

## Deployment to Railway

### Prerequisites

1. [GitHub account](https://github.com)
2. [Railway account](https://railway.app)
3. Git installed on your local machine

### Deployment Steps

1. **Push to GitHub**

   Create a new GitHub repository and push this codebase to it:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/twitterbot.git
   git push -u origin main
   ```

2. **Connect to Railway**

   - Go to [Railway Dashboard](https://railway.app/dashboard)
   - Click "New Project" > "Deploy from GitHub repo"
   - Select your GitHub repository
   - Railway will automatically detect the Nixpacks configuration

3. **Configure Environment Variables**

   In the Railway dashboard, go to the "Variables" tab and add:

   ```
   TARGET_PROFILE=https://x.com/u235___
   MIN_REFRESH_TIME=15
   MAX_REFRESH_TIME=20
   BOT_LAUNCH_DELAY=10
   HEADLESS=true
   ```

4. **Configure Resources**

   In the Railway dashboard, go to the "Settings" tab and:
   - Set Memory limit to at least 1GB
   - Set CPU limit to at least 0.5 vCPUs

5. **Deploy**

   Railway will automatically deploy your application when you push changes to your GitHub repository.

### Monitoring

The bot provides several API endpoints for monitoring:

- `/api/status` - Get the current status of all bots
- `/api/stats/refreshes` - Get refresh statistics

## Managing Accounts

After deployment, you can manage accounts through the API:

### Add Account
```
curl -X POST https://your-railway-domain.up.railway.app/api/accounts \
  -H "Content-Type: application/json" \
  -d '{"username":"email@example.com","password":"your_password","handle":"twitter_handle"}'
```

### Remove Account
```
curl -X DELETE https://your-railway-domain.up.railway.app/api/accounts/email@example.com
```

### Start Bot
```
curl -X POST https://your-railway-domain.up.railway.app/api/bots/email@example.com/start
```

### Stop Bot
```
curl -X POST https://your-railway-domain.up.railway.app/api/bots/email@example.com/stop
```

## Local Development

1. Install dependencies:
   ```
   npm install
   ```

2. Create .env file:
   ```
   cp .env.example .env
   ```

3. Run the bot:
   ```
   npm start
   ```

4. For testing a single account:
   ```
   npm run test-bot
   ```

## Troubleshooting Railway Deployment

If your deployment fails:

1. Check the logs in the Railway dashboard
2. Ensure the memory limit is sufficient (1GB+)
3. Verify all environment variables are set correctly
4. Try restarting the service from the Railway dashboard