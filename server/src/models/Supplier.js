const mongoose = require('mongoose');

const SUPPLIER_CATEGORIES = [
  'BUILDING_MATERIALS', // محلات مواد البناء
  'SAND_TRUCKS',        // شاحنات الرمل والحصى
  'WATER_TRUCKS',       // شاحنات الماء
  'MASONS',             // البناؤون والبنائين
  'ELECTRICIANS',       // كهربائيون
  'PLUMBERS',           // سباكون
  'PAINTERS',           // دهّانون
  'ALUMINUM_GLASS',     // ألومنيوم وزجاج
  'BLACKSMITHS',        // حدّادون
  'HEAVY_EQUIPMENT',    // مقاولو آليات ثقيلة
  'OTHER',              // أخرى
];

const supplierSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'اسم المورد أو المهني مطلوب'],
    trim: true,
  },
  phone: {
    type: String,
    required: [true, 'رقم الهاتف الأساسي مطلوب'],
    trim: true,
  },
  phone2: {
    type: String,
    trim: true,
  },
  category: {
    type: String,
    required: [true, 'الفئة مطلوبة'],
    enum: SUPPLIER_CATEGORIES,
    default: 'BUILDING_MATERIALS',
  },
  company: {
    type: String,
    trim: true,
  },
  location: {
    type: String,
    trim: true,
  },
  note: {
    type: String,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Text indexing for fast search
supplierSchema.index({ fullName: 'text', company: 'text', location: 'text', note: 'text' });
supplierSchema.index({ category: 1, isActive: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);
module.exports.SUPPLIER_CATEGORIES = SUPPLIER_CATEGORIES;
