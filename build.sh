#!/bin/bash

# Build script for Railway deployment

echo "🔨 Installing client dependencies..."
cd client
npm ci
echo "✅ Client dependencies installed"

echo "🔨 Building React app..."
npm run build
echo "✅ React app built"

echo "🔨 Copying build files to server..."
cp -r dist ../server/public
echo "✅ Build files copied"

echo "🔨 Installing server dependencies..."
cd ../server
npm ci --production
echo "✅ Server dependencies installed"

echo "🎉 Build completed successfully!"
