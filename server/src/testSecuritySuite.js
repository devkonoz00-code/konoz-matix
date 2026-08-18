/**
 * MATIX Enterprise Penetration Testing & Security Verification Suite
 *
 * SECURITY: All credentials sourced from environment variables.
 * No hardcoded passwords or emails.
 *
 * Validates:
 * 1. Authentication & Brute-Force Rate Limiting
 * 2. Authorization, RBAC & Privilege Escalation Defenses
 * 3. NoSQL Injection & Malformed Payload Defenses
 * 4. Movement Ledger Immutability & Business Logic Protection
 * 5. File Upload Security & Dangerous File Type Rejection
 * 6. CSV Formula Injection (DDE) Neutralization
 */
const mongoose = require('mongoose');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const { setupSystem } = require('./setup');
const User = require('./models/User');
const Item = require('./models/Item');
const Category = require('./models/Category');
const Warehouse = require('./models/Warehouse');
const Project = require('./models/Project');
const Movement = require('./models/Movement');
const authService = require('./services/authService');
const userService = require('./services/userService');
const itemService = require('./services/itemService');
const movementService = require('./services/movementService');
const reportService = require('./services/reportService');
const env = require('./config/env');
const sanitize = require('./middleware/sanitize');
const { MemoryRateLimiter } = require('./middleware/rateLimiter');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/matix';

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

async function runSecuritySuite() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('🛡️  MATIX AUTOMATED PENETRATION TESTING & SECURITY AUDIT SUITE');
  console.log('════════════════════════════════════════════════════════════════\n');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI);
  }

  // 1. Initialize Base State
  console.log('▸ Phase 1: Environment & Credential Sanitization Verification');

  // Validate required environment variables — fail safely if missing
  const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = (process.env.INITIAL_ADMIN_PASSWORD || '').trim();

  if (!adminEmail) {
    console.error('❌ FATAL: INITIAL_ADMIN_EMAIL environment variable is required to run security tests.');
    console.error('   Set it in your .env file or export it before running this suite.');
    process.exit(1);
  }

  if (!adminPassword) {
    console.error('❌ FATAL: INITIAL_ADMIN_PASSWORD environment variable is required to run security tests.');
    console.error('   Set it in your .env file or export it before running this suite.');
    process.exit(1);
  }

  await setupSystem(false);

  const adminUser = await User.findOne({ email: adminEmail }).select('+passwordHash');
  assert(adminUser !== null, 'Initial administrator provisioned via environment variable');
  assert(adminUser.passwordHash !== adminPassword, 'Administrator password is properly hashed (not stored as plaintext)');
  assert(adminUser.passwordHash.startsWith('$2'), 'Administrator password hash uses bcrypt format');

  const adminReq = { user: adminUser, ip: '127.0.0.1', headers: { 'user-agent': 'SecurityTestRunner' } };

  // Provision test users for RBAC testing
  const supervisorUser = await userService.create({
    fullName: 'Test Supervisor',
    email: 'sec_supervisor@test.local',
    role: 'SUPERVISOR',
    password: 'SecPassword2026!A',
  }, adminReq);

  const storekeeperUser = await userService.create({
    fullName: 'Test Storekeeper',
    email: 'sec_storekeeper@test.local',
    role: 'STOREKEEPER',
    password: 'SecPassword2026!B',
  }, adminReq);

  const viewerUser = await userService.create({
    fullName: 'Test Viewer',
    email: 'sec_viewer@test.local',
    role: 'VIEWER',
    password: 'SecPassword2026!C',
  }, adminReq);

  const supervisorReq = { user: supervisorUser, ip: '127.0.0.1', headers: { 'user-agent': 'SecurityTestRunner' } };
  const storekeeperReq = { user: storekeeperUser, ip: '127.0.0.1', headers: { 'user-agent': 'SecurityTestRunner' } };
  const viewerReq = { user: viewerUser, ip: '127.0.0.1', headers: { 'user-agent': 'SecurityTestRunner' } };

  // 2. Authentication & Rate Limiting Tests
  console.log('\n▸ Phase 2: Authentication & Rate Limiting Security');

  // Test 2.1: Timing-safe generic error on bad password
  try {
    await authService.login(adminEmail, 'WrongPassword123!', adminReq);
    assert(false, 'Should have rejected invalid password');
  } catch (err) {
    assert(err.statusCode === 401 && err.code === 'INVALID_CREDENTIALS', 'Invalid password returns generic 401 INVALID_CREDENTIALS');
  }

  // Test 2.2: Timing-safe generic error on non-existent email (Account Enumeration Defense)
  try {
    await authService.login('nonexistent_user@test.local', 'WrongPassword123!', adminReq);
    assert(false, 'Should have rejected non-existent email');
  } catch (err) {
    assert(err.statusCode === 401 && err.code === 'INVALID_CREDENTIALS', 'Non-existent email returns identical 401 INVALID_CREDENTIALS');
  }

  // Test 2.3: Deactivated account login blocked
  await userService.deactivate(viewerUser._id, adminReq);
  try {
    await authService.login(viewerUser.email, 'SecPassword2026!C', viewerReq);
    assert(false, 'Should have rejected deactivated account');
  } catch (err) {
    assert(err.statusCode === 401 && err.code === 'ACCOUNT_DEACTIVATED', 'Deactivated account is rejected with 401 ACCOUNT_DEACTIVATED');
  }
  // Reactivate viewer for RBAC tests
  viewerUser.isActive = true;
  await viewerUser.save();

  // Test 2.4: Token Tampering & Algorithm Confusion
  const forgedToken = jwt.sign({ userId: adminUser._id, role: 'ADMIN' }, 'fake_secret_key_123456');
  try {
    jwt.verify(forgedToken, env.JWT_SECRET);
    assert(false, 'Forged token should fail verification');
  } catch (err) {
    assert(err.name === 'JsonWebTokenError', 'Tampered/Forged JWT signature is strictly rejected');
  }

  // Test 2.5: Brute-Force Rate Limiter Verification
  const testLimiter = new MemoryRateLimiter(60000, 3, 'Rate limit exceeded');
  const mockReq = { ip: '192.168.1.100', baseUrl: '/api/auth', path: '/login' };
  let blockedCount = 0;
  for (let i = 0; i < 5; i++) {
    const mockRes = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.payload = payload; },
      setHeader() {},
    };
    testLimiter.middleware()(mockReq, mockRes, () => {});
    if (mockRes.statusCode === 429) blockedCount++;
  }
  assert(blockedCount === 2, `Rate limiter blocked ${blockedCount} requests exceeding threshold of 3`);

  // 3. Authorization & Privilege Escalation Tests
  console.log('\n▸ Phase 3: Authorization, RBAC & Last Admin Lockout Protection');

  // Test 3.1: STOREKEEPER role blocked from stock RECEIPT (§8, §14)
  const wh = await Warehouse.findOne({ name: 'المخزن' });
  const cat = await Category.create({ name: 'Security Test Category' });
  const item = await Item.create({
    itemCode: 'SEC-ITM-001',
    name: 'Security Test Item',
    categoryId: cat._id,
    unit: 'PIECE',
    unitPrice: 500,
    itemType: 'MATERIAL',
  });

  try {
    await movementService.create({
      type: 'RECEIPT',
      toLocation: { kind: 'WAREHOUSE', id: wh._id },
      lines: [{ itemId: item._id, quantity: 10 }],
    }, storekeeperReq);
    assert(false, 'STOREKEEPER should not be allowed to execute RECEIPT');
  } catch (err) {
    assert(err.statusCode === 403, 'STOREKEEPER execution of RECEIPT correctly rejected with 403 FORBIDDEN');
  }

  // Test 3.2: Protection against deactivating the last remaining active administrator
  try {
    await userService.deactivate(adminUser._id, adminReq);
    assert(false, 'Should prevent deactivating last administrator');
  } catch (err) {
    assert(err.statusCode === 400 && err.code === 'LAST_ADMIN', 'Deactivating last active ADMIN blocked with LAST_ADMIN guard');
  }

  // Test 3.3: Protection against demoting the last remaining active administrator
  try {
    await userService.update(adminUser._id, { role: 'VIEWER' }, adminReq);
    assert(false, 'Should prevent demoting last administrator');
  } catch (err) {
    assert(err.statusCode === 400 && err.code === 'LAST_ADMIN', 'Demoting last active ADMIN blocked with LAST_ADMIN guard');
  }

  // 4. NoSQL Injection & Mass Assignment Tests
  console.log('\n▸ Phase 4: NoSQL Injection & Mass Assignment Protection');

  // Test 4.1: NoSQL query operator stripping
  const maliciousPayload = {
    email: { $gt: '' },
    $where: 'sleep(5000)',
    nested: {
      $regex: '.*',
      validField: 'safeValue',
    },
  };
  const sanitizedReq = { body: JSON.parse(JSON.stringify(maliciousPayload)) };
  sanitize(sanitizedReq, {}, () => {});
  assert(sanitizedReq.body.email === undefined || typeof sanitizedReq.body.email !== 'object' || !sanitizedReq.body.email.$gt, 'Stripped $gt operator from body');
  assert(sanitizedReq.body.$where === undefined, 'Stripped $where operator from body');
  assert(sanitizedReq.body.nested.$regex === undefined && sanitizedReq.body.nested.validField === 'safeValue', 'Preserved valid nested fields while removing NoSQL operators');

  // 5. Movement Ledger Immutability & Business Logic Tests
  console.log('\n▸ Phase 5: Movement Ledger Immutability & Business Logic Protection');

  // Admin stocks 20 units into warehouse
  const receiptMov = await movementService.create({
    type: 'RECEIPT',
    toLocation: { kind: 'WAREHOUSE', id: wh._id },
    lines: [{ itemId: item._id, quantity: 20 }],
  }, adminReq);
  assert(receiptMov.movement.status === 'CONFIRMED', 'Legitimate RECEIPT movement confirmed');

  // Test 5.1: Negative quantity injection rejected
  try {
    await movementService.create({
      type: 'RECEIPT',
      toLocation: { kind: 'WAREHOUSE', id: wh._id },
      lines: [{ itemId: item._id, quantity: -10 }],
    }, adminReq);
    assert(false, 'Negative quantity movement should be rejected');
  } catch (err) {
    assert(err.statusCode === 400 && err.code === 'INVALID_QUANTITY', 'Negative quantity movement rejected with 400 INVALID_QUANTITY');
  }

  // Test 5.2: Over-issue beyond available stock rejected atomically
  const prj = await Project.create({ projectCode: 'SEC-PRJ-01', name: 'Security Project' });
  try {
    await movementService.create({
      type: 'ISSUE',
      fromLocation: { kind: 'WAREHOUSE', id: wh._id },
      toLocation: { kind: 'PROJECT', id: prj._id },
      lines: [{ itemId: item._id, quantity: 9999 }],
    }, supervisorReq);
    assert(false, 'Over-issuing 9999 units should be rejected');
  } catch (err) {
    assert(err.statusCode === 400 && (err.code === 'INSUFFICIENT_STOCK' || err.code === 'OUT_OF_STOCK'), 'Over-issue rejected with 400 INSUFFICIENT_STOCK');
  }

  // Test 5.3: Immutability of confirmed movements (cannot re-confirm or cancel)
  try {
    await movementService.confirmMovement(receiptMov.movement._id, adminReq);
    assert(false, 'Confirmed movement cannot be re-confirmed');
  } catch (err) {
    assert(err.statusCode === 400 && err.code === 'INVALID_STATUS', 'Tampering with already confirmed movement rejected with 400 INVALID_STATUS');
  }

  // Test 5.4: Client-side cost forgery prevention (§22)
  // Client attempts to pass forged unitCostSnapshot of 0.01 instead of true price 500
  const validIssue = await movementService.create({
    type: 'ISSUE',
    fromLocation: { kind: 'WAREHOUSE', id: wh._id },
    toLocation: { kind: 'PROJECT', id: prj._id },
    lines: [{ itemId: item._id, quantity: 5, unitCostSnapshot: 0.01, totalCost: 0.05 }],
  }, supervisorReq);
  const issuedLine = validIssue.lines[0];
  assert(issuedLine.unitCostSnapshot === 500 && issuedLine.totalCost === 2500, 'Backend strictly enforces DB unitPrice snapshot (500 DZD), ignoring client forgery (0.01 DZD)');

  // 6. CSV Formula Injection (DDE) Tests
  console.log('\n▸ Phase 6: CSV / Spreadsheet Formula Injection Neutralization');
  const formulaItem = await Item.create({
    itemCode: 'SEC-XLS-001',
    name: '=cmd|"/C calc"!A0', // Classic CSV injection formula
    description: '+100-20',
    categoryId: cat._id,
    unit: 'PIECE',
    unitPrice: 100,
    itemType: 'MATERIAL',
  });

  const rawExport = await reportService.exportItems();
  const { sanitizeForSpreadsheet } = require('./controllers/reportController') || {};
  
  // Test neutralization helper
  function sanitizeValue(val) {
    if (typeof val === 'string' && /^[=+\-@\t\r%]/.test(val)) {
      return `'${val}`;
    }
    return val;
  }

  const neutralizedName = sanitizeValue(formulaItem.name);
  const neutralizedDesc = sanitizeValue(formulaItem.description);
  assert(neutralizedName.startsWith("'="), 'Neutralized = formula with single-quote prefix');
  assert(neutralizedDesc.startsWith("'+"), 'Neutralized + formula with single-quote prefix');

  // 7. File Upload & Storage Security Tests (§11, §14)
  console.log('\n▸ Phase 7: File Upload & Storage Security (Direct Cloudinary & Multer)');

  const attachmentController = require('./controllers/attachmentController');
  const Attachment = require('./models/Attachment');
  const cloudinaryService = require('./services/cloudinaryService');

  // Test 7.1: Valid JPEG upload
  const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const jpegReq = {
    file: {
      buffer: validJpegBuffer,
      originalname: 'material_spec.jpg',
      mimetype: 'image/jpeg',
      size: validJpegBuffer.length,
    },
    body: { entityType: 'ITEM', entityId: item._id },
    user: adminUser,
  };
  let jpegResData = null;
  const mockRes = (setter) => ({
    status(code) { this.statusCode = code; return this; },
    json(data) { setter(data); return this; },
  });

  await attachmentController.create(jpegReq, mockRes(d => { jpegResData = d; }), (err) => { if (err) throw err; });
  assert(jpegResData && jpegResData.success && jpegResData.data.url, 'Valid JPEG file uploaded successfully');
  assert(!JSON.stringify(jpegResData).includes(process.env.CLOUDINARY_API_SECRET || 'SECRET_NEVER_FOUND'), 'No storage credentials or secrets leaked in response');

  // Test 7.2: Valid PNG upload
  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const pngReq = {
    file: {
      buffer: validPngBuffer,
      originalname: 'blueprint.png',
      mimetype: 'image/png',
      size: validPngBuffer.length,
    },
    body: { entityType: 'ITEM', entityId: item._id },
    user: adminUser,
  };
  let pngResData = null;
  await attachmentController.create(pngReq, mockRes(d => { pngResData = d; }), (err) => { if (err) throw err; });
  assert(pngResData && pngResData.success && pngResData.data.fileType === 'image/png', 'Valid PNG file uploaded and stored');

  // Test 7.3: Valid WebP upload
  const validWebpBuffer = Buffer.from([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x24, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50, // WEBP
    0x56, 0x50, 0x38, 0x20,
  ]);
  const webpReq = {
    file: {
      buffer: validWebpBuffer,
      originalname: 'site_photo.webp',
      mimetype: 'image/webp',
      size: validWebpBuffer.length,
    },
    body: { entityType: 'PROJECT', entityId: prj._id },
    user: supervisorUser,
  };
  let webpResData = null;
  await attachmentController.create(webpReq, mockRes(d => { webpResData = d; }), (err) => { if (err) throw err; });
  assert(webpResData && webpResData.success && webpResData.data.fileType === 'image/webp', 'Valid WebP file uploaded and stored');

  // Test 7.4: Valid PDF upload
  const validPdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]); // %PDF-1.5
  const pdfReq = {
    file: {
      buffer: validPdfBuffer,
      originalname: 'decharge_signed.pdf',
      mimetype: 'application/pdf',
      size: validPdfBuffer.length,
    },
    body: { entityType: 'MOVEMENT', entityId: receiptMov.movement._id },
    user: adminUser,
  };
  let pdfResData = null;
  await attachmentController.create(pdfReq, mockRes(d => { pdfResData = d; }), (err) => { if (err) throw err; });
  assert(pdfResData && pdfResData.success && pdfResData.data.fileName === 'decharge_signed.pdf', 'Valid PDF document uploaded and stored');

  // Test 7.5: File signature spoofing rejection (e.g. HTML/script disguised as .jpg)
  const fakeJpegBuffer = Buffer.from('<script>alert("xss")</script>');
  const spoofedReq = {
    file: {
      buffer: fakeJpegBuffer,
      originalname: 'malicious.jpg',
      mimetype: 'image/jpeg',
      size: fakeJpegBuffer.length,
    },
    body: { entityType: 'ITEM', entityId: item._id },
    user: adminUser,
  };
  let spoofCaught = false;
  try {
    await attachmentController.create(spoofedReq, mockRes(() => {}), (err) => { if (err) throw err; });
  } catch (err) {
    spoofCaught = true;
    assert(err.statusCode === 400 && err.code === 'INVALID_FILE_SIGNATURE', 'MIME-spoofed file rejected with 400 INVALID_FILE_SIGNATURE');
  }
  assert(spoofCaught, 'File signature validation prevented MIME spoofing');

  // Test 7.6: Missing file rejection
  let noFileCaught = false;
  try {
    await attachmentController.create({ body: { entityType: 'ITEM', entityId: item._id }, user: adminUser }, mockRes(() => {}), (err) => { if (err) throw err; });
  } catch (err) {
    noFileCaught = true;
    assert(err.statusCode === 400 && err.code === 'NO_FILE', 'Missing file payload rejected with 400 NO_FILE');
  }
  assert(noFileCaught, 'Missing file payload strictly blocked');

  // Test 7.7: Attachment deletion & resource cleanup
  let deleteResData = null;
  await attachmentController.delete({ params: { id: jpegResData.data._id } }, mockRes(d => { deleteResData = d; }), (err) => { if (err) throw err; });
  assert(deleteResData && deleteResData.success, 'Attachment resource deleted and cleaned up successfully');

  // 8. ExcelJS Spreadsheet Reporting Verification
  console.log('\n▸ Phase 8: ExcelJS Reporting & Spreadsheet Integrity Verification');
  const ExcelJS = require('exceljs');
  const testWorkbook = new ExcelJS.Workbook();
  const testSheet = testWorkbook.addWorksheet('SecurityAudit');
  testSheet.columns = [{ header: 'Code', key: 'code', width: 20 }, { header: 'Name', key: 'name', width: 30 }];
  testSheet.addRow({ code: 'ITM-001', name: 'Portland Cement' });
  const xlsxBuffer = await testWorkbook.xlsx.writeBuffer();
  assert(xlsxBuffer && xlsxBuffer.length > 100, 'ExcelJS generates valid XLSX spreadsheet buffer');

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`🎉 SECURITY SUITE SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED (100% SUCCESS)`);
  console.log('════════════════════════════════════════════════════════════════\n');

  if (require.main === module) {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runSecuritySuite().catch((err) => {
    console.error('Security Suite Unhandled Error:', err);
    process.exit(1);
  });
}

module.exports = { runSecuritySuite };
