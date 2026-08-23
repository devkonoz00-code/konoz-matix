const mongoose = require('mongoose');

const movementLineSchema = new mongoose.Schema({
  movementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movement',
    required: [true, 'Movement is required'],
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: [true, 'Item is required'],
  },
  barcodeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Barcode',
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0.001, 'Quantity must be positive'],
  },
  unitCostSnapshot: {
    type: Number,
    required: [true, 'Unit cost snapshot is required'],
    min: 0,
  },
  totalCost: {
    type: Number,
    required: [true, 'Total cost is required'],
    min: 0,
  },
  note: String,
});

movementLineSchema.index({ movementId: 1 });
movementLineSchema.index({ itemId: 1 });
movementLineSchema.index({ movementId: 1, itemId: 1 });

module.exports = mongoose.model('MovementLine', movementLineSchema);
