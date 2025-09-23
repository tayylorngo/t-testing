# 🚂 Railway Deployment - Quick Start

## 🎯 Deploy in 5 Minutes!

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Ready for Railway deployment"
git push origin main
```

### Step 2: Deploy to Railway
1. **Go to [railway.app](https://railway.app)**
2. **Sign up/Login** with GitHub
3. **Click "Deploy from GitHub repo"**
4. **Select your `t-testing` repository**
5. **Railway will auto-deploy!**

### Step 3: Add MongoDB Database
1. **In Railway dashboard** → Click **"+ New"**
2. **Select "Database"** → **"MongoDB"**
3. **Railway creates free MongoDB instance**

### Step 4: Set Environment Variables
In Railway dashboard → **Variables** tab:

```bash
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-here
MONGODB_URI=${{MongoDB.MONGODB_URL}}
CORS_ORIGIN=https://your-app-name.railway.app
```

**Generate JWT Secret:**
- Go to [randomkeygen.com](https://randomkeygen.com)
- Use a "CodeIgniter Encryption Keys" (64 characters)

### Step 5: Done! 🎉
Your app will be live at: `https://your-app-name.railway.app`

## 🔍 Troubleshooting

**App not loading?**
- Check Railway logs in dashboard
- Verify environment variables are set
- Ensure MongoDB service is connected

**Need help?**
- Railway docs: [docs.railway.app](https://docs.railway.app)
- Your app will auto-redeploy when you push to GitHub

---

**That's it! Your T-Testing app is now live on Railway!** 🚂✨
