/**
 * Project-to-Project Transfers Workflow Module
 */
import { api } from '../js/api.js';
import { formatDate, getStatusBadge, showToast, showModal } from '../js/app.js';
import { i18n } from '../js/i18n.js';

export async function renderTransfers(container) {
  document.getElementById('page-title').textContent = i18n.t('nav_transfers');

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
      <div>
        <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);" data-i18n="nav_transfers">Site Transfers (Project → Project)</h2>
        <p style="color: var(--text-secondary); font-size: 0.85rem;">Submit &rarr; Confirm workflow for materials moving between construction sites</p>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-initiate-transfer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span data-i18n="btn_new_transfer">Initiate Transfer</span>
      </button>
    </div>

    <!-- Transfers Table -->
    <div class="card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Transfer #</th>
              <th>Source Project</th>
              <th>Destination Project</th>
              <th>Status</th>
              <th>Initiated By</th>
              <th>Date</th>
              <th data-i18n="lbl_actions">Actions</th>
            </tr>
          </thead>
          <tbody id="transfers-table-body">
            <tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Loading transfers...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  i18n.translateDOM(container);

  async function loadTransfers() {
    const tbody = document.getElementById('transfers-table-body');
    try {
      const [transRes, prjRes] = await Promise.all([
        api.get('/transfers'),
        api.get('/projects'),
      ]);

      const transfers = transRes.data || [];
      const prjMap = Object.fromEntries((prjRes.data || []).map(p => [p._id, `${p.projectCode} — ${p.name}`]));

      if (transfers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No inter-project transfers recorded.</td></tr>`;
        return;
      }

      tbody.innerHTML = transfers.map(t => {
        const fromPrj = prjMap[t.fromLocation?.id] || 'Source Project';
        const toPrj = prjMap[t.toLocation?.id] || 'Destination Project';
        const isPending = t.status === 'PENDING';

        return `
          <tr>
            <td style="font-family: var(--font-mono); font-weight: 600; color: var(--purple);">${t.movementNumber}</td>
            <td style="font-weight: 600; color: #fff;">${fromPrj}</td>
            <td style="font-weight: 600; color: var(--accent-cyan);">${toPrj}</td>
            <td>${getStatusBadge(t.status)}</td>
            <td>${t.createdBy?.fullName || 'PM'}</td>
            <td>${formatDate(t.createdAt)}</td>
            <td>
              ${isPending ? `<button class="btn btn-sm btn-success btn-confirm-transfer" data-id="${t._id}"><span data-i18n="btn_receive">Confirm Receipt</span></button>` : `<span class="badge badge-success">Completed</span>`}
            </td>
          </tr>
        `;
      }).join('');

      // Bind Confirm Button
      tbody.querySelectorAll('.btn-confirm-transfer').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          try {
            await api.patch(`/transfers/${id}/confirm`);
            showToast('Transfer confirmed! Material stock now resolved at destination project site.', 'success');
            loadTransfers();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });

    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Initiate Transfer Modal
  document.getElementById('btn-initiate-transfer').addEventListener('click', async () => {
    const [prjRes, itmRes] = await Promise.all([
      api.get('/projects?status=ACTIVE'),
      api.get('/items'),
    ]);

    const projects = prjRes.data || [];
    const items = itmRes.data || [];

    const content = `
      <form id="form-initiate-transfer">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Source Project (Sending)</label>
            <select id="inp-trf-source" class="form-select" required>
              ${projects.map(p => `<option value="${p._id}">${p.projectCode} — ${p.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Destination Project (Receiving)</label>
            <select id="inp-trf-dest" class="form-select" required>
              ${projects.map((p, idx) => `<option value="${p._id}" ${idx === 1 ? 'selected' : ''}>${p.projectCode} — ${p.name}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Transfer Note / Reason</label>
          <input type="text" id="inp-trf-note" class="form-control" placeholder="E.g. Urgent machine transfer for site drilling">
        </div>

        <div style="margin-top: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <label class="form-label" style="margin-bottom: 0;">Transfer Line Items</label>
            <button type="button" class="btn btn-sm btn-outline" id="btn-add-trf-line">+ Add Line</button>
          </div>
          <div id="trf-lines-container" style="display: flex; flex-direction: column; gap: 0.75rem;"></div>
        </div>
      </form>
    `;

    const modal = showModal({
      title: 'Initiate Inter-Project Transfer',
      content,
      confirmText: 'Submit Transfer',
      onConfirm: async () => {
        const sourceId = document.getElementById('inp-trf-source').value;
        const destId = document.getElementById('inp-trf-dest').value;
        const note = document.getElementById('inp-trf-note').value.trim();

        if (sourceId === destId) {
          showToast('Source and Destination project cannot be the same', 'error');
          return false;
        }

        const lineRows = document.querySelectorAll('.trf-line-row');
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
          await api.post('/transfers', {
            fromLocation: { kind: 'PROJECT', id: sourceId },
            toLocation: { kind: 'PROJECT', id: destId },
            note,
            lines,
          });
          showToast(i18n.t('msg_transfer_submitted'), 'success');
          loadTransfers();
          return true;
        } catch (err) {
          showToast(err.message, 'error');
          return false;
        }
      }
    });

    function addLineRow() {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'trf-line-row';
      lineDiv.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr auto; gap: 0.5rem; align-items: center; background: var(--bg-surface-elevated); padding: 0.5rem; border-radius: var(--radius-md);';
      lineDiv.innerHTML = `
        <select class="form-select sel-item">
          ${items.map(i => `<option value="${i._id}">${i.itemCode} — ${i.name} (${i.unit})</option>`).join('')}
        </select>
        <input type="number" step="0.01" class="form-control inp-qty" placeholder="Quantity" value="1" min="0.01" required>
        <button type="button" class="icon-button btn-remove-line" style="color: var(--danger); width: 32px; height: 32px;">&times;</button>
      `;
      lineDiv.querySelector('.btn-remove-line').addEventListener('click', () => lineDiv.remove());
      modal.querySelector('#trf-lines-container').appendChild(lineDiv);
    }

    modal.querySelector('#btn-add-trf-line').addEventListener('click', addLineRow);
    addLineRow();
  });

  loadTransfers();
}
