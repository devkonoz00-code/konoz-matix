/**
 * Material Request Detail Module
 */
import { api } from '../js/api.js';
import { formatMoney, formatDate, getStatusBadge, showToast, showModal } from '../js/app.js';
import { i18n } from '../js/i18n.js';

export async function renderRequestDetail(container, params) {
  const requestId = params.id;
  document.getElementById('page-title').textContent = 'Material Request Detail';

  container.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <a href="#/requests" class="btn btn-sm btn-outline" style="margin-bottom: 1rem;">&larr; Back to Requests</a>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
        <div>
          <span style="font-family: var(--font-mono); color: var(--primary); font-weight: 700;" id="req-num">Loading...</span>
          <h2 style="font-size: 1.6rem; font-weight: 700; color: var(--text-primary); margin-top: 0.15rem;" id="req-prj-name">—</h2>
          <p style="color: var(--text-secondary); font-size: 0.85rem;" id="req-requester">—</p>
        </div>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;" id="req-actions-bar">
          <!-- Lifecycle Action Buttons -->
        </div>
      </div>
    </div>

    <!-- Request Status & Summary Cards -->
    <div class="grid-cols-4" style="margin-bottom: 1.5rem;">
      <div class="card stat-card">
        <div class="stat-icon purple">📌</div>
        <div class="stat-content">
          <div class="stat-label">Current Status</div>
          <div class="stat-value" style="font-size: 1.15rem; padding-top: 0.35rem;" id="stat-req-status">—</div>
          <div class="stat-subtext" id="stat-req-priority">Priority: —</div>
        </div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon blue">📅</div>
        <div class="stat-content">
          <div class="stat-label">Date Submitted</div>
          <div class="stat-value" style="font-size: 1rem; padding-top: 0.4rem;" id="stat-req-date">—</div>
          <div class="stat-subtext">Immutable log timestamp</div>
        </div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon cyan">📦</div>
        <div class="stat-content">
          <div class="stat-label">Total Line Items</div>
          <div class="stat-value" id="stat-req-line-count">—</div>
          <div class="stat-subtext">Distinct materials</div>
        </div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon green">💰</div>
        <div class="stat-content">
          <div class="stat-label">Estimated Value</div>
          <div class="stat-value" id="stat-req-est-value">—</div>
          <div class="stat-subtext">Snapshot at draft time</div>
        </div>
      </div>
    </div>

    <!-- Requested Lines Table -->
    <div class="card" style="margin-bottom: 1.5rem;">
      <h3 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 1rem;">Requested Material Lines</h3>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Item Code</th>
              <th>Material / Tool Name</th>
              <th>Unit</th>
              <th>Requested Qty</th>
              <th>Approved Qty</th>
              <th>Fulfilled Qty</th>
              <th>Unit Snapshot Cost</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody id="req-lines-table-body">
            <tr><td colspan="8" style="text-align: center; color: var(--text-muted);">Loading line items...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Request Notes / Audit Trail -->
    <div class="card">
      <h3 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.5rem;">Request Notes</h3>
      <p style="color: var(--text-secondary); font-size: 0.9rem;" id="req-note-text">—</p>
    </div>
  `;

  i18n.translateDOM(container);

  async function loadRequest() {
    try {
      const res = await api.get(`/requests/${requestId}`);
      const { request, lines } = res.data;
      const currentUser = api.getCurrentUser();

      document.getElementById('req-num').textContent = request.requestNumber;
      document.getElementById('req-prj-name').textContent = `Project: ${request.projectId?.name || 'Site'}`;
      document.getElementById('req-requester').textContent = `Requested by ${request.requestedBy?.fullName} (${request.requestedBy?.email})`;
      document.getElementById('stat-req-status').innerHTML = getStatusBadge(request.status);
      document.getElementById('stat-req-priority').textContent = `Priority: ${request.priority}`;
      document.getElementById('stat-req-date').textContent = formatDate(request.createdAt).split(',')[0];
      document.getElementById('stat-req-line-count').textContent = lines.length;
      document.getElementById('req-note-text').textContent = request.note || 'No notes attached.';

      const totalEst = lines.reduce((sum, l) => sum + (l.requestedQuantity * (l.unitCostSnapshot || 0)), 0);
      document.getElementById('stat-req-est-value').textContent = formatMoney(totalEst);

      // Populate Lines
      const tbody = document.getElementById('req-lines-table-body');
      tbody.innerHTML = lines.map(l => `
        <tr>
          <td><a href="#/items/${l.itemId?._id}" style="font-family: var(--font-mono); font-weight: 600; color: var(--primary);">${l.itemId?.itemCode || '—'}</a></td>
          <td style="font-weight: 600; color: #fff;">${l.itemId?.name || 'Item'}</td>
          <td>${l.itemId?.unit || 'unit'}</td>
          <td style="font-weight: 700; color: var(--text-primary);">${l.requestedQuantity}</td>
          <td style="font-weight: 700; color: var(--success);">${l.approvedQuantity !== undefined ? l.approvedQuantity : '—'}</td>
          <td style="font-weight: 700; color: var(--accent-cyan);">${l.fulfilledQuantity || 0}</td>
          <td>${formatMoney(l.unitCostSnapshot || 0)}</td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${l.note || '—'}</td>
        </tr>
      `).join('');

      // Build Lifecycle Actions Bar based on Status & Role
      const actionsBar = document.getElementById('req-actions-bar');
      actionsBar.innerHTML = '';

      if (request.status === 'DRAFT') {
        actionsBar.innerHTML = `
          <button class="btn btn-primary btn-sm" id="btn-submit-req">
            <span data-i18n="btn_submit">Submit Request</span>
          </button>
          <button class="btn btn-danger btn-sm" id="btn-cancel-req">Cancel</button>
        `;
        actionsBar.querySelector('#btn-submit-req')?.addEventListener('click', async () => {
          await api.patch(`/requests/${requestId}/submit`);
          showToast('Request submitted for warehouse approval', 'success');
          loadRequest();
        });
        actionsBar.querySelector('#btn-cancel-req')?.addEventListener('click', async () => {
          await api.patch(`/requests/${requestId}/cancel`);
          showToast('Request cancelled', 'info');
          loadRequest();
        });
      } else if (request.status === 'SUBMITTED' && ['ADMIN', 'WAREHOUSE_MANAGER'].includes(currentUser?.role)) {
        actionsBar.innerHTML = `
          <button class="btn btn-success btn-sm" id="btn-approve-req">
            <span data-i18n="btn_approve">Approve Request</span>
          </button>
          <button class="btn btn-danger btn-sm" id="btn-reject-req">
            <span data-i18n="btn_reject">Reject Request</span>
          </button>
        `;
        actionsBar.querySelector('#btn-approve-req')?.addEventListener('click', async () => {
          // Auto approve all requested quantities
          const approvalLines = lines.map(l => ({ lineId: l._id, approvedQuantity: l.requestedQuantity }));
          await api.patch(`/requests/${requestId}/approve`, { lines: approvalLines });
          showToast('Request approved! Ready for warehouse issue movement.', 'success');
          loadRequest();
        });
        actionsBar.querySelector('#btn-reject-req')?.addEventListener('click', async () => {
          await api.patch(`/requests/${requestId}/reject`, { note: 'Rejected by warehouse management' });
          showToast('Request rejected', 'info');
          loadRequest();
        });
      } else if (request.status === 'APPROVED' && ['ADMIN', 'WAREHOUSE_MANAGER', 'STOREKEEPER'].includes(currentUser?.role)) {
        actionsBar.innerHTML = `
          <a href="#/movements" class="btn btn-primary btn-sm">
            Execute ISSUE Movement &rarr;
          </a>
        `;
      }

    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  loadRequest();
}
