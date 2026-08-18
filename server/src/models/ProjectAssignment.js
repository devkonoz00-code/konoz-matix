const mongoose = require('mongoose');

const projectAssignmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project is required'],
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
    trim: true,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: Date,
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

// Indexes
projectAssignmentSchema.index({ userId: 1, projectId: 1 });
projectAssignmentSchema.index({ userId: 1, isActive: 1 });
projectAssignmentSchema.index({ projectId: 1, isActive: 1 });

module.exports = mongoose.model('ProjectAssignment', projectAssignmentSchema);
