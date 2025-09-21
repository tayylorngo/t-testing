import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Real-time session management
const activeSessions = new Map(); // sessionId -> Set of socketIds
const userSessions = new Map(); // socketId -> sessionId

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  // Join a session room
  socket.on('join-session', (sessionId) => {
    console.log(`🔌 Socket ${socket.id} joining session: ${sessionId}`);
    socket.join(`session-${sessionId}`);
    
    // Track user's active session
    userSessions.set(socket.id, sessionId);
    
    // Add to active sessions tracking
    if (!activeSessions.has(sessionId)) {
      activeSessions.set(sessionId, new Set());
    }
    activeSessions.get(sessionId).add(socket.id);
    
    console.log(`🔌 User ${socket.id} joined session ${sessionId}`);
    console.log(`🔌 Active sessions:`, Array.from(activeSessions.entries()).map(([id, sockets]) => [id, sockets.size]));
    console.log(`🔌 Session ${sessionId} now has ${activeSessions.get(sessionId).size} users`);
  });

  // Leave a session room
  socket.on('leave-session', (sessionId) => {
    console.log(`🔌 Socket ${socket.id} leaving session: ${sessionId}`);
    socket.leave(`session-${sessionId}`);
    
    // Remove from tracking
    userSessions.delete(socket.id);
    if (activeSessions.has(sessionId)) {
      activeSessions.get(sessionId).delete(socket.id);
      if (activeSessions.get(sessionId).size === 0) {
        activeSessions.delete(sessionId);
      }
    }
    
    console.log(`🔌 User ${socket.id} left session ${sessionId}`);
    console.log(`🔌 Active sessions:`, Array.from(activeSessions.entries()).map(([id, sockets]) => [id, sockets.size]));
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const sessionId = userSessions.get(socket.id);
    if (sessionId) {
      console.log(`🔌 Socket ${socket.id} disconnected from session: ${sessionId}`);
      if (activeSessions.has(sessionId)) {
        activeSessions.get(sessionId).delete(socket.id);
        if (activeSessions.get(sessionId).size === 0) {
          activeSessions.delete(sessionId);
        }
      }
      userSessions.delete(socket.id);
    }
    console.log('🔌 User disconnected:', socket.id);
    console.log(`🔌 Active sessions:`, Array.from(activeSessions.entries()).map(([id, sockets]) => [id, sockets.size]));
  });
  
  // Handle heartbeat ping
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

// Helper function to emit updates to all users in a session
const emitSessionUpdate = (sessionId, eventType, data, user = null, logEntry = null) => {
  console.log(`🚀 emitSessionUpdate called for session: ${sessionId}`)
  console.log(`🚀 Event type: ${eventType}`)
  console.log(`🚀 Data:`, data)
  console.log(`🚀 User:`, user ? `${user.firstName} ${user.lastName}` : 'Unknown User')
  console.log(`🚀 Log entry:`, logEntry)
  
  const updatePayload = {
    type: eventType,
    sessionId,
    data: {
      ...data,
      userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown User'
    },
    logEntry: logEntry,
    timestamp: new Date().toISOString()
  };
  
  console.log(`🚀 Final update payload:`, updatePayload)
  console.log(`🚀 Emitting ${eventType} update to session ${sessionId}`);
  
  // Check how many sockets are in the session room
  const sessionRoom = io.sockets.adapter.rooms.get(`session-${sessionId}`);
  const socketCount = sessionRoom ? sessionRoom.size : 0;
  console.log(`🚀 Number of sockets in session-${sessionId}: ${socketCount}`);
  
  io.to(`session-${sessionId}`).emit('session-update', updatePayload);
  console.log(`🚀 Emitted ${eventType} update to session ${sessionId}`);
};

// Helper function to normalize supply names (remove quantities in parentheses)
const normalizeSupplyName = (supplyName) => {
  if (!supplyName) return '';
  // Remove patterns like " (1)", " (2)", etc.
  return supplyName.replace(/\s*\(\d+\)$/, '');
};

// Helper function to pluralize supply names
const pluralize = (count, singular, plural) => {
  return count === 1 ? singular : plural;
};

// Helper function to get the correct plural form of a supply name
const getPluralForm = (supplyName) => {
  // Handle common irregular plurals
  const irregularPlurals = {
    'pencil': 'pencils',
    'pen': 'pens',
    'calculator': 'calculators',
    'protractor': 'protractors',
    'ruler': 'rulers',
    'notebook': 'notebooks',
    'textbook': 'textbooks',
    'paper': 'papers',
    'marker': 'markers',
    'eraser': 'erasers',
    'scissors': 'scissors',
    'tape': 'tape',
    'stapler': 'staplers',
    'folder': 'folders',
    'binder': 'binders'
  };
  
  // Check if we have an irregular plural
  if (irregularPlurals[supplyName.toLowerCase()]) {
    return irregularPlurals[supplyName.toLowerCase()];
  }
  
  // Handle regular plurals
  if (supplyName.toLowerCase().endsWith('s')) {
    // If it already ends with 's', just return as is
    return supplyName;
  }
  
  // Add 's' for regular plurals
  return supplyName + 's';
};

// Helper function to get supply summary for logging
const getSupplySummary = (supplies) => {
  if (!supplies || supplies.length === 0) return { summary: '', count: 0 };
  
  // Normalize all supply names and count them, preserving initial supply status
  const supplyCounts = {};
  
  supplies.forEach(supply => {
    if (supply.startsWith('INITIAL_')) {
      const cleanName = supply.replace('INITIAL_', '');
      const normalizedName = normalizeSupplyName(cleanName);
      const key = `${normalizedName} (initial)`;
      supplyCounts[key] = (supplyCounts[key] || 0) + 1;
    } else {
      const normalizedName = normalizeSupplyName(supply);
      supplyCounts[normalizedName] = (supplyCounts[normalizedName] || 0) + 1;
    }
  });
  
  // Create summary string
  const summaryParts = Object.entries(supplyCounts).map(([supply, count]) => {
    if (supply.includes('(initial)')) {
      const baseSupply = supply.replace(' (initial)', '');
      const pluralized = pluralize(count, baseSupply, getPluralForm(baseSupply));
      return `${count} ${pluralized} (initial)`;
    } else {
      const pluralized = pluralize(count, supply, getPluralForm(supply));
      return `${count} ${pluralized}`;
    }
  });
  
  return {
    summary: summaryParts.join(', '),
    count: supplies.length,
    individualCounts: supplyCounts
  };
};

// Helper function to add activity log entries to sessions
const addActivityLogEntry = async (sessionId, action, roomName = null, details = null, userName = null) => {
  try {
    console.log(`📝 addActivityLogEntry called for session: ${sessionId}`)
    console.log(`📝 Action: ${action}, Room: ${roomName}, Details: ${details}, User: ${userName}`)
    
    const session = await Session.findById(sessionId);
    if (!session) {
      console.log(`❌ Session ${sessionId} not found for activity log entry`);
      return null;
    }

    const logEntry = {
      action,
      timestamp: new Date(),
      userName: userName || 'Unknown User',
      roomName,
      details
    };

    // Add to beginning of array and keep only last 100 entries
    session.activityLog = [logEntry, ...(session.activityLog || [])].slice(0, 100);
    await session.save();

    console.log(`✅ Activity log entry added to session ${sessionId}:`, logEntry);
    return logEntry;
  } catch (error) {
    console.error(`❌ Error adding activity log entry to session ${sessionId}:`, error);
    return null;
  }
};

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

// User Schema
const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  verified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Section Schema
const sectionSchema = new mongoose.Schema({
  number: {
    type: Number,
    required: true,
    min: 1,
    max: 99
  },
  studentCount: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  accommodations: {
    type: [String],
    default: []
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Room Schema
const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  supplies: [{
    type: String,
    trim: true
  }],
  sections: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section'
  }],
  status: {
    type: String,
    enum: ['planned', 'active', 'completed'],
    default: 'active'
  },
  presentStudents: {
    type: Number,
    min: 0
  },
  notes: {
    type: String,
    trim: true
  },
  proctors: [{
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    startTime: {
      type: String,
      required: true
    },
    endTime: {
      type: String,
      required: true
    },
    email: {
      type: String,
      trim: true
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Session Invitation Schema
const sessionInvitationSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true
  },
  invitedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  permissions: {
    view: { type: Boolean, default: true },
    edit: { type: Boolean, default: false },
    manage: { type: Boolean, default: false }
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    }
  }
});

// Session Schema
const sessionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  collaborators: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    permissions: {
      view: { type: Boolean, default: true },
      edit: { type: Boolean, default: false },
      manage: { type: Boolean, default: false }
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  rooms: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room'
  }],
  sections: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section'
  }],
  status: {
    type: String,
    enum: ['planned', 'active', 'completed', 'cancelled'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  activityLog: [{
    action: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    userName: {
      type: String,
      required: true
    },
    roomName: {
      type: String
    },
    details: {
      type: String
    }
  }],
  invalidations: [{
    id: {
      type: String,
      required: true
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true
    },
    sectionNumber: {
      type: String,
      required: true
    },
    notes: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    invalidatedBy: {
      type: String,
      required: true
    }
  }]
});

// Update the updatedAt field before saving
roomSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

sectionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

sessionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Create models
const User = mongoose.model('User', userSchema);
const Room = mongoose.model('Room', roomSchema);
const Section = mongoose.model('Section', sectionSchema);
const Session = mongoose.model('Session', sessionSchema);
const SessionInvitation = mongoose.model('SessionInvitation', sessionInvitationSchema);

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

// Initialize demo data after connection
mongoose.connection.once('open', () => {
  initializeDemoData();
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Validation middleware
const validateRegistration = [
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
];

const validateLogin = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
];

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Permission checking middleware
const checkSessionPermission = (requiredPermission = 'view') => {
  return async (req, res, next) => {
    try {
      const sessionId = req.params.sessionId || req.params.id;
      if (!sessionId) {
        return res.status(400).json({ message: 'Session ID is required' });
      }

      const session = await Session.findById(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      // Session owner has all permissions
      if (session.createdBy.toString() === req.user.id) {
        req.sessionPermissions = { view: true, edit: true, manage: true };
        return next();
      }

      // Check if user is a collaborator
      const collaboration = session.collaborators.find(
        collab => collab.userId.toString() === req.user.id
      );

      if (!collaboration) {
        return res.status(403).json({ message: 'Access denied to this session' });
      }

      // Check if user has the required permission
      if (!collaboration.permissions[requiredPermission]) {
        return res.status(403).json({ 
          message: `Insufficient permissions. ${requiredPermission} access required.` 
        });
      }

      req.sessionPermissions = collaboration.permissions;
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'T-Testing API is running',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Register user
app.post('/api/register', validateRegistration, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { firstName, lastName, username, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const newUser = new User({
      firstName,
      lastName,
      username,
      password: hashedPassword
    });

    await newUser.save();

    // Return user data without password
    const userData = newUser.toObject();
    delete userData.password;
    
    res.status(201).json({
      message: 'User registered successfully',
      user: userData
    });

  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Login user
app.post('/api/login', validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { username, password } = req.body;

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        username: user.username
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Return user data without password
    const userData = user.toObject();
    delete userData.password;

    res.json({
      token,
      user: userData
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Verify token
app.get('/api/verify', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ 
      message: 'Token is valid', 
      user: user.toObject()
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Logout (client-side token removal)
app.post('/api/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Get all rooms
app.get('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const rooms = await Room.find()
      .populate('sections', 'number studentCount accommodations notes')
      .sort({ createdAt: -1 });
    res.json(rooms);
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update room status
app.put('/api/rooms/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const room = await Room.findByIdAndUpdate(
      id,
      { status, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Find the session that contains this room to emit real-time update
    const session = await Session.findOne({ rooms: id });
    console.log(`Room status update - Found session:`, session ? session._id : 'None');
    if (session) {
      console.log(`Room status update - Emitting real-time update for session: ${session._id}`);
      // Get user information for the real-time update
      const user = await User.findById(req.user.id);
      
      // Add activity log entry with room name
      const action = `${user.firstName} ${user.lastName} marked Room ${room.name} ${status === 'completed' ? 'complete' : 'incomplete'}`;
      const logEntry = await addActivityLogEntry(session._id, action, room.name, null, `${user.firstName} ${user.lastName}`);
      
      emitSessionUpdate(session._id, 'room-status-updated', { roomId: id, room, status }, user, logEntry);
    } else {
      console.log(`Room status update - No session found containing room: ${id}`);
    }

    res.json({ message: 'Room status updated', room });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new room
app.post('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const { name, supplies = [] } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Room name is required' });
    }

    const newRoom = new Room({
      name,
      supplies
    });

    await newRoom.save();
    
    const populatedRoom = await Room.findById(newRoom._id)
      .populate('sections', 'number studentCount');
    
    res.status(201).json({ message: 'Room created successfully', room: populatedRoom });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update room
app.put('/api/rooms/:id', authenticateToken, async (req, res) => {
  try {
      const { id } = req.params;
  const { name, supplies, status, presentStudents, notes, proctors } = req.body;
  const updateData = {};

  if (name !== undefined) updateData.name = name;
  if (supplies !== undefined) updateData.supplies = supplies;
  if (status !== undefined) updateData.status = status;
  if (presentStudents !== undefined) updateData.presentStudents = presentStudents;
  if (notes !== undefined) updateData.notes = notes;
  if (proctors !== undefined) updateData.proctors = proctors;

    // Get the old room data BEFORE updating to compare supplies
    const oldRoom = await Room.findById(id);
    if (!oldRoom) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const room = await Room.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('sections', 'number studentCount accommodations notes');

    // Find the session that contains this room to emit real-time update
    const session = await Session.findOne({ rooms: id });
    if (session) {
      console.log(`Room update - Emitting real-time update for session: ${session._id}`);
      // Get user information for the real-time update
      const user = await User.findById(req.user.id);
      
      // Add activity log entry for supply changes or room completion
      let logEntry = null;
      if (supplies !== undefined) {
        console.log(`🔍 Supply update detected for room ${id}`);
        console.log(`🔍 Old supplies:`, oldRoom.supplies);
        console.log(`🔍 New supplies:`, supplies);
        
        if (JSON.stringify(oldRoom.supplies) !== JSON.stringify(supplies)) {
          console.log(`🔍 Supplies changed, creating log entry`);
          // Compare old and new supplies to create a more descriptive log message
          const oldSupplies = oldRoom.supplies || [];
          const newSupplies = supplies || [];
          
          // Find added and removed supplies by comparing counts
          const oldSupplyCounts = {};
          const newSupplyCounts = {};
          
          // Count old supplies
          oldSupplies.forEach(supply => {
            const normalized = normalizeSupplyName(supply);
            oldSupplyCounts[normalized] = (oldSupplyCounts[normalized] || 0) + 1;
          });
          
          // Count new supplies
          newSupplies.forEach(supply => {
            const normalized = normalizeSupplyName(supply);
            newSupplyCounts[normalized] = (newSupplyCounts[normalized] || 0) + 1;
          });
          
          // Find supplies that were added or removed
          const allSupplyNames = new Set([...Object.keys(oldSupplyCounts), ...Object.keys(newSupplyCounts)]);
          
          const addedSupplies = [];
          const removedSupplies = [];
          
          allSupplyNames.forEach(supplyName => {
            const oldCount = oldSupplyCounts[supplyName] || 0;
            const newCount = newSupplyCounts[supplyName] || 0;
            
            if (newCount > oldCount) {
              // Supply was added (or quantity increased)
              const addedCount = newCount - oldCount;
              for (let i = 0; i < addedCount; i++) {
                addedSupplies.push(supplyName);
              }
            } else if (oldCount > newCount) {
              // Supply was removed (or quantity decreased)
              const removedCount = oldCount - newCount;
              for (let i = 0; i < removedCount; i++) {
                removedSupplies.push(supplyName);
              }
            }
          });
          
          console.log(`🔍 Added supplies:`, addedSupplies);
          console.log(`🔍 Removed supplies:`, removedSupplies);
          
          let action = '';
          let details = '';
          
          if (addedSupplies.length > 0 && removedSupplies.length > 0) {
            // Format: "{user name} added {summary} and removed {summary} in Room {room name}"
            const addedSummary = getSupplySummary(addedSupplies);
            const removedSummary = getSupplySummary(removedSupplies);
            action = `${user.firstName} ${user.lastName} added ${addedSummary.summary} and removed ${removedSummary.summary} in Room ${room.name}`;
            details = `Added: ${addedSummary.summary}. Removed: ${removedSummary.summary}`;
          } else if (addedSupplies.length > 0) {
            // Format: "{user name} added {summary} to Room {room name}"
            const addedSummary = getSupplySummary(addedSupplies);
            action = `${user.firstName} ${user.lastName} added ${addedSummary.summary} to Room ${room.name}`;
            details = `Added: ${addedSummary.summary}`;
          } else if (removedSupplies.length > 0) {
            // Format: "{user name} removed {summary} from Room {room name}"
            const removedSummary = getSupplySummary(removedSupplies);
            action = `${user.firstName} ${user.lastName} removed ${removedSummary.summary} from Room ${room.name}`;
            details = `Removed: ${removedSummary.summary}`;
          }
          
          console.log(`🔍 Action:`, action);
          console.log(`🔍 Details:`, details);
          
          if (action) {
            logEntry = await addActivityLogEntry(session._id, action, room.name, details, `${user.firstName} ${user.lastName}`);
            console.log(`🔍 Log entry created:`, logEntry);
          }
        } else {
          console.log(`🔍 No supply changes detected`);
        }
      } else if (status === 'completed' && presentStudents !== undefined) {
        // Room completion with present students
        const action = `${user.firstName} ${user.lastName} marked Room ${room.name} complete with ${presentStudents} students present`;
        const details = `Present students: ${presentStudents}`;
        logEntry = await addActivityLogEntry(session._id, action, room.name, details, `${user.firstName} ${user.lastName}`);
        console.log(`🔍 Room completion log entry created:`, logEntry);
      } else if (status === 'active' && presentStudents === undefined) {
        // Room marked incomplete - clear present students
        const previousPresentStudents = room.presentStudents;
        let action, details;
        
        if (previousPresentStudents !== undefined && previousPresentStudents > 0) {
          action = `${user.firstName} ${user.lastName} marked Room ${room.name} incomplete (${previousPresentStudents} students were present)`;
          details = `Room status changed from completed to active. Present students count cleared.`;
        } else {
          action = `${user.firstName} ${user.lastName} marked Room ${room.name} incomplete`;
          details = `Room status changed from completed to active. Present students count cleared.`;
        }
        
        logEntry = await addActivityLogEntry(session._id, action, room.name, details, `${user.firstName} ${user.lastName}`);
        console.log(`🔍 Room incomplete log entry created:`, logEntry);
      } else if (notes !== undefined) {
        console.log(`🔍 Notes update detected for room ${id}`);
        const oldNotes = oldRoom.notes || '';
        const newNotes = notes || '';
        
        if (oldNotes !== newNotes) {
          console.log(`🔍 Notes changed, creating log entry`);
          let action, details;
          
          if (oldNotes && newNotes) {
            action = `${user.firstName} ${user.lastName} updated notes for Room ${room.name}`;
            details = `Notes updated: "${newNotes}"`;
          } else if (newNotes && !oldNotes) {
            action = `${user.firstName} ${user.lastName} added notes to Room ${room.name}`;
            details = `Notes added: "${newNotes}"`;
          } else if (!newNotes && oldNotes) {
            action = `${user.firstName} ${user.lastName} removed notes from Room ${room.name}`;
            details = `Notes removed`;
          }
          
          logEntry = await addActivityLogEntry(session._id, action, room.name, details, `${user.firstName} ${user.lastName}`);
          console.log(`🔍 Room notes log entry created:`, logEntry);
        }
      } else if (proctors !== undefined) {
        console.log(`🔍 Proctors update detected for room ${id}`);
        const oldProctors = oldRoom.proctors || [];
        const newProctors = proctors || [];
        
        if (JSON.stringify(oldProctors) !== JSON.stringify(newProctors)) {
          console.log(`🔍 Proctors changed, creating log entry`);
          let action, details;
          
          const oldCount = oldProctors.length;
          const newCount = newProctors.length;
          
          if (newCount > oldCount) {
            action = `${user.firstName} ${user.lastName} added proctor(s) to Room ${room.name}`;
            details = `Proctors updated: ${newCount} proctor(s) assigned`;
          } else if (newCount < oldCount) {
            action = `${user.firstName} ${user.lastName} removed proctor(s) from Room ${room.name}`;
            details = `Proctors updated: ${newCount} proctor(s) assigned`;
          } else {
            action = `${user.firstName} ${user.lastName} updated proctor assignments for Room ${room.name}`;
            details = `Proctors updated: ${newCount} proctor(s) assigned`;
          }
          
          logEntry = await addActivityLogEntry(session._id, action, room.name, details, `${user.firstName} ${user.lastName}`);
          console.log(`🔍 Room proctors log entry created:`, logEntry);
        }
      } else {
        console.log(`🔍 No supplies in request body`);
      }
      
      emitSessionUpdate(session._id, 'room-updated', { roomId: id, room }, user, logEntry);
    } else {
      console.log(`Room update - No session found containing room: ${id}`);
    }

    res.json({ message: 'Room updated successfully', room });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete room
app.delete('/api/rooms/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const room = await Room.findByIdAndDelete(id);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get supplies
app.get('/api/supplies', authenticateToken, async (req, res) => {
  try {
    const rooms = await Room.find();
    const allSupplies = rooms
      .flatMap(room => room.supplies)
      .filter((supply, index, arr) => arr.indexOf(supply) === index);
    
    res.json({ supplies: allSupplies });
  } catch (error) {
    console.error('Get supplies error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Session Management Routes

// Get all sessions for the authenticated user (owned and collaborated)
app.get('/api/sessions', authenticateToken, async (req, res) => {
  try {
    const sessions = await Session.find({
      $or: [
        { createdBy: req.user.id },
        { 'collaborators.userId': req.user.id }
      ]
    })
      .populate([
        {
          path: 'rooms',
          select: 'name supplies status presentStudents notes proctors',
          populate: {
            path: 'sections',
            select: 'number studentCount accommodations notes'
          }
        },
        {
          path: 'sections',
          select: 'number studentCount accommodations notes'
        },
        {
          path: 'collaborators.userId',
          select: 'username firstName lastName'
        },
        {
          path: 'createdBy',
          select: 'username firstName lastName'
        }
      ])
      .sort({ createdAt: -1 });
    
    res.json({ sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new session
app.post('/api/sessions', authenticateToken, async (req, res) => {
  try {
    const { name, description, date, startTime, endTime } = req.body;

    if (!name || !date || !startTime || !endTime) {
      return res.status(400).json({ message: 'Name, date, start time, and end time are required' });
    }

    // Fix timezone issue by ensuring the date is treated as local date
    const [year, month, day] = date.split('-').map(Number);
    const localDate = new Date(year, month - 1, day); // month is 0-indexed
    
    const newSession = new Session({
      name,
      description,
      date: localDate,
      startTime,
      endTime,
      createdBy: req.user.id
    });

    await newSession.save();
    
    const populatedSession = await Session.findById(newSession._id)
      .populate({
        path: 'rooms',
        select: 'name supplies status presentStudents notes proctors',
        populate: {
          path: 'sections',
          select: 'number studentCount accommodations notes'
        }
      })
      .populate('sections', 'number studentCount accommodations notes');
    
    res.status(201).json({ 
      message: 'Session created successfully', 
      session: populatedSession 
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get specific session
app.get('/api/sessions/:id', authenticateToken, checkSessionPermission('view'), async (req, res) => {
  try {
    const session = await Session.findOne({ 
      _id: req.params.id,
      $or: [
        { createdBy: req.user.id },
        { 'collaborators.userId': req.user.id }
      ]
    }).populate([
      {
        path: 'rooms',
        select: 'name supplies status presentStudents notes proctors',
        populate: {
          path: 'sections',
          select: 'number studentCount accommodations notes'
        }
      },
      {
        path: 'sections',
        select: 'number studentCount accommodations notes'
      },
      {
        path: 'collaborators.userId',
        select: 'username firstName lastName'
      },
      {
        path: 'createdBy',
        select: 'username firstName lastName'
      }
    ]);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json({ session });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update session
app.put('/api/sessions/:id', authenticateToken, checkSessionPermission('edit'), async (req, res) => {
  try {
    const { name, description, date, startTime, endTime, status } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (date) {
      // Fix timezone issue by ensuring the date is treated as local date
      const [year, month, day] = date.split('-').map(Number);
      updateData.date = new Date(year, month - 1, day); // month is 0-indexed
    }
    if (startTime) updateData.startTime = startTime;
    if (endTime) updateData.endTime = endTime;
    if (status) updateData.status = status;

    const session = await Session.findOneAndUpdate(
      { 
        _id: req.params.id,
        $or: [
          { createdBy: req.user.id },
          { 'collaborators.userId': req.user.id }
        ]
      },
      updateData,
      { new: true, runValidators: true }
    ).populate([
      {
        path: 'rooms',
        select: 'name supplies status presentStudents notes proctors',
        populate: {
          path: 'sections',
          select: 'number studentCount accommodations notes'
        }
      },
      {
        path: 'sections',
        select: 'number studentCount accommodations notes'
      },
      {
        path: 'collaborators.userId',
        select: 'username firstName lastName'
      },
      {
        path: 'createdBy',
        select: 'username firstName lastName'
      }
    ]);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Add activity log entry for session update (only if not just a status change)
    const user = await User.findById(req.user.id);
    let logEntry = null;
    
    // Only create log entry if more than just status was updated
    const hasNonStatusChanges = name || description !== undefined || date || startTime || endTime;
    if (hasNonStatusChanges) {
      const action = `${user.firstName} ${user.lastName} updated session details`;
      logEntry = await addActivityLogEntry(req.params.id, action, null, 'Session information was modified', `${user.firstName} ${user.lastName}`);
    }

    // Emit real-time update to all users in the session
    emitSessionUpdate(req.params.id, 'session-updated', { session }, user, logEntry);

    res.json({ message: 'Session updated successfully', session });
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete session
app.delete('/api/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const session = await Session.findOneAndDelete({ 
      _id: req.params.id, 
      createdBy: req.user.id 
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Session Collaboration and Invitation Routes

// Get all users for invitation (excluding current user and existing session members)
app.get('/api/users/search', authenticateToken, async (req, res) => {
  try {
    const { q, sessionId } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }

    // Get the session to check existing collaborators and owner
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Build exclusion list: current user, session owner, and existing collaborators
    const excludedUserIds = [req.user.id, session.createdBy];
    if (session.collaborators && session.collaborators.length > 0) {
      session.collaborators.forEach(collab => {
        excludedUserIds.push(collab.userId);
      });
    }

    const searchQuery = q ? {
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } }
      ],
      _id: { $nin: excludedUserIds }
    } : { _id: { $nin: excludedUserIds } };

    const users = await User.find(searchQuery)
      .select('username firstName lastName')
      .limit(10);

    res.json({ users });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Send invitation to user
app.post('/api/sessions/:sessionId/invite', authenticateToken, checkSessionPermission('manage'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { invitedUserId, permissions } = req.body;

    if (!invitedUserId) {
      return res.status(400).json({ message: 'Invited user ID is required' });
    }

    // Check if user is already a collaborator
    const session = await Session.findById(sessionId);
    const existingCollaborator = session.collaborators.find(
      collab => collab.userId.toString() === invitedUserId
    );

    if (existingCollaborator) {
      return res.status(400).json({ message: 'User is already a collaborator on this session' });
    }

    // Check if invitation already exists
    const existingInvitation = await SessionInvitation.findOne({
      sessionId,
      invitedUserId,
      status: 'pending'
    });

    if (existingInvitation) {
      return res.status(400).json({ message: 'Invitation already sent to this user' });
    }

    // Create invitation
    const invitation = new SessionInvitation({
      sessionId,
      invitedUserId,
      invitedBy: req.user.id,
      permissions: permissions || { view: true, edit: false, manage: false }
    });

    await invitation.save();

    // Populate user details for response
    await invitation.populate('invitedUserId', 'username firstName lastName');

    res.status(201).json({ 
      message: 'Invitation sent successfully', 
      invitation 
    });
  } catch (error) {
    console.error('Send invitation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get pending invitations for the current user
app.get('/api/invitations/pending', authenticateToken, async (req, res) => {
  try {
    const invitations = await SessionInvitation.find({
      invitedUserId: req.user.id,
      status: 'pending'
    }).populate('sessionId').populate('invitedBy', 'username firstName lastName');
    
    console.log('Pending invitations with populated data:', JSON.stringify(invitations, null, 2));
    
    res.json({ invitations });
  } catch (error) {
    console.error('Error fetching pending invitations:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// Get invitations sent by the current user
app.get('/api/invitations/sent', authenticateToken, async (req, res) => {
  try {
    const invitations = await SessionInvitation.find({
      invitedBy: req.user.id
    }).populate('sessionId').populate('invitedUserId', 'username firstName lastName');
    
    console.log('Sent invitations with populated data:', JSON.stringify(invitations, null, 2));
    
    res.json({ invitations });
  } catch (error) {
    console.error('Error fetching sent invitations:', error);
    res.status(500).json({ error: 'Failed to fetch sent invitations' });
  }
});

// Accept invitation
app.put('/api/invitations/:invitationId/accept', authenticateToken, async (req, res) => {
  try {
    const { invitationId } = req.params;

    const invitation = await SessionInvitation.findOne({
      _id: invitationId,
      invitedUserId: req.user.id,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    });

    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found or expired' });
    }

    // Add user as collaborator
    await Session.findByIdAndUpdate(
      invitation.sessionId,
      {
        $push: {
          collaborators: {
            userId: req.user.id,
            permissions: invitation.permissions,
            addedAt: new Date()
          }
        }
      }
    );

    // Update invitation status
    invitation.status = 'accepted';
    await invitation.save();

    res.json({ message: 'Invitation accepted successfully' });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Decline invitation
app.put('/api/invitations/:invitationId/decline', authenticateToken, async (req, res) => {
  try {
    const { invitationId } = req.params;

    const invitation = await SessionInvitation.findOne({
      _id: invitationId,
      invitedUserId: req.user.id,
      status: 'pending'
    });

    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    invitation.status = 'declined';
    await invitation.save();

    res.json({ message: 'Invitation declined successfully' });
  } catch (error) {
    console.error('Decline invitation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Cancel/revoke an invitation (only the person who sent it can cancel it)
app.delete('/api/invitations/:invitationId', authenticateToken, async (req, res) => {
  try {
    const invitation = await SessionInvitation.findById(req.params.invitationId);
    
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }
    
    // Only the person who sent the invitation can cancel it
    if (invitation.invitedBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'You can only cancel invitations you sent' });
    }
    
    // Only pending invitations can be cancelled
    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending invitations can be cancelled' });
    }
    
    await SessionInvitation.findByIdAndDelete(req.params.invitationId);
    res.json({ message: 'Invitation cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling invitation:', error);
    res.status(500).json({ error: 'Failed to cancel invitation' });
  }
});

// Clear/delete an accepted or declined invitation (only the person who sent it can clear it)
app.delete('/api/invitations/:invitationId/clear', authenticateToken, async (req, res) => {
  try {
    const invitation = await SessionInvitation.findById(req.params.invitationId);
    
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }
    
    // Only the person who sent the invitation can clear it
    if (invitation.invitedBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'You can only clear invitations you sent' });
    }
    
    // Only accepted or declined invitations can be cleared
    if (invitation.status === 'pending') {
      return res.status(400).json({ error: 'Pending invitations cannot be cleared. Use cancel instead.' });
    }
    
    await SessionInvitation.findByIdAndDelete(req.params.invitationId);
    res.json({ message: 'Invitation cleared successfully' });
  } catch (error) {
    console.error('Error clearing invitation:', error);
    res.status(500).json({ error: 'Failed to clear invitation' });
  }
});

// Get session collaborators
app.get('/api/sessions/:sessionId/collaborators', authenticateToken, checkSessionPermission('view'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await Session.findById(sessionId)
      .populate('collaborators.userId', 'username firstName lastName')
      .populate('createdBy', 'username firstName lastName');

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json({ 
      owner: session.createdBy,
      collaborators: session.collaborators 
    });
  } catch (error) {
    console.error('Get collaborators error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update collaborator permissions
app.put('/api/sessions/:sessionId/collaborators/:userId', authenticateToken, checkSessionPermission('manage'), async (req, res) => {
  try {
    const { sessionId, userId } = req.params;
    const { permissions } = req.body;

    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ message: 'Valid permissions object is required' });
    }

    const session = await Session.findByIdAndUpdate(
      sessionId,
      {
        $set: {
          'collaborators.$[collab].permissions': permissions
        }
      },
      {
        arrayFilters: [{ 'collab.userId': userId }],
        new: true
      }
    ).populate('collaborators.userId', 'username firstName lastName');

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json({ 
      message: 'Collaborator permissions updated successfully',
      collaborators: session.collaborators
    });
  } catch (error) {
    console.error('Update collaborator permissions error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Remove collaborator
app.delete('/api/sessions/:sessionId/collaborators/:userId', authenticateToken, checkSessionPermission('manage'), async (req, res) => {
  try {
    const { sessionId, userId } = req.params;

    const session = await Session.findByIdAndUpdate(
      sessionId,
      {
        $pull: {
          collaborators: { userId }
        }
      },
      { new: true }
    ).populate('collaborators.userId', 'username firstName lastName');

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json({ 
      message: 'Collaborator removed successfully',
      collaborators: session.collaborators
    });
  } catch (error) {
    console.error('Remove collaborator error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Leave session (for invited users)
app.delete('/api/sessions/:sessionId/leave', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Check if session exists
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if user is a collaborator (not the owner)
    const isCollaborator = session.collaborators.some(collab => collab.userId.toString() === userId);
    if (!isCollaborator) {
      return res.status(403).json({ message: 'You can only leave sessions you were invited to' });
    }

    // Remove user from collaborators
    const updatedSession = await Session.findByIdAndUpdate(
      sessionId,
      {
        $pull: {
          collaborators: { userId }
        }
      },
      { new: true }
    ).populate('collaborators.userId', 'username firstName lastName');

    res.json({ 
      message: 'Successfully left the session',
      collaborators: updatedSession.collaborators
    });
  } catch (error) {
    console.error('Leave session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Room Management within Sessions

// Add room to session
app.post('/api/sessions/:sessionId/rooms', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { roomId } = req.body;

    if (!roomId) {
      return res.status(400).json({ message: 'Room ID is required' });
    }

    // Check if session exists and belongs to user
    const session = await Session.findOne({ 
      _id: sessionId, 
      createdBy: req.user.id 
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if room exists
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check if room is already in session
    if (session.rooms.includes(roomId)) {
      return res.status(400).json({ message: 'Room is already in this session' });
    }

    // Add room to session
    session.rooms.push(roomId);
    await session.save();

    // Return updated session with populated rooms
    const updatedSession = await Session.findById(sessionId)
      .populate({
        path: 'rooms',
        select: 'name supplies',
        populate: {
          path: 'sections',
          select: 'number studentCount accommodations notes'
        }
      })
      .populate('sections', 'number studentCount accommodations notes');

    // Add activity log entry for room addition
    const user = await User.findById(req.user.id);
    const action = `${user.firstName} ${user.lastName} added Room ${room.name} to the session`;
    const logEntry = await addActivityLogEntry(sessionId, action, room.name, null, `${user.firstName} ${user.lastName}`);

    // Emit real-time update to all users in the session
    emitSessionUpdate(sessionId, 'room-added', { room: room, session: updatedSession }, user, logEntry);

    res.json({ 
      message: 'Room added to session successfully', 
      session: updatedSession 
    });
  } catch (error) {
    console.error('Add room to session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Remove room from session
app.delete('/api/sessions/:sessionId/rooms/:roomId', authenticateToken, async (req, res) => {
  try {
    const { sessionId, roomId } = req.params;

    // Check if session exists and belongs to user
    const session = await Session.findOne({ 
      _id: sessionId, 
      createdBy: req.user.id 
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Remove room from session
    session.rooms = session.rooms.filter(room => room.toString() !== roomId);
    await session.save();

    // Return updated session with populated rooms
    const updatedSession = await Session.findById(sessionId)
      .populate({
        path: 'rooms',
        select: 'name supplies',
        populate: {
          path: 'sections',
          select: 'number studentCount accommodations notes'
        }
      })
      .populate('sections', 'number studentCount accommodations notes');

    // Add activity log entry for room removal
    const user = await User.findById(req.user.id);
    const room = await Room.findById(roomId);
    let logEntry = null;
    if (room) {
      const action = `${user.firstName} ${user.lastName} removed Room ${room.name} from the session`;
      logEntry = await addActivityLogEntry(sessionId, action, room.name, null, `${user.firstName} ${user.lastName}`);
    }

    // Emit real-time update to all users in the session
    emitSessionUpdate(sessionId, 'room-removed', { roomId, session: updatedSession }, user, logEntry);

    res.json({ 
      message: 'Room removed from session successfully', 
      session: updatedSession 
    });
  } catch (error) {
    console.error('Remove room to session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Section Management Routes

// Create new section
app.post('/api/sections', authenticateToken, async (req, res) => {
  try {
    const { number, studentCount = 1, accommodations = [], notes = '' } = req.body;

    if (!number || number < 1 || number > 99) {
      return res.status(400).json({ message: 'Section number must be between 1 and 99' });
    }

    if (!studentCount || studentCount < 1) {
      return res.status(400).json({ message: 'Student count must be at least 1' });
    }

    const newSection = new Section({
      number,
      studentCount,
      accommodations,
      notes
    });

    await newSection.save();
    res.status(201).json({ message: 'Section created successfully', section: newSection });
  } catch (error) {
    console.error('Create section error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update section
app.put('/api/sections/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { number, studentCount, accommodations, notes } = req.body;
    const updateData = {};

    if (number !== undefined) {
      if (number < 1 || number > 99) {
        return res.status(400).json({ message: 'Section number must be between 1 and 99' });
      }
      updateData.number = number;
    }
    if (studentCount !== undefined) {
      if (studentCount < 1) {
        return res.status(400).json({ message: 'Student count must be at least 1' });
      }
      updateData.studentCount = studentCount;
    }
    if (accommodations !== undefined) {
      updateData.accommodations = accommodations;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const section = await Section.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    // Find the session that contains this section to emit real-time update
    const session = await Session.findOne({ sections: id });
    if (session) {
      console.log(`Section update - Emitting real-time update for session: ${session._id}`);
      // Get user information for the real-time update
      const user = await User.findById(req.user.id);
      
      // Add activity log entry for section update
      const action = `${user.firstName} ${user.lastName} updated section ${section.number} to ${section.studentCount} students`;
      const logEntry = await addActivityLogEntry(session._id, action, null, null, `${user.firstName} ${user.lastName}`);
      
      emitSessionUpdate(session._id, 'section-updated', { sectionId: id, section }, user, logEntry);
    } else {
      console.log(`Section update - No session found containing section: ${id}`);
    }

    res.json({ message: 'Section updated successfully', section });
  } catch (error) {
    console.error('Update section error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add section to session
app.post('/api/sessions/:sessionId/sections', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { sectionId } = req.body;

    if (!sectionId) {
      return res.status(400).json({ message: 'Section ID is required' });
    }

    // Check if session exists and belongs to user
    const session = await Session.findOne({ 
      _id: sessionId, 
      createdBy: req.user.id 
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if section exists
    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    // Check if section is already in session
    if (session.sections.includes(sectionId)) {
      return res.status(400).json({ message: 'Section is already in this session' });
    }

    // Add section to session
    session.sections.push(sectionId);
    await session.save();

    // Return updated session with populated sections
    const updatedSession = await Session.findById(sessionId)
      .populate('sections', 'number studentCount accommodations notes');

    // Add activity log entry for section addition
    const user = await User.findById(req.user.id);
    const action = `${user.firstName} ${user.lastName} added section ${section.number} with ${section.studentCount} students to the session`;
    const logEntry = await addActivityLogEntry(sessionId, action, null, null, `${user.firstName} ${user.lastName}`);

    // Emit real-time update to all users in the session
    emitSessionUpdate(sessionId, 'section-added', { section, session: updatedSession }, user, logEntry);

    res.json({ 
      message: 'Section added to session successfully', 
      session: updatedSession 
    });
  } catch (error) {
    console.error('Add section to session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Remove section from session
app.delete('/api/sessions/:sessionId/sections/:sectionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId, sectionId } = req.params;

    // Check if session exists and belongs to user
    const session = await Session.findOne({ 
      _id: sessionId, 
      createdBy: req.user.id 
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Remove section from session
    session.sections = session.sections.filter(section => section.toString() !== sectionId);
    await session.save();

    // Return updated session with populated sections
    const updatedSession = await Session.findById(sessionId)
      .populate('sections', 'number studentCount accommodations notes');

    // Add activity log entry for section removal
    const user = await User.findById(req.user.id);
    const section = await Section.findById(sectionId);
    let logEntry = null;
    if (section) {
      const action = `${user.firstName} ${user.lastName} removed section ${section.number} with ${section.studentCount} students from the session`;
      logEntry = await addActivityLogEntry(sessionId, action, null, null, `${user.firstName} ${user.lastName}`);
    }

    // Emit real-time update to all users in the session
    emitSessionUpdate(sessionId, 'section-removed', { sectionId, session: updatedSession }, user, logEntry);

    res.json({ 
      message: 'Section removed from session successfully', 
      session: updatedSession 
    });
  } catch (error) {
    console.error('Remove section from session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Activity Log Management

// Get activity log for a session
app.get('/api/sessions/:sessionId/activity-log', authenticateToken, checkSessionPermission('view'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json({ activityLog: session.activityLog || [] });
  } catch (error) {
    console.error('Get activity log error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Clear activity log for a session (owner only)
app.delete('/api/sessions/:sessionId/activity-log', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if user is the session owner
    if (session.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the session owner can clear the activity log' });
    }

    // Clear the activity log
    session.activityLog = [];
    await session.save();

    // Emit real-time update to all users in the session
    const user = await User.findById(req.user.id);
    emitSessionUpdate(sessionId, 'activity-log-cleared', { message: 'Activity log cleared' }, user);

    res.json({ message: 'Activity log cleared successfully' });
  } catch (error) {
    console.error('Clear activity log error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Test Invalidation Management

// Get invalidated tests for a session
app.get('/api/sessions/:sessionId/invalidations', authenticateToken, checkSessionPermission('view'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json({ invalidations: session.invalidations || [] });
  } catch (error) {
    console.error('Get invalidations error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add test invalidation
app.post('/api/sessions/:sessionId/invalidations', authenticateToken, checkSessionPermission('edit'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { roomId, sectionNumber, notes } = req.body;
    
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const user = await User.findById(req.user.id);
    const room = await Room.findById(roomId);
    
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const invalidation = {
      id: `${roomId}_${sectionNumber}_${Date.now()}`,
      roomId,
      sectionNumber,
      notes,
      timestamp: new Date().toISOString(),
      invalidatedBy: `${user.firstName} ${user.lastName}`
    };

    // Add to session invalidations
    if (!session.invalidations) {
      session.invalidations = [];
    }
    session.invalidations.push(invalidation);
    await session.save();

    // Add to activity log
    const action = `${user.firstName} ${user.lastName} invalidated test for Section ${sectionNumber}`;
    const details = `Notes: ${notes}`;
    const logEntry = await addActivityLogEntry(sessionId, action, room.name, details, `${user.firstName} ${user.lastName}`);

    // Emit real-time update
    emitSessionUpdate(sessionId, 'invalidation-added', { invalidation, session }, user, logEntry);

    res.json({ invalidation });
  } catch (error) {
    console.error('Add invalidation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Remove test invalidation
app.delete('/api/sessions/:sessionId/invalidations/:invalidationId', authenticateToken, checkSessionPermission('edit'), async (req, res) => {
  try {
    const { sessionId, invalidationId } = req.params;
    
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const invalidationIndex = session.invalidations.findIndex(inv => inv.id === invalidationId);
    if (invalidationIndex === -1) {
      return res.status(404).json({ message: 'Invalidation not found' });
    }

    const invalidation = session.invalidations[invalidationIndex];
    session.invalidations.splice(invalidationIndex, 1);
    await session.save();

    const user = await User.findById(req.user.id);
    const room = await Room.findById(invalidation.roomId);

    // Add to activity log
    const action = `${user.firstName} ${user.lastName} removed test invalidation for Section ${invalidation.sectionNumber}`;
    const details = `Removed invalidation: ${invalidation.notes}`;
    const logEntry = await addActivityLogEntry(sessionId, action, room?.name || 'Unknown Room', details, `${user.firstName} ${user.lastName}`);

    // Emit real-time update
    emitSessionUpdate(sessionId, 'invalidation-removed', { invalidationId, session }, user, logEntry);

    res.json({ message: 'Invalidation removed successfully' });
  } catch (error) {
    console.error('Remove invalidation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Room Section Management

// Add section to room
app.post('/api/rooms/:roomId/sections', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { sectionId } = req.body;

    if (!sectionId) {
      return res.status(400).json({ message: 'Section ID is required' });
    }

    // Check if room exists
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check if section exists
    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    // Check if section is already in room
    if (room.sections.includes(sectionId)) {
      return res.status(400).json({ message: 'Section is already in this room' });
    }

    // Add section to room
    room.sections.push(sectionId);
    await room.save();

    // Return updated room with populated sections
    const updatedRoom = await Room.findById(roomId)
      .populate('sections', 'number studentCount accommodations notes');

    // Find the session that contains this room to emit real-time update
    const session = await Session.findOne({ rooms: roomId });
    if (session) {
      console.log(`Section added to room - Emitting real-time update for session: ${session._id}`);
      // Get user information for the real-time update
      const user = await User.findById(req.user.id);
      
             emitSessionUpdate(session._id, 'section-added-to-room', { roomId, sectionId, room: updatedRoom }, user, null);
    } else {
      console.log(`Section added to room - No session found containing room: ${roomId}`);
    }

    res.json({ 
      message: 'Section added to room successfully', 
      room: updatedRoom 
    });
  } catch (error) {
    console.error('Add section to room error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create room with sections
app.post('/api/rooms/with-sections', authenticateToken, async (req, res) => {
  try {
    const { name, supplies = [], sectionIds = [] } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Room name is required' });
    }

    // Create the room
    const newRoom = new Room({
      name: name.trim(),
      supplies
    });

    // Add sections if provided
    if (sectionIds.length > 0) {
      // Verify all sections exist
      const sections = await Section.find({ _id: { $in: sectionIds } });
      if (sections.length !== sectionIds.length) {
        return res.status(400).json({ message: 'One or more sections not found' });
      }
      newRoom.sections = sectionIds;
    }

    await newRoom.save();
    
    // Return populated room
    const populatedRoom = await Room.findById(newRoom._id)
      .populate('sections', 'number studentCount accommodations notes');
    
    res.status(201).json({ message: 'Room created successfully', room: populatedRoom });
  } catch (error) {
    console.error('Create room with sections error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete section completely (removes from all rooms and sessions)
app.delete('/api/sections/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if section exists
    const section = await Section.findById(id);
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    // Remove section from all rooms
    await Room.updateMany(
      { sections: id },
      { $pull: { sections: id } }
    );

    // Remove section from all sessions
    await Session.updateMany(
      { sections: id },
      { $pull: { sections: id } }
    );

    // Delete the section from the database
    await Section.findByIdAndDelete(id);

    res.json({ message: 'Section deleted successfully' });
  } catch (error) {
    console.error('Delete section error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Remove section from room
app.delete('/api/rooms/:roomId/sections/:sectionId', authenticateToken, async (req, res) => {
  try {
    const { roomId, sectionId } = req.params;

    // Check if room exists
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Remove section from room
    room.sections = room.sections.filter(section => section.toString() !== sectionId);
    await room.save();

    // Return updated room with populated sections
    const updatedRoom = await Room.findById(roomId)
      .populate('sections', 'number studentCount accommodations notes');

    // Find the session that contains this room to emit real-time update
    const session = await Session.findOne({ rooms: roomId });
    if (session) {
      console.log(`Section removed from room - Emitting real-time update for session: ${session._id}`);
      // Get user information for the real-time update
      const user = await User.findById(req.user.id);
      
             emitSessionUpdate(session._id, 'section-removed-from-room', { roomId, sectionId, room: updatedRoom }, user, null);
    } else {
      console.log(`Section removed from room - No session found containing room: ${roomId}`);
    }

    res.json({ 
      message: 'Section removed from room successfully', 
      room: updatedRoom 
    });
  } catch (error) {
    console.error('Remove section from room error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Move students between rooms
app.post('/api/sessions/:sessionId/move-students', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { sourceRoomId, destinationRoomId, sectionId, studentsToMove } = req.body;

    if (!sourceRoomId || !destinationRoomId || !sectionId || !studentsToMove) {
      return res.status(400).json({ message: 'All fields are required: sourceRoomId, destinationRoomId, sectionId, studentsToMove' });
    }

    // Check if session exists and user has permission
    const session = await Session.findOne({ 
      _id: sessionId,
      $or: [
        { createdBy: req.user.id },
        { 'collaborators.userId': req.user.id }
      ]
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if source and destination rooms exist and are in the session
    const sourceRoom = await Room.findById(sourceRoomId);
    const destinationRoom = await Room.findById(destinationRoomId);
    
    if (!sourceRoom || !destinationRoom) {
      return res.status(404).json({ message: 'Source or destination room not found' });
    }

    if (!session.rooms.includes(sourceRoomId) || !session.rooms.includes(destinationRoomId)) {
      return res.status(400).json({ message: 'Both rooms must be in the session' });
    }

    // Check if section exists in source room
    const sourceSection = sourceRoom.sections.find(s => s.toString() === sectionId);
    if (!sourceSection) {
      return res.status(400).json({ message: 'Section not found in source room' });
    }

    // Get user information for logging
    const user = await User.findById(req.user.id);

    // Get the section details
    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    // Check if destination room already has a section with the same number
    const destinationRoomSections = await Room.findById(destinationRoomId)
      .populate('sections', 'number studentCount accommodations notes');
    
    const existingSection = destinationRoomSections.sections.find(s => s.number === section.number);
    
    if (existingSection) {
      // Combine sections - add students to existing section
      const newStudentCount = existingSection.studentCount + studentsToMove;
      await Section.findByIdAndUpdate(existingSection._id, { 
        studentCount: newStudentCount 
      });
      
      // Remove the source section from source room
      await Room.findByIdAndUpdate(sourceRoomId, {
        $pull: { sections: sectionId }
      });
      
      // Delete the source section since we combined it
      await Section.findByIdAndDelete(sectionId);
      
      console.log(`Combined section ${section.number}: ${existingSection.studentCount} + ${studentsToMove} = ${newStudentCount} students`);
    } else {
      // No existing section with same number - move the entire section
      // Remove section from source room
      await Room.findByIdAndUpdate(sourceRoomId, {
        $pull: { sections: sectionId }
      });

      // Add section to destination room
      await Room.findByIdAndUpdate(destinationRoomId, {
        $push: { sections: sectionId }
      });
      
      console.log(`Moved entire section ${section.number} with ${studentsToMove} students`);
    }

    // Get updated rooms with populated sections
    const updatedSourceRoom = await Room.findById(sourceRoomId)
      .populate('sections', 'number studentCount accommodations notes');
    const updatedDestinationRoom = await Room.findById(destinationRoomId)
      .populate('sections', 'number studentCount accommodations notes');

    // Add comprehensive activity log entry for student movement
    let action;
    if (existingSection) {
      action = `${user.firstName} ${user.lastName} moved ${studentsToMove} students from Room ${sourceRoom.name} to Room ${destinationRoom.name} (combined with existing Section ${section.number})`;
    } else {
      action = `${user.firstName} ${user.lastName} moved ${studentsToMove} students from Room ${sourceRoom.name} to Room ${destinationRoom.name}`;
    }
    const logEntry = await addActivityLogEntry(sessionId, action, null, null, `${user.firstName} ${user.lastName}`);

    // Emit real-time update with the log entry and updated room data
    emitSessionUpdate(sessionId, 'students-moved', { 
      sourceRoomId, 
      destinationRoomId, 
      sectionId, 
      studentsToMove,
      sourceRoom: updatedSourceRoom,
      destinationRoom: updatedDestinationRoom
    }, user, logEntry);

    res.json({ 
      message: 'Students moved successfully',
      logEntry,
      sourceRoom: updatedSourceRoom,
      destinationRoom: updatedDestinationRoom
    });
  } catch (error) {
    console.error('Move students error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 T-Testing Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🗄️  MongoDB URI: ${MONGODB_URI}`);
  console.log(`🔌 WebSocket server ready for real-time updates`);
}); 