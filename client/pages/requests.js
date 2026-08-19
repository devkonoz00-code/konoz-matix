/**
 * Material Requests Page Module
 */
import { api } from '../js/api.js';
import { formatDate, getStatusBadge, showToast, showModal } from '../js/app.js';
import { i18n } from '../js/i18n.js';

export async function renderRequests(container) {
  document.getElementById('page-title').textContent = i18n.t('nav_requests');

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
      <div>
        <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);" data-i18n="nav_requests">Material Requests</h2>
        <p style="color: var(--text-secondary); font-size: 0.85rem;">Project material demands — records intent without modifying stock</p>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-create-request">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span data-i18n="btn_new_request">New Request</span>
      </button>
    </div>

    <!-- Filters -->
    <div class="card" style="margin-bottom: 1.5rem; padding: 1rem;">
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <div style="width: 200px;">
          <select id="req-status-filter" class="form-select">
            <option value="">All Statuses</option>
            <option value="DRAFT">DRAFT</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="APPROVED">APPROVED</option>
            <option value="PARTIALLY_FULFILLED">PARTIALLY_FULFILLED</option>
            <option value="FULFILLED">FULFILLED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
        <div style="flex: 1; min-width: 220px;">
          <select id="req-project-filter" class="form-select">
            <option value="">All Projects</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Requests Table -->
    <div class="card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Request #</th>
              <th>Project Site</th>
              <th>Requested By</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Created Date</th>
              <th data-i18n="lbl_actions">Actions</th>
            </tr>
          </thead>
          <tbody id="requests-table-body">
            <tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Loading material requests...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  i18n.translateDOM(container);

  // Populate Projects in Filter
  try {
    const prjRes = await api.get('/projects');
    const prjSelect = document.getElementById('req-project-filter');
    if (prjSelect && prjRes.data) {
      prjRes.data.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p._id;
        opt.textContent = `${p.projectCode} — ${p.name}`;
        prjSelect.appendChild(opt);
      });
    }
  } catch {}

  async function loadRequests() {
    const status = document.getElementById('req-status-filter')?.value || '';
    const projectId = document.getElementById('req-project-filter')?.value || '';
    const tbody = document.getElementById('requests-table-body');

    try {
      const res = await api.get('/requests', { status, projectId });
      const requests = res.data || [];

      if (requests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No material requests found.</td></tr>`;
        return;
      }

      tbody.innerHTML = requests.map(r => `
        <tr>
          <td><a href="#/requests/${r._id}" style="font-family: var(--font-mono); font-weight: 600; color: var(--primary);">${r.requestNumber}</a></td>
          <td style="font-weight: 600; color: var(--text-primary);">${r.projectId?.name || '—'}</td>
          <td>${r.requestedBy?.fullName || '—'}</td>
          <td>
            <span class="badge ${r.priority === 'URGENT' ? 'badge-danger' : r.priority === 'HIGH' ? 'badge-warning' : 'badge-secondary'}">
              ${r.priority}
            </span>
          </td>
          <td>${getStatusBadge(r.status)}</td>
          <td>${formatDate(r.createdAt)}</td>
          <td>
            <a href="#/requests/${r._id}" class="btn btn-sm btn-outline">Review Details &rarr;</a>
          </td>
        </tr>
      `).join('');

    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  document.getElementById('req-status-filter').addEventListener('change', loadRequests);
  document.getElementById('req-project-filter').addEventListener('change', loadRequests);

  // New Request Modal
  document.getElementById('btn-create-request').addEventListener('click', async () => {
    const [prjRes, itmRes] = await Promise.all([
      api.get('/projects?status=ACTIVE'),
      api.get('/items'),
    ]);

    const projects = prjRes.data || [];
    const items = itmRes.data || [];

    const content = `
      <form id="form-new-request">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Destination Project</label>
            <select id="inp-req-project" class="form-select" required>
              ${projects.map(p => `<option value="${p._id}">${p.projectCode} — ${p.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Priority Level</label>
            <select id="inp-req-priority" class="form-select">
              <option value="NORMAL">NORMAL</option>
              <option value="LOW">LOW</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Request Note / Purpose</label>
          <input type="text" id="inp-req-note" class="form-control" placeholder="E.g. Foundation pour scheduled for Tuesday">
        </div>

        <div style="margin-top: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <label class="form-label" style="margin-bottom: 0;">Requested Items List</label>
            <button type="button" class="btn btn-sm btn-outline" id="btn-add-line">+ Add Line Item</button>
          </div>
          <div id="request-lines-container" style="display: flex; flex-direction: column; gap: 0.75rem;">
            <!-- Lines dynamically added -->
          </div>
        </div>
      </form>
    `;

    const modal = showModal({
      title: 'Draft New Material Request',
      content,
      confirmText: 'Create Draft Request',
      onConfirm: async () => {
        const projectId = document.getElementById('inp-req-project').value;
        const priority = document.getElementById('inp-req-priority').value;
        const note = document.getElementById('inp-req-note').value.trim();

        const lineRows = document.querySelectorAll('.req-line-row');
        const lines = [];

        lineRows.forEach(row => {
          const itemId = row.querySelector('.sel-item').value;
          const qty = parseFloat(row.querySelector('.inp-qty').value);
          const lineNote = row.querySelector('.inp-line-note').value.trim();
          if (itemId && qty > 0) {
            lines.push({ itemId, requestedQuantity: qty, note: lineNote });
          }
        });

        if (lines.length === 0) {
          showToast('Please add at least one line item with a quantity', 'error');
          return false;
        }

        const reqKey = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
        try {
          const res = await api.post('/requests', { projectId, priority, note, lines }, {
            headers: { 'Idempotency-Key': reqKey }
          });
          showToast(`Request ${res.data?.request?.requestNumber || ''} drafted successfully`, 'success');
          loadRequests();
          return true;
        } catch (err) {
          showToast(err.message, 'error');
          return false;
        }
      }
    });

    // Helper to add line
    function addLineRow() {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'req-line-row';
      lineDiv.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 1.5fr auto; gap: 0.5rem; align-items: center; background: var(--bg-surface-elevated); padding: 0.5rem; border-radius: var(--radius-md);';
      lineDiv.innerHTML = `
        <select class="form-select sel-item">
          ${items.map(i => `<option value="${i._id}">${i.itemCode} — ${i.name} (${i.unit})</option>`).join('')}
        </select>
        <input type="number" step="0.01" class="form-control inp-qty" placeholder="Qty" value="1" min="0.01" required>
        <input type="text" class="form-control inp-line-note" placeholder="Line note">
        <button type="button" class="icon-button btn-remove-line" style="color: var(--danger); width: 32px; height: 32px;">&times;</button>
      `;

      lineDiv.querySelector('.btn-remove-line').addEventListener('click', () => lineDiv.remove());
      modal.querySelector('#request-lines-container').appendChild(lineDiv);
    }

    modal.querySelector('#btn-add-line').addEventListener('click', addLineRow);
    addLineRow(); // Add first line automatically
  });

  loadRequests();
}
