/**
 * Automated Golden Scenario Acceptance Test (§18)
 * Verifies the complete lifecycle against the live MATIX API.
 *
 * SECURITY: All credentials sourced from environment variables.
 * No hardcoded passwords or emails.
 *
 * Prerequisites: Server running on port 5000, `npm run setup` already executed.
 *
 * Required environment variables:
 *   INITIAL_ADMIN_EMAIL    - Admin email used during setup
 *   INITIAL_ADMIN_PASSWORD - Admin password used during setup
 */
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const API_BASE = 'http://127.0.0.1:5000/api';

async function request(endpoint, options = {}) {
  const url = new URL(API_BASE + endpoint);
  const method = options.method || 'GET';
  const headers = {
    'Content-Type': 'application/json',
    ...(options.token ? { 'Authorization': `Bearer ${options.token}` } : {}),
  };

  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, text: body });
        }
      });
    });

    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

/**
 * Generate a cryptographically random password satisfying complexity requirements.
 */
function generateSecurePassword() {
  const randomBytes = crypto.randomBytes(16).toString('hex');
  return `Test_${randomBytes}_1!`;
}

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    process.exit(1);
  }
  passed++;
  console.log(`  ✅ ${message}`);
}

async function runGoldenScenario() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  🧪 MATIX GOLDEN SCENARIO ACCEPTANCE TEST');
  console.log('═══════════════════════════════════════════════════\n');

  // Validate required environment variables — fail safely if missing
  const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = (process.env.INITIAL_ADMIN_PASSWORD || '').trim();

  if (!adminEmail) {
    console.error('❌ FATAL: INITIAL_ADMIN_EMAIL environment variable is required.');
    console.error('   Set it in your .env file or export it before running this test.');
    process.exit(1);
  }

  if (!adminPassword) {
    console.error('❌ FATAL: INITIAL_ADMIN_PASSWORD environment variable is required.');
    console.error('   Set it in your .env file or export it before running this test.');
    process.exit(1);
  }

  // ──────────────────────────────────────────────────
  // Step 0: Authenticate admin and dynamically provision test users via API
  // ──────────────────────────────────────────────────
  console.log('▸ Step 0: Authenticating Admin & Provisioning Test Users');

  const adminLogin = await request('/auth/login', {
    method: 'POST', body: { email: adminEmail, password: adminPassword }
  });
  assert(adminLogin.data.success, 'Admin login OK');
  const adminToken = adminLogin.data.data.accessToken;

  // Dynamically create test users with securely generated credentials
  const supervisorPassword = generateSecurePassword();
  const supervisorCreateRes = await request('/users', {
    method: 'POST', token: adminToken,
    body: {
      fullName: 'Omar Cherkaoui',
      email: `supervisor_${crypto.randomBytes(4).toString('hex')}@test.local`,
      role: 'SUPERVISOR',
      password: supervisorPassword,
    }
  });
  assert(supervisorCreateRes.data.success, 'Test Supervisor provisioned dynamically');
  const supervisorEmail = supervisorCreateRes.data.data.email;
  const supervisorUserId = supervisorCreateRes.data.data._id;

  const supervisorLogin = await request('/auth/login', {
    method: 'POST', body: { email: supervisorEmail, password: supervisorPassword }
  });
  assert(supervisorLogin.data.success, 'Supervisor login OK');
  const supervisorToken = supervisorLogin.data.data.accessToken;

  const wmPassword = generateSecurePassword();
  const wmCreateRes = await request('/users', {
    method: 'POST', token: adminToken,
    body: {
      fullName: 'Tariq El-Amrani',
      email: `wm_${crypto.randomBytes(4).toString('hex')}@test.local`,
      role: 'WAREHOUSE_MANAGER',
      password: wmPassword,
    }
  });
  assert(wmCreateRes.data.success, 'Test Warehouse Manager provisioned dynamically');
  const wmEmail = wmCreateRes.data.data.email;

  const wmLogin = await request('/auth/login', {
    method: 'POST', body: { email: wmEmail, password: wmPassword }
  });
  assert(wmLogin.data.success, 'Warehouse Manager login OK');
  const wmToken = wmLogin.data.data.accessToken;

  // ──────────────────────────────────────────────────
  // Step 0.5: Fetch reference warehouses + Create category
  // ──────────────────────────────────────────────────
  console.log('\n▸ Step 0.5: Category & Warehouse Setup');

  const catRes = await request('/categories', {
    method: 'POST', token: adminToken,
    body: { name: 'Heavy Equipment & Tools', description: 'Site machinery and power tools' }
  });
  assert(catRes.data.success, 'Category created');
  const categoryId = catRes.data.data._id;

  const whRes = await request('/warehouses', { token: adminToken });
  assert(whRes.data.success && whRes.data.data.length >= 2, '2 Reference Warehouses found');
  const mainWarehouse = whRes.data.data.find(w => w.name === 'المخزن') || whRes.data.data[0];

  // ──────────────────────────────────────────────────
  // Step 1: Create Item — no barcode → auto ITM-XXXXXX
  // ──────────────────────────────────────────────────
  console.log('\n▸ Step 1: Item Creation with Auto-Generated Barcode');

  const itemRes = await request('/items', {
    method: 'POST', token: adminToken,
    body: {
      name: 'Rotary Hammer Drill SDS-Max',
      categoryId, itemType: 'TOOL', unit: 'piece',
      purchasePrice: 120.00, currentCostPrice: 120.00,
      brand: 'Bosch Professional', model: 'GBH 8-45 D',
    }
  });
  assert(itemRes.data.success, 'Item created');
  const item = itemRes.data.data;
  assert(item.itemCode && item.itemCode.startsWith('ITM-'), `Auto-generated code: ${item.itemCode}`);
  assert(item.barcodes && item.barcodes.length > 0, `Internal barcode linked: ${item.barcodes[0].code}`);
  const itemId = item._id;
  const primaryBarcode = item.barcodes[0].code;

  // ──────────────────────────────────────────────────
  // Step 2: Label Printing API
  // ──────────────────────────────────────────────────
  console.log('\n▸ Step 2: Barcode & QR Label Printing Endpoint');

  const labelRes = await request(`/items/labels?ids=${itemId}`, { token: adminToken });
  assert(labelRes.data.success && labelRes.data.data.length === 1, 'Label data returned for 1 item');
  assert(labelRes.data.data[0].barcode === primaryBarcode, `Label primary barcode: ${primaryBarcode}`);
  assert(labelRes.data.data[0].itemCode === item.itemCode, `Label itemCode: ${item.itemCode}`);

  // ──────────────────────────────────────────────────
  // Step 3: Receipt — 10 units into Warehouse المخزن
  // ──────────────────────────────────────────────────
  console.log('\n▸ Step 3: Initial Stock RECEIPT (10 units at Warehouse)');

  const receiptRes = await request('/movements', {
    method: 'POST', token: adminToken,
    body: {
      type: 'RECEIPT',
      toLocation: { kind: 'WAREHOUSE', id: mainWarehouse._id },
      lines: [{ itemId, quantity: 10, note: 'Supplier delivery' }],
      note: 'Initial batch purchase'
    }
  });
  assert(receiptRes.data.success, 'RECEIPT auto-confirmed');
  assert(receiptRes.data.data.movement.status === 'CONFIRMED', 'Receipt status = CONFIRMED');

  // ──────────────────────────────────────────────────
  // Step 4: Create 2 Projects & Assign PM
  // ──────────────────────────────────────────────────
  console.log('\n▸ Step 4: Project Creation & PM Assignment');

  const p1Res = await request('/projects', {
    method: 'POST', token: adminToken,
    body: { projectCode: 'PRJ-CAS-01', name: 'Casablanca Marina Tower', location: 'Casablanca', status: 'ACTIVE' }
  });
  assert(p1Res.data.success, 'Project 1 created');
  const project1Id = p1Res.data.data._id;

  const p2Res = await request('/projects', {
    method: 'POST', token: adminToken,
    body: { projectCode: 'PRJ-RAB-02', name: 'Rabat Heritage Plaza', location: 'Rabat', status: 'ACTIVE' }
  });
  assert(p2Res.data.success, 'Project 2 created');
  const project2Id = p2Res.data.data._id;

  // Assign Supervisor (PM-equivalent) to both projects via /api/project-assignments
  const a1 = await request('/project-assignments', {
    method: 'POST', token: adminToken,
    body: { userId: supervisorUserId, projectId: project1Id, role: 'LEAD_PROJECT_MANAGER' }
  });
  assert(a1.data.success, 'Supervisor assigned to Project 1');

  const a2 = await request('/project-assignments', {
    method: 'POST', token: adminToken,
    body: { userId: supervisorUserId, projectId: project2Id, role: 'LEAD_PROJECT_MANAGER' }
  });
  assert(a2.data.success, 'Supervisor assigned to Project 2');

  // ──────────────────────────────────────────────────
  // Step 5: Material Request → Approve → ISSUE
  // ──────────────────────────────────────────────────
  console.log('\n▸ Step 5: Material Request → Approve → ISSUE (5 units)');

  // Supervisor creates request
  const reqRes = await request('/requests', {
    method: 'POST', token: supervisorToken,
    body: {
      projectId: project1Id, priority: 'HIGH',
      note: 'Required for concrete breaking phase',
      lines: [{ itemId, requestedQuantity: 5 }]
    }
  });
  assert(reqRes.data.success, 'Material Request created (DRAFT)');
  const matReqId = reqRes.data.data.request._id;
  const matReqLineId = reqRes.data.data.lines[0]._id;

  // Supervisor submits
  const submitRes = await request(`/requests/${matReqId}/submit`, {
    method: 'PATCH', token: supervisorToken
  });
  assert(submitRes.data.success, 'Request SUBMITTED');

  // Admin approves with quantity
  const approveRes = await request(`/requests/${matReqId}/approve`, {
    method: 'PATCH', token: adminToken,
    body: { lines: [{ lineId: matReqLineId, approvedQuantity: 5 }] }
  });
  assert(approveRes.data.success, 'Request APPROVED');

  // Admin creates ISSUE movement (Warehouse → Project 1)
  const issueRes = await request('/movements', {
    method: 'POST', token: adminToken,
    body: {
      type: 'ISSUE',
      fromLocation: { kind: 'WAREHOUSE', id: mainWarehouse._id },
      toLocation: { kind: 'PROJECT', id: project1Id },
      projectId: project1Id,
      requestId: matReqId,
      lines: [{ itemId, quantity: 5 }],
      note: 'Issued per request'
    }
  });
  assert(issueRes.data.success, 'ISSUE movement created (PENDING)');
  assert(issueRes.data.data.movement.status === 'PENDING', 'Issue status = PENDING');
  const issueMovId = issueRes.data.data.movement._id;

  // Supervisor confirms receipt at Project 1
  const confirmIssue = await request(`/movements/${issueMovId}/confirm`, {
    method: 'PATCH', token: supervisorToken
  });
  assert(confirmIssue.data.success, 'ISSUE confirmed (materials received at Project 1)');
  assert(confirmIssue.data.data.movement.status === 'CONFIRMED', 'Issue status now CONFIRMED');

  // ──────────────────────────────────────────────────
  // Step 6: Verify Derived Stock at Project 1
  // ──────────────────────────────────────────────────
  console.log('\n▸ Step 6: Verify Derived Inventory at Project 1');

  const p1Dash = await request(`/projects/${project1Id}/dashboard`, { token: supervisorToken });
  assert(p1Dash.data.success, 'Project 1 dashboard loaded');
  assert(p1Dash.data.data.materials.length === 1, '1 material type at Project 1');
  assert(p1Dash.data.data.materials[0].quantity === 5, 'Project 1 derived quantity = 5');
  assert(p1Dash.data.data.totalMaterialValue === 600.00, 'Project 1 value = 5 × $120 = $600');

  // ──────────────────────────────────────────────────
  // Step 7: Barcode Scanner Lookup
  // ──────────────────────────────────────────────────
  console.log('\n▸ Step 7: Barcode Scan & Item Detail Lookup');

  const scanRes = await request(`/barcodes/${encodeURIComponent(primaryBarcode)}`, { token: supervisorToken });
  assert(scanRes.data.success, 'Barcode lookup resolved');

  const itemDetail = await request(`/items/${itemId}`, { token: supervisorToken });
  assert(itemDetail.data.success, 'Item detail loaded with enriched locations');
  const locs = itemDetail.data.data.currentLocations;
  const p1Loc = locs.find(l => l.locationKind === 'PROJECT' && l.locationId === project1Id);
  const whLoc = locs.find(l => l.locationKind === 'WAREHOUSE' && l.locationId === mainWarehouse._id);
  assert(p1Loc && p1Loc.quantity === 5, `Project 1 balance = ${p1Loc?.quantity}`);
  assert(whLoc && whLoc.quantity === 5, `Warehouse balance = ${whLoc?.quantity}`);
  assert(p1Loc.responsible === 'Omar Cherkaoui', `Responsible PM: ${p1Loc?.responsible}`);

  // ──────────────────────────────────────────────────
  // Step 8-9: Transfer 2 units from Project 1 → Project 2 + confirm
  // ──────────────────────────────────────────────────
  console.log('\n▸ Steps 8-9: Site-to-Site TRANSFER (2 units)');

  const transferRes = await request('/transfers', {
    method: 'POST', token: supervisorToken,
    body: {
      fromLocation: { kind: 'PROJECT', id: project1Id },
      toLocation: { kind: 'PROJECT', id: project2Id },
      lines: [{ itemId, quantity: 2 }],
      note: 'Urgent transfer for structural works'
    }
  });
  assert(transferRes.data.success, 'TRANSFER initiated (PENDING)');
  const transferMovId = transferRes.data.data.movement._id;

  // Confirm transfer at Project 2 (PATCH)
  const confirmTrf = await request(`/transfers/${transferMovId}/confirm`, {
    method: 'PATCH', token: supervisorToken
  });
  assert(confirmTrf.data.success, 'TRANSFER CONFIRMED at Project 2');

  // Verify split: P1=3, P2=2
  const p1After = await request(`/projects/${project1Id}/dashboard`, { token: supervisorToken });
  const p2After = await request(`/projects/${project2Id}/dashboard`, { token: supervisorToken });
  assert(p1After.data.data.materials[0].quantity === 3, 'Project 1 balance after transfer = 3');
  assert(p2After.data.data.materials[0].quantity === 2, 'Project 2 balance after transfer = 2');

  // ──────────────────────────────────────────────────
  // Step 10: Return 2 units from Project 2 → Warehouse
  // ──────────────────────────────────────────────────
  console.log('\n▸ Step 10: Site-to-Warehouse RETURN (2 units)');

  const returnRes = await request('/returns', {
    method: 'POST', token: supervisorToken,
    body: {
      fromLocation: { kind: 'PROJECT', id: project2Id },
      toLocation: { kind: 'WAREHOUSE', id: mainWarehouse._id },
      lines: [{ itemId, quantity: 2 }],
      note: 'Job finished, returning to depot'
    }
  });
  assert(returnRes.data.success, 'RETURN initiated (PENDING)');
  const returnMovId = returnRes.data.data.movement._id;

  // Warehouse Manager confirms return (PATCH)
  const confirmRet = await request(`/returns/${returnMovId}/confirm`, {
    method: 'PATCH', token: wmToken
  });
  assert(confirmRet.data.success, 'RETURN CONFIRMED by Warehouse Manager');

  // ──────────────────────────────────────────────────
  // Step 11: Full Ledger History & Financial Reconciliation
  // ──────────────────────────────────────────────────
  console.log('\n▸ Step 11: Movement History & Ledger Reconciliation');

  const historyRes = await request(`/items/${itemId}/history`, { token: adminToken });
  assert(historyRes.data.success, 'Item history loaded');
  const history = historyRes.data.data;
  assert(history.length === 4, `4 movements recorded: ${history.map(h => h.type).join(' → ')}`);

  // Verify frozen cost on every hop
  const allCostsFrozen = history.every(h => h.unitCostSnapshot === 120.00);
  assert(allCostsFrozen, 'All 4 hops have unitCostSnapshot frozen at $120.00');

  // Final derived balances
  const finalItem = await request(`/items/${itemId}`, { token: adminToken });
  const finalLocs = finalItem.data.data.currentLocations;
  const finalP1 = finalLocs.find(l => l.locationKind === 'PROJECT' && l.locationId === project1Id);
  const finalP2 = finalLocs.find(l => l.locationKind === 'PROJECT' && l.locationId === project2Id);
  const finalWh = finalLocs.find(l => l.locationKind === 'WAREHOUSE' && l.locationId === mainWarehouse._id);

  assert(finalP1 && finalP1.quantity === 3, `Final Project 1: 3 units ✓`);
  assert(!finalP2, `Final Project 2: 0 units (removed from active) ✓`);
  assert(finalWh && finalWh.quantity === 7, `Final Warehouse: 7 units (5 kept + 2 returned) ✓`);

  // Verify total = 10 (conservation of quantity)
  const totalDerived = (finalP1?.quantity || 0) + (finalP2?.quantity || 0) + (finalWh?.quantity || 0);
  assert(totalDerived === 10, `Conservation of stock: ${totalDerived}/10 units accounted for ✓`);

  // ──────────────────────────────────────────────────
  // COMPLETE
  // ──────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  🎉 ALL ${passed}/${total} GOLDEN SCENARIO TESTS PASSED!`);
  console.log('═══════════════════════════════════════════════════\n');
}

runGoldenScenario().catch(err => {
  console.error('\n💥 Fatal test error:', err.message || err);
  process.exit(1);
});
