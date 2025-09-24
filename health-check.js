#!/usr/bin/env node

/**
 * Health Check Script for Elmira
 * 
 * This script can be used to ping your Render app to keep it awake.
 * Run this script periodically to prevent Render from sleeping.
 * 
 * Usage:
 * 1. Set your app URL: node health-check.js https://your-app-name.onrender.com
 * 2. Or set RENDER_URL environment variable
 */

const https = require('https');
const http = require('http');

const RENDER_URL = process.env.RENDER_URL || process.argv[2] || 'http://localhost:3001';

async function healthCheck() {
  const url = new URL(RENDER_URL);
  const isHttps = url.protocol === 'https:';
  const client = isHttps ? https : http;
  
  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: '/health',
    method: 'GET',
    timeout: 10000
  };

  return new Promise((resolve, reject) => {
    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200 && response.status === 'OK') {
            console.log(`✅ Health check successful: ${RENDER_URL}`);
            console.log(`   Status: ${response.status}`);
            console.log(`   Uptime: ${Math.floor(response.uptime)}s`);
            console.log(`   Timestamp: ${response.timestamp}`);
            resolve(response);
          } else {
            console.log(`❌ Health check failed: ${res.statusCode}`);
            reject(new Error(`Health check failed: ${res.statusCode}`));
          }
        } catch (error) {
          console.log(`❌ Invalid response: ${data}`);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Health check error: ${error.message}`);
      reject(error);
    });

    req.on('timeout', () => {
      console.log(`❌ Health check timeout`);
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.end();
  });
}

// Run health check
healthCheck()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Health check failed:', error.message);
    process.exit(1);
  });
