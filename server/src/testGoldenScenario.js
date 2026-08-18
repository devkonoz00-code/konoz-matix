/**
 * Golden Scenario Acceptance Test Suite (§18)
 * Executes the complete 10-step end-to-end acceptance test against MATIX.
 *
 * SECURITY: All credentials sourced from environment variables.
 * No hardcoded passwords or emails.
 */
const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const { setupSystem } = require('./setup');
const User = require('./models/User');
const Warehouse = require('./models/Warehouse');
const Project = require('./models/Project');
const Item = require('./models/Item');
const Barcode = require('./models/Barcode');
const Movement = require('./models/Movement');
const MovementLine = require('./models/MovementLine');
const AuditLog = require('./models/AuditLog');
const MaterialRequest = require('./models/MaterialRequest');

const itemService = require('./services/itemService');
const projectService = require('./services/projectService');
const projectAssignmentService = require('./services/projectAssignmentService');
const movementService = require('./services/movementService');
const requestService = require('./services/requestService');
const stockService = require('./services/stockService');
const userService = require('./services/userService');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/matix';

/**
 * Generate a cryptographically random password that satisfies complexity requirements.
 */
function generateSecurePassword() {
  const randomBytes = crypto.randomBytes(16).toString('hex');
  return `Test_${randomBytes}_1!`;
}

/**
 * Generate a unique test email using a random suffix.
 */
function generateTestEmail(prefix) {
  const suffix = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${suffix}@test.local`;
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function runGoldenScenario() {
  console.log('====================================================');
  console.log('🚀 RUNNING MATIX GOLDEN SCENARIO ACCEPTANCE SUITE (§18)');
  console.log('====================================================\n');

  // Validate required environment variables
  const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = (process.env.INITIAL_ADMIN_PASSWORD || '').trim();

  if (!adminEmail) {
    console.error('❌ FATAL: INITIAL_ADMIN_EMAIL environment variable is required to run tests.');
    console.error('   Set it in your .env file or export it before running this test.');
    process.exit(1);
  }

  if (!adminPassword) {
    console.error('❌ FATAL: INITIAL_ADMIN_PASSWORD environment variable is required to run tests.');
    console.error('   Set it in your .env file or export it before running this test.');
    process.exit(1);
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI);
  }
  console.log('Connected to MongoDB.\n');

  // STEP 0: Clean reference setup (1 initial admin, 2 warehouses)
  console.log('--- Step 0: Initialize Production Reference Data (§16) ---');
  await setupSystem(false);

  const userCount = await User.countDocuments();
  const whCount = await Warehouse.countDocuments();
  const itemCount = await Item.countDocuments();
  const prjCount = await Project.countDocuments();
  const movCount = await Movement.countDocuments();

  assert(userCount === 1, `Expected 1 reference admin user, got ${userCount}`);
  assert(whCount === 2, `Expected 2 reference warehouses, got ${whCount}`);
  assert(itemCount === 0, `Expected 0 items (clean state), got ${itemCount}`);
  assert(prjCount === 0, `Expected 0 projects (clean state), got ${prjCount}`);
  assert(movCount === 0, `Expected 0 movements (clean state), got ${movCount}`);

  const adminUser = await User.findOne({ email: adminEmail });
  assert(adminUser, `Initial administrator exists: ${adminEmail}`);

  const adminReq = { user: adminUser, ip: '127.0.0.1', headers: { 'user-agent': 'TestRunner' } };

  // Admin securely provisions team members with dynamically generated credentials
  const supervisorEmail = generateTestEmail('supervisor');
  const supervisorPassword = generateSecurePassword();
  const supervisorUser = await userService.create({
    fullName: 'Omar Cherkaoui',
    email: supervisorEmail,
    role: 'SUPERVISOR',
    password: supervisorPassword,
  }, adminReq);

  const wmEmail = generateTestEmail('wm');
  const wmPassword = generateSecurePassword();
  const wmUser = await userService.create({
    fullName: 'Tariq El-Amrani',
    email: wmEmail,
    role: 'WAREHOUSE_MANAGER',
    password: wmPassword,
  }, adminReq);

  const whMakhzan = await Warehouse.findOne({ name: 'المخزن' });
  const whMahal = await Warehouse.findOne({ name: 'المحل' });

  assert(adminUser && supervisorUser && wmUser, 'Provisioned team members (ADMIN, SUPERVISOR, WAREHOUSE_MANAGER)');
  assert(whMakhzan && whMahal, 'Initialized 2 real warehouses (المخزن and المحل)');

  const supervisorReq = { user: supervisorUser, ip: '127.0.0.1', headers: { 'user-agent': 'TestRunner' } };
  const wmReq = { user: wmUser, ip: '127.0.0.1', headers: { 'user-agent': 'TestRunner' } };

  // Category
  const Category = require('./models/Category');
  let category = await Category.findOne({ name: 'Matériaux de Construction' });
  if (!category) {
    category = await Category.create({ name: 'Matériaux de Construction' });
  }

  // STEP 1: Create Item with photo, no barcode, and starting quantity 50 at المخزن
  console.log('\n--- Step 1: Create Item with starting quantity 50 at المخزن (§18.1) ---');
  const item1 = await itemService.create({
    name: 'Ciment Portland 50kg',
    categoryId: category._id,
    itemType: 'MATERIAL',
    unit: 'BAG',
    unitPrice: 950.00, // 950 DZD
    minimumStock: 20,
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    initialQuantity: 50,
    warehouseId: whMakhzan._id,
  }, adminReq);

  assert(item1.unitPrice === 950.00, 'Item 1 unitPrice = 950.00 DZD');
  assert(item1.barcodes && item1.barcodes.length > 0, 'Internal barcode auto-generated and linked');
  const item1StockAtMakhzan = await stockService.getStockAtLocation(item1._id, 'WAREHOUSE', whMakhzan._id);
  assert(item1StockAtMakhzan === 50, `Item 1 derived stock at المخزن immediately shows 50 (got ${item1StockAtMakhzan})`);

  // STEP 2: Print item label & batch print verification
  console.log('\n--- Step 2: Verify Single & Batch Label Printing Data (§18.2) ---');
  const item2 = await itemService.create({
    name: 'Barre d\'Acier Haute Adhérence 12mm',
    categoryId: category._id,
    itemType: 'MATERIAL',
    unit: 'PIECE',
    unitPrice: 1800.00, // 1800 DZD
    barcode: 'STL-61112345678',
    barcodeType: 'CODE-128',
    initialQuantity: 40,
    warehouseId: whMakhzan._id,
  }, adminReq);

  const labels = await itemService.getLabels([item1._id, item2._id]);
  assert(labels.length === 2, 'Batch label data generated for both items');
  assert(labels[0].barcode && labels[0].name && labels[0].itemCode, 'Item 1 label carries barcode, name, and itemCode');
  assert(labels[1].barcode === 'STL-61112345678', 'Item 2 label carries registered barcode STL-61112345678');

  // STEP 3: Create Project & Point-of-contact assignment
  console.log('\n--- Step 3: Create Project PRJ-01 & assign POC (§18.3) ---');
  const prj1 = await projectService.create({
    projectCode: 'PRJ-01',
    name: 'Résidence El-Bahdja',
    location: 'Alger Centre',
    status: 'ACTIVE',
  }, adminReq);

  const pocAssignment = await projectAssignmentService.create({
    userId: supervisorUser._id,
    projectId: prj1._id,
    role: 'Site Point of Contact',
  }, adminReq);
  assert(pocAssignment.isActive === true, 'POC assignment recorded');

  // STEP 4: Supervisor looks up item and uses "Issue to a project" direct issue (starts PENDING)
  console.log('\n--- Step 4: Direct Issue 20 units of Item 1 by Supervisor to PRJ-01 (§18.4) ---');
  const directIssue = await movementService.create({
    type: 'ISSUE',
    fromLocation: { kind: 'WAREHOUSE', id: whMakhzan._id.toString() },
    toLocation: { kind: 'PROJECT', id: prj1._id.toString() },
    projectId: prj1._id.toString(),
    note: 'Fast-path scanner direct issue for foundation pouring',
    lines: [{ itemId: item1._id, quantity: 20 }],
  }, supervisorReq);

  assert(directIssue.movement.status === 'PENDING', 'Direct issue movement created in PENDING state');
  // Confirm direct issue
  const confirmedDirectIssue = await movementService.confirmMovement(directIssue.movement._id, supervisorReq);
  assert(confirmedDirectIssue.movement.status === 'CONFIRMED', 'Direct issue confirmed by project receiver');

  // STEP 5: Traditional path in parallel: Material Request for Item 2
  console.log('\n--- Step 5: Material Request lifecycle for Item 2 (§18.5) ---');
  const req1 = await requestService.create({
    projectId: prj1._id,
    priority: 'HIGH',
    note: 'Steel reinforcement bars needed for columns',
    lines: [{ itemId: item2._id, requestedQuantity: 15 }],
  }, supervisorReq);
  assert(req1.request.status === 'DRAFT', 'Request created in DRAFT');

  await requestService.updateStatus(req1.request._id, 'SUBMITTED', {}, supervisorReq);
  await requestService.updateStatus(req1.request._id, 'APPROVED', { approvedLines: [{ lineId: req1.lines[0]._id, approvedQuantity: 15 }] }, wmReq);

  const reqIssue = await movementService.create({
    type: 'ISSUE',
    fromLocation: { kind: 'WAREHOUSE', id: whMakhzan._id.toString() },
    toLocation: { kind: 'PROJECT', id: prj1._id.toString() },
    projectId: prj1._id.toString(),
    requestId: req1.request._id,
    lines: [{ itemId: item2._id, quantity: 15 }],
  }, wmReq);
  assert(reqIssue.movement.status === 'PENDING', 'Issue against request sits PENDING');

  await movementService.confirmMovement(reqIssue.movement._id, supervisorReq);
  const prj1MaterialsAfterStep5 = await projectService.getMaterials(prj1._id);
  assert(prj1MaterialsAfterStep5.length === 2, 'PRJ-01 materials view shows both items');

  // STEP 6: Verify Current Value, Total Consumption and Décharge
  console.log('\n--- Step 6: Verify Current Value, Total Consumption & Décharge (§18.6) ---');
  // Item 1: 20 * 950 = 19,000 DZD
  // Item 2: 15 * 1800 = 27,000 DZD
  // Total = 46,000 DZD
  const prj1CurrentVal = await stockService.getProjectCurrentValue(prj1._id);
  const prj1TotalCons = await stockService.getProjectTotalConsumption(prj1._id);
  assert(prj1CurrentVal === 46000, `PRJ-01 Current Value = 46,000 DZD (got ${prj1CurrentVal})`);
  assert(prj1TotalCons === 46000, `PRJ-01 Total Consumption = 46,000 DZD (got ${prj1TotalCons})`);

  const decharge = await projectService.getDecharge(prj1._id);
  assert(decharge.grandTotal === 46000, `Décharge grand total matches Total Consumption = 46,000 DZD (got ${decharge.grandTotal})`);
  assert(decharge.lines.length === 2, 'Décharge itemizes both delivered materials');

  // STEP 7: Over-issue stock validation
  console.log('\n--- Step 7: Attempt Over-Issue / Stock Availability Rejection (§18.7) ---');
  let overIssueCaught = false;
  try {
    await movementService.create({
      type: 'ISSUE',
      fromLocation: { kind: 'WAREHOUSE', id: whMakhzan._id.toString() },
      toLocation: { kind: 'PROJECT', id: prj1._id.toString() },
      projectId: prj1._id.toString(),
      lines: [{ itemId: item1._id, quantity: 100 }], // only 30 left (50-20)
    }, supervisorReq);
  } catch (err) {
    overIssueCaught = true;
    assert(err.statusCode === 400, 'Over-issue returned 400 Bad Request');
    assert(err.message.includes('30') || err.message.includes('Insufficient'), `Error names available amount: "${err.message}"`);
  }
  assert(overIssueCaught, 'Over-issue was strictly blocked atomically');

  // STEP 8: "Add Stock" shortcut on Item 1 by WAREHOUSE_MANAGER into المحل
  console.log('\n--- Step 8: Add Stock (RECEIPT) into المحل (§18.8) ---');
  const addStockReceipt = await movementService.create({
    type: 'RECEIPT',
    toLocation: { kind: 'WAREHOUSE', id: whMahal._id.toString() },
    note: 'Restocking 40 bags of cement into Shop warehouse',
    lines: [{ itemId: item1._id, quantity: 40 }],
  }, wmReq);
  assert(addStockReceipt.movement.status === 'CONFIRMED', 'Add Stock creates confirmed RECEIPT');
  const item1StockMahal = await stockService.getStockAtLocation(item1._id, 'WAREHOUSE', whMahal._id);
  assert(item1StockMahal === 40, `Item 1 stock at المحل is 40 (got ${item1StockMahal})`);

  // STEP 9: Transfer to second project (PRJ-02), confirm, then Return to warehouse (المخزن), confirm
  console.log('\n--- Step 9: Transfer to PRJ-02 & Return to المخزن (§18.9) ---');
  const prj2 = await projectService.create({
    projectCode: 'PRJ-02',
    name: 'Chantier Oran Port',
    location: 'Oran',
    status: 'ACTIVE',
  }, adminReq);

  const transfer = await movementService.create({
    type: 'TRANSFER',
    fromLocation: { kind: 'PROJECT', id: prj1._id.toString() },
    toLocation: { kind: 'PROJECT', id: prj2._id.toString() },
    lines: [{ itemId: item1._id, quantity: 5 }],
  }, supervisorReq);
  assert(transfer.movement.status === 'PENDING', 'Transfer sits PENDING');
  await movementService.confirmMovement(transfer.movement._id, supervisorReq);

  // PRJ-01 stock for Item 1 is now 15 (20 - 5). Total Consumption remains 46,000 DZD!
  const prj1CurPostTrf = await stockService.getProjectCurrentValue(prj1._id);
  const prj1TotPostTrf = await stockService.getProjectTotalConsumption(prj1._id);
  assert(prj1CurPostTrf === (15 * 950 + 15 * 1800), `PRJ-01 Current Value decremented to ${prj1CurPostTrf} DZD`);
  assert(prj1TotPostTrf === 46000, `PRJ-01 Total Consumption stays preserved at 46,000 DZD`);

  // Return from PRJ-02 to warehouse (المخزن)
  const returnMov = await movementService.create({
    type: 'RETURN',
    fromLocation: { kind: 'PROJECT', id: prj2._id.toString() },
    toLocation: { kind: 'WAREHOUSE', id: whMakhzan._id.toString() },
    lines: [{ itemId: item1._id, quantity: 5 }],
  }, supervisorReq);
  assert(returnMov.movement.status === 'PENDING', 'Return sits PENDING');
  await movementService.confirmMovement(returnMov.movement._id, wmReq);

  // STEP 10: Complete Chronological Trace & Reconciliation in DZD
  console.log('\n--- Step 10: Movement History Trace & Accounting Reconciliation (§18.10) ---');
  const item1History = await stockService.getItemHistory(item1._id);
  assert(item1History.length === 5, `Item 1 has 5 movements in full history (got ${item1History.length})`);

  const auditLogs = await AuditLog.find();
  assert(auditLogs.length >= 8, `Audit logs captured for all business actions (count: ${auditLogs.length})`);

  console.log('\n====================================================');
  console.log('🎉 GOLDEN SCENARIO ACCEPTANCE TEST PASSED 100% (DZD throughout)');
  console.log('====================================================\n');

  await mongoose.disconnect();
}

if (require.main === module) {
  runGoldenScenario().catch(err => {
    console.error('\n❌ GOLDEN SCENARIO FAILED:', err);
    process.exit(1);
  });
}

module.exports = { runGoldenScenario };
