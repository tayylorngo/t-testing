import mongoose from 'mongoose';

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

// Update the updatedAt field before saving
sectionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Section', sectionSchema);
