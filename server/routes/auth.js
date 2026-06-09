import express from 'express';
import Session from '../models/Session.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiters.js';

const router = express.Router();

const validateRegistration = [
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters'),
  body('email').trim().isEmail().withMessage('Please enter a valid email address'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
];
const validateLogin = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
];
// In-memory store for password reset codes: email -> { code, expiresAt }
const passwordResetCodes = new Map();
const RESET_CODE_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

function generateResetCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendResetCodeEmail(email, code) {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Elmira – Your password reset code',
      text: `Your password reset code is: ${code}\n\nThis code expires in 15 minutes. If you didn't request this, you can ignore this email.`,
      html: `<p>Your password reset code is: <strong>${code}</strong></p><p>This code expires in 15 minutes. If you didn't request this, you can ignore this email.</p>`
    });
  } else {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Forgot password] No SMTP configured. Reset code for', email, ':', code);
    } else {
      console.log('[Forgot password] No SMTP configured. Reset code generated for', email);
    }
  }
}
const validateProfileUpdate = [
  body('firstName').optional().trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').optional().trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('username').optional().trim().isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters'),
  body('email').optional().trim().isEmail().withMessage('Please enter a valid email address'),
  body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('confirmPassword').optional().custom((value, { req }) => {
    if (req.body.password && value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  })
];

router.post('/api/register', authLimiter, validateRegistration, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { firstName, lastName, username, email, password } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email: normalizedEmail }] });
    if (existingUser) {
      if (existingUser.username === username) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const newUser = new User({
      firstName,
      lastName,
      username,
      email: normalizedEmail,
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
      return res.status(400).json({ message: 'Username or email already exists' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.post('/api/login', authLimiter, validateLogin, async (req, res) => {
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
      process.env.JWT_SECRET,
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
router.get('/api/verify', authenticateToken, async (req, res) => {
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
router.post('/api/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});
router.post('/api/forgot-password', authLimiter, [
  body('email').trim().isEmail().withMessage('Please enter a valid email address')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    const email = req.body.email.trim().toLowerCase();
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({ message: 'If an account exists with this email, you will receive a reset code shortly.' });
    }
    const code = generateResetCode();
    passwordResetCodes.set(email, {
      code,
      expiresAt: Date.now() + RESET_CODE_EXPIRY_MS
    });
    await sendResetCodeEmail(user.email, code);
    res.status(200).json({ message: 'If an account exists with this email, you will receive a reset code shortly.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Unable to send reset code. Please try again later.' });
  }
});
router.post('/api/reset-password', [
  body('email').trim().isEmail().withMessage('Please enter a valid email address'),
  body('code').trim().notEmpty().withMessage('Reset code is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    const { email, code, newPassword } = req.body;
    const normalizedEmail = email.trim().toLowerCase();
    const stored = passwordResetCodes.get(normalizedEmail);
    if (!stored || stored.code !== code.trim()) {
      return res.status(400).json({ message: 'Invalid or expired reset code.' });
    }
    if (Date.now() > stored.expiresAt) {
      passwordResetCodes.delete(normalizedEmail);
      return res.status(400).json({ message: 'Invalid or expired reset code.' });
    }
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      passwordResetCodes.delete(normalizedEmail);
      return res.status(400).json({ message: 'Invalid or expired reset code.' });
    }
    const saltRounds = 10;
    user.password = await bcrypt.hash(newPassword, saltRounds);
    await user.save();
    passwordResetCodes.delete(normalizedEmail);
    res.status(200).json({ message: 'Password has been reset. You can sign in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Unable to reset password. Please try again.' });
  }
});
router.put('/api/profile', authenticateToken, validateProfileUpdate, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { firstName, lastName, username, email, password } = req.body;
    const updateData = {};

    if (firstName !== undefined) updateData.firstName = firstName.trim();
    if (lastName !== undefined) updateData.lastName = lastName.trim();
    if (username !== undefined) updateData.username = username.trim();
    if (email !== undefined) updateData.email = email.trim().toLowerCase();

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check for duplicate username (if changing)
    if (username && username.trim() !== currentUser.username) {
      const existingUsername = await User.findOne({ username: username.trim() });
      if (existingUsername) {
        return res.status(400).json({ message: 'Username already taken' });
      }
    }

    // Check for duplicate email (if changing)
    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== (currentUser.email || '')) {
        const existingEmail = await User.findOne({ email: normalizedEmail });
        if (existingEmail) {
          return res.status(400).json({ message: 'Email already registered' });
        }
      }
    }

    if (password) {
      const currentPassword = req.body.currentPassword;
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to set a new password' });
      }
      const isMatch = await bcrypt.compare(currentPassword, currentUser.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      const saltRounds = 10;
      updateData.password = await bcrypt.hash(password, saltRounds);
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({ message: 'Profile updated successfully', user: updatedUser.toObject() });
  } catch (error) {
    console.error('Profile update error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.get('/api/users/search', authenticateToken, async (req, res) => {
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

export default router;
