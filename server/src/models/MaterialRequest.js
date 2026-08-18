const mongoose = require('mongoose');

const REQUEST_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'REJECTED', 'CANCELLED'];
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

const materialRequestSchema = new mongoose.Schema({
  requestNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project is required'],
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Requester is required'],
  },
  priority: {
    type: String,
    enum: PRIORITIES,
    default: 'NORMAL',
  },
  status: {
    type: String,
    enum: REQUEST_STATUSES,
    default: 'DRAFT',
  },
  note: String,
}, {
  timestamps: true,
});

materialRequestSchema.index({ projectId: 1 });
materialRequestSchema.index({ status: 1 });
materialRequestSchema.index({ requestedBy: 1 });

module.exports = mongoose.model('MaterialRequest', materialRequestSchema);
module.exports.REQUEST_STATUSES = REQUEST_STATUSES;
module.exports.PRIORITIES = PRIORITIES;
