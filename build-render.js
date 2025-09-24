#!/usr/bin/env node

/**
 * Build script for Render deployment
 * Handles client build and file copying for production
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Render build process...');

try {
  // Step 1: Install client dependencies
  console.log('📦 Installing client dependencies...');
  execSync('cd client && npm ci', { stdio: 'inherit' });

  // Step 2: Build client
  console.log('🏗️  Building client...');
  execSync('cd client && npm run build', { stdio: 'inherit' });

  // Step 3: Create server/public directory
  console.log('📁 Creating server/public directory...');
  const publicDir = path.join(__dirname, 'server', 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Step 4: Copy client build to server/public
  console.log('📋 Copying client build to server/public...');
  const clientDist = path.join(__dirname, 'client', 'dist');
  const serverPublic = path.join(__dirname, 'server', 'public');

  // Copy all files from client/dist to server/public
  if (fs.existsSync(clientDist)) {
    const files = fs.readdirSync(clientDist);
    files.forEach(file => {
      const srcPath = path.join(clientDist, file);
      const destPath = path.join(serverPublic, file);
      
      if (fs.statSync(srcPath).isDirectory()) {
        // Copy directory recursively
        execSync(`cp -r "${srcPath}" "${destPath}"`, { stdio: 'inherit' });
      } else {
        // Copy file
        fs.copyFileSync(srcPath, destPath);
      }
    });
    console.log('✅ Client build copied successfully');
  } else {
    console.error('❌ Client dist directory not found');
    process.exit(1);
  }

  console.log('🎉 Render build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
