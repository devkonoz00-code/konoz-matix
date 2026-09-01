const mongoose = require('mongoose');

const REQUEST_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'REJECTED', 'CANCELLED'];
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const REQUEST_TYPES = ['STANDARD', 'WORKSHOP_QUICK'];

const materialRequestSchema = new mongoose.Schema({
  requestNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  requestType: {
    type: String,
    enum: REQUEST_TYPES,
    default: 'STANDARD',
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
  textContent: String, // Worker freeform message (Messenger format)
  photoUrls: [{ type: String }], // Uploaded material photos
  cloudinaryPublicIds: [{ type: String }], // Cloudinary public IDs for auto-deletion
  seenBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    seenAt: {
      type: Date,
      default: Date.now,
    },
  }],
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  processedAt: Date,
  processingNote: String,
}, {
  timestamps: true,
});

materialRequestSchema.index({ projectId: 1 });
materialRequestSchema.index({ status: 1 });
materialRequestSchema.index({ requestedBy: 1 });
materialRequestSchema.index({ requestType: 1 });
materialRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('MaterialRequest', materialRequestSchema);
module.exports.REQUEST_STATUSES = REQUEST_STATUSES;
module.exports.PRIORITIES = PRIORITIES;
module.exports.REQUEST_TYPES = REQUEST_TYPES;
