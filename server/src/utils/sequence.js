/**
 * Generates sequential numbers for various entities.
 * Uses a MongoDB counter collection for atomicity.
 */
const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);

/**
 * Get next sequential number for a given entity type.
 * @param {string} entityType - e.g., 'item', 'movement', 'request'
 * @param {string} prefix - e.g., 'ITM', 'MOV', 'REQ'
 * @param {number} padding - number of digits (default 6)
 */
async function getNextSequence(entityType, prefix, padding = 6) {
  const counter = await Counter.findByIdAndUpdate(
    entityType,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${prefix}-${String(counter.seq).padStart(padding, '0')}`;
}

module.exports = { getNextSequence, Counter };
