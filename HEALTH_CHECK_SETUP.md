# Health Check Setup for Render

This document explains how to set up health checks to keep your Elmira app awake on Render.

## How Render Sleep Works

- **Free Tier**: Apps sleep after 15 minutes of inactivity
- **Wake-up Time**: Takes ~30 seconds to wake up when accessed
- **Solution**: Regular health check pings keep the app awake

## Health Check Endpoints

Your Elmira app has two health check endpoints:

1. **`/api/health`** - Full health check with detailed information
2. **`/health`** - Simple health check for frequent pings

## Manual Health Check

You can manually ping your app by visiting:
```
https://your-app-name.onrender.com/health
```

## Automated Health Check

### Option 1: Use the provided script

```bash
# Set your Render URL
export RENDER_URL=https://your-app-name.onrender.com

# Run health check
node health-check.js
```

### Option 2: Use cron job (if you have a server)

```bash
# Add to crontab (runs every 10 minutes)
*/10 * * * * curl -f https://your-app-name.onrender.com/health > /dev/null 2>&1
```

### Option 3: Use external services

- **UptimeRobot** (free): https://uptimerobot.com
- **Pingdom** (free tier): https://pingdom.com
- **StatusCake** (free tier): https://statuscake.com

### Option 4: Use GitHub Actions (free)

Create `.github/workflows/health-check.yml`:

```yaml
name: Health Check
on:
  schedule:
    - cron: '*/10 * * * *'  # Every 10 minutes
  workflow_dispatch:

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Render App
        run: |
          curl -f ${{ secrets.RENDER_URL }}/health || exit 1
```

## Recommended Setup

For a testing management app like Elmira, the **30-second wake-up time** is usually acceptable because:

1. **Testing sessions are scheduled events** - not 24/7 usage
2. **Users will naturally wake up the app** when they need it
3. **Real-time features work perfectly** once awake
4. **Completely free** with Render

## When to Use Health Checks

- **High-traffic apps** that need to stay awake
- **Critical business hours** when immediate access is required
- **Demo environments** that need to be always available

## When NOT to Use Health Checks

- **Low-traffic testing apps** (like Elmira)
- **Development/staging environments**
- **Personal projects** with occasional use

## Cost Comparison

- **Render Free**: $0/month + 30s wake-up time
- **Render Starter**: $7/month + always awake
- **Railway Hobby**: $5/month + always awake

For most testing management use cases, the free Render tier with occasional wake-up delays is perfectly fine!
