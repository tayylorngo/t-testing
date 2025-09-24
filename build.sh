#!/bin/bash

# Build script for Render deployment
set -e

echo "🚀 Starting build process..."

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client
npm install

# Build client
echo "🏗️  Building client..."
npm run build

# Go back to root
cd ..

# Create server/public directory
echo "📁 Creating server/public directory..."
mkdir -p server/public

# Copy client build to server/public
echo "📋 Copying client build to server/public..."
cp -r client/dist/* server/public/

echo "🎉 Build completed successfully!"