/**
 * Input validation helpers.
 * Validates request body fields and returns structured errors.
 */
const { AppError } = require('../middleware/errorHandler');
const mongoose = require('mongoose');

function validateRequired(body, fields) {
  const missing = fields.filter(f => !body[f] && body[f] !== 0 && body[f] !== false);
  if (missing.length > 0) {
    throw new AppError(`Missing required fields: ${missing.join(', ')}`, 400, 'VALIDATION_ERROR');
  }
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new AppError('Invalid email format', 400, 'VALIDATION_ERROR');
  }
}

function validateEnum(value, allowed, fieldName) {
  if (value && !allowed.includes(value)) {
    throw new AppError(`Invalid ${fieldName}: ${value}. Allowed: ${allowed.join(', ')}`, 400, 'VALIDATION_ERROR');
  }
}

function validateObjectId(id, fieldName) {
  if (id && !mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName}: ${id}`, 400, 'VALIDATION_ERROR');
  }
}

function validatePositiveNumber(value, fieldName) {
  if (value !== undefined && (typeof value !== 'number' || value < 0)) {
    throw new AppError(`${fieldName} must be a non-negative number`, 400, 'VALIDATION_ERROR');
  }
}

module.exports = {
  validateRequired,
  validateEmail,
  validateEnum,
  validateObjectId,
  validatePositiveNumber,
};
