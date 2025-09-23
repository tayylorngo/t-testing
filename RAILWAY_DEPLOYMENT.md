# 🚂 Railway Deployment Guide for T-Testing App

## 🎯 Quick Start (5 minutes)

### Step 1: Prepare Your Repository
1. **Push your code to GitHub** (if not already done):
```bash
git add .
git commit -m "Ready for Railway deployment"
git push origin main
```

### Step 2: Deploy to Railway
1. **Go to [railway.app](https://railway.app)**
2. **Sign up/Login** with your GitHub account
3. **Click "Deploy from GitHub repo"**
4. **Select your t-testing repository**
5. **Railway will auto-detect and deploy!**

### Step 3: Add MongoDB Database
1. **In your Railway project dashboard**
2. **Click "+ New" → "Database" → "MongoDB"**
3. **Railway will create a free MongoDB instance**

### Step 4: Configure Environment Variables
In your Railway project dashboard, go to **Variables** tab and add:

```bash
NODE_ENV=production
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
MONGODB_URI=${{MongoDB.MONGODB_URL}}
CORS_ORIGIN=https://your-app-name.railway.app
```

**Note**: `${{MongoDB.MONGODB_URL}}` will be auto-populated by Railway when you add the MongoDB service.

### Step 5: Deploy!
1. **Railway will automatically redeploy** when you add environment variables
2. **Your app will be live** at `https://your-app-name.railway.app`

## 🔧 Detailed Configuration

### Environment Variables Required

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | `3001` | Server port (Railway sets this automatically) |
| `JWT_SECRET` | `your-secret-key` | **CHANGE THIS!** Generate a secure key |
| `MONGODB_URI` | `${{MongoDB.MONGODB_URL}}` | Auto-filled by Railway |
| `CORS_ORIGIN` | `https://your-app-name.railway.app` | Your Railway domain |

### Generating a Secure JWT Secret

**Option 1: Online Generator**
- Go to [randomkeygen.com](https://randomkeygen.com)
- Use a "CodeIgniter Encryption Keys" (64 characters)

**Option 2: Command Line**
```bash
# If you have Node.js installed
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# If you have OpenSSL
openssl rand -hex 32
```

## 🚀 Deployment Process

### What Railway Does Automatically:
1. **Detects** your Node.js application
2. **Installs dependencies** for both client and server
3. **Builds** the React frontend
4. **Starts** the server with the built frontend
5. **Provides** a public URL
6. **Handles** SSL certificates automatically

### Build Process:
```
1. Install client dependencies (npm ci)
2. Install server dependencies (npm ci --production)
3. Build React app (npm run build)
4. Copy built files to server/public
5. Start server (npm start)
```

## 🔍 Troubleshooting

### Common Issues:

#### 1. Build Fails
**Error**: "Module not found" or "Build failed"
**Solution**: 
- Check that all dependencies are in package.json
- Ensure client builds successfully locally first

#### 2. Database Connection Issues
**Error**: "MongoDB connection failed"
**Solution**:
- Verify MongoDB service is added to your Railway project
- Check MONGODB_URI environment variable is set correctly

#### 3. App Not Loading
**Error**: Blank page or 404
**Solution**:
- Check Railway logs in the dashboard
- Verify CORS_ORIGIN matches your Railway domain
- Ensure PORT environment variable is set

### Viewing Logs:
1. **Go to your Railway project dashboard**
2. **Click on your service**
3. **Go to "Deployments" tab**
4. **Click on the latest deployment**
5. **View logs in real-time**

## 🌐 Custom Domain (Optional)

### Setting up Custom Domain:
1. **In Railway dashboard** → **Settings** → **Domains**
2. **Add your custom domain**
3. **Update CORS_ORIGIN** environment variable to your custom domain
4. **Railway will provide DNS instructions**

## 💰 Cost Information

### Railway Free Tier:
- **$5 credit/month** (more than enough for small apps)
- **512MB RAM**
- **1GB storage**
- **Unlimited bandwidth**
- **Custom domains**

### Your App Usage:
- **Typical usage**: $1-3/month
- **Heavy usage**: $3-5/month
- **Free tier should cover**: 95% of use cases

## 🔄 Updating Your App

### Automatic Deployments:
1. **Push changes to GitHub**
2. **Railway automatically detects changes**
3. **Redeploys automatically**
4. **No manual intervention needed**

### Manual Redeploy:
1. **Go to Railway dashboard**
2. **Click "Redeploy"** on your service
3. **Select deployment to redeploy**

## 📊 Monitoring

### Health Checks:
- **Endpoint**: `https://your-app.railway.app/api/health`
- **Railway monitors** this endpoint automatically
- **Auto-restarts** if health check fails

### Metrics Available:
- **CPU usage**
- **Memory usage**
- **Request count**
- **Response times**

## 🛡️ Security Best Practices

### Environment Variables:
- ✅ **Never commit** .env files to GitHub
- ✅ **Use Railway's** environment variable system
- ✅ **Generate secure** JWT secrets
- ✅ **Rotate secrets** periodically

### Database:
- ✅ **MongoDB Atlas** (Railway's MongoDB) is secure by default
- ✅ **Connection strings** are encrypted
- ✅ **Access is restricted** to your Railway services

## 🎉 Success Checklist

After deployment, verify:
- [ ] App loads at Railway URL
- [ ] Can register/login users
- [ ] Can create sessions
- [ ] Real-time updates work
- [ ] Database persists data
- [ ] Health check endpoint responds

## 🆘 Getting Help

### Railway Support:
- **Documentation**: [docs.railway.app](https://docs.railway.app)
- **Discord**: Railway Discord community
- **GitHub Issues**: For app-specific issues

### Common Commands:
```bash
# Check if your app builds locally
cd client && npm run build

# Test server locally
cd server && npm start

# Check Railway logs
# (Use Railway dashboard)
```

---

**Your T-Testing app will be live at: `https://your-app-name.railway.app`** 🚂✨
