# 🚀 T-Testing App Deployment Guide

This guide covers multiple deployment options for your testing session management application.

## 📋 Prerequisites

- Node.js 18+ installed
- Docker and Docker Compose (for containerized deployment)
- MongoDB database access
- Domain name (for production)

## 🎯 Deployment Options

### Option 1: Docker Deployment (Recommended)

#### Quick Start with Docker Compose

1. **Clone and prepare the repository:**

```bash
git clone <your-repo-url>
cd t-testing
```

2. **Configure environment variables:**

```bash
cp env.production.example .env.production
# Edit .env.production with your settings
```

3. **Set secure passwords:**

```bash
# Generate secure JWT secret
openssl rand -base64 32

# Update .env.production with:
# JWT_SECRET=your-generated-secret
# MONGO_ROOT_PASSWORD=your-secure-password
```

4. **Deploy with Docker Compose:**

```bash
docker-compose up -d
```

5. **Verify deployment:**

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f app

# Test health endpoint
curl http://localhost:3001/api/health
```

#### Production Docker Deployment

1. **Set up SSL certificates:**

```bash
mkdir ssl
# Place your SSL certificates in ssl/ directory
# cert.pem and key.pem
```

2. **Configure domain:**

```bash
# Update nginx.conf with your domain
# Update CORS_ORIGIN in .env.production
```

3. **Deploy with production settings:**

```bash
docker-compose -f docker-compose.yml up -d
```

### Option 2: Cloud Platform Deployment

#### A. Railway Deployment

1. **Connect your GitHub repository to Railway**
2. **Set environment variables in Railway dashboard:**

   - `NODE_ENV=production`
   - `JWT_SECRET=your-secret`
   - `MONGODB_URI=your-mongodb-uri`
   - `CORS_ORIGIN=your-domain`

3. **Deploy automatically on git push**

#### B. Render Deployment

1. **Create a new Web Service on Render**
2. **Connect your GitHub repository**
3. **Configure build settings:**

   - Build Command: `cd client && npm install && npm run build`
   - Start Command: `cd server && npm start`
   - Node Version: 18

4. **Set environment variables:**
   - Same as Railway above

#### C. DigitalOcean App Platform

1. **Create a new App on DigitalOcean**
2. **Connect your GitHub repository**
3. **Configure components:**
   - Static Site (client)
   - Web Service (server)
   - Database (MongoDB)

#### D. Heroku Deployment

1. **Install Heroku CLI**
2. **Create Heroku app:**

```bash
heroku create your-app-name
```

3. **Add MongoDB:**

```bash
heroku addons:create mongolab:sandbox
```

4. **Set environment variables:**

```bash
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secret
heroku config:set MONGODB_URI=your-mongodb-uri
```

5. **Deploy:**

```bash
git push heroku main
```

### Option 3: VPS Deployment

#### Ubuntu/Debian Server Setup

1. **Update system:**

```bash
sudo apt update && sudo apt upgrade -y
```

2. **Install Node.js:**

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. **Install MongoDB:**

```bash
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

4. **Install PM2 for process management:**

```bash
sudo npm install -g pm2
```

5. **Clone and setup application:**

```bash
git clone <your-repo-url>
cd t-testing
cp env.production.example .env.production
# Edit .env.production
```

6. **Build and start:**

```bash
# Build client
cd client
npm install
npm run build

# Install server dependencies
cd ../server
npm install --production

# Start with PM2
pm2 start server.js --name "t-testing"
pm2 startup
pm2 save
```

7. **Setup Nginx reverse proxy:**

```bash
sudo apt install nginx
sudo cp nginx.conf /etc/nginx/sites-available/t-testing
sudo ln -s /etc/nginx/sites-available/t-testing /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔧 Environment Configuration

### Required Environment Variables

```bash
# Application
NODE_ENV=production
PORT=3001

# Security (CHANGE THESE!)
JWT_SECRET=your-super-secret-jwt-key
SESSION_SECRET=your-session-secret

# Database
MONGODB_URI=mongodb://username:password@host:port/database

# CORS
CORS_ORIGIN=https://yourdomain.com

# Optional
REDIS_URL=redis://localhost:6379
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Security Checklist

- ✅ Change default JWT_SECRET
- ✅ Use strong database passwords
- ✅ Enable HTTPS/SSL
- ✅ Configure CORS properly
- ✅ Set up firewall rules
- ✅ Regular security updates
- ✅ Monitor logs

## 📊 Monitoring and Maintenance

### Health Checks

```bash
# Application health
curl https://yourdomain.com/api/health

# Database connectivity
curl https://yourdomain.com/api/health

# WebSocket connectivity
# Test in browser console
```

### Log Monitoring

```bash
# Docker logs
docker-compose logs -f app

# PM2 logs
pm2 logs t-testing

# Nginx logs
sudo tail -f /var/log/nginx/access.log
```

### Backup Strategy

1. **Database backups:**

```bash
# MongoDB backup
mongodump --uri="mongodb://username:password@host:port/database" --out=backup-$(date +%Y%m%d)

# Restore
mongorestore --uri="mongodb://username:password@host:port/database" backup-20240101/
```

2. **Application backups:**

```bash
# Backup application files
tar -czf app-backup-$(date +%Y%m%d).tar.gz /path/to/your/app
```

## 🚨 Troubleshooting

### Common Issues

1. **Port conflicts:**

```bash
# Check what's using port 3001
sudo lsof -i :3001
```

2. **Database connection issues:**

```bash
# Test MongoDB connection
mongo "mongodb://username:password@host:port/database"
```

3. **WebSocket issues:**

```bash
# Check if WebSocket is working
# Test in browser: ws://yourdomain.com/socket.io/
```

4. **Build issues:**

```bash
# Clear cache and rebuild
rm -rf client/node_modules client/dist
cd client && npm install && npm run build
```

### Performance Optimization

1. **Enable gzip compression**
2. **Set up CDN for static assets**
3. **Configure Redis for session storage**
4. **Use MongoDB indexes**
5. **Implement rate limiting**

## 📈 Scaling Considerations

### Horizontal Scaling

1. **Load balancer setup**
2. **Session storage in Redis**
3. **Database clustering**
4. **CDN for static assets**

### Vertical Scaling

1. **Increase server resources**
2. **Optimize database queries**
3. **Enable caching**
4. **Monitor performance metrics**

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Railway
        run: |
          # Your deployment commands here
```

## 📞 Support

For deployment issues:

1. Check application logs
2. Verify environment variables
3. Test database connectivity
4. Review security configuration

---

**Ready to deploy? Choose your preferred option and follow the steps above!** 🚀
