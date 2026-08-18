/**
 * Secure Production Setup Script
 *
 * Provisions ONLY the single initial administrative user from environment variables
 * and initializes base sequence counters and reference warehouses.
 * Zero demo accounts, zero hardcoded passwords.
 */
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const User = require('./models/User');
const Warehouse = require('./models/Warehouse');
const Project = require('./models/Project');
const ProjectAssignment = require('./models/ProjectAssignment');
const Category = require('./models/Category');
const Item = require('./models/Item');
const Barcode = require('./models/Barcode');
const MaterialRequest = require('./models/MaterialRequest');
const MaterialRequestLine = require('./models/MaterialRequestLine');
const Movement = require('./models/Movement');
const MovementLine = require('./models/MovementLine');
const CompanyDocument = require('./models/CompanyDocument');
const AuditLog = require('./models/AuditLog');
const Notification = require('./models/Notification');
const Attachment = require('./models/Attachment');
const { Counter } = require('./utils/sequence');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/matix';

function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 10) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return hasUpper && hasLower && hasDigit && hasSpecial;
}

async function setupSystem(shouldDisconnect = true) {
  const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = (process.env.INITIAL_ADMIN_PASSWORD || '').trim();

  if (!adminEmail) {
    throw new Error('INITIAL_ADMIN_EMAIL is required in environment variables to run system setup.');
  }

  if (!adminPassword || !validatePasswordStrength(adminPassword)) {
    throw new Error(
      'INITIAL_ADMIN_PASSWORD is required and must be at least 10 characters long, containing uppercase, lowercase, numbers, and special characters.'
    );
  }

  if (mongoose.connection.readyState === 0) {
    console.log('[SETUP] Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('[SETUP] Connected to database.');
  }

  // Clear operational collections for pristine go-live
  await Promise.all([
    User.deleteMany({}),
    Warehouse.deleteMany({}),
    Project.deleteMany({}),
    ProjectAssignment.deleteMany({}),
    Category.deleteMany({}),
    Item.deleteMany({}),
    Barcode.deleteMany({}),
    MaterialRequest.deleteMany({}),
    MaterialRequestLine.deleteMany({}),
    Movement.deleteMany({}),
    MovementLine.deleteMany({}),
    CompanyDocument.deleteMany({}),
    AuditLog.deleteMany({}),
    Notification.deleteMany({}),
    Attachment.deleteMany({}),
    Counter.deleteMany({}),
  ]);

  console.log('[SETUP] Initializing single administrator account...');
  const admin = new User({
    fullName: 'System Administrator',
    email: adminEmail,
    passwordHash: adminPassword,
    role: 'ADMIN',
    isActive: true,
  });
  await admin.save();
  console.log(`[SETUP] Admin account created for: ${adminEmail}`);

  console.log('[SETUP] Initializing base warehouses...');
  await Warehouse.create([
    {
      name: 'المحل',
      code: 'WH-SHOP-01',
      location: 'Central Shop Stores',
      isActive: true,
    },
    {
      name: 'المخزن',
      code: 'WH-MAIN-02',
      location: 'Main Warehouse Depot',
      isActive: true,
    },
  ]);

  console.log('[SETUP] Initializing sequence counters...');
  await Counter.create([
    { _id: 'item', seq: 100 },
    { _id: 'barcode', seq: 100 },
    { _id: 'request', seq: 0 },
    { _id: 'movement', seq: 0 },
  ]);

  console.log('====================================================');
  console.log('✨ MATIX SYSTEM SETUP COMPLETED SUCCESSFULLY');
  console.log('====================================================');
  console.log(`Administrator provisioned: ${adminEmail}`);
  console.log('All operational collections are clean and ready for production.');
  console.log('====================================================');

  if (shouldDisconnect) {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  setupSystem(true).catch((err) => {
    console.error('[SETUP ERROR]:', err.message);
    process.exit(1);
  });
}

module.exports = { setupSystem };
