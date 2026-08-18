const mongoose = require('mongoose');

const materialRequestLineSchema = new mongoose.Schema({
  requestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MaterialRequest',
    required: [true, 'Request is required'],
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: [true, 'Item is required'],
  },
  requestedQuantity: {
    type: Number,
    required: [true, 'Requested quantity is required'],
    min: [0.001, 'Quantity must be positive'],
  },
  approvedQuantity: {
    type: Number,
    min: 0,
  },
  fulfilledQuantity: {
    type: Number,
    min: 0,
    default: 0,
  },
  unitCostSnapshot: Number,
  note: String,
});

materialRequestLineSchema.index({ requestId: 1 });
materialRequestLineSchema.index({ itemId: 1 });

module.exports = mongoose.model('MaterialRequestLine', materialRequestLineSchema);
