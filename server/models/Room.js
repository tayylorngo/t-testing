import mongoose from 'mongoose';

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
  sectionAttendance: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Per-section count of exams returned, keyed by section id: { sectionId: returnedCount }
  sectionReturns: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  notes: {
    type: String,
    trim: true
  },
  // A reminder shown when returning tests for a section in this room.
  reminder: {
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

// Update the updatedAt field before saving
roomSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Room', roomSchema);
