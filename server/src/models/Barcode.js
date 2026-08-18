const mongoose = require('mongoose');

const BARCODE_TYPES = ['CODE-128', 'EAN-13', 'EAN-8', 'UPC', 'QR'];

const barcodeSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: [true, 'Item is required'],
  },
  code: {
    type: String,
    required: [true, 'Barcode code is required'],
    trim: true,
  },
  type: {
    type: String,
    enum: BARCODE_TYPES,
    default: 'CODE-128',
    required: [true, 'Barcode type is required'],
  },
  isPrimary: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

barcodeSchema.index({ itemId: 1 });
barcodeSchema.index({ code: 1 }, { unique: true });

module.exports = mongoose.model('Barcode', barcodeSchema);
module.exports.BARCODE_TYPES = BARCODE_TYPES;

