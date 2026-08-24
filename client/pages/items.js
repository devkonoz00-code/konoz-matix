/**
 * Items Catalog & Stock Page Module (§11, §12, §13)
 * Full search, filters, multi-select batch label printing, initial stock allocation to warehouses, and update stock receipt.
 */
import { api } from '../js/api.js';
import { formatMoney, showToast, showModal, escapeHtml, formatImageUrl, playConfirmBeep } from '../js/app.js';
import { i18n } from '../js/i18n.js';
import { router } from '../js/router.js';

let activeModalScanner = null;

async function startModalScanner(viewportId, boxId, inputEl, modalEl) {
  const box = modalEl ? modalEl.querySelector('#' + boxId) : document.getElementById(boxId);
  const viewport = modalEl ? modalEl.querySelector('#' + viewportId) : document.getElementById(viewportId);
  if (!box || !viewport) return;

  box.style.display = 'block';

  try {
    if (activeModalScanner) {
      try { await activeModalScanner.stop(); } catch {}
      activeModalScanner = null;
    }

    if (typeof Html5Qrcode === 'undefined') {
      showToast('جاري تشغيل كاميرا الماسح...', 'info');
      await new Promise(r => setTimeout(r, 400));
    }

    const scanner = new Html5Qrcode(viewportId);
    activeModalScanner = scanner;

    const onScanSuccess = async (decodedText) => {
      const clean = (decodedText || '').trim();
      if (clean) {
        if (inputEl) {
          inputEl.value = clean;
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
        playConfirmBeep();
        showToast(`تم مسح الباركود بنجاح: ${clean}`, 'success');
        try { await scanner.stop(); } catch {}
        activeModalScanner = null;
        box.style.display = 'none';
      }
    };

    const qrConfig = {
      fps: 15,
      qrbox: { width: 250, height: 140 },
      aspectRatio: 1.3,
    };

    await scanner.start(
      { facingMode: 'environment' },
      qrConfig,
      onScanSuccess,
      () => {}
    );
  } catch (err) {
    console.warn('FacingMode environment failed, trying default camera:', err);
    try {
      if (activeModalScanner) {
        await activeModalScanner.start(
          undefined,
          { fps: 15, qrbox: { width: 250, height: 140 } },
          (decodedText) => {
            const clean = (decodedText || '').trim();
            if (clean) {
              if (inputEl) {
                inputEl.value = clean;
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
              }
              playConfirmBeep();
              showToast(`تم مسح الباركود بنجاح: ${clean}`, 'success');
              try { activeModalScanner.stop(); } catch {}
              activeModalScanner = null;
              box.style.display = 'none';
            }
          },
          () => {}
        );
      }
    } catch (fallbackErr) {
      showToast('تعذر فتح الكاميرا: ' + (fallbackErr.message || 'يرجى التحقق من صلاحيات الكاميرا'), 'error');
      box.style.display = 'none';
    }
  }
}

async function stopModalScanner(boxId, modalEl) {
  const box = modalEl ? modalEl.querySelector('#' + boxId) : document.getElementById(boxId);
  if (box) box.style.display = 'none';
  if (activeModalScanner) {
    try { await activeModalScanner.stop(); } catch {}
    activeModalScanner = null;
  }
}

export async function renderItems(container) {
  document.getElementById('page-title').textContent = i18n.t('nav_items');

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
      <div>
        <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);" data-i18n="nav_items">Catalog & Tracked Items</h2>
        <p style="color: var(--text-secondary); font-size: 0.85rem;">Materials, machinery, tools & assets with live derived warehouse balances</p>
      </div>
      <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
        <button class="btn btn-success btn-sm" id="btn-quick-receive-stock">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
          <span>تحديث المخزون / استلام مواد</span>
        </button>
        <button class="btn btn-secondary btn-sm" id="btn-batch-print-labels">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          <span data-i18n="btn_print_barcode">Print Selected Labels</span>
        </button>
        <a href="#/scanner" class="btn btn-outline btn-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>
          <span data-i18n="btn_scan">Scan Barcode</span>
        </a>
        <button class="btn btn-primary btn-sm" id="btn-create-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span data-i18n="btn_new_item">Add New Item</span>
        </button>
      </div>
    </div>

    <!-- Search & Filters -->
    <div class="card" style="margin-bottom: 1.5rem; padding: 1rem;">
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 250px;">
          <input type="text" id="item-search" class="form-control" placeholder="Search by name, item code, barcode or brand...">
        </div>
        <div style="width: 180px;">
          <select id="item-type-filter" class="form-select">
            <option value="">All Types</option>
            <option value="MATERIAL">MATERIAL</option>
            <option value="EQUIPMENT">EQUIPMENT</option>
            <option value="TOOL">TOOL</option>
            <option value="OTHER">OTHER</option>
          </select>
        </div>
        <div style="width: 200px;">
          <select id="item-category-filter" class="form-select">
            <option value="">All Categories</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Items Table -->
    <div class="card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">
                <input type="checkbox" id="chk-select-all" title="Select all items for batch printing" style="cursor: pointer; width: 16px; height: 16px;">
              </th>
              <th data-i18n="lbl_item_code">Item Code</th>
              <th data-i18n="lbl_name">Item Name</th>
              <th data-i18n="lbl_category">Category</th>
              <th>Type</th>
              <th data-i18n="lbl_unit">Unit</th>
              <th data-i18n="lbl_barcode">Primary Barcode</th>
              <th>Unit Price (د.ج)</th>
              <th data-i18n="lbl_actions">Actions</th>
            </tr>
          </thead>
          <tbody id="items-table-body">
            <tr><td colspan="9" style="text-align: center; color: var(--text-muted);">Loading catalog...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  i18n.translateDOM(container);

  // Load Categories into Filter
  try {
    const catRes = await api.get('/categories');
    const catSelect = document.getElementById('item-category-filter');
    if (catSelect && catRes.data) {
      catRes.data.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c._id;
        opt.textContent = c.name;
        catSelect.appendChild(opt);
      });
    }
  } catch {}

  async function loadItems() {
    const search = document.getElementById('item-search')?.value.trim() || '';
    const itemType = document.getElementById('item-type-filter')?.value || '';
    const categoryId = document.getElementById('item-category-filter')?.value || '';
    const tbody = document.getElementById('items-table-body');

    try {
      const res = await api.get('/items', { search, itemType, categoryId });
      const items = res.data || [];

      if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">No items found.</td></tr>`;
        return;
      }

      const currentUser = api.getCurrentUser();
      const isAdmin = currentUser?.role === 'ADMIN';

      tbody.innerHTML = items.map(it => {
        const primaryBarcode = it.barcodes?.find(b => b.isPrimary) || it.barcodes?.[0];
        const barcodeCode = primaryBarcode ? primaryBarcode.code : it.itemCode;

        return `
          <tr>
            <td style="text-align: center;">
              <input type="checkbox" class="item-chk" value="${it._id}" style="cursor: pointer; width: 16px; height: 16px;">
            </td>
            <td>
              <a href="#/items/${it._id}" style="font-family: var(--font-mono); font-weight: 700; color: var(--primary);">${it.itemCode}</a>
            </td>
            <td>
              <div style="font-weight: 600; color: var(--text-primary);">${it.name}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${it.brand || ''} ${it.model || ''}</div>
            </td>
            <td><span class="badge badge-secondary">${it.categoryId?.name || 'General'}</span></td>
            <td><span class="badge badge-info">${it.itemType}</span></td>
            <td style="font-family: var(--font-mono);">${it.unit}</td>
            <td>
              <a href="#/items/labels?ids=${it._id}" class="barcode-link" title="Click to view & print label for ${it.name}">
                <span>🔲</span>
                <span>${barcodeCode}</span>
              </a>
            </td>
            <td style="font-weight: 700; color: var(--success);">${formatMoney(it.unitPrice)}</td>
            <td>
              <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
                <button class="btn btn-sm btn-outline btn-receive-row" data-id="${it._id}" data-name="${it.name}" data-price="${it.unitPrice}" data-unit="${it.unit}" title="تحديث المخزون / استلام مواد بالمستودع">
                  <span>📥 + مخزون</span>
                </button>
                <a href="#/items/labels?ids=${it._id}" class="btn btn-sm btn-outline" title="Print Label">
                  <span>🖨️</span>
                </a>
                <a href="#/items/${it._id}" class="btn btn-sm btn-outline">
                  <span data-i18n="btn_view_history">التفاصيل</span> &rarr;
                </a>
                ${isAdmin ? `
                  <button class="btn btn-sm btn-outline btn-edit-item" data-id="${it._id}" data-name="${escapeHtml(it.name)}" title="تعديل بيانات المادة (للأدمن فقط)" style="color: var(--primary); border-color: rgba(59, 130, 246, 0.4);">
                    <span>✏️ تعديل</span>
                  </button>
                  <button class="btn btn-sm btn-outline btn-delete-item" data-id="${it._id}" data-name="${escapeHtml(it.name)}" title="حذف المادة (للأدمن فقط)" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.3);">
                    <span>🗑️</span>
                  </button>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      // Select all toggle
      const selectAll = document.getElementById('chk-select-all');
      if (selectAll) {
        selectAll.checked = false;
        selectAll.addEventListener('change', () => {
          document.querySelectorAll('.item-chk').forEach(chk => {
            chk.checked = selectAll.checked;
          });
        });
      }

      // Bind row "+ مخزون" buttons
      tbody.querySelectorAll('.btn-receive-row').forEach(btn => {
        btn.addEventListener('click', () => {
          const itemId = btn.getAttribute('data-id');
          const itemName = btn.getAttribute('data-name');
          const unit = btn.getAttribute('data-unit');
          openReceiveStockModal({ preselectedItemId: itemId, preselectedName: itemName, unit });
        });
      });

      // Bind row edit buttons (Admin only)
      tbody.querySelectorAll('.btn-edit-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const itemId = btn.getAttribute('data-id');
          openEditItemModal(itemId, loadItems);
        });
      });

      // Bind row delete buttons (Admin only)
      tbody.querySelectorAll('.btn-delete-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const itemId = btn.getAttribute('data-id');
          const itemName = btn.getAttribute('data-name');
          showModal({
            title: '⚠️ تأكيد حذف المادة',
            content: `
              <p style="color: var(--text-primary); margin-bottom: 0.5rem;">
                هل أنت متأكد من رغبتك في حذف المادة <strong>${itemName}</strong> من الكتالوج؟
              </p>
              <p style="color: var(--danger); font-size: 0.82rem; margin-bottom: 0;">
                سيتم إلغاء تفعيل هذه المادة وحذفها من الكتالوج وعمليات البحث مع الحفاظ على سلامة سجلات الحركات التاريخية.
              </p>
            `,
            confirmText: 'تأكيد وحذف المادة',
            onConfirm: async () => {
              try {
                await api.delete(`/items/${itemId}`);
                showToast(`تم حذف المادة "${itemName}" بنجاح`, 'success');
                loadItems();
                return true;
              } catch (err) {
                showToast(err.message, 'error');
                return false;
              }
            },
          });
        });
      });

    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Batch Print Labels Action
  document.getElementById('btn-batch-print-labels')?.addEventListener('click', () => {
    const checked = Array.from(document.querySelectorAll('.item-chk:checked')).map(c => c.value);
    if (checked.length === 0) {
      showToast('Please select at least one item using the checkboxes to print labels', 'info');
      return;
    }
    router.navigate(`/items/labels?ids=${checked.join(',')}`);
  });

  // Top "Update Stock / Receive" button
  document.getElementById('btn-quick-receive-stock')?.addEventListener('click', () => {
    openReceiveStockModal({});
  });

  // Bind Filters
  document.getElementById('item-search').addEventListener('input', loadItems);
  document.getElementById('item-type-filter').addEventListener('change', loadItems);
  document.getElementById('item-category-filter').addEventListener('change', loadItems);

  // New Item Modal (§13)
  document.getElementById('btn-create-item').addEventListener('click', async () => {
    const [catRes, whRes] = await Promise.all([
      api.get('/categories'),
      api.get('/warehouses'),
    ]);
    const categories = catRes.data || [];
    const warehouses = whRes.data || [];

    const content = `
      <form id="form-new-item">
        <div class="form-group autocomplete-container">
          <label class="form-label" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <span>اسم المادة / Item Name *</span>
            <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: normal;">(اقتراحات فورية من السجل مع فحص عدم التكرار 🟢)</span>
          </label>
          <div class="autocomplete-input-wrapper">
            <span class="autocomplete-icon-search">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            </span>
            <input type="text" id="inp-item-name" class="form-control" placeholder="اكتب اسم المادة للبحث التلقائي (مثال: BRIQUE, RAMLA, CIMENT)..." autocomplete="off" spellcheck="false" required>
            <button type="button" id="btn-clear-item-name" class="autocomplete-btn-clear" title="مسح النص">✕</button>
          </div>
          <div id="item-name-suggestions" class="autocomplete-dropdown"></div>
          <div id="item-duplicate-warning" style="display: none; margin-top: 0.45rem; font-size: 0.8rem; color: var(--warning); background: var(--warning-light); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); border: 1px solid rgba(217, 119, 6, 0.3);">
            ⚠️ <strong>تنبيه لمنع التكرار:</strong> هذه المادة مسجلة مسبقاً في النظام برمز (<span id="item-duplicate-code" style="font-weight: 700;"></span>).
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <label class="form-label" style="margin-bottom: 0;">الفئة / الصنف *</label>
              <button type="button" class="btn btn-sm btn-outline" id="btn-toggle-new-cat" style="font-size: 0.72rem; padding: 0.15rem 0.4rem;">
                ➕ إضافة صنف جديد
              </button>
            </div>
            <select id="inp-item-cat" class="form-select" required>
              ${categories.map(c => `<option value="${c._id}">${c.name}</option>`).join('')}
            </select>

            <!-- Inline New Category Box -->
            <div id="inline-new-cat-box" style="display: none; margin-top: 0.5rem; background: var(--bg-surface-elevated); padding: 0.6rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">اسم الصنف / الفئة الجديدة:</label>
              <div style="display: flex; gap: 0.5rem;">
                <input type="text" id="inp-inline-cat-name" class="form-control" placeholder="مثال: مواد البناء الأساسية">
                <button type="button" class="btn btn-sm btn-primary" id="btn-save-inline-cat" style="flex-shrink: 0;">حفظ الصنف</button>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">نوع العنصر / Item Type *</label>
            <select id="inp-item-type" class="form-select" required>
              <option value="MATERIAL">MATERIAL (مادة)</option>
              <option value="EQUIPMENT">EQUIPMENT (معدات)</option>
              <option value="TOOL">TOOL (أداة)</option>
              <option value="OTHER">OTHER (أخرى)</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">وحدة القياس / Unit (§7) *</label>
            <select id="inp-item-unit" class="form-select" required>
              <option value="PIECE">PIECE (قطعة / pcs)</option>
              <option value="BAG">BAG (كيس / sac)</option>
              <option value="KG">KG (كيلوغرام)</option>
              <option value="TON">TON (طن)</option>
              <option value="METER">METER (متر)</option>
              <option value="CM">CM (سنتيمتر)</option>
              <option value="SQM">SQM (متر مربع m²)</option>
              <option value="CBM">CBM (متر مكعب m³)</option>
              <option value="LITER">LITER (لتر)</option>
              <option value="BOX">BOX (علبة / boîte)</option>
              <option value="ROLL">ROLL (لفة / rouleau)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">السعر الإفرادي (د.ج) / Unit Price (DZD) *</label>
            <input type="number" step="0.01" id="inp-item-unit-price" class="form-control" placeholder="0.00" required>
          </div>
        </div>

        <!-- Initial Stock Allocation Section (§7, §8) -->
        <div style="background: var(--bg-surface-elevated); border: 1px solid var(--primary-light); border-radius: var(--radius-md); padding: 0.85rem; margin-bottom: 1rem;">
          <div style="font-weight: 700; font-size: 0.85rem; color: var(--primary); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.4rem;">
            <span>🏬 الرصيد الأولي وتوجيه المخزون للمستودع</span>
            <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: normal;">(اختياري — يتم تسجيله مباشرة في حركة الاستلام)</span>
          </div>
          <div class="form-row">
            <div class="form-group" style="margin-bottom: 0.5rem;">
              <label class="form-label">عدد الوحدات / الكمية الأولية المتوفرة</label>
              <input type="number" step="0.01" min="0" id="inp-item-initial-qty" class="form-control" value="0" placeholder="0">
            </div>
            <div class="form-group" style="margin-bottom: 0.5rem;">
              <label class="form-label">المستودع الوجهة (المحل أو المخزن)</label>
              <select id="inp-item-target-wh" class="form-select">
                ${warehouses.map(w => `<option value="${w._id}">${w.name} (${w.code})</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-size: 0.75rem;">رقم وصل الشراء / وصل الاستلام (Bon de Vente - اختياري)</label>
            <input type="text" id="inp-item-initial-doc" class="form-control" placeholder="مثال: BV-2024-001 أو فاتورة المورد">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">حد تنبيه انخفاض المخزون (Minimum Stock)</label>
            <input type="number" step="1" min="0" id="inp-item-min-stock" class="form-control" placeholder="مثال: 10">
          </div>
          <div class="form-group">
            <label class="form-label">الماركة / المصنّع (Brand)</label>
            <input type="text" id="inp-item-brand" class="form-control" placeholder="E.g. Sonasid, Lafarge, Bosch">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">صورة المادة / Item Image (اختياري)</label>
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <label class="btn btn-sm btn-outline" style="cursor: pointer; margin: 0;">
              🖼️ اختيار من المعرض
              <input type="file" id="inp-item-image-file" accept="image/jpeg,image/png,image/webp" style="display: none;">
            </label>
            <label class="btn btn-sm btn-outline" style="cursor: pointer; margin: 0;">
              📷 التقاط بالكاميرا
              <input type="file" id="inp-item-image-camera" accept="image/jpeg,image/png,image/webp" capture="environment" style="display: none;">
            </label>
            <input type="hidden" id="inp-item-image-url">
          </div>
          <div id="item-image-preview-box" style="display: none; margin-top: 0.5rem; text-align: center;">
            <img id="item-image-preview" src="" alt="Preview" style="max-height: 120px; max-width: 100%; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); object-fit: cover;">
            <div style="margin-top: 0.25rem;">
              <button type="button" id="btn-remove-image" class="btn btn-sm btn-outline" style="font-size: 0.72rem; color: var(--danger);">✕ إزالة الصورة</button>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <span>الباركود / QR (اختياري)</span>
            <span style="font-size: 0.72rem; color: var(--text-muted);">(اتركه فارغاً للتوليد التلقائي لرمز ITM-XXXXXX)</span>
          </label>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <input type="text" id="inp-item-barcode" class="form-control" placeholder="امسح بالماسح أو اكتب الكود (مثال: 611123456789)...">
            <button type="button" class="btn btn-primary btn-sm" id="btn-scan-create-barcode" style="display: inline-flex; align-items: center; gap: 0.35rem; flex-shrink: 0; padding: 0.5rem 0.85rem; font-weight: 600;" title="مسح الباركود بالكاميرا مباشرة">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>
              <span>📷 مسح باركود</span>
            </button>
          </div>
          <div id="create-barcode-scanner-box" style="display: none; margin-top: 0.75rem; background: #0f172a; border-radius: var(--radius-md); padding: 0.75rem; border: 1px solid var(--border-subtle); text-align: center;">
            <div id="create-barcode-scanner-viewport" style="width: 100%; min-height: 220px; border-radius: var(--radius-sm); overflow: hidden; background: #020617;"></div>
            <div style="display: flex; justify-content: center; gap: 0.5rem; margin-top: 0.5rem;">
              <button type="button" class="btn btn-sm btn-secondary" id="btn-stop-create-barcode-scanner">✕ إغلاق الماسح</button>
            </div>
          </div>
        </div>
      </form>
    `;

    const itemFormKey = 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);

    const modal = showModal({
      title: 'إضافة مادة جديدة في الكتالوج وتوجيه المخزون',
      content,
      confirmText: 'حفظ وتثبيت المادة',
      onConfirm: async () => {
        stopModalScanner('create-barcode-scanner-box', modal);
        const name = (modal.querySelector('#inp-item-name')?.value || '').trim();
        const categoryId = modal.querySelector('#inp-item-cat')?.value;
        const itemType = modal.querySelector('#inp-item-type')?.value;
        const unit = modal.querySelector('#inp-item-unit')?.value;
        const unitPrice = parseFloat(modal.querySelector('#inp-item-unit-price')?.value);
        const initialQty = parseFloat(modal.querySelector('#inp-item-initial-qty')?.value) || 0;
        const warehouseId = modal.querySelector('#inp-item-target-wh')?.value;
        const referenceDocNumber = (modal.querySelector('#inp-item-initial-doc')?.value || '').trim();
        const minStockVal = modal.querySelector('#inp-item-min-stock')?.value;
        const minimumStock = minStockVal ? parseFloat(minStockVal) : undefined;
        const brand = (modal.querySelector('#inp-item-brand')?.value || '').trim();
        const barcode = (modal.querySelector('#inp-item-barcode')?.value || '').trim() || undefined;
        let imageUrl = (modal.querySelector('#inp-item-image-url')?.value || '').trim() || undefined;

        if (!name || !categoryId || !unit || isNaN(unitPrice)) {
          showToast('يرجى ملء جميع الحقول المطلوبة بشكل صحيح', 'error');
          return false;
        }

        // Upload file to server if selected (from gallery or camera)
        const fileInput = modal.querySelector('#inp-item-image-file');
        const cameraInput = modal.querySelector('#inp-item-image-camera');
        const selectedFile = (fileInput && fileInput.files && fileInput.files[0])
          || (cameraInput && cameraInput.files && cameraInput.files[0]);

        if (selectedFile) {
          try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            const uploadRes = await api.post('/items/upload-image', formData);
            if (uploadRes.success && uploadRes.data?.url) {
              imageUrl = uploadRes.data.url;
            }
          } catch (uploadErr) {
            showToast('فشل رفع الصورة: ' + (uploadErr.message || 'خطأ غير معروف'), 'error');
            return false;
          }
        }

        try {
          await api.post('/items', {
            name,
            categoryId,
            itemType,
            unit,
            unitPrice,
            imageUrl,
            initialQuantity: initialQty > 0 ? initialQty : undefined,
            warehouseId: initialQty > 0 ? warehouseId : undefined,
            referenceDocNumber: referenceDocNumber || undefined,
            minimumStock,
            brand,
            barcode,
          }, {
            headers: { 'Idempotency-Key': itemFormKey }
          });

          if (initialQty > 0) {
            showToast(`تمت إضافة المادة "${name}" وتوجيه ${initialQty} ${unit} بنجاح إلى المستودع!`, 'success');
          } else {
            showToast(`تمت إضافة المادة "${name}" بنجاح!`, 'success');
          }
          loadItems();
          return true;
        } catch (err) {
          showToast(err.message, 'error');
          return false;
        }
      }
    });

    // Barcode Scanner in Create Modal
    modal.querySelector('#btn-scan-create-barcode')?.addEventListener('click', () => {
      const barcodeInp = modal.querySelector('#inp-item-barcode');
      startModalScanner('create-barcode-scanner-viewport', 'create-barcode-scanner-box', barcodeInp, modal);
    });

    modal.querySelector('#btn-stop-create-barcode-scanner')?.addEventListener('click', () => {
      stopModalScanner('create-barcode-scanner-box', modal);
    });

    // Handle Category Toggle & Quick Add inside Modal
    const toggleBtn = modal.querySelector('#btn-toggle-new-cat');
    const inlineBox = modal.querySelector('#inline-new-cat-box');
    const inlineInput = modal.querySelector('#inp-inline-cat-name');
    const inlineSaveBtn = modal.querySelector('#btn-save-inline-cat');
    const catSelect = modal.querySelector('#inp-item-cat');

    toggleBtn?.addEventListener('click', () => {
      inlineBox.style.display = inlineBox.style.display === 'none' ? 'block' : 'none';
      if (inlineBox.style.display === 'block') inlineInput?.focus();
    });

    inlineSaveBtn?.addEventListener('click', async (e) => {
      e.preventDefault();
      const newCatName = inlineInput.value.trim();
      if (!newCatName) {
        showToast('يرجى إدخال اسم الصنف', 'error');
        return;
      }

      const catKey = 'cat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      inlineSaveBtn.disabled = true;
      const origText = inlineSaveBtn.innerHTML;
      inlineSaveBtn.innerHTML = 'جاري الحفظ...';

      try {
        const res = await api.post('/categories', { name: newCatName }, { headers: { 'Idempotency-Key': catKey } });
        const newCat = res.data;
        showToast(`تم إنشاء الصنف "${newCat.name}" بنجاح!`, 'success');

        const newOption = document.createElement('option');
        newOption.value = newCat._id;
        newOption.textContent = newCat.name;
        newOption.selected = true;

        catSelect.appendChild(newOption);
        catSelect.value = newCat._id;
        inlineBox.style.display = 'none';
        inlineInput.value = '';
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        inlineSaveBtn.disabled = false;
        inlineSaveBtn.innerHTML = origText;
      }
    });

    // Image preview handlers for gallery and camera inputs
    function handleImagePreview(file) {
      const previewBox = modal.querySelector('#item-image-preview-box');
      const previewImg = modal.querySelector('#item-image-preview');
      if (file && previewBox && previewImg) {
        const reader = new FileReader();
        reader.onload = (e) => {
          previewImg.src = e.target.result;
          previewBox.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    }

    const galleryInput = modal.querySelector('#inp-item-image-file');
    const cameraInput = modal.querySelector('#inp-item-image-camera');

    galleryInput?.addEventListener('change', () => {
      if (galleryInput.files[0]) {
        // Clear camera input so only one is active
        if (cameraInput) cameraInput.value = '';
        handleImagePreview(galleryInput.files[0]);
      }
    });

    cameraInput?.addEventListener('change', () => {
      if (cameraInput.files[0]) {
        // Clear gallery input so only one is active
        if (galleryInput) galleryInput.value = '';
        handleImagePreview(cameraInput.files[0]);
      }
    });

    modal.querySelector('#btn-remove-image')?.addEventListener('click', () => {
      if (galleryInput) galleryInput.value = '';
      if (cameraInput) cameraInput.value = '';
      const previewBox = modal.querySelector('#item-image-preview-box');
      if (previewBox) previewBox.style.display = 'none';
      const hiddenUrl = modal.querySelector('#inp-item-image-url');
      if (hiddenUrl) hiddenUrl.value = '';
    });

    // Smart Autocomplete from CSV & Database for Item Name (§13)
    const nameInput = modal.querySelector('#inp-item-name');
    const clearBtn = modal.querySelector('#btn-clear-item-name');
    const suggestionsBox = modal.querySelector('#item-name-suggestions');
    const duplicateWarning = modal.querySelector('#item-duplicate-warning');
    const duplicateCode = modal.querySelector('#item-duplicate-code');

    let debounceTimer = null;
    let selectedIndex = -1;
    let currentSuggestions = [];

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function escapeRegExp(str) {
      return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function updateClearButton() {
      if (clearBtn) {
        clearBtn.style.display = nameInput.value.trim() ? 'flex' : 'none';
      }
    }

    function hideDropdown() {
      if (suggestionsBox) {
        suggestionsBox.classList.remove('active');
        suggestionsBox.innerHTML = '';
      }
      selectedIndex = -1;
    }

    clearBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      nameInput.value = '';
      updateClearButton();
      hideDropdown();
      if (duplicateWarning) duplicateWarning.style.display = 'none';
      nameInput.focus();
    });

    async function fetchSuggestions(query) {
      if (!suggestionsBox) return;
      try {
        suggestionsBox.innerHTML = `
          <div class="autocomplete-loading">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
            <span>جاري البحث الذكي في السجل وقاعدة البيانات...</span>
          </div>
        `;
        suggestionsBox.classList.add('active');
        const res = await api.get('/items/suggestions', { q: query });
        currentSuggestions = res.data || [];
        renderSuggestions(currentSuggestions, query);
      } catch (err) {
        suggestionsBox.innerHTML = '<div class="autocomplete-empty">تعذر جلب الاقتراحات</div>';
      }
    }

    function renderSuggestions(list, query) {
      if (!suggestionsBox) return;
      if (!list || list.length === 0) {
        suggestionsBox.innerHTML = '<div class="autocomplete-empty">لا توجد أسماء مطابقة في الملف أو قاعدة البيانات</div>';
        suggestionsBox.classList.add('active');
        return;
      }

      const q = (query || '').trim();
      const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
      selectedIndex = -1;

      const itemsHtml = list.map((item, idx) => {
        let displayName = escapeHtml(item.name);
        if (tokens.length > 0) {
          tokens.forEach(tok => {
            try {
              const regex = new RegExp(`(${escapeRegExp(tok)})`, 'gi');
              displayName = displayName.replace(regex, '<span class="autocomplete-match-highlight">$1</span>');
            } catch {}
          });
        }

        const badgeHtml = item.existsInDb
          ? `<span class="autocomplete-badge-exists" title="مسجل مسبقاً في قاعدة البيانات"><span class="autocomplete-dot autocomplete-dot-green"></span> مسجل مسبقاً (${escapeHtml(item.existingItem?.itemCode || 'مسجل')})</span>`
          : `<span class="autocomplete-badge-new">مقترح من السجل</span>`;

        return `
          <li class="autocomplete-item" data-idx="${idx}" role="option">
            <div class="autocomplete-item-name">
              ${item.existsInDb ? '<span class="autocomplete-dot autocomplete-dot-green" title="مسجل في قاعدة البيانات"></span>' : ''}
              <span>${displayName}</span>
            </div>
            <div>${badgeHtml}</div>
          </li>
        `;
      }).join('');

      suggestionsBox.innerHTML = `
        <div class="autocomplete-dropdown-header">
          <span>💡 نتائج البحث والمقترحات (${list.length})</span>
          <span style="font-size: 0.68rem; font-weight: normal;">انقر أو اضغط Enter للاختيار</span>
        </div>
        <ul class="autocomplete-list" role="listbox">
          ${itemsHtml}
        </ul>
        <div class="autocomplete-dropdown-footer">
          <span><kbd>↑</kbd> <kbd>↓</kbd> للتنقل</span>
          <span><kbd>Enter</kbd> للاختيار &nbsp; <kbd>Esc</kbd> للإغلاق</span>
        </div>
      `;

      suggestionsBox.classList.add('active');

      suggestionsBox.querySelectorAll('.autocomplete-item').forEach(itemEl => {
        itemEl.addEventListener('mousedown', (e) => {
          e.preventDefault(); // Prevent blur before selection
          const idx = parseInt(itemEl.dataset.idx, 10);
          selectSuggestion(currentSuggestions[idx]);
        });
      });
    }

    function selectSuggestion(item) {
      if (!item || !nameInput) return;
      nameInput.value = item.name;
      updateClearButton();
      hideDropdown();

      if (item.existsInDb && item.existingItem) {
        if (duplicateWarning && duplicateCode) {
          duplicateWarning.style.display = 'block';
          duplicateCode.textContent = `${item.existingItem.itemCode || ''} ${item.existingItem.category ? '— ' + item.existingItem.category : ''}`;
        }
        if (item.existingItem.categoryId) {
          const catSelect = modal.querySelector('#inp-item-cat');
          if (catSelect && catSelect.querySelector(`option[value="${item.existingItem.categoryId}"]`)) {
            catSelect.value = item.existingItem.categoryId;
          }
        }
        if (item.existingItem.unit) {
          const unitSelect = modal.querySelector('#inp-item-unit');
          if (unitSelect && unitSelect.querySelector(`option[value="${item.existingItem.unit}"]`)) {
            unitSelect.value = item.existingItem.unit;
          }
        }
        if (item.existingItem.unitPrice && !modal.querySelector('#inp-item-unit-price').value) {
          modal.querySelector('#inp-item-unit-price').value = item.existingItem.unitPrice;
        }
      } else {
        if (duplicateWarning) duplicateWarning.style.display = 'none';
      }

      nameInput.focus();
    }

    function updateHighlight(items) {
      items.forEach((it, idx) => {
        if (idx === selectedIndex) {
          it.classList.add('selected');
          it.scrollIntoView({ block: 'nearest' });
        } else {
          it.classList.remove('selected');
        }
      });
    }

    nameInput?.addEventListener('input', () => {
      updateClearButton();
      if (duplicateWarning) duplicateWarning.style.display = 'none';
      clearTimeout(debounceTimer);
      const val = nameInput.value.trim();
      if (!val) {
        hideDropdown();
        return;
      }
      debounceTimer = setTimeout(() => {
        fetchSuggestions(val);
      }, 120);
    });

    nameInput?.addEventListener('focus', () => {
      updateClearButton();
      const val = nameInput.value.trim();
      if (val) {
        fetchSuggestions(val);
      }
    });

    nameInput?.addEventListener('keydown', (e) => {
      const items = suggestionsBox?.querySelectorAll('.autocomplete-item') || [];

      if (!suggestionsBox || !suggestionsBox.classList.contains('active') || items.length === 0) {
        if (e.key === 'ArrowDown') {
          fetchSuggestions(nameInput.value.trim());
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % items.length;
        updateHighlight(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + items.length) % items.length;
        updateHighlight(items);
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < currentSuggestions.length) {
          e.preventDefault();
          selectSuggestion(currentSuggestions[selectedIndex]);
        }
      } else if (e.key === 'Tab') {
        if (selectedIndex >= 0 && selectedIndex < currentSuggestions.length) {
          selectSuggestion(currentSuggestions[selectedIndex]);
        } else if (currentSuggestions.length > 0) {
          selectSuggestion(currentSuggestions[0]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hideDropdown();
      }
    });

    // Close dropdown on click outside
    const closeHandler = (e) => {
      if (!modal.contains(e.target) || (!nameInput.contains(e.target) && !suggestionsBox.contains(e.target))) {
        hideDropdown();
      }
    };
    document.addEventListener('click', closeHandler);
  });

  // Receive / Update Stock Modal
  async function openReceiveStockModal({ preselectedItemId, preselectedName, unit = 'units' }) {
    try {
      const [itemsRes, whRes] = await Promise.all([
        api.get('/items'),
        api.get('/warehouses'),
      ]);
      const allItems = itemsRes.data || [];
      const warehouses = whRes.data || [];
      const receiveKey = 'rec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);

      const content = `
        <form id="form-receive-stock">
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1rem;">
            تسجيل حركة استلام وتحديث المخزون بالمستودع المركزي (المحل أو المخزن) مع تثبيت التكلفة في السجل.
          </p>

          <div class="form-group">
            <label class="form-label">المادة / Item *</label>
            <select id="sel-receive-item" class="form-select" required>
              ${allItems.map(it => `
                <option value="${it._id}" data-unit="${it.unit}" data-price="${it.unitPrice}" ${preselectedItemId && it._id.toString() === preselectedItemId.toString() ? 'selected' : ''}>
                  ${it.itemCode} — ${it.name} (${it.unit})
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">المستودع الوجهة *</label>
              <select id="sel-receive-warehouse" class="form-select" required>
                ${warehouses.map(w => `<option value="${w._id}">${w.name} (${w.code})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">الكمية المستلمة (عدد الوحدات) *</label>
              <input type="number" step="0.01" min="0.01" id="inp-receive-qty" class="form-control" value="10" required>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">رقم وصل الشراء / الاستلام (Bon de Vente / Facture)</label>
            <input type="text" id="inp-receive-doc" class="form-control" placeholder="مثال: BV-2024-008 أو وصل استلام المورد">
          </div>

          <div class="form-group">
            <label class="form-label">ملاحظات إضافية (اختياري)</label>
            <input type="text" id="inp-receive-note" class="form-control" placeholder="مثال: استلام دفعة جديدة من المورد">
          </div>
        </form>
      `;

      showModal({
        title: '📥 استلام مواد وتحديث المخزون بالمستودع',
        content,
        confirmText: 'تأكيد وحفظ الاستلام',
        onConfirm: async () => {
          const itemId = document.getElementById('sel-receive-item').value;
          const whId = document.getElementById('sel-receive-warehouse').value;
          const qty = parseFloat(document.getElementById('inp-receive-qty').value);
          const docNum = document.getElementById('inp-receive-doc').value.trim();
          const note = document.getElementById('inp-receive-note').value.trim();

          if (!itemId || !whId || isNaN(qty) || qty <= 0) {
            showToast('يرجى تحديد المادة والمستودع وإدخال كمية صحيحة', 'error');
            return false;
          }

          try {
            await api.post('/movements', {
              type: 'RECEIPT',
              toLocation: { kind: 'WAREHOUSE', id: whId },
              referenceDocNumber: docNum || undefined,
              note: note || 'استلام مواد بالمستودع',
              lines: [{ itemId, quantity: qty }],
            }, {
              headers: { 'Idempotency-Key': receiveKey }
            });

            showToast(`تم استلام ${qty} بنجاح وتحديث الرصيد بالمستودع!`, 'success');
            loadItems();
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
  }

  loadItems();
}

/**
 * Edit Item Modal — Restricted to ADMIN & Warehouse Managers
 * Allows updating item name, category, unit, price, min stock, brand, model, description, barcode (with live camera scan), image, and active status.
 */
export async function openEditItemModal(itemId, onSuccess) {
  try {
    const [itemRes, catRes] = await Promise.all([
      api.get(`/items/${itemId}`),
      api.get('/categories'),
    ]);

    const item = itemRes.data;
    const categories = catRes.data || [];

    const units = [
      { val: 'PIECE', label: 'PIECE (قطعة / pcs)' },
      { val: 'BAG', label: 'BAG (كيس / sac)' },
      { val: 'KG', label: 'KG (كيلوغرام)' },
      { val: 'TON', label: 'TON (طن)' },
      { val: 'METER', label: 'METER (متر)' },
      { val: 'CM', label: 'CM (سنتيمتر)' },
      { val: 'SQM', label: 'SQM (متر مربع m²)' },
      { val: 'CBM', label: 'CBM (متر مكعب m³)' },
      { val: 'LITER', label: 'LITER (لتر)' },
      { val: 'BOX', label: 'BOX (علبة / boîte)' },
      { val: 'ROLL', label: 'ROLL (لفة / rouleau)' },
    ];

    const itemTypes = [
      { val: 'MATERIAL', label: 'MATERIAL (مادة)' },
      { val: 'EQUIPMENT', label: 'EQUIPMENT (معدات)' },
      { val: 'TOOL', label: 'TOOL (أداة)' },
      { val: 'OTHER', label: 'OTHER (أخرى)' },
    ];

    const currentCatId = (item.categoryId?._id || item.categoryId || '').toString();
    const primaryBarcode = (item.barcodes || []).find(b => b.isPrimary) || (item.barcodes || [])[0];
    const currentBarcode = primaryBarcode ? primaryBarcode.code : '';

    const content = `
      <form id="form-edit-item">
        <div style="margin-bottom: 0.85rem; padding: 0.6rem 0.85rem; background: var(--bg-surface-elevated); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">كود المادة:</span>
            <span style="font-family: var(--font-mono); font-weight: 700; color: var(--primary); margin-left: 0.35rem;">${item.itemCode}</span>
          </div>
          <span class="badge badge-info">${item.itemType || 'MATERIAL'}</span>
        </div>

        <div class="form-group">
          <label class="form-label">اسم المادة / Item Name *</label>
          <input type="text" id="inp-edit-item-name" class="form-control" value="${escapeHtml(item.name || '')}" placeholder="اسم المادة..." required>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">الفئة / الصنف *</label>
            <select id="inp-edit-item-cat" class="form-select" required>
              ${categories.map(c => `<option value="${c._id}" ${c._id.toString() === currentCatId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">نوع العنصر / Item Type *</label>
            <select id="inp-edit-item-type" class="form-select" required>
              ${itemTypes.map(t => `<option value="${t.val}" ${item.itemType === t.val ? 'selected' : ''}>${t.label}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">وحدة القياس / Unit *</label>
            <select id="inp-edit-item-unit" class="form-select" required>
              ${units.map(u => `<option value="${u.val}" ${item.unit === u.val ? 'selected' : ''}>${u.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">السعر الإفرادي (د.ج) / Unit Price *</label>
            <input type="number" step="0.01" min="0" id="inp-edit-item-unit-price" class="form-control" value="${item.unitPrice != null ? item.unitPrice : 0}" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">حد تنبيه انخفاض المخزون (Minimum Stock)</label>
            <input type="number" step="1" min="0" id="inp-edit-item-min-stock" class="form-control" value="${item.minimumStock != null ? item.minimumStock : ''}" placeholder="مثال: 10">
          </div>
          <div class="form-group">
            <label class="form-label">الماركة / المصنّع (Brand)</label>
            <input type="text" id="inp-edit-item-brand" class="form-control" value="${escapeHtml(item.brand || '')}" placeholder="E.g. Lafarge, Bosch, Sonasid">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">الموديل / المواصفة (Model)</label>
            <input type="text" id="inp-edit-item-model" class="form-control" value="${escapeHtml(item.model || '')}" placeholder="مثال: CPJ-42.5 أو 12mm">
          </div>
          <div class="form-group">
            <label class="form-label">حالة المادة في الكتالوج</label>
            <select id="inp-edit-item-active" class="form-select">
              <option value="true" ${item.isActive !== false ? 'selected' : ''}>نشط / Active (ظاهر في الكتالوج)</option>
              <option value="false" ${item.isActive === false ? 'selected' : ''}>معطل / Inactive (مخفي من القوائم)</option>
            </select>
          </div>
        </div>

        <!-- Barcode with live camera scanner -->
        <div class="form-group">
          <label class="form-label" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <span>الباركود / Barcode (المطبوع على الملصق)</span>
            <span style="font-size: 0.72rem; color: var(--text-muted);">(يمكن مسحه بالكاميرا مباشرة أو تعديله)</span>
          </label>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <input type="text" id="inp-edit-item-barcode" class="form-control" value="${escapeHtml(currentBarcode)}" placeholder="الباركود...">
            <button type="button" class="btn btn-primary btn-sm" id="btn-scan-edit-barcode" style="display: inline-flex; align-items: center; gap: 0.35rem; flex-shrink: 0; padding: 0.5rem 0.85rem; font-weight: 600;" title="مسح الباركود بالكاميرا">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>
              <span>📷 مسح باركود</span>
            </button>
          </div>
          <div id="edit-barcode-scanner-box" style="display: none; margin-top: 0.75rem; background: #0f172a; border-radius: var(--radius-md); padding: 0.75rem; border: 1px solid var(--border-subtle); text-align: center;">
            <div id="edit-barcode-scanner-viewport" style="width: 100%; min-height: 220px; border-radius: var(--radius-sm); overflow: hidden; background: #020617;"></div>
            <div style="display: flex; justify-content: center; gap: 0.5rem; margin-top: 0.5rem;">
              <button type="button" class="btn btn-sm btn-secondary" id="btn-stop-edit-barcode-scanner">✕ إغلاق الماسح</button>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">الوصف وملاحظات إضافية (Description)</label>
          <textarea id="inp-edit-item-desc" class="form-control" rows="2" placeholder="وصف تفصيلي أو مواصفات تقنية...">${escapeHtml(item.description || '')}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">صورة المادة / Item Image</label>
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <label class="btn btn-sm btn-outline" style="cursor: pointer; margin: 0;">
              🖼️ تغيير الصورة من المعرض
              <input type="file" id="inp-edit-image-file" accept="image/jpeg,image/png,image/webp" style="display: none;">
            </label>
            <label class="btn btn-sm btn-outline" style="cursor: pointer; margin: 0;">
              📷 التقاط بالكاميرا
              <input type="file" id="inp-edit-image-camera" accept="image/jpeg,image/png,image/webp" capture="environment" style="display: none;">
            </label>
            <input type="hidden" id="inp-edit-image-url" value="${escapeHtml(item.imageUrl || '')}">
          </div>
          <div id="edit-image-preview-box" style="${item.imageUrl ? '' : 'display: none;'} margin-top: 0.5rem; text-align: center;">
            <img id="edit-image-preview" src="${formatImageUrl(item.imageUrl)}" alt="Preview" style="max-height: 120px; max-width: 100%; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); object-fit: cover;">
            <div style="margin-top: 0.25rem;">
              <button type="button" id="btn-edit-remove-image" class="btn btn-sm btn-outline" style="font-size: 0.72rem; color: var(--danger);">✕ إزالة الصورة</button>
            </div>
          </div>
        </div>
      </form>
    `;

    const modal = showModal({
      title: `✏️ تعديل بيانات المادة: ${item.name}`,
      content,
      confirmText: 'حفظ التعديلات',
      onConfirm: async (modalEl) => {
        stopModalScanner('edit-barcode-scanner-box', modalEl || modal);
        const name = (modalEl || modal).querySelector('#inp-edit-item-name')?.value.trim();
        const categoryId = (modalEl || modal).querySelector('#inp-edit-item-cat')?.value;
        const itemType = (modalEl || modal).querySelector('#inp-edit-item-type')?.value;
        const unit = (modalEl || modal).querySelector('#inp-edit-item-unit')?.value;
        const unitPrice = parseFloat((modalEl || modal).querySelector('#inp-edit-item-unit-price')?.value);
        const minStockVal = ((modalEl || modal).querySelector('#inp-edit-item-min-stock')?.value || '').trim();
        const minimumStock = minStockVal ? parseFloat(minStockVal) : null;
        const brand = ((modalEl || modal).querySelector('#inp-edit-item-brand')?.value || '').trim();
        const model = ((modalEl || modal).querySelector('#inp-edit-item-model')?.value || '').trim();
        const barcode = ((modalEl || modal).querySelector('#inp-edit-item-barcode')?.value || '').trim();
        const description = ((modalEl || modal).querySelector('#inp-edit-item-desc')?.value || '').trim();
        const isActive = (modalEl || modal).querySelector('#inp-edit-item-active')?.value === 'true';
        let imageUrl = ((modalEl || modal).querySelector('#inp-edit-image-url')?.value || '').trim();

        // If no new image URL was typed but item already has an image and it wasn't removed, retain it
        if (!imageUrl && item.imageUrl && (modalEl || modal).querySelector('#edit-image-preview-box')?.style.display !== 'none') {
          imageUrl = item.imageUrl;
        }

        if (!name || !categoryId || !unit || isNaN(unitPrice) || unitPrice < 0) {
          showToast('يرجى ملء جميع الحقول المطلوبة بشكل صحيح وبسعر صالح', 'error');
          return false;
        }

        // Upload file if new image was picked
        const fileInput = (modalEl || modal).querySelector('#inp-edit-image-file');
        const cameraInput = (modalEl || modal).querySelector('#inp-edit-image-camera');
        const selectedFile = (fileInput?.files?.[0]) || (cameraInput?.files?.[0]);

        if (selectedFile) {
          try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            const uploadRes = await api.post('/items/upload-image', formData);
            if (uploadRes.success && uploadRes.data?.url) {
              imageUrl = uploadRes.data.url;
            }
          } catch (uploadErr) {
            showToast('فشل رفع الصورة: ' + (uploadErr.message || 'خطأ غير معروف'), 'error');
            return false;
          }
        }

        try {
          await api.patch(`/items/${itemId}`, {
            name,
            categoryId,
            itemType,
            unit,
            unitPrice,
            minimumStock,
            brand,
            model,
            barcode: barcode || undefined,
            description,
            imageUrl: imageUrl || '',
            isActive,
          });

          showToast(`تم تعديل المادة "${name}" بنجاح`, 'success');
          if (typeof onSuccess === 'function') onSuccess();
          return true;
        } catch (err) {
          showToast(err.message || 'فشل تعديل المادة', 'error');
          return false;
        }
      }
    });

    // Barcode scanner listener in Edit Modal
    modal.querySelector('#btn-scan-edit-barcode')?.addEventListener('click', () => {
      const barcodeInp = modal.querySelector('#inp-edit-item-barcode');
      startModalScanner('edit-barcode-scanner-viewport', 'edit-barcode-scanner-box', barcodeInp, modal);
    });

    modal.querySelector('#btn-stop-edit-barcode-scanner')?.addEventListener('click', () => {
      stopModalScanner('edit-barcode-scanner-box', modal);
    });

    // Wire up image preview and remove button inside modal
    const fileInput = modal.querySelector('#inp-edit-image-file');
    const cameraInput = modal.querySelector('#inp-edit-image-camera');
    const previewBox = modal.querySelector('#edit-image-preview-box');
    const previewImg = modal.querySelector('#edit-image-preview');
    const removeBtn = modal.querySelector('#btn-edit-remove-image');
    const urlInput = modal.querySelector('#inp-edit-image-url');

    function handleFileChange(e) {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          if (previewImg) previewImg.src = evt.target.result;
          if (previewBox) previewBox.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    }

    fileInput?.addEventListener('change', handleFileChange);
    cameraInput?.addEventListener('change', handleFileChange);

    removeBtn?.addEventListener('click', () => {
      if (fileInput) fileInput.value = '';
      if (cameraInput) cameraInput.value = '';
      if (urlInput) urlInput.value = '';
      if (previewImg) previewImg.src = '';
      if (previewBox) previewBox.style.display = 'none';
    });

  } catch (err) {
    showToast(err.message || 'تعذر تحميل بيانات المادة', 'error');
  }
}

