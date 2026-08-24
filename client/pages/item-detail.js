/**
 * Item Detail ("Life of the Item") Page Module (§11, §12, §13)
 * Displays item identity, active location balances, barcodes, and chronological movement ledger history.
 */
import { api } from '../js/api.js';
import { formatMoney, formatDate, getMovementTypeBadge, showToast, showModal } from '../js/app.js';
import { i18n } from '../js/i18n.js';
import { openEditItemModal } from './items.js';

export async function renderItemDetail(container, params) {
  const itemId = params.id;
  document.getElementById('page-title').textContent = 'Life of the Item';

  container.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <a href="#/items" class="btn btn-sm btn-outline" style="margin-bottom: 1rem;">&larr; Back to Catalog</a>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
        <div style="display: flex; gap: 1.25rem; align-items: center; flex-wrap: wrap;">
          <div id="itm-photo-container" style="width: 84px; height: 84px; border-radius: var(--radius-md); overflow: hidden; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: var(--shadow-sm);">
            <span style="font-size: 2rem; color: var(--text-muted);">📦</span>
          </div>
          <div>
            <span style="font-family: var(--font-mono); color: var(--primary); font-weight: 700;" id="itm-code">Loading...</span>
            <h2 style="font-size: 1.6rem; font-weight: 700; color: var(--text-primary); margin-top: 0.15rem;" id="itm-name">—</h2>
            <p style="color: var(--text-secondary); font-size: 0.85rem;" id="itm-meta">—</p>
          </div>
        </div>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button class="btn btn-success btn-sm" id="btn-detail-receive-stock">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
            <span>📥 تحديث المخزون / استلام بالمستودع</span>
          </button>
          <button class="btn btn-outline btn-sm" id="btn-detail-edit-item" style="display: none; color: var(--primary); border-color: rgba(59, 130, 246, 0.4);" title="تعديل بيانات المادة (للأدمن فقط)">
            <span>✏️ تعديل المادة</span>
          </button>
          <a href="#/items/labels?ids=${itemId}" class="btn btn-primary btn-sm" id="btn-print-item-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            <span data-i18n="btn_print_barcode">Print Label (≤10cm)</span>
          </a>
          <button class="btn btn-secondary btn-sm" id="btn-add-barcode">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span data-i18n="btn_add_barcode">Attach Barcode</span>
          </button>
          <a href="#/scanner" class="btn btn-outline btn-sm">
            <span data-i18n="btn_scan">Scan</span>
          </a>
          <button class="btn btn-outline btn-sm" id="btn-detail-delete-item" style="display: none; color: var(--danger); border-color: rgba(239, 68, 68, 0.4);" title="حذف المادة">
            <span>🗑️ حذف المادة</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Item Identity Cards -->
    <div class="grid-cols-4" style="margin-bottom: 1.5rem;">
      <div class="card stat-card">
        <div class="stat-icon cyan">🏷️</div>
        <div class="stat-content">
          <div class="stat-label">Current Unit Cost</div>
          <div class="stat-value" id="itm-cost">—</div>
          <div class="stat-subtext" id="itm-type">Type: —</div>
        </div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon green">📊</div>
        <div class="stat-content">
          <div class="stat-label">Global Total In Stock</div>
          <div class="stat-value" id="itm-total-qty">—</div>
          <div class="stat-subtext" id="itm-unit">Unit: —</div>
        </div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon blue">📍</div>
        <div class="stat-content">
          <div class="stat-label">Current Locations</div>
          <div class="stat-value" style="font-size: 1.1rem; padding-top: 0.3rem;" id="itm-locations-summary">—</div>
          <div class="stat-subtext">Active derived balances</div>
        </div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon purple">🔲</div>
        <div class="stat-content">
          <div class="stat-label">Registered Barcodes</div>
          <div class="stat-value" style="font-size: 1.1rem; padding-top: 0.3rem;" id="itm-barcode-count">—</div>
          <div class="stat-subtext" id="itm-primary-barcode">—</div>
        </div>
      </div>
    </div>

    <!-- Current Stock By Location Table -->
    <div class="card" style="margin-bottom: 1.5rem;">
      <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">Current Stock Distribution Across Locations</h3>
      <p style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 1rem;">
        Derived dynamically from confirmed movement history — never stored as a mutable balance.
      </p>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Location Type</th>
              <th>Location Name / Site</th>
              <th>Responsible Party</th>
              <th>Quantity Present</th>
              <th>Current Valuation</th>
            </tr>
          </thead>
          <tbody id="item-locations-table-body">
            <tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Calculating distribution...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Barcodes Collection -->
    <div class="card" style="margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary);">Associated Barcodes & QR Identifiers</h3>
        <a href="#/items/labels?ids=${itemId}" class="btn btn-sm btn-outline">🖨️ Print Label</a>
      </div>
      <p style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.75rem;">
        Click any barcode below to view and print its physical scannable label.
      </p>
      <div id="item-barcodes-list" style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
        <p style="color: var(--text-muted);">Loading barcodes...</p>
      </div>
    </div>

    <!-- Chronological Movement History (The Ledger) -->
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <div>
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);" data-i18n="btn_view_history">Full Chronological Movement History</h3>
          <p style="font-size: 0.78rem; color: var(--text-muted);">
            Complete immutable ledger trace showing every hop between Warehouses and Projects with frozen cost snapshots.
          </p>
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Movement #</th>
              <th>Type</th>
              <th>From Location</th>
              <th>To Location</th>
              <th>Quantity Moved</th>
              <th>Frozen Unit Cost</th>
              <th>Total Value</th>
              <th>Recorded By</th>
              <th>Date & Time</th>
            </tr>
          </thead>
          <tbody id="item-history-table-body">
            <tr><td colspan="9" style="text-align: center; color: var(--text-muted);">Loading movement trace...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  i18n.translateDOM(container);

  try {
    const [itemRes, historyRes, whRes, prjRes] = await Promise.all([
      api.get(`/items/${itemId}`),
      api.get(`/items/${itemId}/history`),
      api.get('/warehouses'),
      api.get('/projects'),
    ]);

    const item = itemRes.data;
    const history = historyRes.data || [];
    const warehouses = whRes.data || [];
    const projects = prjRes.data || [];

    const whMap = Object.fromEntries(warehouses.map(w => [w._id, w.name]));
    const prjMap = Object.fromEntries(projects.map(p => [p._id, `${p.projectCode} — ${p.name}`]));

    // Populate Item Identity
    const photoContainer = document.getElementById('itm-photo-container');
    if (photoContainer) {
      if (item.imageUrl) {
        photoContainer.innerHTML = `<img src="${item.imageUrl}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='<span style=\\'font-size: 2rem; color: var(--text-muted);\\'>📦</span>';">`;
      } else {
        photoContainer.innerHTML = `<span style="font-size: 2rem; color: var(--text-muted);">📦</span>`;
      }
    }
    document.getElementById('itm-code').textContent = item.itemCode;
    document.getElementById('itm-name').textContent = item.name;
    document.getElementById('itm-meta').textContent = `${item.categoryId?.name || 'General'} • ${item.brand || ''} ${item.model || ''}`;
    document.getElementById('itm-cost').textContent = formatMoney(item.unitPrice);
    document.getElementById('itm-type').textContent = `Type: ${item.itemType}`;
    document.getElementById('itm-unit').textContent = `Unit: ${item.unit}`;

    // Locations Distribution
    const locs = item.currentLocations || [];
    const totalQty = locs.reduce((sum, l) => sum + (l.quantity || 0), 0);
    const isLowStock = item.minimumStock != null && totalQty <= item.minimumStock;
    document.getElementById('itm-total-qty').innerHTML = `
      <span>${totalQty} ${item.unit}</span>
      ${isLowStock ? '<span class="badge badge-warning" style="font-size: 0.7rem; margin-left: 0.5rem; vertical-align: middle;">⚠️ Low Stock (Min: ' + item.minimumStock + ')</span>' : ''}
    `;
    document.getElementById('itm-locations-summary').textContent = `${locs.length} Location(s)`;

    const locTbody = document.getElementById('item-locations-table-body');
    if (locs.length > 0) {
      locTbody.innerHTML = locs.map(l => {
        const locName = l.locationName || (l.locationKind === 'WAREHOUSE' ? (whMap[l.locationId] || 'Warehouse') : (prjMap[l.locationId] || 'Project Site'));
        const responsible = l.responsible || '—';
        const val = l.value || (l.quantity * (item.unitPrice || 0));

        return `
          <tr>
            <td><span class="badge ${l.locationKind === 'WAREHOUSE' ? 'badge-info' : 'badge-purple'}">${l.locationKind}</span></td>
            <td style="font-weight: 600; color: var(--text-primary);">${locName}</td>
            <td style="color: var(--text-secondary);">${responsible}</td>
            <td style="font-weight: 700; color: var(--accent-cyan);">${l.quantity} ${item.unit}</td>
            <td style="font-weight: 600; color: var(--success);">${formatMoney(val)}</td>
          </tr>
        `;
      }).join('');
    } else {
      locTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">No current confirmed stock at any location.</td></tr>`;
    }

    // Barcodes list
    const barcodesList = document.getElementById('item-barcodes-list');
    const barcodes = item.barcodes || [];
    document.getElementById('itm-barcode-count').textContent = `${barcodes.length} code(s)`;
    const prim = barcodes.find(b => b.isPrimary) || barcodes[0];
    document.getElementById('itm-primary-barcode').textContent = prim ? prim.code : 'None';

    if (barcodes.length > 0) {
      barcodesList.innerHTML = `
        <div style="width: 100%; display: flex; gap: 1.5rem; align-items: center; background: var(--bg-surface-elevated); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); flex-wrap: wrap;">
          <div style="background: #fff; padding: 0.75rem; border-radius: var(--radius-sm); display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: var(--shadow-sm);">
            <canvas id="detail-qr-canvas" style="width: 110px; height: 110px;"></canvas>
            <span style="font-size: 0.7rem; color: #0f172a; font-weight: 700; margin-top: 0.35rem;">QR CODE</span>
          </div>
          <div style="flex: 1; min-width: 200px;">
            <div style="background: #fff; padding: 0.5rem; border-radius: var(--radius-sm); display: inline-block; margin-bottom: 0.75rem;">
              <svg id="detail-barcode-svg"></svg>
            </div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
              ${barcodes.map(b => `
                <a href="#/items/labels?ids=${itemId}" class="barcode-link" style="padding: 0.35rem 0.65rem; font-size: 0.8rem; text-decoration: none;">
                  <span style="font-family: var(--font-mono); font-weight: 700;">${b.code}</span>
                  <span class="badge badge-secondary" style="font-size: 0.65rem;">${b.type}</span>
                  ${b.isPrimary ? '<span class="badge badge-success" style="font-size: 0.65rem;">Primary</span>' : ''}
                </a>
              `).join('')}
            </div>
          </div>
        </div>
      `;

      // Render Barcode and QR Code on item details
      const primaryCode = prim ? prim.code : item.itemCode;
      const detailCanvas = document.getElementById('detail-qr-canvas');
      const detailSvg = document.getElementById('detail-barcode-svg');

      if (detailCanvas) {
        if (window.MatixQR && typeof window.MatixQR.toCanvas === 'function') {
          window.MatixQR.toCanvas(detailCanvas, primaryCode, { width: 110, margin: 1 });
        } else if (typeof QRCode !== 'undefined' && typeof QRCode.toCanvas === 'function') {
          QRCode.toCanvas(detailCanvas, primaryCode, { width: 110, margin: 1 });
        }
      }

      if (typeof JsBarcode !== 'undefined' && detailSvg) {
        try {
          const format = (prim?.type === 'EAN-13' && primaryCode.length === 13) ? 'EAN13' : 'CODE128';
          JsBarcode(detailSvg, primaryCode, {
            format,
            lineColor: '#0f172a',
            width: 1.5,
            height: 40,
            displayValue: true,
            fontSize: 11,
            margin: 2,
            font: 'monospace',
          });
        } catch {
          try {
            JsBarcode(detailSvg, primaryCode, { format: 'CODE128', lineColor: '#0f172a', width: 1.5, height: 40, displayValue: true });
          } catch {}
        }
      }
    } else {
      barcodesList.innerHTML = `<p style="color: var(--text-muted);">No barcodes attached to this item.</p>`;
    }

    // Movement History Ledger Table
    const histTbody = document.getElementById('item-history-table-body');
    if (history.length > 0) {
      histTbody.innerHTML = history.map(h => {
        const fromStr = h.fromLocation ? (h.fromLocation.kind === 'WAREHOUSE' ? (whMap[h.fromLocation.id] || 'Warehouse') : (prjMap[h.fromLocation.id] || 'Project Site')) : '<span style="color: var(--text-muted);">External Supplier</span>';
        const toStr = h.toLocation ? (h.toLocation.kind === 'WAREHOUSE' ? (whMap[h.toLocation.id] || 'Warehouse') : (prjMap[h.toLocation.id] || 'Project Site')) : '—';

        return `
          <tr>
            <td style="font-family: var(--font-mono); font-weight: 600; color: var(--primary);">${h.movementNumber}</td>
            <td>${getMovementTypeBadge(h.type)}</td>
            <td>${fromStr}</td>
            <td>${toStr}</td>
            <td style="font-weight: 700; color: var(--accent-cyan);">${h.quantity} ${item.unit}</td>
            <td>${formatMoney(h.unitCostSnapshot)}</td>
            <td style="font-weight: 700; color: var(--text-primary);">${formatMoney(h.totalCost)}</td>
            <td>${h.createdBy?.fullName || 'System'}</td>
            <td>${formatDate(h.date)}</td>
          </tr>
        `;
      }).join('');
    } else {
      histTbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">No movements recorded for this item yet.</td></tr>`;
    }

    // Receive / Add Stock to Warehouse Modal
    document.getElementById('btn-detail-receive-stock')?.addEventListener('click', async () => {
      try {
        const whRes = await api.get('/warehouses');
        const warehouses = whRes.data || [];

        const content = `
          <form id="form-detail-receive">
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1rem;">
              تسجيل استلام وتحديث رصيد <strong>${item.name}</strong> (${item.unit}) في أحد المستودعات المركزية (المحل أو المخزن).
            </p>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">المستودع الوجهة *</label>
                <select id="inp-detail-wh" class="form-select" required>
                  ${warehouses.map(w => `<option value="${w._id}">${w.name} (${w.code})</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">الكمية المستلمة (${item.unit}) *</label>
                <input type="number" step="0.01" min="0.01" id="inp-detail-qty" class="form-control" value="10" required>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">رقم وصل الشراء / الاستلام (Bon de Vente)</label>
              <input type="text" id="inp-detail-doc" class="form-control" placeholder="مثال: BV-2024-001">
            </div>
            <div class="form-group">
              <label class="form-label">ملاحظات (اختياري)</label>
              <input type="text" id="inp-detail-note" class="form-control" placeholder="ملاحظات حركة الاستلام">
            </div>
          </form>
        `;

        showModal({
          title: `📥 استلام مخزون: ${item.name}`,
          content,
          confirmText: 'تأكيد واستلام المخزون',
          onConfirm: async () => {
            const whId = document.getElementById('inp-detail-wh').value;
            const qty = parseFloat(document.getElementById('inp-detail-qty').value);
            const docNum = document.getElementById('inp-detail-doc').value.trim();
            const note = document.getElementById('inp-detail-note').value.trim();

            if (!whId || isNaN(qty) || qty <= 0) {
              showToast('يرجى تحديد المستودع وإدخال كمية صحيحة', 'error');
              return false;
            }

            try {
              await api.post('/movements', {
                type: 'RECEIPT',
                toLocation: { kind: 'WAREHOUSE', id: whId },
                referenceDocNumber: docNum || undefined,
                note: note || `استلام ${qty} ${item.unit} من ${item.name}`,
                lines: [{ itemId, quantity: qty }],
              });

              showToast(`تم استلام ${qty} ${item.unit} وتحديث الرصيد بالمستودع بنجاح!`, 'success');
              renderItemDetail(container, params);
              return true;
            } catch (err) {
              showToast(err.message, 'error');
              return false;
            }
          }
        });
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Attach Barcode Modal
    document.getElementById('btn-add-barcode')?.addEventListener('click', () => {
      const content = `
        <form id="form-attach-barcode">
          <div class="form-group">
            <label class="form-label">Barcode Value</label>
            <input type="text" id="inp-bar-val" class="form-control" placeholder="Leave empty to auto-generate internal ITM-XXXXXX">
          </div>
          <div class="form-group">
            <label class="form-label">Barcode Type</label>
            <select id="inp-bar-type" class="form-select">
              <option value="CODE-128">CODE-128</option>
              <option value="EAN-13">EAN-13</option>
              <option value="QR">QR Code</option>
            </select>
          </div>
        </form>
      `;

      showModal({
        title: `Attach Barcode to ${item.name}`,
        content,
        confirmText: 'Attach Barcode',
        onConfirm: async () => {
          const code = document.getElementById('inp-bar-val').value.trim() || undefined;
          const type = document.getElementById('inp-bar-type').value;

          try {
            await api.post(`/items/${itemId}/barcodes`, { code, type });
            showToast('Barcode attached successfully', 'success');
            renderItemDetail(container, params);
            return true;
          } catch (err) {
            showToast(err.message, 'error');
            return false;
          }
        }
      });
    });

    // Edit & Delete Item Actions (ADMIN only)
    const currentUser = api.getCurrentUser();
    const isAdmin = currentUser?.role === 'ADMIN';

    const editBtn = document.getElementById('btn-detail-edit-item');
    if (editBtn && isAdmin) {
      editBtn.style.display = 'inline-flex';
      editBtn.addEventListener('click', () => {
        openEditItemModal(itemId, () => {
          renderItemDetail(container, params);
        });
      });
    }

    const deleteBtn = document.getElementById('btn-detail-delete-item');
    if (deleteBtn && isAdmin) {
      deleteBtn.style.display = 'inline-flex';
      deleteBtn.addEventListener('click', () => {
        showModal({
          title: '⚠️ تأكيد حذف المادة',
          content: `
            <p style="color: var(--text-primary); margin-bottom: 0.5rem;">
              هل أنت متأكد من رغبتك في حذف المادة <strong>${item.name}</strong> (${item.itemCode}) من الكتالوج؟
            </p>
            <p style="color: var(--danger); font-size: 0.82rem; margin-bottom: 0;">
              سيتم إلغاء تفعيل هذه المادة وحذفها من الكتالوج وعمليات البحث مع الحفاظ على سلامة سجلات الحركات التاريخية.
            </p>
          `,
          confirmText: 'تأكيد وحذف المادة',
          onConfirm: async () => {
            try {
              await api.delete(`/items/${itemId}`);
              showToast(`تم حذف المادة "${item.name}" بنجاح`, 'success');
              window.location.hash = '#/items';
              return true;
            } catch (err) {
              showToast(err.message, 'error');
              return false;
            }
          },
        });
      });
    }

  } catch (err) {
    showToast(err.message, 'error');
  }
}
