/**
 * Reports & Data Exports Page Module
 */
import { api } from '../js/api.js';
import { showToast } from '../js/app.js';
import { i18n } from '../js/i18n.js';

export function renderReports(container) {
  document.getElementById('page-title').textContent = i18n.t('nav_reports');

  container.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);" data-i18n="nav_reports">Reports & Data Exports</h2>
      <p style="color: var(--text-secondary); font-size: 0.85rem;">Download raw ledger snapshots, material inventories and movement archives in CSV / Excel</p>
    </div>

    <div class="grid-cols-2">
      <!-- Items Export Card -->
      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">📦</div>
          <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">Items & Material Catalog</h3>
          <p style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.4; margin-bottom: 1.25rem;">
            Export the complete tracked items catalog including item codes, current cost prices, units, barcodes and categories.
          </p>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <button class="btn btn-primary btn-sm btn-export" data-type="items" data-format="xlsx">
            <span>Export Excel (.xlsx)</span>
          </button>
          <button class="btn btn-outline btn-sm btn-export" data-type="items" data-format="csv">
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <!-- Movements Ledger Export Card -->
      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">📜</div>
          <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">Movement Ledger History</h3>
          <p style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.4; margin-bottom: 1.25rem;">
            Download every immutable ledger event (Receipts, Issues, Transfers, Returns) with frozen historical costs, from/to locations and timestamps.
          </p>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <button class="btn btn-primary btn-sm btn-export" data-type="movements" data-format="xlsx">
            <span>Export Excel (.xlsx)</span>
          </button>
          <button class="btn btn-outline btn-sm btn-export" data-type="movements" data-format="csv">
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <!-- Requests Export Card -->
      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">📝</div>
          <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">Material Requests Archive</h3>
          <p style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.4; margin-bottom: 1.25rem;">
            Export all site material demands, approvals, rejections and fulfillment records across projects.
          </p>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <button class="btn btn-primary btn-sm btn-export" data-type="requests" data-format="xlsx">
            <span>Export Excel (.xlsx)</span>
          </button>
          <button class="btn btn-outline btn-sm btn-export" data-type="requests" data-format="csv">
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <!-- Operational Backup Note -->
      <div class="card" style="background: rgba(37,99,235,0.08); border-color: rgba(37,99,235,0.3);">
        <div style="font-size: 1.75rem; margin-bottom: 0.5rem;">🛡️</div>
        <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--accent-cyan); margin-bottom: 0.25rem;">Data Integrity & Backup Note</h3>
        <p style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.5;">
          Per §14 of the architecture specification, all balances are derived deterministically from confirmed movement lines. Automated exports provide offline analytical snapshots. Regular database dumps (<code>mongodump</code>) are recommended for disaster recovery.
        </p>
      </div>
    </div>
  `;

  i18n.translateDOM(container);

  // Bind Export Buttons
  container.querySelectorAll('.btn-export').forEach(btn => {
    btn.addEventListener('click', async () => {
      const type = btn.getAttribute('data-type');
      const format = btn.getAttribute('data-format');
      btn.disabled = true;
      const originalText = btn.innerHTML;
      btn.innerHTML = '<span>Exporting...</span>';

      try {
        await api.downloadExport(type, format);
        showToast(`${type.toUpperCase()} exported to ${format.toUpperCase()} successfully`, 'success');
      } catch (err) {
        showToast(err.message || 'Export failed', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });
  });
}
