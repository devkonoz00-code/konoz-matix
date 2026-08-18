const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  entityType: {
    type: String,
    enum: ['REQUEST', 'MOVEMENT', 'ITEM', 'PROJECT'],
    required: true,
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  cloudinaryPublicId: String,
  url: {
    type: String,
    required: true,
  },
  fileType: String,
  fileName: String,
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

attachmentSchema.index({ entityType: 1, entityId: 1 });

module.exports = mongoose.model('Attachment', attachmentSchema);
