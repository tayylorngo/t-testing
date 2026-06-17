import mongoose from 'mongoose';

// Section Schema
const sectionSchema = new mongoose.Schema({
  number: {
    // Section numbers are 1-99 with an optional single trailing letter (e.g. "99A").
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    match: [/^([1-9]|[1-9][0-9])[A-Za-z]?$/, 'Section number must be 1-99 with an optional single letter (e.g. 99A)']
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
