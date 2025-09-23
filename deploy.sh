#!/bin/bash

# T-Testing App Deployment Script
# Usage: ./deploy.sh [docker|vps|cloud]

set -e

DEPLOYMENT_TYPE=${1:-docker}

echo "🚀 T-Testing App Deployment Script"
echo "=================================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to generate secure JWT secret
generate_jwt_secret() {
    if command_exists openssl; then
        openssl rand -base64 32
    elif command_exists python3; then
        python3 -c "import secrets; print(secrets.token_urlsafe(32))"
    else
        echo "Please install openssl or python3 to generate secure secrets"
        exit 1
    fi
}

# Function for Docker deployment
deploy_docker() {
    echo "🐳 Deploying with Docker..."
    
    # Check if Docker is installed
    if ! command_exists docker; then
        echo "❌ Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command_exists docker-compose; then
        echo "❌ Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Create environment file if it doesn't exist
    if [ ! -f .env.production ]; then
        echo "📝 Creating production environment file..."
        cp env.production.example .env.production
        
        # Generate secure JWT secret
        JWT_SECRET=$(generate_jwt_secret)
        sed -i.bak "s/your-super-secret-jwt-key-change-this-in-production-make-it-long-and-random/$JWT_SECRET/" .env.production
        rm .env.production.bak
        
        echo "✅ Environment file created. Please review and update .env.production with your settings."
        echo "⚠️  Important: Update CORS_ORIGIN with your domain before continuing."
        read -p "Press Enter to continue after updating .env.production..."
    fi
    
    # Build and start containers
    echo "🔨 Building and starting containers..."
    docker-compose up -d --build
    
    # Wait for services to start
    echo "⏳ Waiting for services to start..."
    sleep 10
    
    # Check health
    echo "🏥 Checking application health..."
    if curl -f http://localhost:3001/api/health >/dev/null 2>&1; then
        echo "✅ Application is running successfully!"
        echo "🌐 Access your app at: http://localhost:3001"
    else
        echo "❌ Application health check failed. Check logs with: docker-compose logs -f app"
        exit 1
    fi
    
    echo "📊 To view logs: docker-compose logs -f"
    echo "🛑 To stop: docker-compose down"
}

# Function for VPS deployment
deploy_vps() {
    echo "🖥️  VPS Deployment Guide..."
    echo "=========================="
    echo "This will guide you through VPS deployment steps."
    echo ""
    echo "1. Update your system:"
    echo "   sudo apt update && sudo apt upgrade -y"
    echo ""
    echo "2. Install Node.js 18:"
    echo "   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "   sudo apt-get install -y nodejs"
    echo ""
    echo "3. Install MongoDB:"
    echo "   wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -"
    echo "   echo 'deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse' | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list"
    echo "   sudo apt-get update && sudo apt-get install -y mongodb-org"
    echo "   sudo systemctl start mongod && sudo systemctl enable mongod"
    echo ""
    echo "4. Install PM2:"
    echo "   sudo npm install -g pm2"
    echo ""
    echo "5. Clone and setup your app:"
    echo "   git clone <your-repo-url>"
    echo "   cd t-testing"
    echo "   cp env.production.example .env.production"
    echo "   # Edit .env.production with your settings"
    echo ""
    echo "6. Build and start:"
    echo "   cd client && npm install && npm run build"
    echo "   cd ../server && npm install --production"
    echo "   pm2 start server.js --name 't-testing'"
    echo "   pm2 startup && pm2 save"
    echo ""
    echo "7. Setup Nginx (optional):"
    echo "   sudo apt install nginx"
    echo "   sudo cp nginx.conf /etc/nginx/sites-available/t-testing"
    echo "   sudo ln -s /etc/nginx/sites-available/t-testing /etc/nginx/sites-enabled/"
    echo "   sudo nginx -t && sudo systemctl reload nginx"
    echo ""
    echo "📖 See DEPLOYMENT.md for detailed VPS setup instructions."
}

# Function for cloud deployment
deploy_cloud() {
    echo "☁️  Cloud Deployment Options..."
    echo "=============================="
    echo "Choose your preferred cloud platform:"
    echo ""
    echo "1. Railway (Recommended for beginners):"
    echo "   - Connect GitHub repository"
    echo "   - Set environment variables"
    echo "   - Automatic deployments"
    echo ""
    echo "2. Render:"
    echo "   - Create Web Service"
    echo "   - Connect GitHub repository"
    echo "   - Configure build settings"
    echo ""
    echo "3. DigitalOcean App Platform:"
    echo "   - Create new App"
    echo "   - Connect GitHub repository"
    echo "   - Configure components"
    echo ""
    echo "4. Heroku:"
    echo "   - heroku create your-app-name"
    echo "   - heroku addons:create mongolab:sandbox"
    echo "   - heroku config:set JWT_SECRET=your-secret"
    echo "   - git push heroku main"
    echo ""
    echo "📖 See DEPLOYMENT.md for detailed cloud deployment instructions."
}

# Main deployment logic
case $DEPLOYMENT_TYPE in
    docker)
        deploy_docker
        ;;
    vps)
        deploy_vps
        ;;
    cloud)
        deploy_cloud
        ;;
    *)
        echo "❌ Invalid deployment type. Use: docker, vps, or cloud"
        echo ""
        echo "Usage: $0 [docker|vps|cloud]"
        echo ""
        echo "  docker  - Deploy using Docker Compose (recommended)"
        echo "  vps     - Show VPS deployment guide"
        echo "  cloud   - Show cloud platform options"
        exit 1
        ;;
esac

echo ""
echo "🎉 Deployment setup complete!"
echo "📖 For more details, see DEPLOYMENT.md"
