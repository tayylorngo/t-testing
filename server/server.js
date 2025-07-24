import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

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
    default: 'planned'
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
    default: 'planned'
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
        { name: 'Room 103', status: 'planned', supplies: ['calculators'] }
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
    const { name, supplies } = req.body;
    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (supplies !== undefined) updateData.supplies = supplies;

    const room = await Room.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('sections', 'number studentCount accommodations notes');

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
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

// Get all sessions for the authenticated user
app.get('/api/sessions', authenticateToken, async (req, res) => {
  try {
    const sessions = await Session.find({ createdBy: req.user.id })
      .populate({
        path: 'rooms',
        select: 'name supplies status',
        populate: {
          path: 'sections',
          select: 'number studentCount accommodations notes'
        }
      })
      .populate('sections', 'number studentCount accommodations notes')
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

    const newSession = new Session({
      name,
      description,
      date: new Date(date),
      startTime,
      endTime,
      createdBy: req.user.id
    });

    await newSession.save();
    
    const populatedSession = await Session.findById(newSession._id)
      .populate({
        path: 'rooms',
        select: 'name supplies status',
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
app.get('/api/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const session = await Session.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id 
    }).populate({
      path: 'rooms',
      select: 'name supplies status',
      populate: {
        path: 'sections',
        select: 'number studentCount accommodations notes'
      }
    })
    .populate('sections', 'number studentCount accommodations notes');

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
app.put('/api/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, date, startTime, endTime, status } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (date) updateData.date = new Date(date);
    if (startTime) updateData.startTime = startTime;
    if (endTime) updateData.endTime = endTime;
    if (status) updateData.status = status;

    const session = await Session.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user.id },
      updateData,
      { new: true, runValidators: true }
    ).populate({
      path: 'rooms',
      select: 'name supplies status',
      populate: {
        path: 'sections',
        select: 'number studentCount accommodations notes'
      }
    })
    .populate('sections', 'number studentCount accommodations notes');

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

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

    res.json({ 
      message: 'Room removed from session successfully', 
      session: updatedSession 
    });
  } catch (error) {
    console.error('Remove room from session error:', error);
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

    res.json({ 
      message: 'Section removed from session successfully', 
      session: updatedSession 
    });
  } catch (error) {
    console.error('Remove section from session error:', error);
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

    res.json({ 
      message: 'Section removed from room successfully', 
      room: updatedRoom 
    });
  } catch (error) {
    console.error('Remove section from room error:', error);
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
app.listen(PORT, () => {
  console.log(`🚀 T-Testing Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🗄️  MongoDB URI: ${MONGODB_URI}`);
}); 