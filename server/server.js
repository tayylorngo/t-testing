import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import User from './models/User.js';
import Room from './models/Room.js';
import { debugLog } from './utils/logger.js';
import { initRealtime } from './realtime/socket.js';
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import sessionRoutes from './routes/sessions.js';
import sectionRoutes from './routes/sections.js';
import invitationRoutes from './routes/invitations.js';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables - explicitly specify path
dotenv.config({ path: path.join(__dirname, '.env') });

// Validate JWT_SECRET at startup — refuse to boot without a real secret
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is missing or empty. Exiting.');
  process.exit(1);
}

// Build the CORS allowlist from CLIENT_URL (comma-separated) plus this app's own
// public URL on Render (RENDER_EXTERNAL_URL is set automatically, e.g.
// https://elmira.onrender.com). Since the SPA is served from the same origin as
// the API, the app's own origin must be allowed for browser API calls to work.
const normalizeOrigin = (o) => o.trim().replace(/\/+$/, '');
const allowedOrigins = [
  ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : []),
  ...(process.env.RENDER_EXTERNAL_URL ? [process.env.RENDER_EXTERNAL_URL] : []),
]
  .map(normalizeOrigin)
  .filter(Boolean);

function checkCorsOrigin(origin, callback) {
  // Allow requests with no Origin header (same-origin GETs, curl, server-to-server)
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes(normalizeOrigin(origin))) return callback(null, true);
  callback(new Error(`CORS: origin ${origin} is not allowed`));
}

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: checkCorsOrigin,
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Wire up real-time (socket.io) handlers
initRealtime(io);

// MongoDB Connection
const MONGODB_URI = process.env.MONGO_URL || process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ Missing MongoDB connection string: set MONGO_URL or MONGODB_URI');
  process.exit(1);
}
debugLog('🔍 MongoDB URI:', MONGODB_URI ? 'Set' : 'Not set');
debugLog('🔍 Environment variables:', {
  MONGODB_URI: process.env.MONGODB_URI ? 'Set' : 'Not set',
  MONGO_URL: process.env.MONGO_URL ? 'Set' : 'Not set',
  NODE_ENV: process.env.NODE_ENV || 'Not set'
});

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

// Initialize demo data if database is empty
const initializeDemoData = async () => {
  try {
    // Check if demo admin user exists
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('password', 10);
      await User.create({
        firstName: 'Admin',
        lastName: 'User',
        username: 'admin',
        email: 'admin@example.com',
        password: hashedPassword,
        verified: true
      });
      console.log('✅ Demo admin user created');
    }

    // Check if demo rooms exist
    const roomCount = await Room.countDocuments();
    if (roomCount === 0) {
      await Room.insertMany([
        { name: 'Room 101', status: 'active', supplies: ['pencils', 'paper'] },
        { name: 'Room 102', status: 'completed', supplies: [] },
        { name: 'Room 103', status: 'active', supplies: ['calculators'] }
      ]);
      console.log('✅ Demo rooms created');
    }
  } catch (error) {
    console.error('❌ Error initializing demo data:', error);
  }
};

// Initialize demo data after connection (only when explicitly opted in)
mongoose.connection.once('open', async () => {
  if (process.env.SEED_DEMO === 'true') {
    initializeDemoData();
  }
});

// Middleware
app.use(helmet());
app.use(cors({ origin: checkCorsOrigin }));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the React app build
const publicPath = path.join(__dirname, 'public');
debugLog('🔍 Public path:', publicPath);
debugLog('🔍 Public directory exists:', fs.existsSync(publicPath));

// Create public directory if it doesn't exist
if (!fs.existsSync(publicPath)) {
  debugLog('🔨 Creating public directory...');
  fs.mkdirSync(publicPath, { recursive: true });
}

// Check if index.html exists
const indexPath = path.join(publicPath, 'index.html');
debugLog('🔍 index.html exists:', fs.existsSync(indexPath));

// Debug: List files in public directory
debugLog('🔍 Files in public directory:');
try {
  const files = fs.readdirSync(publicPath, { recursive: true });
  debugLog('📁 Public directory contents:', files);
} catch (error) {
  console.error('❌ Error reading public directory:', error.message);
}

// Serve static files with proper MIME types
app.use(express.static(publicPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html');
      // index.html must always be revalidated so a client picks up the new
      // hashed asset names after a redeploy (prevents requesting deleted bundles).
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Specific route for assets directory
app.use('/assets', express.static(path.join(publicPath, 'assets'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
    // Hashed bundles are content-addressed, so they are safe to cache forever.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

// Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Additional health check for Render (more frequent pings)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use(authRoutes);
app.use(roomRoutes);
app.use(sessionRoutes);
app.use(sectionRoutes);
app.use(invitationRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  } else {
    console.error('Unhandled error:', err.message);
  }
  res.status(500).json({ message: 'Something went wrong!' });
});

// Catch-all handler: send back React's index.html file for client-side routing.
// Assets and API paths must NOT fall through to index.html — a missing asset
// should return a clean 404 instead of HTML (which causes MIME-type errors) or
// a JSON 500. The express.static middleware above still serves existing assets.
app.get('*', (req, res) => {
  if (req.path.startsWith('/assets/') || req.path.startsWith('/api/')) {
    return res.status(404).send('Not found');
  }
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Elmira Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log('🗄️  Connected to MongoDB');
  console.log(`🔌 WebSocket server ready for real-time updates`);
}); 
