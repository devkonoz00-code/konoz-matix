/**
 * Dashboard Page Module
 */
import { api } from '../js/api.js';
import { formatMoney, formatDate, getMovementTypeBadge } from '../js/app.js';
import { i18n } from '../js/i18n.js';

export async function renderDashboard(container) {
  document.getElementById('page-title').textContent = i18n.t('nav_dashboard');

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
      <div>
        <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);" data-i18n="nav_dashboard">Dashboard</h2>
        <p style="color: var(--text-secondary); font-size: 0.85rem;">Global logistics, project balances & material ledger status</p>
      </div>
      <div style="display: flex; gap: 0.75rem;">
        <a href="#/scanner" class="btn btn-primary btn-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>
          <span data-i18n="btn_scan">Scan Barcode</span>
        </a>
        <a href="#/requests" class="btn btn-secondary btn-sm">
          <span data-i18n="btn_new_request">New Request</span>
        </a>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="grid-cols-4" id="dashboard-stats" style="margin-bottom: 1.5rem;">
      <div class="card stat-card">
        <div class="stat-icon blue">🏗️</div>
        <div class="stat-content">
          <div class="stat-label" data-i18n="dash_total_projects">Active Projects</div>
          <div class="stat-value" id="stat-active-projects">—</div>
          <div class="stat-subtext" id="stat-total-projects">Total Projects: —</div>
        </div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon cyan">📦</div>
        <div class="stat-content">
          <div class="stat-label" data-i18n="dash_total_items">Tracked Items</div>
          <div class="stat-value" id="stat-total-items">—</div>
          <div class="stat-subtext">Active catalog items</div>
        </div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon green">💰</div>
        <div class="stat-content">
          <div class="stat-label" data-i18n="dash_total_system_value">Total System Value</div>
          <div class="stat-value" id="stat-system-value">—</div>
          <div class="stat-subtext" id="stat-project-val-breakdown">Projects: —</div>
        </div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon purple">📜</div>
        <div class="stat-content">
          <div class="stat-label" data-i18n="dash_total_movements">Ledger Movements</div>
          <div class="stat-value" id="stat-movements">—</div>
          <div class="stat-subtext" id="stat-pending-req">Pending: —</div>
        </div>
      </div>
    </div>

    <!-- Project Values & Warehouse Values Split -->
    <div class="grid-cols-2">
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary);" data-i18n="dash_project_allocation">Value by Project</h3>
          <a href="#/projects" class="btn btn-sm btn-outline">View All</a>
        </div>
        <div id="project-value-list" style="display: flex; flex-direction: column; gap: 0.75rem;">
          <p style="color: var(--text-muted);">Loading project balances...</p>
        </div>
      </div>

      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary);">Warehouse Balances</h3>
          <a href="#/movements" class="btn btn-sm btn-outline">View Movements</a>
        </div>
        <div id="warehouse-value-list" style="display: flex; flex-direction: column; gap: 0.75rem;">
          <p style="color: var(--text-muted);">Loading warehouse values...</p>
        </div>
      </div>
    </div>

    <!-- Recent Movement Activity -->
    <div class="card" style="margin-top: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary);" data-i18n="dash_recent_movements">Recent Ledger Activity</h3>
        <a href="#/movements" class="btn btn-sm btn-outline">Full Ledger</a>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th data-i18n="lbl_last_movement">Movement #</th>
              <th>Type</th>
              <th>From</th>
              <th>To</th>
              <th>Created By</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody id="recent-movements-body">
            <tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Loading ledger...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  i18n.translateDOM(container);

  // Fetch Dashboard Data from Backend
  try {
    const res = await api.get('/reports/company-dashboard');
    if (res.success && res.data) {
      const { summary, projectValues, warehouseValues, recentMovements } = res.data;

      // Populate Stats
      document.getElementById('stat-active-projects').textContent = summary.activeProjects || 0;
      document.getElementById('stat-total-projects').textContent = `Total: ${summary.totalProjects || 0}`;
      document.getElementById('stat-total-items').textContent = summary.totalItems || 0;
      document.getElementById('stat-system-value').textContent = formatMoney(summary.totalSystemValue || 0);
      document.getElementById('stat-project-val-breakdown').textContent = `Sites: ${formatMoney(summary.totalProjectValue || 0)}`;
      document.getElementById('stat-movements').textContent = summary.totalMovements || 0;
      document.getElementById('stat-pending-req').textContent = `Pending: ${summary.pendingRequests || 0}`;

      // Project Values List (§9)
      const prjList = document.getElementById('project-value-list');
      if (projectValues && projectValues.length > 0) {
        prjList.innerHTML = projectValues.map(p => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--bg-surface-elevated); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div>
              <a href="#/projects/${p.project._id}" style="color: var(--text-primary); font-weight: 600; text-decoration: none;">${p.project.name}</a>
              <div style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">${p.project.projectCode}</div>
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; gap: 0.2rem;">
              <div style="font-size: 0.88rem; font-weight: 700; color: var(--primary);">
                ${formatMoney(p.currentValue || p.totalValue || 0)} <span style="font-size: 0.7rem; font-weight: 500; color: var(--text-muted);">(On-Hand)</span>
              </div>
              <div style="font-size: 0.78rem; font-weight: 600; color: var(--purple);">
                ${formatMoney(p.totalConsumption || 0)} <span style="font-size: 0.7rem; font-weight: 400; color: var(--text-muted);">(Total Consumption)</span>
              </div>
            </div>
          </div>
        `).join('');
      } else {
        prjList.innerHTML = `<p style="color: var(--text-muted);">No active projects found.</p>`;
      }

      // Warehouse Values List
      const whList = document.getElementById('warehouse-value-list');
      if (warehouseValues && warehouseValues.length > 0) {
        whList.innerHTML = warehouseValues.map(w => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--bg-surface-elevated); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div>
              <div style="font-weight: 600; color: var(--text-primary);">${w.warehouse.name}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${w.warehouse.code}</div>
            </div>
            <div style="font-weight: 700; color: var(--success);">${formatMoney(w.totalValue)}</div>
          </div>
        `).join('');
      } else {
        whList.innerHTML = `<p style="color: var(--text-muted);">No warehouses registered.</p>`;
      }

      // Recent Movements Table
      const movementsBody = document.getElementById('recent-movements-body');
      if (recentMovements && recentMovements.length > 0) {
        movementsBody.innerHTML = recentMovements.map(m => `
          <tr>
            <td><a href="#/movements" style="font-family: var(--font-mono); font-weight: 600; color: var(--primary);">${m.movementNumber}</a></td>
            <td>${getMovementTypeBadge(m.type)}</td>
            <td>${m.fromLocation ? `${m.fromLocation.kind}` : '<span style="color: var(--text-muted);">Supplier</span>'}</td>
            <td>${m.toLocation ? `${m.toLocation.kind}` : '—'}</td>
            <td>${m.createdBy?.fullName || 'System'}</td>
            <td>${formatDate(m.createdAt)}</td>
          </tr>
        `).join('');
      } else {
        movementsBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No movements recorded yet.</td></tr>`;
      }
    }
  } catch (err) {
    console.error('Error loading dashboard:', err);
  }
}
