/**
 * Movement Ledger Page Module
 */
import { api } from '../js/api.js';
import { formatDate, getMovementTypeBadge, getStatusBadge, formatMoney, showToast, showModal } from '../js/app.js';
import { i18n } from '../js/i18n.js';

export async function renderMovements(container) {
  document.getElementById('page-title').textContent = i18n.t('nav_movements');

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
      <div>
        <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);" data-i18n="nav_movements">Movement Ledger</h2>
        <p style="color: var(--text-secondary); font-size: 0.85rem;">The single source of truth for all physical stock and location transitions</p>
      </div>
      <div style="display: flex; gap: 0.75rem;">
        <button class="btn btn-primary btn-sm" id="btn-record-movement">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span data-i18n="btn_new_movement">Record Movement</span>
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="card" style="margin-bottom: 1.5rem; padding: 1rem;">
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <div style="width: 200px;">
          <select id="mov-type-filter" class="form-select">
            <option value="">All Movement Types</option>
            <option value="RECEIPT">RECEIPT (Inbound)</option>
            <option value="ISSUE">ISSUE (Warehouse → Project)</option>
            <option value="TRANSFER">TRANSFER (Project → Project)</option>
            <option value="RETURN">RETURN (Project → Warehouse)</option>
            <option value="ADJUSTMENT">ADJUSTMENT</option>
          </select>
        </div>
        <div style="width: 180px;">
          <select id="mov-status-filter" class="form-select">
            <option value="">All Statuses</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="PENDING">PENDING</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Movement Ledger Table -->
    <div class="card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Movement #</th>
              <th>Type</th>
              <th>From Location</th>
              <th>To Location</th>
              <th>Linked Bon de Vente</th>
              <th>Status</th>
              <th>Created By</th>
              <th>Date & Time</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody id="movements-table-body">
            <tr><td colspan="9" style="text-align: center; color: var(--text-muted);">Loading ledger...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  i18n.translateDOM(container);

  async function loadMovements() {
    const type = document.getElementById('mov-type-filter')?.value || '';
    const status = document.getElementById('mov-status-filter')?.value || '';
    const tbody = document.getElementById('movements-table-body');

    try {
      const [movRes, whRes, prjRes] = await Promise.all([
        api.get('/movements', { type, status }),
        api.get('/warehouses'),
        api.get('/projects'),
      ]);

      const movements = movRes.data || [];
      const whMap = Object.fromEntries((whRes.data || []).map(w => [w._id, w.name]));
      const prjMap = Object.fromEntries((prjRes.data || []).map(p => [p._id, `${p.projectCode} — ${p.name}`]));

      if (movements.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">No movement ledger events found.</td></tr>`;
        return;
      }

      tbody.innerHTML = movements.map(m => {
        const fromStr = m.fromLocation ? (m.fromLocation.kind === 'WAREHOUSE' ? (whMap[m.fromLocation.id] || 'Warehouse') : (prjMap[m.fromLocation.id] || 'Project')) : '<span style="color: var(--text-muted);">Supplier</span>';
        const toStr = m.toLocation ? (m.toLocation.kind === 'WAREHOUSE' ? (whMap[m.toLocation.id] || 'Warehouse') : (prjMap[m.toLocation.id] || 'Project')) : '—';
        const docRef = m.companyDocumentId ? `<span class="badge badge-purple" style="font-family: var(--font-mono);">${m.companyDocumentId.documentNumber}</span>` : '<span style="color: var(--text-muted);">—</span>';

        return `
          <tr>
            <td style="font-family: var(--font-mono); font-weight: 600; color: var(--primary);">${m.movementNumber}</td>
            <td>${getMovementTypeBadge(m.type)}</td>
            <td>${fromStr}</td>
            <td>${toStr}</td>
            <td>${docRef}</td>
            <td>${getStatusBadge(m.status)}</td>
            <td>${m.createdBy?.fullName || 'System'}</td>
            <td>${formatDate(m.createdAt)}</td>
            <td>
              <button class="btn btn-sm btn-outline btn-view-mov-lines" data-id="${m._id}">View Lines</button>
            </td>
          </tr>
        `;
      }).join('');

      // Bind View Lines button
      tbody.querySelectorAll('.btn-view-mov-lines').forEach(btn => {
        btn.addEventListener('click', () => openMovementLinesModal(btn.getAttribute('data-id'), whMap, prjMap));
      });

    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  document.getElementById('mov-type-filter').addEventListener('change', loadMovements);
  document.getElementById('mov-status-filter').addEventListener('change', loadMovements);

  // View Lines Modal
  async function openMovementLinesModal(movementId, whMap, prjMap) {
    try {
      const res = await api.get(`/movements/${movementId}`);
      const { movement, lines } = res.data;

      const fromStr = movement.fromLocation ? (movement.fromLocation.kind === 'WAREHOUSE' ? whMap[movement.fromLocation.id] : prjMap[movement.fromLocation.id]) : 'External Supplier';
      const toStr = movement.toLocation ? (movement.toLocation.kind === 'WAREHOUSE' ? whMap[movement.toLocation.id] : prjMap[movement.toLocation.id]) : '—';

      const content = `
        <div style="margin-bottom: 1rem; font-size: 0.85rem;">
          <div><strong>Movement Number:</strong> <span style="font-family: var(--font-mono); color: var(--accent-cyan);">${movement.movementNumber}</span></div>
          <div><strong>Route:</strong> ${fromStr} &rarr; ${toStr}</div>
          <div><strong>Recorded:</strong> ${formatDate(movement.createdAt)} by ${movement.createdBy?.fullName}</div>
          ${movement.note ? `<div style="margin-top: 0.35rem; color: var(--text-secondary);"><strong>Note:</strong> ${movement.note}</div>` : ''}
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Frozen Unit Cost</th>
                <th>Total Value</th>
              </tr>
            </thead>
            <tbody>
              ${lines.map(l => `
                <tr>
                  <td>
                    <div style="font-weight: 600; color: #fff;">${l.itemId?.name || 'Item'}</div>
                    <div style="font-size: 0.72rem; font-family: var(--font-mono); color: var(--accent-cyan);">${l.itemId?.itemCode || ''}</div>
                  </td>
                  <td style="font-weight: 700; color: var(--accent-cyan);">${l.quantity} ${l.itemId?.unit || ''}</td>
                  <td>${formatMoney(l.unitCostSnapshot)}</td>
                  <td style="font-weight: 700; color: #fff;">${formatMoney(l.totalCost)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      showModal({
        title: `Movement Lines — ${movement.movementNumber}`,
        content,
        cancelText: 'Close',
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Record Movement Modal (RECEIPT, ISSUE, ADJUSTMENT)
  document.getElementById('btn-record-movement').addEventListener('click', async () => {
    const [whRes, prjRes, itmRes, docRes] = await Promise.all([
      api.get('/warehouses'),
      api.get('/projects?status=ACTIVE'),
      api.get('/items'),
      api.get('/documents'),
    ]);

    const warehouses = whRes.data || [];
    const projects = prjRes.data || [];
    const items = itmRes.data || [];
    const docs = docRes.data || [];

    const content = `
      <form id="form-record-movement">
        <div class="form-group">
          <label class="form-label">Movement Type</label>
          <select id="inp-mov-type" class="form-select" required>
            <option value="RECEIPT">RECEIPT (Supplier Inbound → Warehouse)</option>
            <option value="ISSUE">ISSUE (Warehouse Outbound → Project Site)</option>
            <option value="ADJUSTMENT">ADJUSTMENT (Stock Correction)</option>
          </select>
        </div>

        <div class="form-row" id="mov-locations-row">
          <div class="form-group" id="group-from-loc">
            <label class="form-label">From Warehouse</label>
            <select id="inp-mov-from-wh" class="form-select">
              ${warehouses.map(w => `<option value="${w._id}">${w.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" id="group-to-loc">
            <label class="form-label">To Project Site</label>
            <select id="inp-mov-to-prj" class="form-select">
              ${projects.map(p => `<option value="${p._id}">${p.projectCode} — ${p.name}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Linked Official Document (e.g. Bon de Vente)</label>
          <select id="inp-mov-doc" class="form-select">
            <option value="">None / External</option>
            ${docs.map(d => `<option value="${d._id}">${d.documentNumber} (${d.documentType})</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Movement Reason / Note</label>
          <input type="text" id="inp-mov-note" class="form-control" placeholder="E.g. Official exit for Phase 2 foundation work">
        </div>

        <div style="margin-top: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <label class="form-label" style="margin-bottom: 0;">Movement Items</label>
            <button type="button" class="btn btn-sm btn-outline" id="btn-add-mov-line">+ Add Line Item</button>
          </div>
          <div id="mov-lines-container" style="display: flex; flex-direction: column; gap: 0.75rem;"></div>
        </div>
      </form>
    `;

    const modal = showModal({
      title: 'Record Movement in Ledger',
      content,
      confirmText: 'Execute Movement',
      onConfirm: async () => {
        const type = document.getElementById('inp-mov-type').value;
        const note = document.getElementById('inp-mov-note').value.trim();
        const companyDocumentId = document.getElementById('inp-mov-doc').value || undefined;

        let fromLocation = null;
        let toLocation = null;
        let projectId = undefined;

        if (type === 'RECEIPT') {
          const whId = document.getElementById('inp-mov-from-wh').value;
          toLocation = { kind: 'WAREHOUSE', id: whId };
        } else if (type === 'ISSUE') {
          const whId = document.getElementById('inp-mov-from-wh').value;
          const prjId = document.getElementById('inp-mov-to-prj').value;
          fromLocation = { kind: 'WAREHOUSE', id: whId };
          toLocation = { kind: 'PROJECT', id: prjId };
          projectId = prjId;
        }

        const lineRows = document.querySelectorAll('.mov-line-row');
        const lines = [];
        lineRows.forEach(row => {
          const itemId = row.querySelector('.sel-item').value;
          const qty = parseFloat(row.querySelector('.inp-qty').value);
          if (itemId && qty > 0) {
            lines.push({ itemId, quantity: qty });
          }
        });

        if (lines.length === 0) {
          showToast('Please add at least one line item with a positive quantity', 'error');
          return false;
        }

        try {
          await api.post('/movements', { type, fromLocation, toLocation, projectId, companyDocumentId, note, lines });
          showToast('Movement recorded and confirmed in ledger!', 'success');
          loadMovements();
          return true;
        } catch (err) {
          showToast(err.message, 'error');
          return false;
        }
      }
    });

    function addLineRow() {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'mov-line-row';
      lineDiv.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr auto; gap: 0.5rem; align-items: center; background: var(--bg-surface-elevated); padding: 0.5rem; border-radius: var(--radius-md);';
      lineDiv.innerHTML = `
        <select class="form-select sel-item">
          ${items.map(i => `<option value="${i._id}">${i.itemCode} — ${i.name} (${i.unit})</option>`).join('')}
        </select>
        <input type="number" step="0.01" class="form-control inp-qty" placeholder="Quantity" value="1" min="0.01" required>
        <button type="button" class="icon-button btn-remove-line" style="color: var(--danger); width: 32px; height: 32px;">&times;</button>
      `;
      lineDiv.querySelector('.btn-remove-line').addEventListener('click', () => lineDiv.remove());
      modal.querySelector('#mov-lines-container').appendChild(lineDiv);
    }

    modal.querySelector('#btn-add-mov-line').addEventListener('click', addLineRow);
    addLineRow();
  });

  loadMovements();
}
