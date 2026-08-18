/**
 * Project Detail & Material View Module (§9, §13)
 * Displays project site materials, live Current Value, and Total Consumption.
 */
import { api } from '../js/api.js';
import { formatMoney, formatDate, getStatusBadge, showToast, showModal } from '../js/app.js';
import { i18n } from '../js/i18n.js';

export async function renderProjectDetail(container, params) {
  const projectId = params.id;
  document.getElementById('page-title').textContent = 'Project Dashboard';

  container.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <a href="#/projects" class="btn btn-sm btn-outline" style="margin-bottom: 1rem;">&larr; Back to Projects</a>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;" id="project-header">
        <div>
          <span style="font-family: var(--font-mono); color: var(--primary); font-weight: 700;" id="prj-code">Loading...</span>
          <h2 style="font-size: 1.6rem; font-weight: 700; color: var(--text-primary); margin-top: 0.15rem;" id="prj-name">—</h2>
          <p style="color: var(--text-secondary); font-size: 0.85rem;" id="prj-loc">📍 —</p>
        </div>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button class="btn btn-primary btn-sm" id="btn-print-decharge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            <span>Print Décharge</span>
          </button>
          <a href="#/scanner" class="btn btn-outline btn-sm">
            <span data-i18n="btn_scan">Scan Item</span>
          </a>
          <a href="#/requests" class="btn btn-outline btn-sm">
            <span data-i18n="btn_new_request">New Request</span>
          </a>
          <a href="#/transfers" class="btn btn-secondary btn-sm">
            <span data-i18n="btn_new_transfer">Transfer Out</span>
          </a>
          <a href="#/returns" class="btn btn-outline btn-sm">
            <span data-i18n="btn_new_return">Return to WH</span>
          </a>
        </div>
      </div>
    </div>

    <!-- Project Metrics Grid (§9: Current Value & Total Consumption) -->
    <div class="grid-cols-4" style="margin-bottom: 1.5rem;">
      <div class="card stat-card">
        <div class="stat-icon green">💰</div>
        <div class="stat-content">
          <div class="stat-label">Current Value (On-Hand)</div>
          <div class="stat-value" id="stat-prj-current-value">—</div>
          <div class="stat-subtext">Materials currently on site</div>
        </div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon purple">📊</div>
        <div class="stat-content">
          <div class="stat-label">Total Consumption</div>
          <div class="stat-value" id="stat-prj-total-consumption">—</div>
          <div class="stat-subtext">Cumulative material received</div>
        </div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon cyan">👷</div>
        <div class="stat-content">
          <div class="stat-label">Site Management</div>
          <div class="stat-value" style="font-size: 1.1rem; padding-top: 0.4rem;" id="stat-prj-manager">—</div>
          <div class="stat-subtext" id="stat-prj-mgr-role">Active assignment</div>
        </div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon blue">📌</div>
        <div class="stat-content">
          <div class="stat-label">Project Status</div>
          <div class="stat-value" style="font-size: 1.1rem; padding-top: 0.4rem;" id="stat-prj-status">—</div>
          <div class="stat-subtext" id="stat-prj-items-count">0 items on site</div>
        </div>
      </div>
    </div>

    <!-- Live Project Materials Table (Derived Stock) -->
    <div class="card" style="margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <div>
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">Site Materials & Equipment Inventory</h3>
          <p style="font-size: 0.78rem; color: var(--text-muted);">
            Derived dynamically from confirmed movement lines (Receipts, Issues, Transfers, Returns). Never stored as a mutable balance.
          </p>
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th data-i18n="lbl_item_code">Item Code</th>
              <th data-i18n="lbl_name">Item Name</th>
              <th data-i18n="lbl_category">Category</th>
              <th>Type</th>
              <th data-i18n="lbl_quantity">Current Qty</th>
              <th>Unit Price</th>
              <th data-i18n="lbl_total_value">Total Value</th>
              <th data-i18n="lbl_actions">Actions</th>
            </tr>
          </thead>
          <tbody id="project-materials-body">
            <tr><td colspan="8" style="text-align: center; color: var(--text-muted);">Calculating live ledger balances...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Assigned Team Members History -->
    <div class="card">
      <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">Site Responsibility & Assignment Log</h3>
      <div id="project-members-list" style="display: flex; flex-direction: column; gap: 0.75rem;">
        <p style="color: var(--text-muted);">Loading team members...</p>
      </div>
    </div>
  `;

  i18n.translateDOM(container);

  try {
    const res = await api.get(`/projects/${projectId}/dashboard`);
    if (res.success && res.data) {
      const { project, currentValue, totalConsumption, totalMaterialValue, materialCount, members, materials } = res.data;

      const liveCurrentVal = currentValue !== undefined ? currentValue : (totalMaterialValue || 0);

      document.getElementById('prj-code').textContent = project.projectCode;
      document.getElementById('prj-name').textContent = project.name;
      document.getElementById('prj-loc').textContent = `📍 ${project.location || 'Location unspecified'}`;
      document.getElementById('stat-prj-current-value').textContent = formatMoney(liveCurrentVal);
      document.getElementById('stat-prj-total-consumption').textContent = formatMoney(totalConsumption || 0);
      document.getElementById('stat-prj-items-count').textContent = `${materialCount || 0} distinct items on site`;
      document.getElementById('stat-prj-status').innerHTML = getStatusBadge(project.status);

      // Active PM
      const activeMember = members?.find(m => m.isActive);
      if (activeMember && activeMember.userId) {
        document.getElementById('stat-prj-manager').textContent = activeMember.userId.fullName;
        document.getElementById('stat-prj-mgr-role').textContent = activeMember.role;
      } else {
        document.getElementById('stat-prj-manager').textContent = 'Unassigned';
      }

      // Populate Materials Table
      const matBody = document.getElementById('project-materials-body');
      if (materials && materials.length > 0) {
        matBody.innerHTML = materials.map(m => `
          <tr>
            <td><a href="#/items/${m.item?._id}" style="font-family: var(--font-mono); font-weight: 600; color: var(--primary);">${m.item?.itemCode || '—'}</a></td>
            <td>
              <div style="font-weight: 600; color: var(--text-primary);">${m.item?.name || 'Unknown Item'}</div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">${m.item?.brand || ''} ${m.item?.model || ''}</div>
            </td>
            <td><span class="badge badge-secondary">${m.item?.categoryId?.name || 'General'}</span></td>
            <td><span class="badge badge-info">${m.item?.itemType || 'MATERIAL'}</span></td>
            <td style="font-weight: 700; color: var(--accent-cyan); font-size: 1rem;">
              ${m.quantity} <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 400;">${m.item?.unit || 'units'}</span>
            </td>
            <td>${formatMoney(m.item?.unitPrice || 0)}</td>
            <td style="font-weight: 700; color: var(--text-primary);">${formatMoney(m.value || 0)}</td>
            <td>
              <div style="display: flex; gap: 0.35rem;">
                <a href="#/items/labels?ids=${m.item?._id}" class="btn btn-sm btn-outline" title="Print Label">🖨️</a>
                <a href="#/items/${m.item?._id}" class="btn btn-sm btn-outline">Life of Item &rarr;</a>
              </div>
            </td>
          </tr>
        `).join('');
      } else {
        matBody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">No materials currently on site according to confirmed movement ledger records.</td></tr>`;
      }

      // Members List
      const membersList = document.getElementById('project-members-list');
      if (members && members.length > 0) {
        membersList.innerHTML = members.map(mem => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--bg-surface-elevated); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div>
              <div style="font-weight: 600; color: var(--text-primary);">${mem.userId?.fullName || 'User'} <span style="font-size: 0.75rem; color: var(--text-muted);">(${mem.userId?.email || ''})</span></div>
              <div style="font-size: 0.75rem; color: var(--primary); font-weight: 600;">${mem.role}</div>
            </div>
            <div style="text-align: right; font-size: 0.75rem; color: var(--text-muted);">
              <div>Assigned: ${formatDate(mem.startDate).split(',')[0]}</div>
              <span class="badge ${mem.isActive ? 'badge-success' : 'badge-secondary'}">${mem.isActive ? 'Active' : 'Past Assignment'}</span>
            </div>
          </div>
        `).join('');
      } else {
        membersList.innerHTML = `<p style="color: var(--text-muted);">No assigned team members.</p>`;
      }
    }
  } catch (err) {
    showToast(err.message, 'error');
  }

  // Bind Print Décharge Button (§9, §13)
  document.getElementById('btn-print-decharge')?.addEventListener('click', async () => {
    try {
      const res = await api.get(`/projects/${projectId}/decharge`);
      if (!res.success || !res.data) throw new Error('Failed to load Décharge data');

      const { project, lines, grandTotal, generatedAt } = res.data;

      const printContent = `
        <div id="decharge-printable" class="decharge-document" style="font-family: var(--font-sans); color: #0f172a; background: #fff; padding: 1.5rem;">
          <div style="border-bottom: 2px solid #0f172a; padding-bottom: 1rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div style="font-size: 0.85rem; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.05em;">MATIX Logistics System</div>
              <h2 style="font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 0.2rem 0;">DÉCHARGE DE MATÉRIEL / BON DE DÉLIVRANCE</h2>
              <div style="font-size: 0.9rem; color: #475569;">Project: <strong>${project.name}</strong> (${project.projectCode})</div>
              <div style="font-size: 0.85rem; color: #64748b;">Site Location: ${project.location || 'N/A'}</div>
            </div>
            <div style="text-align: right; font-size: 0.85rem; color: #475569;">
              <div>Date d'émission: <strong>${formatDate(generatedAt)}</strong></div>
              <div>Régime monétaire: <strong>DZD (Algerian Dinar)</strong></div>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.85rem;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
                <th style="padding: 8px 10px; border: 1px solid #cbd5e1;"># Code</th>
                <th style="padding: 8px 10px; border: 1px solid #cbd5e1;">Désignation / Article</th>
                <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">Unité</th>
                <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right;">Quantité Cumulée</th>
                <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right;">Prix Unitaire</th>
                <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right;">Total Ligne (DZD)</th>
              </tr>
            </thead>
            <tbody>
              ${lines.length === 0 ? `
                <tr><td colspan="6" style="padding: 1.5rem; text-align: center; color: #64748b; border: 1px solid #cbd5e1;">Aucun matériel délivré à ce projet.</td></tr>
              ` : lines.map(l => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: 600;">${l.itemCode}</td>
                  <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 600;">${l.name}</td>
                  <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">${l.unit}</td>
                  <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right; font-weight: 700;">${l.quantity}</td>
                  <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right;">${formatMoney(l.unitPrice)}</td>
                  <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right; font-weight: 700;">${formatMoney(l.totalCost)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background: #f8fafc; font-weight: 800; font-size: 0.95rem;">
                <td colspan="5" style="padding: 10px; text-align: right; border: 1px solid #cbd5e1; text-transform: uppercase;">
                  Consommation Totale Cumulée (Grand Total):
                </td>
                <td style="padding: 10px; text-align: right; border: 1px solid #cbd5e1; color: #1e3a8a; font-size: 1.1rem;">
                  ${formatMoney(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 3rem; padding-top: 1rem; page-break-inside: avoid;">
            <div style="border-top: 1px dashed #64748b; padding-top: 0.5rem; text-align: center;">
              <div style="font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 2.5rem;">Délivré par (Magasinier / Responsable Dépôt)</div>
              <div style="font-size: 0.75rem; color: #94a3b8;">Nom, Date & Signature</div>
            </div>
            <div style="border-top: 1px dashed #64748b; padding-top: 0.5rem; text-align: center;">
              <div style="font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 2.5rem;">Reçu par (Chef de Projet / Superviseur Chantier)</div>
              <div style="font-size: 0.75rem; color: #94a3b8;">Nom, Date & Signature</div>
            </div>
          </div>
        </div>
      `;

      const modal = showModal({
        title: `Print Décharge — ${project.name}`,
        content: `
          <div class="no-print" style="margin-bottom: 1rem; display: flex; justify-content: flex-end;">
            <button class="btn btn-primary" id="btn-do-print-decharge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              <span>Imprimer la Décharge (A4)</span>
            </button>
          </div>
          <div style="max-height: 60vh; overflow-y: auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
            ${printContent}
          </div>
        `,
        cancelText: 'Close',
      });

      modal.querySelector('#btn-do-print-decharge')?.addEventListener('click', () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Décharge — ${project.name} (${project.projectCode})</title>
            <style>
              @page { size: A4; margin: 15mm; }
              body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; }
              * { box-sizing: border-box; }
            </style>
          </head>
          <body>
            ${printContent}
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
          </html>
        `);
        printWindow.document.close();
      });

    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

