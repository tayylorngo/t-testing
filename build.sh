#!/bin/bash

# Build script for Railway deployment

echo "🔨 Installing client dependencies..."
cd client
npm ci
echo "✅ Client dependencies installed"

echo "🔨 Building React app..."
npm run build
echo "✅ React app built"

echo "🔨 Creating public directory and copying build files..."
mkdir -p ../server/public
cp -r dist/* ../server/public/
echo "✅ Build files copied to server/public"

echo "🔨 Installing server dependencies..."
cd ../server
npm ci --production
echo "✅ Server dependencies installed"

echo "🎉 Build completed successfully!"
