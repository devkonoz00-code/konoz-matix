/**
 * Items Catalog & Stock Page Module (§11, §12, §13)
 * Full search, filters, multi-select batch label printing, initial stock allocation to warehouses, and update stock receipt.
 */
import { api } from '../js/api.js';
import { formatMoney, showToast, showModal, escapeHtml, formatImageUrl, openBarcodeScannerModal, openImageLightboxModal } from '../js/app.js';
import { i18n } from '../js/i18n.js';
import { router } from '../js/router.js';

const ITEM_EDITOR_ROLES = new Set(['ADMIN', 'WAREHOUSE_MANAGER']);
const ITEM_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ITEM_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

function getItemImageValidationError(file) {
  if (!file) return '';
  if (!ITEM_IMAGE_TYPES.has(file.type)) {
    return 'صيغة الصورة غير مدعومة. استخدم JPEG أو PNG أو WebP';
  }
  if (file.size > ITEM_IMAGE_MAX_BYTES) {
    return 'حجم الصورة يتجاوز الحد الأقصى 5 MB';
  }
  return '';
}

function getItemImageRequestErrorMessage(error) {
  if (
    error?.code === 'CLOUDINARY_NOT_CONFIGURED' ||
    error?.code === 'CLOUDINARY_INVALID_CONFIGURATION' ||
    error?.code === 'CLOUDINARY_CONFLICTING_CONFIGURATION'
  ) {
    return 'إعداد Cloudinary غير مكتمل على الخادم. أضف بيانات الحساب ثم أعد تشغيل النظام.';
  }
  if (error?.code === 'CLOUDINARY_AUTH_FAILED' || error?.code === 'CLOUDINARY_ACCOUNT_NOT_FOUND') {
    return 'رفض Cloudinary بيانات الحساب الموجودة على الخادم. تحقق من Cloud name وAPI key وAPI secret وأنها من الحساب نفسه.';
  }
  if (
    error?.code === 'CLOUDINARY_UPLOAD_TIMEOUT' ||
    error?.code === 'CLOUDINARY_UNAVAILABLE' ||
    error?.code === 'CLOUDINARY_RATE_LIMITED'
  ) {
    return 'تعذر الاتصال بـCloudinary مؤقتًا. انتظر قليلًا ثم أعد المحاولة.';
  }
  if (error?.code === 'CLOUDINARY_UPLOAD_REJECTED') {
    return 'رفض Cloudinary الصورة. تحقق من قيود حساب Cloudinary ثم جرّب صورة JPEG أو PNG أو WebP أصغر من 5 MB.';
  }
  if (error?.code === 'STORAGE_UPLOAD_FAILED' || error?.code === 'INVALID_STORAGE_RESPONSE') {
    return 'فشل رفع الصورة إلى Cloudinary. تحقق من بيانات الحساب والاتصال ثم حاول مجدداً.';
  }
  if (error?.code === 'ITEM_IMAGE_CONFLICT') {
    return 'تم تعديل المادة في الوقت نفسه من جلسة أخرى. أعد فتح التعديل ثم حاول مجدداً.';
  }
  return escapeHtml(error?.message || 'خطأ غير معروف');
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
              <th style="width: 72px; text-align: center;">الصورة</th>
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
            <tr><td colspan="10" style="text-align: center; color: var(--text-muted);">Loading catalog...</td></tr>
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
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 2rem; color: var(--text-muted);">No items found.</td></tr>`;
        return;
      }

      const currentUser = api.getCurrentUser();
      const isAdmin = currentUser?.role === 'ADMIN';
      const canEditItems = ITEM_EDITOR_ROLES.has(currentUser?.role);

      tbody.innerHTML = items.map(it => {
        const primaryBarcode = it.barcodes?.find(b => b.isPrimary) || it.barcodes?.[0];
        const barcodeCode = primaryBarcode ? primaryBarcode.code : it.itemCode;
        const itemId = escapeHtml(it._id || '');
        const itemCode = escapeHtml(it.itemCode || '');
        const itemName = escapeHtml(it.name || '');
        const itemBrand = escapeHtml(it.brand || '');
        const itemModel = escapeHtml(it.model || '');
        const itemCategory = escapeHtml(it.categoryId?.name || 'General');
        const itemTypeLabel = escapeHtml(it.itemType || '');
        const itemUnit = escapeHtml(it.unit || '');
        const itemBarcode = escapeHtml(barcodeCode || '');
        const itemImageUrl = escapeHtml(formatImageUrl(it.imageUrl));

        return `
          <tr>
            <td style="text-align: center;">
              <input type="checkbox" class="item-chk" value="${itemId}" style="cursor: pointer; width: 16px; height: 16px;">
            </td>
            <td style="text-align: center; padding: 0.45rem;">
              <a href="#/items/${itemId}" class="item-photo-link" aria-label="عرض تفاصيل ${itemName}" style="width: 52px; height: 52px; margin: 0 auto; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: var(--bg-surface-elevated); text-decoration: none;">
                ${itemImageUrl
                  ? `<img class="item-thumbnail-image" src="${itemImageUrl}" alt="${itemName}" loading="lazy" decoding="async" style="width: 100%; height: 100%; object-fit: cover;">`
                  : '<span aria-hidden="true" style="font-size: 1.35rem;">📦</span>'}
              </a>
            </td>
            <td>
              <a href="#/items/${itemId}" style="font-family: var(--font-mono); font-weight: 700; color: var(--primary);">${itemCode}</a>
            </td>
            <td>
              <div style="font-weight: 600; color: var(--text-primary);">${itemName}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${itemBrand} ${itemModel}</div>
            </td>
            <td><span class="badge badge-secondary">${itemCategory}</span></td>
            <td><span class="badge badge-info">${itemTypeLabel}</span></td>
            <td style="font-family: var(--font-mono);">${itemUnit}</td>
            <td>
              <a href="#/items/labels?ids=${itemId}" class="barcode-link" title="Click to view & print label for ${itemName}">
                <span>🔲</span>
                <span>${itemBarcode}</span>
              </a>
            </td>
            <td style="font-weight: 700; color: var(--success);">${formatMoney(it.unitPrice)}</td>
            <td>
              <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
                <button class="btn btn-sm btn-outline btn-receive-row" data-id="${itemId}" data-name="${itemName}" data-price="${Number(it.unitPrice) || 0}" data-unit="${itemUnit}" title="تحديث المخزون / استلام مواد بالمستودع">
                  <span>📥 + مخزون</span>
                </button>
                <a href="#/items/labels?ids=${itemId}" class="btn btn-sm btn-outline" title="Print Label">
                  <span>🖨️</span>
                </a>
                <a href="#/items/${itemId}" class="btn btn-sm btn-outline">
                  <span data-i18n="btn_view_history">التفاصيل</span> &rarr;
                </a>
                ${canEditItems ? `
                  <button class="btn btn-sm btn-outline btn-edit-item" data-id="${itemId}" title="تعديل بيانات المادة" style="color: var(--primary); border-color: rgba(59, 130, 246, 0.4);">
                    <span>✏️ تعديل</span>
                  </button>
                ` : ''}
                ${isAdmin ? `
                  <button class="btn btn-sm btn-outline btn-delete-item" data-id="${itemId}" data-name="${itemName}" title="حذف المادة (للأدمن فقط)" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.3);">
                    <span>🗑️</span>
                  </button>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      // Cloudinary/local delivery errors fallback to clean package icon
      tbody.querySelectorAll('.item-thumbnail-image').forEach(image => {
        image.addEventListener('error', () => {
          const wrapper = image.closest('.item-photo-link');
          if (wrapper) {
            wrapper.title = 'لا تتوفر صورة';
            wrapper.innerHTML = '<span aria-hidden="true" style="font-size: 1.35rem; opacity: 0.6;">📦</span>';
          }
        }, { once: true });
      });

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

      // Bind row edit buttons (ADMIN and WAREHOUSE_MANAGER)
      tbody.querySelectorAll('.btn-edit-item').forEach(btn => {
        btn.addEventListener('click', () => {
          openEditItemModal(btn.getAttribute('data-id'), loadItems);
        });
      });

      // Bind row delete buttons (Admin only)
      tbody.querySelectorAll('.btn-delete-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const itemId = btn.getAttribute('data-id');
          const itemName = escapeHtml(btn.getAttribute('data-name') || '');
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
              ${categories.map(c => `<option value="${escapeHtml(c._id || '')}">${escapeHtml(c.name || '')}</option>`).join('')}
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
                ${warehouses.map(w => `<option value="${escapeHtml(w._id || '')}">${escapeHtml(w.name || '')} (${escapeHtml(w.code || '')})</option>`).join('')}
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
            <span>كود بار المادة الأصلي / Original Barcode</span>
            <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: normal;">(يولد تلقائياً ITM-XXXXXX إذا ترك فارغاً)</span>
          </label>
          <div style="display: flex; gap: 0.5rem;">
            <input type="text" id="inp-item-barcode" class="form-control" placeholder="امسح الباركود الأصلي بالكاميرا أو اكتبه هنا...">
            <button type="button" class="btn btn-primary" id="btn-scan-item-barcode" style="display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; padding: 0.5rem 0.85rem; font-weight: 600;" title="مسح الباركود بالكاميرا">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>
              <span>مسح بالكاميرا</span>
            </button>
          </div>
          <div id="scanned-barcode-badge" style="display: none; margin-top: 0.4rem; font-size: 0.8rem; color: var(--success); background: rgba(16, 185, 129, 0.1); padding: 0.4rem 0.65rem; border-radius: var(--radius-sm); border: 1px solid rgba(16, 185, 129, 0.3);">
            ✅ <strong>تم مسح الباركود الأصلي:</strong> <span id="scanned-barcode-val" style="font-family: var(--font-mono); font-weight: 700;"></span>
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
        const name = document.getElementById('inp-item-name').value.trim();
        const categoryId = document.getElementById('inp-item-cat').value;
        const itemType = document.getElementById('inp-item-type').value;
        const unit = document.getElementById('inp-item-unit').value;
        const unitPrice = parseFloat(document.getElementById('inp-item-unit-price').value);
        const initialQty = parseFloat(document.getElementById('inp-item-initial-qty').value) || 0;
        const warehouseId = document.getElementById('inp-item-target-wh').value;
        const referenceDocNumber = document.getElementById('inp-item-initial-doc').value.trim();
        const minStockVal = document.getElementById('inp-item-min-stock').value;
        const minimumStock = minStockVal ? parseFloat(minStockVal) : undefined;
        const brand = document.getElementById('inp-item-brand').value.trim();
        const barcode = document.getElementById('inp-item-barcode').value.trim() || undefined;
        if (!name || !categoryId || !unit || isNaN(unitPrice)) {
          showToast('يرجى ملء جميع الحقول المطلوبة بشكل صحيح', 'error');
          return false;
        }

        const fileInput = document.getElementById('inp-item-image-file');
        const cameraInput = document.getElementById('inp-item-image-camera');
        const selectedFile = (fileInput && fileInput.files && fileInput.files[0])
          || (cameraInput && cameraInput.files && cameraInput.files[0]);
        const imageValidationError = getItemImageValidationError(selectedFile);
        if (imageValidationError) {
          showToast(imageValidationError, 'error');
          return false;
        }

        try {
          // Create the item exactly once, then attach its image through the
          // dedicated atomic endpoint. A later image failure must not repeat
          // this POST and create a duplicate item.
          const createPayload = {
            name,
            categoryId,
            itemType,
            unit,
            unitPrice,
            initialQuantity: initialQty > 0 ? initialQty : undefined,
            warehouseId: initialQty > 0 ? warehouseId : undefined,
            referenceDocNumber: referenceDocNumber || undefined,
            minimumStock,
            brand,
            barcode,
          };
          const createRes = await api.request('/items', {
            method: 'POST',
            headers: { 'Idempotency-Key': itemFormKey },
            body: JSON.stringify(createPayload),
          });

          if (selectedFile) {
            const createdItemId = createRes.data?._id;
            try {
              if (!createdItemId) throw new Error('لم يرجع الخادم معرّف المادة الجديدة');
              const formData = new FormData();
              formData.append('file', selectedFile);
              const imageRes = await api.request(`/items/${encodeURIComponent(createdItemId)}/image`, {
                method: 'PUT',
                body: formData,
              });
              if (!imageRes?.success) throw new Error('تعذر تثبيت الصورة على المادة');
            } catch (imageError) {
              showToast(`تم حفظ المادة بنجاح، لكن تعذر رفع الصورة. يمكنك إضافتها من زر التعديل: ${getItemImageRequestErrorMessage(imageError)}`, 'warning');
              loadItems();
              return true;
            }
          }

          if (initialQty > 0) {
            showToast(`تمت إضافة المادة "${escapeHtml(name)}" وتوجيه ${initialQty} ${escapeHtml(unit)} بنجاح إلى المستودع!`, 'success');
          } else {
            showToast(`تمت إضافة المادة "${escapeHtml(name)}" بنجاح!`, 'success');
          }
          loadItems();
          return true;
        } catch (err) {
          showToast(escapeHtml(err.message || 'تعذر حفظ المادة'), 'error');
          return false;
        }
      }
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

    // Camera Barcode Scanner for Original Barcode
    modal.querySelector('#btn-scan-item-barcode')?.addEventListener('click', () => {
      openBarcodeScannerModal({
        title: 'مسح كود بار المادة الأصلي',
        onScan: (scannedCode) => {
          const barcodeInput = modal.querySelector('#inp-item-barcode');
          if (barcodeInput) {
            barcodeInput.value = scannedCode;
            const badge = modal.querySelector('#scanned-barcode-badge');
            const badgeVal = modal.querySelector('#scanned-barcode-val');
            if (badge && badgeVal) {
              badgeVal.textContent = scannedCode;
              badge.style.display = 'block';
            }
            showToast(`تم مسح الباركود الأصلي بنجاح: ${scannedCode}`, 'success');
          }
        }
      });
    });

    // Image preview handlers for gallery and camera inputs
    function handleImagePreview(file, sourceInput) {
      const previewBox = modal.querySelector('#item-image-preview-box');
      const previewImg = modal.querySelector('#item-image-preview');
      if (file && previewBox && previewImg) {
        const validationError = getItemImageValidationError(file);
        if (validationError) {
          if (sourceInput) sourceInput.value = '';
          previewImg.removeAttribute('src');
          previewBox.style.display = 'none';
          showToast(validationError, 'error');
          return;
        }
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
        handleImagePreview(galleryInput.files[0], galleryInput);
      }
    });

    cameraInput?.addEventListener('change', () => {
      if (cameraInput.files[0]) {
        // Clear gallery input so only one is active
        if (galleryInput) galleryInput.value = '';
        handleImagePreview(cameraInput.files[0], cameraInput);
      }
    });

    modal.querySelector('#btn-remove-image')?.addEventListener('click', () => {
      if (galleryInput) galleryInput.value = '';
      if (cameraInput) cameraInput.value = '';
      const previewBox = modal.querySelector('#item-image-preview-box');
      if (previewBox) previewBox.style.display = 'none';
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
 * Opens the complete item editor for roles allowed by PATCH /api/items/:id.
 * Image metadata is always omitted from PATCH. Replacements and removals use
 * the dedicated atomic image endpoints after the item data is saved.
 */
export async function openEditItemModal(itemId, onSuccess) {
  const currentUser = api.getCurrentUser();
  const isAdmin = currentUser?.role === 'ADMIN';
  if (!ITEM_EDITOR_ROLES.has(currentUser?.role)) {
    showToast('ليس لديك صلاحية تعديل بيانات المواد', 'error');
    return;
  }

  if (!itemId) {
    showToast('تعذر تحديد المادة المطلوب تعديلها', 'error');
    return;
  }

  try {
    const encodedItemId = encodeURIComponent(itemId);
    const [itemRes, categoryRes] = await Promise.all([
      api.get(`/items/${encodedItemId}`),
      api.get('/categories'),
    ]);

    const item = itemRes.data;
    const categories = categoryRes.data || [];
    if (!item) throw new Error('تعذر تحميل بيانات المادة');

    const units = [
      { value: 'PIECE', label: 'PIECE (قطعة / pcs)' },
      { value: 'BAG', label: 'BAG (كيس / sac)' },
      { value: 'KG', label: 'KG (كيلوغرام)' },
      { value: 'TON', label: 'TON (طن)' },
      { value: 'METER', label: 'METER (متر)' },
      { value: 'CM', label: 'CM (سنتيمتر)' },
      { value: 'SQM', label: 'SQM (متر مربع m²)' },
      { value: 'CBM', label: 'CBM (متر مكعب m³)' },
      { value: 'LITER', label: 'LITER (لتر)' },
      { value: 'BOX', label: 'BOX (علبة / boîte)' },
      { value: 'ROLL', label: 'ROLL (لفة / rouleau)' },
    ];
    const itemTypes = [
      { value: 'MATERIAL', label: 'MATERIAL (مادة)' },
      { value: 'EQUIPMENT', label: 'EQUIPMENT (معدات)' },
      { value: 'TOOL', label: 'TOOL (أداة)' },
      { value: 'OTHER', label: 'OTHER (أخرى)' },
    ];

    const currentCategoryId = String(item.categoryId?._id || item.categoryId || '');
    const primaryBarcode = (item.barcodes || []).find(barcode => barcode.isPrimary)
      || (item.barcodes || [])[0];
    const originalImageUrl = typeof item.imageUrl === 'string' ? item.imageUrl.trim() : '';
    const formattedImageUrl = formatImageUrl(originalImageUrl);
    const hasOriginalImage = Boolean(originalImageUrl);

    const content = `
      <form id="form-edit-item" novalidate>
        <div style="margin-bottom: 0.9rem; padding: 0.65rem 0.85rem; background: var(--bg-surface-elevated); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
          <div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">كود المادة:</span>
            <strong style="font-family: var(--font-mono); color: var(--primary); margin-inline-start: 0.35rem;">${escapeHtml(item.itemCode || '')}</strong>
          </div>
          <span class="badge badge-info">${escapeHtml(item.itemType || 'MATERIAL')}</span>
        </div>

        <div class="form-group">
          <label class="form-label" for="inp-edit-item-name">اسم المادة / Item Name *</label>
          <input type="text" id="inp-edit-item-name" class="form-control" value="${escapeHtml(item.name || '')}" maxlength="250" required>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="inp-edit-item-cat">الفئة / الصنف *</label>
            <select id="inp-edit-item-cat" class="form-select" required>
              ${categories.map(category => {
                const categoryId = String(category._id || '');
                return `<option value="${escapeHtml(categoryId)}" ${categoryId === currentCategoryId ? 'selected' : ''}>${escapeHtml(category.name || '')}</option>`;
              }).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="inp-edit-item-type">نوع العنصر / Item Type *</label>
            <select id="inp-edit-item-type" class="form-select" required>
              ${itemTypes.map(type => `<option value="${type.value}" ${item.itemType === type.value ? 'selected' : ''}>${type.label}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="inp-edit-item-unit">وحدة القياس / Unit *</label>
            <select id="inp-edit-item-unit" class="form-select" required>
              ${units.map(unit => `<option value="${unit.value}" ${item.unit === unit.value ? 'selected' : ''}>${unit.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="inp-edit-item-unit-price">السعر الإفرادي (د.ج) *</label>
            <input type="number" step="0.01" min="0" id="inp-edit-item-unit-price" class="form-control" value="${Number(item.unitPrice) || 0}" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="inp-edit-item-min-stock">حد تنبيه انخفاض المخزون</label>
            <input type="number" step="1" min="0" id="inp-edit-item-min-stock" class="form-control" value="${item.minimumStock != null ? Number(item.minimumStock) : ''}">
          </div>
          ${isAdmin ? `
            <div class="form-group">
              <label class="form-label" for="inp-edit-item-active">حالة المادة</label>
              <select id="inp-edit-item-active" class="form-select">
                <option value="true" ${item.isActive !== false ? 'selected' : ''}>نشط / Active</option>
                <option value="false" ${item.isActive === false ? 'selected' : ''}>معطل / Inactive</option>
              </select>
            </div>
          ` : ''}
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="inp-edit-item-brand">الماركة / المصنّع</label>
            <input type="text" id="inp-edit-item-brand" class="form-control" value="${escapeHtml(item.brand || '')}" maxlength="160">
          </div>
          <div class="form-group">
            <label class="form-label" for="inp-edit-item-model">الموديل / المواصفة</label>
            <input type="text" id="inp-edit-item-model" class="form-control" value="${escapeHtml(item.model || '')}" maxlength="160">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="inp-edit-item-barcode">الباركود الأساسي</label>
          <input type="text" id="inp-edit-item-barcode" class="form-control" value="${escapeHtml(primaryBarcode?.code || '')}" readonly>
          <small style="display: block; margin-top: 0.3rem; color: var(--text-muted);">تتم إدارة الباركودات بصورة مستقلة من صفحة تفاصيل المادة.</small>
        </div>

        <div class="form-group">
          <label class="form-label" for="inp-edit-item-desc">الوصف وملاحظات إضافية</label>
          <textarea id="inp-edit-item-desc" class="form-control" rows="3" maxlength="2000">${escapeHtml(item.description || '')}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">صورة المادة / Item Image</label>
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <label class="btn btn-sm btn-outline" style="cursor: pointer; margin: 0;">
              🖼️ اختيار صورة جديدة
              <input type="file" id="inp-edit-image-file" accept="image/jpeg,image/png,image/webp" style="display: none;">
            </label>
            <label class="btn btn-sm btn-outline" style="cursor: pointer; margin: 0;">
              📷 التقاط بالكاميرا
              <input type="file" id="inp-edit-image-camera" accept="image/jpeg,image/png,image/webp" capture="environment" style="display: none;">
            </label>
            <span id="edit-image-file-name" style="font-size: 0.75rem; color: var(--text-muted);"></span>
          </div>
          <div id="edit-image-preview-box" style="${hasOriginalImage ? '' : 'display: none;'} margin-top: 0.65rem; padding: 0.65rem; text-align: center; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
            <img id="edit-image-preview" src="${escapeHtml(formattedImageUrl)}" alt="${escapeHtml(item.name || 'Preview')}" style="${formattedImageUrl ? '' : 'display: none;'} max-height: 180px; max-width: 100%; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); object-fit: contain;">
            <div id="edit-image-preview-status" style="${formattedImageUrl ? 'display: none;' : ''} color: var(--warning); font-size: 0.78rem; padding: 0.5rem;">تعذر عرض الصورة الحالية، لكن سيبقى رابطها محفوظاً ما لم تختر إزالتها أو استبدالها.</div>
            <div style="margin-top: 0.45rem;">
              <button type="button" id="btn-edit-remove-image" class="btn btn-sm btn-outline" style="font-size: 0.75rem; color: var(--danger);" ${hasOriginalImage ? '' : 'disabled'}>✕ إزالة الصورة</button>
            </div>
          </div>
          <small style="display: block; margin-top: 0.35rem; color: var(--text-muted);">JPEG أو PNG أو WebP، بحد أقصى 5 MB.</small>
        </div>
      </form>
    `;

    let imageRemoved = false;
    const modal = showModal({
      title: `✏️ تعديل بيانات المادة: ${escapeHtml(item.name || '')}`,
      content,
      confirmText: 'حفظ التعديلات',
      onConfirm: async (modalElement) => {
        const root = modalElement || modal;
        const name = (root.querySelector('#inp-edit-item-name')?.value || '').trim();
        const categoryId = root.querySelector('#inp-edit-item-cat')?.value || '';
        const itemType = root.querySelector('#inp-edit-item-type')?.value || '';
        const unit = root.querySelector('#inp-edit-item-unit')?.value || '';
        const unitPrice = Number(root.querySelector('#inp-edit-item-unit-price')?.value);
        const minimumStockRaw = (root.querySelector('#inp-edit-item-min-stock')?.value || '').trim();
        const minimumStock = minimumStockRaw === '' ? null : Number(minimumStockRaw);

        if (!name || !categoryId || !itemType || !unit || !Number.isFinite(unitPrice) || unitPrice < 0) {
          showToast('يرجى ملء الحقول المطلوبة وإدخال سعر صالح', 'error');
          return false;
        }
        if (minimumStock !== null && (!Number.isFinite(minimumStock) || minimumStock < 0)) {
          showToast('حد انخفاض المخزون يجب أن يكون رقماً موجباً أو صفراً', 'error');
          return false;
        }

        const payload = {
          name,
          categoryId,
          itemType,
          unit,
          unitPrice,
          minimumStock,
          brand: (root.querySelector('#inp-edit-item-brand')?.value || '').trim(),
          model: (root.querySelector('#inp-edit-item-model')?.value || '').trim(),
          description: (root.querySelector('#inp-edit-item-desc')?.value || '').trim(),
        };
        if (isAdmin) {
          payload.isActive = root.querySelector('#inp-edit-item-active')?.value === 'true';
        }

        const fileInput = root.querySelector('#inp-edit-image-file');
        const cameraInput = root.querySelector('#inp-edit-image-camera');
        const selectedFile = fileInput?.files?.[0] || cameraInput?.files?.[0];
        const imageValidationError = getItemImageValidationError(selectedFile);
        if (imageValidationError) {
          showToast(imageValidationError, 'error');
          return false;
        }

        let updateRes;
        try {
          updateRes = await api.patch(`/items/${encodedItemId}`, payload);
        } catch (error) {
          showToast(escapeHtml(error.message || 'فشل تعديل المادة'), 'error');
          return false;
        }

        try {
          if (selectedFile) {
            const formData = new FormData();
            formData.append('file', selectedFile);
            const imageRes = await api.request(`/items/${encodedItemId}/image`, {
              method: 'PUT',
              body: formData,
            });
            if (!imageRes?.success) throw new Error('تعذر تثبيت الصورة الجديدة');
          } else if (imageRemoved) {
            const imageRes = await api.delete(`/items/${encodedItemId}/image`);
            if (!imageRes?.success) throw new Error('تعذر حذف الصورة الحالية');
          }
        } catch (imageError) {
          showToast(`تم حفظ بيانات المادة، لكن تعذر ${imageRemoved ? 'حذف الصورة' : 'تحديث الصورة'}. أعد فتح التعديل وحاول مجدداً: ${getItemImageRequestErrorMessage(imageError)}`, 'warning');
          if (typeof onSuccess === 'function') await onSuccess(updateRes.data);
          return true;
        }

        showToast(`تم تعديل المادة "${escapeHtml(name)}" بنجاح`, 'success');
        if (typeof onSuccess === 'function') await onSuccess(updateRes.data);
        return true;
      },
    });

    const fileInput = modal.querySelector('#inp-edit-image-file');
    const cameraInput = modal.querySelector('#inp-edit-image-camera');
    const previewBox = modal.querySelector('#edit-image-preview-box');
    const previewImage = modal.querySelector('#edit-image-preview');
    const previewStatus = modal.querySelector('#edit-image-preview-status');
    const removeButton = modal.querySelector('#btn-edit-remove-image');
    const fileName = modal.querySelector('#edit-image-file-name');
    const showPreviewFailure = () => {
      if (previewImage) previewImage.style.display = 'none';
      if (previewStatus) {
        previewStatus.textContent = 'تعذر عرض الصورة الحالية، لكن سيبقى رابطها محفوظاً ما لم تختر إزالتها أو استبدالها.';
        previewStatus.style.display = 'block';
      }
    };

    previewImage?.addEventListener('error', showPreviewFailure);

    const previewSelectedFile = (selectedFile, sourceInput) => {
      if (!selectedFile) return;
      const validationError = getItemImageValidationError(selectedFile);
      if (validationError) {
        sourceInput.value = '';
        showToast(validationError, 'error');
        return;
      }

      imageRemoved = false;
      if (previewBox) previewBox.style.display = 'block';
      if (removeButton) removeButton.disabled = false;
      if (fileName) fileName.textContent = `${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB)`;

      const reader = new FileReader();
      reader.addEventListener('load', event => {
        if (previewImage) {
          previewImage.src = event.target?.result || '';
          previewImage.style.display = 'inline-block';
        }
        if (previewStatus) previewStatus.style.display = 'none';
      });
      reader.addEventListener('error', () => {
        showToast('تعذر قراءة ملف الصورة المحدد', 'error');
      });
      reader.readAsDataURL(selectedFile);
    };

    fileInput?.addEventListener('change', () => {
      if (fileInput.files?.[0]) {
        if (cameraInput) cameraInput.value = '';
        previewSelectedFile(fileInput.files[0], fileInput);
      }
    });
    cameraInput?.addEventListener('change', () => {
      if (cameraInput.files?.[0]) {
        if (fileInput) fileInput.value = '';
        previewSelectedFile(cameraInput.files[0], cameraInput);
      }
    });

    removeButton?.addEventListener('click', () => {
      imageRemoved = true;
      if (fileInput) fileInput.value = '';
      if (cameraInput) cameraInput.value = '';
      if (previewImage) {
        previewImage.removeAttribute('src');
        previewImage.style.display = 'none';
      }
      if (previewStatus) previewStatus.style.display = 'none';
      if (previewBox) previewBox.style.display = 'none';
      if (fileName) fileName.textContent = 'سيتم حذف الصورة عند حفظ التعديلات.';
      removeButton.disabled = true;
    });
  } catch (error) {
    showToast(escapeHtml(error.message || 'تعذر تحميل بيانات المادة'), 'error');
  }
}
