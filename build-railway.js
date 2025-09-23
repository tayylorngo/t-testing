#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Starting Railway build process...');

try {
  // Step 1: Install client dependencies
  console.log('📦 Installing client dependencies...');
  execSync('cd client && npm ci', { stdio: 'inherit' });
  console.log('✅ Client dependencies installed');

  // Step 2: Build React app
  console.log('🔨 Building React app...');
  execSync('cd client && npm run build', { stdio: 'inherit' });
  console.log('✅ React app built');

  // Step 3: Create public directory
  console.log('📁 Creating public directory...');
  const publicPath = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicPath)) {
    fs.mkdirSync(publicPath, { recursive: true });
  }
  console.log('✅ Public directory created');

  // Step 4: Copy build files
  console.log('📋 Copying build files...');
  const clientDistPath = path.join(process.cwd(), 'client', 'dist');
  const publicDirPath = path.join(process.cwd(), 'public');
  
  if (fs.existsSync(clientDistPath)) {
    // Copy all files from client/dist to public
    const files = fs.readdirSync(clientDistPath);
    files.forEach(file => {
      const srcPath = path.join(clientDistPath, file);
      const destPath = path.join(publicDirPath, file);
      
      if (fs.statSync(srcPath).isDirectory()) {
        // Copy directory recursively
        execSync(`cp -r "${srcPath}" "${destPath}"`, { stdio: 'inherit' });
      } else {
        // Copy file
        fs.copyFileSync(srcPath, destPath);
      }
    });
    console.log('✅ Build files copied to public directory');
  } else {
    console.log('⚠️  Client dist directory not found, creating fallback index.html');
    const fallbackHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>T-Testing</title>
</head>
<body>
    <div id="root">
        <h1>T-Testing App</h1>
        <p>React app build failed. Please check the build process.</p>
    </div>
</body>
</html>`;
    fs.writeFileSync(path.join(publicDirPath, 'index.html'), fallbackHtml);
  }

  // Step 5: Install server dependencies
  console.log('📦 Installing server dependencies...');
  execSync('cd server && npm ci --production', { stdio: 'inherit' });
  console.log('✅ Server dependencies installed');

  console.log('🎉 Railway build completed successfully!');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
