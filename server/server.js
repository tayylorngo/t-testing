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
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/t-testing';

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

// Room Schema
const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['not-started', 'in-progress', 'completed'],
    default: 'not-started'
  },
  supplies: [{
    type: String,
    trim: true
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

// Update the updatedAt field before saving
roomSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Create models
const User = mongoose.model('User', userSchema);
const Room = mongoose.model('Room', roomSchema);

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
        { name: 'Room 101', status: 'in-progress', supplies: ['pencils', 'paper'] },
        { name: 'Room 102', status: 'completed', supplies: [] },
        { name: 'Room 103', status: 'not-started', supplies: ['calculators'] }
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
    const rooms = await Room.find().sort({ createdAt: -1 });
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
    const { name, status = 'not-started', supplies = [] } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Room name is required' });
    }

    const newRoom = new Room({
      name,
      status,
      supplies
    });

    await newRoom.save();
    res.status(201).json({ message: 'Room created successfully', room: newRoom });
  } catch (error) {
    console.error('Create room error:', error);
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