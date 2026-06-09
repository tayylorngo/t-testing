import mongoose from 'mongoose';

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
  accommodationStartTime: {
    type: String,
    default: null
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
  archived: {
    type: Boolean,
    default: false
  },
  archivedAt: {
    type: Date
  },
  archivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
sessionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Session', sessionSchema);
