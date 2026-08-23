/**
 * Immutable Audit Logs Viewer Module
 */
import { api } from '../js/api.js';
import { formatDate, showToast, showModal, escapeHtml } from '../js/app.js';
import { i18n } from '../js/i18n.js';

export async function renderAuditLogs(container) {
  document.getElementById('page-title').textContent = i18n.t('nav_audit_logs');

  container.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);" data-i18n="nav_audit_logs">Audit Trail & Compliance Log</h2>
      <p style="color: var(--text-secondary); font-size: 0.85rem;">Immutable tamper-evident record of all sensitive actions, movements & state transitions</p>
    </div>

    <!-- Filters -->
    <div class="card" style="margin-bottom: 1.5rem; padding: 1rem;">
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <div style="width: 200px;">
          <select id="audit-action-filter" class="form-select">
            <option value="">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="APPROVE">APPROVE</option>
            <option value="ISSUE">ISSUE</option>
            <option value="TRANSFER">TRANSFER</option>
            <option value="RETURN">RETURN</option>
            <option value="RECEIVE">RECEIVE</option>
            <option value="LOGIN">LOGIN</option>
            <option value="LOGOUT">LOGOUT</option>
          </select>
        </div>
        <div style="width: 200px;">
          <select id="audit-entity-filter" class="form-select">
            <option value="">All Entity Types</option>
            <option value="Movement">Movement</option>
            <option value="MaterialRequest">MaterialRequest</option>
            <option value="Item">Item</option>
            <option value="Project">Project</option>
            <option value="ProjectAssignment">ProjectAssignment</option>
            <option value="User">User</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Audit Logs Table -->
    <div class="card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Entity Type</th>
              <th>User</th>
              <th>IP Address</th>
              <th>State Snapshot</th>
            </tr>
          </thead>
          <tbody id="audit-table-body">
            <tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Loading audit records...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  i18n.translateDOM(container);

  async function loadLogs() {
    const action = document.getElementById('audit-action-filter')?.value || '';
    const entityType = document.getElementById('audit-entity-filter')?.value || '';
    const tbody = document.getElementById('audit-table-body');

    try {
      const res = await api.get('/audit-logs', { action, entityType });
      const logs = res.data?.logs || [];

      if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No audit records found matching criteria.</td></tr>`;
        return;
      }

      tbody.innerHTML = logs.map(l => {
        const actionCls = {
          CREATE: 'badge-success',
          ISSUE: 'badge-info',
          TRANSFER: 'badge-purple',
          RETURN: 'badge-warning',
          RECEIVE: 'badge-success',
          APPROVE: 'badge-info',
          DELETE: 'badge-danger',
          LOGIN: 'badge-secondary',
          LOGOUT: 'badge-secondary',
        }[l.action] || 'badge-secondary';

        const safeAction = escapeHtml(l.action);
        const safeEntity = escapeHtml(l.entityType);
        const safeUser = escapeHtml(l.userId?.fullName || 'System');
        const safeRole = escapeHtml(l.userId?.role || '');
        const safeIp = escapeHtml(l.ip || '—');

        return `
          <tr>
            <td style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-secondary);">${formatDate(l.timestamp)}</td>
            <td><span class="badge ${actionCls}">${safeAction}</span></td>
            <td style="font-weight: 600; color: #fff;">${safeEntity}</td>
            <td>
              <div>${safeUser}</div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">${safeRole}</div>
            </td>
            <td style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">${safeIp}</td>
            <td>
              <button class="btn btn-sm btn-outline btn-view-diff" data-log='${JSON.stringify(l).replace(/'/g, "&apos;")}'>View Diff</button>
            </td>
          </tr>
        `;
      }).join('');

      // Bind Diff Modal
      tbody.querySelectorAll('.btn-view-diff').forEach(btn => {
        btn.addEventListener('click', () => {
          const logData = JSON.parse(btn.getAttribute('data-log'));
          showModal({
            title: `Audit Event Snapshot — ${logData.action} ${logData.entityType}`,
            content: `
              <div style="font-size: 0.85rem; margin-bottom: 1rem;">
                <div><strong>User:</strong> ${logData.userId?.fullName} (${logData.userId?.email})</div>
                <div><strong>Timestamp:</strong> ${formatDate(logData.timestamp)}</div>
                <div><strong>Entity ID:</strong> <code>${logData.entityId || '—'}</code></div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                  <div style="font-weight: 700; color: var(--text-muted); margin-bottom: 0.35rem;">BEFORE:</div>
                  <pre style="background: var(--bg-main); padding: 0.75rem; border-radius: var(--radius-md); font-size: 0.75rem; color: var(--text-secondary); overflow-x: auto; max-height: 200px;">${JSON.stringify(logData.before, null, 2) || 'null'}</pre>
                </div>
                <div>
                  <div style="font-weight: 700; color: var(--accent-cyan); margin-bottom: 0.35rem;">AFTER:</div>
                  <pre style="background: var(--bg-main); padding: 0.75rem; border-radius: var(--radius-md); font-size: 0.75rem; color: var(--text-secondary); overflow-x: auto; max-height: 200px;">${JSON.stringify(logData.after, null, 2) || 'null'}</pre>
                </div>
              </div>
            `,
            cancelText: 'Close',
          });
        });
      });

    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  document.getElementById('audit-action-filter').addEventListener('change', loadLogs);
  document.getElementById('audit-entity-filter').addEventListener('change', loadLogs);

  loadLogs();
}
