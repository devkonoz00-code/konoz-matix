const mongoose = require('mongoose');

const PROJECT_STATUSES = ['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'];

const projectSchema = new mongoose.Schema({
  projectCode: {
    type: String,
    required: [true, 'Project code is required'],
    unique: true,
    trim: true,
  },
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
  },
  location: {
    type: String,
    trim: true,
  },
  description: String,
  status: {
    type: String,
    enum: PROJECT_STATUSES,
    default: 'ACTIVE',
  },
  startDate: Date,
  expectedEndDate: Date,
}, {
  timestamps: true,
});

module.exports = mongoose.model('Project', projectSchema);
module.exports.PROJECT_STATUSES = PROJECT_STATUSES;
