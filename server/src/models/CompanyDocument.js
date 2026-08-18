const mongoose = require('mongoose');

const companyDocumentSchema = new mongoose.Schema({
  documentNumber: {
    type: String,
    required: [true, 'Document number is required'],
    trim: true,
  },
  documentType: {
    type: String,
    required: [true, 'Document type is required'],
    trim: true,
  },
  documentDate: {
    type: Date,
    required: [true, 'Document date is required'],
  },
  externalReference: String,
  sourceSystem: String,
  note: String,
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

companyDocumentSchema.index({ documentNumber: 1 });

module.exports = mongoose.model('CompanyDocument', companyDocumentSchema);
