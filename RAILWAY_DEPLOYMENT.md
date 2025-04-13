# Railway Deployment Instructions

This guide provides step-by-step instructions for deploying the Twitter Profile Refresh Bot to Railway for 24/7 operation.

## Prerequisites

1. [GitHub account](https://github.com)
2. [Railway account](https://railway.app) (with linked GitHub account)
3. Git installed on your local machine

## Deployment Steps

### 1. Push to GitHub

Create a new GitHub repository and push this codebase to it:

```bash
# Initialize git (if not done already)
git init

# Add all files
git add .

# Commit changes
git commit -m "Initial commit"

# Add GitHub remote (replace with your own repository URL)
git remote add origin https://github.com/yourusername/twitterbot.git

# Push to GitHub
git push -u origin master
```

### 2. Deploy to Railway

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project" > "Deploy from GitHub repo"
3. Select your GitHub repository with the Twitter bot code
4. Railway will automatically detect the Nixpacks configuration

### 3. Configure Environment Variables

In the Railway dashboard, go to the "Variables" tab and add these variables:

```
TARGET_PROFILE=https://x.com/u235___
MIN_REFRESH_TIME=15
MAX_REFRESH_TIME=20
BOT_LAUNCH_DELAY=10
HEADLESS=true
PORT=3000
```

### 4. Configure Resources

In the Railway dashboard, go to the "Settings" tab and:
- Set Memory limit to at least 1GB
- Set CPU limit to at least 1 vCPU (recommended for Puppeteer)

### 5. Initial Setup

After deployment, you'll need to add your Twitter accounts through the API:

```bash
curl -X POST https://your-railway-domain.up.railway.app/api/accounts \
  -H "Content-Type: application/json" \
  -d '{"username":"email@example.com","password":"your_password","handle":"twitter_handle"}'
```

### 6. Verify Deployment

1. Check the Railway logs to ensure the service is running
2. Access the status endpoint: `https://your-railway-domain.up.railway.app/api/status`
3. Monitor refresh activity: `https://your-railway-domain.up.railway.app/api/stats/refreshes`

## Troubleshooting

### Browser Crashes

If Puppeteer browser keeps crashing:
- Increase memory allocation in Railway settings
- Check logs for specific error messages
- Try editing CHROME_BIN environment variable if needed

### Twitter Login Issues

If Twitter login fails:
- Check account credentials
- Verify there are no unusual activity flags on the accounts
- Review logs for exact failure point

### Service Keeps Restarting

If the service restarts frequently:
- Check for uncaught exceptions in Railway logs
- Ensure memory limits are sufficient
- Verify Puppeteer configuration

## Monitoring 24/7 Operation

To ensure your bot runs reliably 24/7:

1. Set up an uptime monitoring service like UptimeRobot to ping your `/api/status` endpoint
2. Check Railway metrics regularly for memory/CPU usage
3. Monitor the `/api/stats/refreshes` endpoint to verify refreshes are occurring

## Updating Your Deployment

When you push changes to your GitHub repository, Railway will automatically redeploy your application. 