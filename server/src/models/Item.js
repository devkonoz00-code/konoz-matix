const mongoose = require('mongoose');

const ITEM_TYPES = ['MATERIAL', 'EQUIPMENT', 'TOOL', 'OTHER'];
const ITEM_UNITS = ['PIECE', 'KG', 'TON', 'METER', 'CM', 'SQM', 'CBM', 'LITER', 'BAG', 'BOX', 'ROLL'];

const itemSchema = new mongoose.Schema({
  itemCode: {
    type: String,
    required: [true, 'Item code is required'],
    unique: true,
    trim: true,
  },
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true,
  },
  description: String,
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required'],
  },
  brand: { type: String, trim: true },
  model: { type: String, trim: true },
  unit: {
    type: String,
    required: [true, 'Unit is required'],
    uppercase: true,
    enum: ITEM_UNITS,
    trim: true,
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price cannot be negative'],
  },
  minimumStock: {
    type: Number,
    min: 0,
    default: null,
  },
  imageUrl: String,
  itemType: {
    type: String,
    enum: ITEM_TYPES,
    required: [true, 'Item type is required'],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

itemSchema.index({ name: 'text', itemCode: 'text', brand: 'text' });
itemSchema.index({ categoryId: 1 });
itemSchema.index({ itemType: 1 });
itemSchema.index({ isActive: 1 });

module.exports = mongoose.model('Item', itemSchema);
module.exports.ITEM_TYPES = ITEM_TYPES;
module.exports.ITEM_UNITS = ITEM_UNITS;


