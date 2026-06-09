#!/bin/bash

# Build script for Render deployment
set -e

echo "🚀 Starting build process..."

# Install server dependencies first
echo "📦 Installing server dependencies..."
cd server
npm install --production
cd ..

# Install client dependencies (including devDependencies)
echo "📦 Installing client dependencies..."
cd client
echo "📁 Current directory: $(pwd)"
echo "📁 Package.json exists: $(test -f package.json && echo 'YES' || echo 'NO')"
npm install --include=dev
echo "📦 Checking if vite is installed..."
ls node_modules/.bin/vite || echo "❌ Vite not found in node_modules/.bin/"

# Build client
echo "🏗️  Building client..."
npm run build

# Go back to root
cd ..

# Create server/public directory
echo "📁 Creating server/public directory..."
mkdir -p server/public

# Remove stale hashed bundles from previous deploys so old assets don't linger
echo "🧹 Clearing stale assets in server/public..."
rm -rf server/public/assets
mkdir -p server/public

# Copy client build to server/public
echo "📋 Copying client build to server/public..."
cp -r client/dist/* server/public/

echo "🎉 Build completed successfully!"