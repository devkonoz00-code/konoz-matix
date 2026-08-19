/**
 * Project-to-Warehouse Returns Workflow Module
 */
import { api } from '../js/api.js';
import { formatDate, getStatusBadge, showToast, showModal } from '../js/app.js';
import { i18n } from '../js/i18n.js';

export async function renderReturns(container) {
  document.getElementById('page-title').textContent = i18n.t('nav_returns');

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
      <div>
        <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);" data-i18n="nav_returns">Returns to Central Warehouse</h2>
        <p style="color: var(--text-secondary); font-size: 0.85rem;">Submit &rarr; Confirm workflow for surplus or finished tools returning from site to storage</p>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-initiate-return">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span data-i18n="btn_new_return">Initiate Return</span>
      </button>
    </div>

    <!-- Returns Table -->
    <div class="card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Return #</th>
              <th>Source Project</th>
              <th>Destination Warehouse</th>
              <th>Status</th>
              <th>Initiated By</th>
              <th>Date</th>
              <th data-i18n="lbl_actions">Actions</th>
            </tr>
          </thead>
          <tbody id="returns-table-body">
            <tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Loading returns...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  i18n.translateDOM(container);

  async function loadReturns() {
    const tbody = document.getElementById('returns-table-body');
    try {
      const [retRes, prjRes, whRes] = await Promise.all([
        api.get('/returns'),
        api.get('/projects'),
        api.get('/warehouses'),
      ]);

      const returns = retRes.data || [];
      const prjMap = Object.fromEntries((prjRes.data || []).map(p => [p._id, `${p.projectCode} — ${p.name}`]));
      const whMap = Object.fromEntries((whRes.data || []).map(w => [w._id, w.name]));

      if (returns.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No warehouse returns recorded.</td></tr>`;
        return;
      }

      tbody.innerHTML = returns.map(r => {
        const fromPrj = prjMap[r.fromLocation?.id] || 'Source Project';
        const toWh = whMap[r.toLocation?.id] || 'Destination Warehouse';
        const isPending = r.status === 'PENDING';

        return `
          <tr>
            <td style="font-family: var(--font-mono); font-weight: 600; color: var(--warning);">${r.movementNumber}</td>
            <td style="font-weight: 600; color: #fff;">${fromPrj}</td>
            <td style="font-weight: 600; color: var(--accent-cyan);">${toWh}</td>
            <td>${getStatusBadge(r.status)}</td>
            <td>${r.createdBy?.fullName || 'PM'}</td>
            <td>${formatDate(r.createdAt)}</td>
            <td>
              ${isPending ? `<button class="btn btn-sm btn-success btn-confirm-return" data-id="${r._id}">Confirm at Warehouse</button>` : `<span class="badge badge-success">Completed</span>`}
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.btn-confirm-return').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          try {
            await api.patch(`/returns/${id}/confirm`);
            showToast('Return confirmed! Material stock restored to central warehouse balance.', 'success');
            loadReturns();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });

    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Initiate Return Modal
  document.getElementById('btn-initiate-return').addEventListener('click', async () => {
    const [prjRes, whRes, itmRes] = await Promise.all([
      api.get('/projects?status=ACTIVE'),
      api.get('/warehouses'),
      api.get('/items'),
    ]);

    const projects = prjRes.data || [];
    const warehouses = whRes.data || [];
    const items = itmRes.data || [];

    const content = `
      <form id="form-initiate-return">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Returning Project Site</label>
            <select id="inp-ret-source" class="form-select" required>
              ${projects.map(p => `<option value="${p._id}">${p.projectCode} — ${p.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Destination Warehouse</label>
            <select id="inp-ret-dest" class="form-select" required>
              ${warehouses.map(w => `<option value="${w._id}">${w.name}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Reason for Return</label>
          <input type="text" id="inp-ret-note" class="form-control" placeholder="E.g. Surplus dry cement bags returned after slab completion">
        </div>

        <div style="margin-top: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <label class="form-label" style="margin-bottom: 0;">Returning Items List</label>
            <button type="button" class="btn btn-sm btn-outline" id="btn-add-ret-line">+ Add Line</button>
          </div>
          <div id="ret-lines-container" style="display: flex; flex-direction: column; gap: 0.75rem;"></div>
        </div>
      </form>
    `;

    const retKey = 'ret_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);

    const modal = showModal({
      title: 'Initiate Return to Warehouse',
      content,
      confirmText: 'Submit Return',
      onConfirm: async () => {
        const sourceId = document.getElementById('inp-ret-source').value;
        const destId = document.getElementById('inp-ret-dest').value;
        const note = document.getElementById('inp-ret-note').value.trim();

        const lineRows = document.querySelectorAll('.ret-line-row');
        const lines = [];
        lineRows.forEach(row => {
          const itemId = row.querySelector('.sel-item').value;
          const qty = parseFloat(row.querySelector('.inp-qty').value);
          if (itemId && qty > 0) {
            lines.push({ itemId, quantity: qty });
          }
        });

        if (lines.length === 0) {
          showToast('Please add at least one line item', 'error');
          return false;
        }

        try {
          await api.post('/returns', {
            fromLocation: { kind: 'PROJECT', id: sourceId },
            toLocation: { kind: 'WAREHOUSE', id: destId },
            note,
            lines,
          }, {
            headers: { 'Idempotency-Key': retKey }
          });
          showToast(i18n.t('msg_return_submitted'), 'success');
          loadReturns();
          return true;
        } catch (err) {
          showToast(err.message, 'error');
          return false;
        }
      }
    });

    function addLineRow() {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'ret-line-row';
      lineDiv.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr auto; gap: 0.5rem; align-items: center; background: var(--bg-surface-elevated); padding: 0.5rem; border-radius: var(--radius-md);';
      lineDiv.innerHTML = `
        <select class="form-select sel-item">
          ${items.map(i => `<option value="${i._id}">${i.itemCode} — ${i.name} (${i.unit})</option>`).join('')}
        </select>
        <input type="number" step="0.01" class="form-control inp-qty" placeholder="Quantity" value="1" min="0.01" required>
        <button type="button" class="icon-button btn-remove-line" style="color: var(--danger); width: 32px; height: 32px;">&times;</button>
      `;
      lineDiv.querySelector('.btn-remove-line').addEventListener('click', () => lineDiv.remove());
      modal.querySelector('#ret-lines-container').appendChild(lineDiv);
    }

    modal.querySelector('#btn-add-ret-line').addEventListener('click', addLineRow);
    addLineRow();
  });

  loadReturns();
}
