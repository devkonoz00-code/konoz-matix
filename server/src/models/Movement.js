const mongoose = require('mongoose');

const MOVEMENT_TYPES = ['RECEIPT', 'ISSUE', 'TRANSFER', 'RETURN', 'ADJUSTMENT'];
const MOVEMENT_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED'];
const LOCATION_KINDS = ['WAREHOUSE', 'PROJECT'];

const locationSchema = new mongoose.Schema({
  kind: {
    type: String,
    enum: LOCATION_KINDS,
    required: true,
  },
  id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
}, { _id: false });

const movementSchema = new mongoose.Schema({
  movementNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  type: {
    type: String,
    enum: MOVEMENT_TYPES,
    required: [true, 'Movement type is required'],
  },
  fromLocation: {
    type: locationSchema,
    default: null,
  },
  toLocation: {
    type: locationSchema,
    default: null,
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
  },
  requestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MaterialRequest',
  },
  companyDocumentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompanyDocument',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required'],
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  status: {
    type: String,
    enum: MOVEMENT_STATUSES,
    default: 'PENDING',
  },
  note: String,
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

movementSchema.index({ createdAt: -1 });
movementSchema.index({ type: 1 });
movementSchema.index({ status: 1 });
movementSchema.index({ 'fromLocation.kind': 1, 'fromLocation.id': 1 });
movementSchema.index({ 'toLocation.kind': 1, 'toLocation.id': 1 });
movementSchema.index({ projectId: 1 });
movementSchema.index({ requestId: 1 });

module.exports = mongoose.model('Movement', movementSchema);
module.exports.MOVEMENT_TYPES = MOVEMENT_TYPES;
module.exports.MOVEMENT_STATUSES = MOVEMENT_STATUSES;
module.exports.LOCATION_KINDS = LOCATION_KINDS;
