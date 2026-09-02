/**
 * Suppliers & Contacts Directory Module
 * Mobile-First Directory for Store Owners, Truck Drivers, Masons, and Craft Contractors.
 */
import { api } from '../js/api.js';
import { showToast, showModal, escapeHtml, playSuccessChime } from '../js/app.js';
import { i18n } from '../js/i18n.js';

// Supplier Categories Definitions
export const SUPPLIER_CATEGORIES = {
  BUILDING_MATERIALS: {
    label: 'محلات مواد البناء',
    icon: '🏪',
    color: '#3b82f6',
    bgLight: 'rgba(59, 130, 246, 0.12)',
    badgeClass: 'badge-primary',
  },
  SAND_TRUCKS: {
    label: 'شاحنات الرمل والحصى',
    icon: '🚛',
    color: '#f59e0b',
    bgLight: 'rgba(245, 158, 11, 0.12)',
    badgeClass: 'badge-warning',
  },
  WATER_TRUCKS: {
    label: 'شاحنات الماء',
    icon: '💧',
    color: '#06b6d4',
    bgLight: 'rgba(6, 182, 212, 0.12)',
    badgeClass: 'badge-info',
  },
  MASONS: {
    label: 'البناؤون والعمال',
    icon: '👷',
    color: '#10b981',
    bgLight: 'rgba(16, 185, 129, 0.12)',
    badgeClass: 'badge-success',
  },
  ELECTRICIANS: {
    label: 'كهربائيون',
    icon: '⚡',
    color: '#eab308',
    bgLight: 'rgba(234, 179, 8, 0.12)',
    badgeClass: 'badge-warning',
  },
  PLUMBERS: {
    label: 'سباكون',
    icon: '🚿',
    color: '#0284c7',
    bgLight: 'rgba(2, 132, 199, 0.12)',
    badgeClass: 'badge-info',
  },
  PAINTERS: {
    label: 'دهّانون',
    icon: '🎨',
    color: '#ec4899',
    bgLight: 'rgba(236, 72, 153, 0.12)',
    badgeClass: 'badge-purple',
  },
  ALUMINUM_GLASS: {
    label: 'ألومنيوم وزجاج',
    icon: '🪟',
    color: '#64748b',
    bgLight: 'rgba(100, 116, 139, 0.12)',
    badgeClass: 'badge-secondary',
  },
  BLACKSMITHS: {
    label: 'حدّادون',
    icon: '🏗️',
    color: '#8b5cf6',
    bgLight: 'rgba(139, 92, 246, 0.12)',
    badgeClass: 'badge-purple',
  },
  HEAVY_EQUIPMENT: {
    label: 'آليات ثقيلة وحفر',
    icon: '🚜',
    color: '#ea580c',
    bgLight: 'rgba(234, 88, 12, 0.12)',
    badgeClass: 'badge-warning',
  },
  OTHER: {
    label: 'أخرى',
    icon: '📦',
    color: '#6b7280',
    bgLight: 'rgba(107, 114, 128, 0.12)',
    badgeClass: 'badge-secondary',
  },
};

export async function renderSuppliers(container) {
  document.getElementById('page-title').textContent = 'الموردين والمتعاملين';

  const currentUser = api.getCurrentUser();
  const isAdmin = currentUser?.role === 'ADMIN';

  let currentCategory = 'ALL';
  let searchQuery = '';

  container.innerHTML = `
    <!-- Top Header Bar -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
      <div>
        <h2 style="font-size: 1.45rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem; margin: 0;">
          <span>📒</span>
          <span>دليل الموردين والمتعاملين</span>
        </h2>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.25rem;">
          سجل جهات الاتصال الخارجية للمشاريع (محلات، سائقو شاحنات، مهنيون) مع إمكانية الاتصال ومراسلة واتساب الفورية
        </p>
      </div>

      ${isAdmin ? `
        <button class="btn btn-primary" id="btn-add-supplier" style="font-weight: 700; border-radius: var(--radius-md); padding: 0.55rem 1.15rem; display: flex; align-items: center; gap: 0.4rem; box-shadow: 0 3px 10px rgba(37, 99, 235, 0.25);">
          <span>➕ إضافة مورد جديد</span>
        </button>
      ` : ''}
    </div>

    <!-- Search & Instant Filter Bar -->
    <div class="card" style="padding: 1rem; margin-bottom: 1.25rem; border-radius: var(--radius-lg); border: 1px solid var(--border-subtle); background: var(--bg-surface);">
      <div style="position: relative; margin-bottom: 0.85rem;">
        <input
          type="text"
          id="supplier-search"
          class="form-control"
          placeholder="🔍 ابحث بالاسم، المحل، النشاط، المدينة أو رقم الهاتف..."
          style="padding: 0.7rem 1rem; font-size: 0.95rem; border-radius: var(--radius-md);"
        >
      </div>

      <!-- Horizontal Scrollable Category Filter Chips -->
      <div class="supplier-chips-container" id="supplier-filter-chips" style="display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.35rem; -webkit-overflow-scrolling: touch;">
        <button class="supplier-chip active" data-cat="ALL" style="white-space: nowrap; border-radius: var(--radius-full); padding: 0.4rem 0.9rem; font-size: 0.82rem; font-weight: 700; cursor: pointer; border: 1px solid var(--border-subtle); background: var(--primary); color: #fff; display: flex; align-items: center; gap: 0.35rem; transition: all 0.2s;">
          <span>🌐 الكل</span>
          <span class="supplier-chip-count" id="count-ALL" style="background: rgba(255,255,255,0.25); border-radius: 9999px; padding: 0.1rem 0.45rem; font-size: 0.72rem;">0</span>
        </button>
        ${Object.entries(SUPPLIER_CATEGORIES).map(([key, cat]) => `
          <button class="supplier-chip" data-cat="${key}" style="white-space: nowrap; border-radius: var(--radius-full); padding: 0.4rem 0.9rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; border: 1px solid var(--border-subtle); background: var(--bg-surface-elevated); color: var(--text-secondary); display: flex; align-items: center; gap: 0.35rem; transition: all 0.2s;">
            <span>${cat.icon} ${cat.label}</span>
            <span class="supplier-chip-count" id="count-${key}" style="background: rgba(0,0,0,0.08); border-radius: 9999px; padding: 0.1rem 0.45rem; font-size: 0.72rem; color: var(--text-muted);">0</span>
          </button>
        `).join('')}
      </div>
    </div>

    <!-- Suppliers Grid Container -->
    <div id="suppliers-grid-container" class="grid-cols-2" style="gap: 1rem;">
      <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 3rem;">
        <div class="spinner" style="margin: 0 auto 0.75rem auto; width: 28px; height: 28px;"></div>
        جاري تحميل دليل الموردين...
      </div>
    </div>
  `;

  // Bind Search Input (Debounced)
  let debounceTimeout = null;
  const searchInput = container.querySelector('#supplier-search');
  searchInput?.addEventListener('input', (e) => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      searchQuery = e.target.value.trim();
      loadSuppliers();
    }, 250);
  });

  function selectCategoryChip(catKey) {
    currentCategory = catKey || 'ALL';
    filterChips.forEach((c) => {
      const isMatch = c.getAttribute('data-cat') === currentCategory;
      c.classList.toggle('active', isMatch);
      c.style.background = isMatch ? 'var(--primary)' : 'var(--bg-surface-elevated)';
      c.style.color = isMatch ? '#ffffff' : 'var(--text-secondary)';
      c.style.borderColor = isMatch ? 'var(--primary)' : 'var(--border-subtle)';
      c.style.fontWeight = isMatch ? '700' : '600';
    });
    loadSuppliers();
  }

  // Bind Category Filter Chips
  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const cat = chip.getAttribute('data-cat') || 'ALL';
      selectCategoryChip(cat);
    });
  });

  // Bind Add Supplier Button (Admin only)
  if (isAdmin) {
    container.querySelector('#btn-add-supplier')?.addEventListener('click', () => {
      openSupplierModal(null, (newCat) => {
        if (newCat) selectCategoryChip(newCat);
        else loadSuppliers();
      });
    });
  }

  // Load Data
  await loadSuppliers();

  // --- Main Loader Function ---
  async function loadSuppliers() {
    const grid = document.getElementById('suppliers-grid-container');
    if (!grid) return;

    try {
      const queryParams = { limit: 200 };
      if (currentCategory && currentCategory !== 'ALL') {
        queryParams.category = currentCategory;
      }
      if (searchQuery) {
        queryParams.search = searchQuery;
      }

      const res = await api.get('/suppliers', queryParams);

      const suppliers = res.data?.suppliers || [];
      const total = res.data?.total || 0;

      // Update count badge for active filter
      const totalCountBadge = document.getElementById(`count-${currentCategory}`);
      if (totalCountBadge) {
        totalCountBadge.textContent = suppliers.length;
      }

      if (suppliers.length === 0) {
        grid.innerHTML = `
          <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 3.5rem 1.5rem; border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle); background: var(--bg-surface);">
            <div style="font-size: 3rem; margin-bottom: 0.75rem;">📭</div>
            <h3 style="color: var(--text-primary); font-size: 1.15rem; font-weight: 700; margin-bottom: 0.4rem;">
              لا يوجد موردون أو متعاملون مطابقون
            </h3>
            <p style="color: var(--text-muted); font-size: 0.85rem; max-width: 420px; margin: 0 auto 1.25rem auto;">
              ${searchQuery ? `لم يتم العثور على نتائج للبحث "${escapeHtml(searchQuery)}".` : 'لم تتم إضافة أي موردين في هذه الفئة بعد.'}
            </p>
            ${isAdmin ? `
              <button class="btn btn-primary btn-sm" id="btn-empty-add-supplier" style="font-weight: 700;">
                ➕ إضافة مورد جديد الآن
              </button>
            ` : ''}
          </div>
        `;

        if (isAdmin) {
          grid.querySelector('#btn-empty-add-supplier')?.addEventListener('click', () => {
            openSupplierModal({ category: currentCategory !== 'ALL' ? currentCategory : 'BUILDING_MATERIALS' }, (newCat) => {
              if (newCat) selectCategoryChip(newCat);
              else loadSuppliers();
            });
          });
        }
        return;
      }

      grid.innerHTML = suppliers.map((s) => renderSupplierCard(s, isAdmin)).join('');

      // Attach Card Actions
      attachCardEventListeners(grid, loadSuppliers, isAdmin);

    } catch (err) {
      grid.innerHTML = `
        <div class="card error-container" style="grid-column: 1 / -1; padding: 2rem; text-align: center;">
          <p style="color: var(--danger); font-weight: 600;">تعذر تحميل دليل الموردين: ${escapeHtml(err.message)}</p>
          <button class="btn btn-outline btn-sm" onclick="window.location.reload()" style="margin-top: 0.5rem;">إعادة المحاولة</button>
        </div>
      `;
    }
  }

  // --- Render Single Supplier Card ---
  function renderSupplierCard(s, isAdminUser) {
    const catDef = SUPPLIER_CATEGORIES[s.category] || SUPPLIER_CATEGORIES.OTHER;
    const fullName = escapeHtml(s.fullName || 'مورد');
    const company = escapeHtml(s.company || '');
    const location = escapeHtml(s.location || '');
    const note = escapeHtml(s.note || '');
    const rawPhone = s.phone || '';
    const rawPhone2 = s.phone2 || '';

    // Initials for avatar
    const initials = fullName
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '👤';

    // WhatsApp formatting (+213 Algeria)
    let waUrl = '';
    let telUrl = '';
    if (rawPhone && rawPhone !== '—') {
      let cleanDigits = rawPhone.replace(/[^0-9]/g, '');
      if (cleanDigits.startsWith('00213')) {
        cleanDigits = cleanDigits.slice(2);
      } else if (cleanDigits.startsWith('0') && cleanDigits.length === 10) {
        cleanDigits = '213' + cleanDigits.slice(1);
      } else if (!cleanDigits.startsWith('213') && cleanDigits.length === 9) {
        cleanDigits = '213' + cleanDigits;
      }
      const waMsg = `السلام عليكم سيدي الكريم (${s.fullName})، نتواصل معك من طرف شركة البناء والأشغال بخصوص طلب خدمات ومواد.`;
      waUrl = `https://wa.me/${cleanDigits}?text=${encodeURIComponent(waMsg)}`;
      telUrl = `tel:${rawPhone}`;
    }

    let telUrl2 = '';
    if (rawPhone2) {
      telUrl2 = `tel:${rawPhone2}`;
    }

    return `
      <div class="card supplier-card" style="padding: 1.15rem; border-radius: var(--radius-lg); border: 1px solid var(--border-subtle); background: var(--bg-surface); display: flex; flex-direction: column; justify-content: space-between; box-shadow: var(--shadow-sm); position: relative; overflow: hidden; transition: transform 0.2s, box-shadow 0.2s;">
        
        <!-- Top Accent Bar -->
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 3.5px; background: ${catDef.color};"></div>

        <div>
          <!-- Header: Avatar, Name & Category Badge -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.85rem; gap: 0.5rem;">
            
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div class="supplier-avatar" style="width: 44px; height: 44px; min-width: 44px; border-radius: var(--radius-full); background: ${catDef.color}; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem; box-shadow: 0 3px 8px rgba(0,0,0,0.15);">
                <span>${catDef.icon}</span>
              </div>
              <div>
                <h3 style="margin: 0; font-size: 1rem; font-weight: 800; color: var(--text-primary); line-height: 1.3;">
                  ${fullName}
                </h3>
                ${company ? `
                  <div style="font-size: 0.82rem; color: var(--primary); font-weight: 600; margin-top: 0.1rem; display: flex; align-items: center; gap: 0.25rem;">
                    <span>🏢 ${company}</span>
                  </div>
                ` : ''}
              </div>
            </div>

            <span class="badge ${catDef.badgeClass}" style="font-size: 0.72rem; font-weight: 700; white-space: nowrap; padding: 0.25rem 0.6rem; border-radius: var(--radius-full);">
              ${catDef.label}
            </span>
          </div>

          <!-- Details Box (Location & Notes) -->
          <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.65rem 0.85rem; margin-bottom: 0.85rem; font-size: 0.82rem;">
            ${location ? `
              <div style="color: var(--text-secondary); display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.35rem;">
                <span>📍</span>
                <strong>الموقع:</strong>
                <span>${location}</span>
              </div>
            ` : ''}
            <div style="color: var(--text-secondary); display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.35rem;">
              <span>📞</span>
              <strong>الهاتف الأساسي:</strong>
              <a href="${telUrl}" style="font-family: var(--font-mono); font-weight: 700; color: var(--primary); text-decoration: none; direction: ltr; display: inline-block;">
                ${escapeHtml(rawPhone)}
              </a>
            </div>
            ${rawPhone2 ? `
              <div style="color: var(--text-muted); display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.35rem;">
                <span>📱</span>
                <strong>هاتف ثانوي:</strong>
                <a href="${telUrl2}" style="font-family: var(--font-mono); font-weight: 600; color: var(--text-secondary); text-decoration: none; direction: ltr; display: inline-block;">
                  ${escapeHtml(rawPhone2)}
                </a>
              </div>
            ` : ''}
            ${note ? `
              <div style="color: var(--text-muted); margin-top: 0.4rem; padding-top: 0.4rem; border-top: 1px dashed var(--border-subtle); line-height: 1.45; font-size: 0.8rem;">
                📝 <strong>ملاحظات:</strong> ${note}
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Direct Contact Actions Bar -->
        <div style="display: flex; gap: 0.45rem; border-top: 1px solid var(--border-subtle); padding-top: 0.75rem; flex-wrap: wrap; align-items: center;">
          ${telUrl ? `
            <a href="${telUrl}" class="btn btn-sm btn-outline" style="flex: 1; min-width: 95px; color: var(--accent-cyan); border-color: rgba(6, 182, 212, 0.4); text-decoration: none; font-size: 0.82rem; font-weight: 700; padding: 0.5rem 0.6rem; text-align: center; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; gap: 0.3rem;" title="اتصال هاتفي مباشر">
              <span>📞 اتصال</span>
            </a>
          ` : ''}
          ${waUrl ? `
            <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="flex: 1.2; min-width: 110px; background: #25D366; color: #ffffff; text-decoration: none; font-size: 0.82rem; font-weight: 800; padding: 0.5rem 0.65rem; text-align: center; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; gap: 0.3rem; box-shadow: 0 2px 8px rgba(37, 211, 102, 0.35);" title="مراسلة المورد عبر واتساب">
              <span>💬 واتساب</span>
            </a>
          ` : ''}
          ${isAdminUser ? `
            <button class="btn btn-sm btn-outline btn-edit-supplier" data-id="${s._id}" title="تعديل بيانات المورد" style="padding: 0.5rem 0.65rem; border-radius: var(--radius-md); font-weight: 700;">
              <span>✏️</span>
            </button>
            <button class="btn btn-sm btn-danger btn-delete-supplier" data-id="${s._id}" data-name="${fullName}" title="حذف المورد" style="padding: 0.5rem 0.65rem; border-radius: var(--radius-md); background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); color: var(--danger);">
              <span>🗑️</span>
            </button>
          ` : ''}
        </div>

      </div>
    `;
  }

  // --- Attach Event Listeners ---
  function attachCardEventListeners(grid, reloadFn, isAdminUser) {
    if (!isAdminUser) return;

    // Edit Supplier
    grid.querySelectorAll('.btn-edit-supplier').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const supId = btn.getAttribute('data-id');
        try {
          const res = await api.get(`/suppliers/${supId}`);
          if (res.data) {
            openSupplierModal(res.data, reloadFn);
          }
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    // Delete Supplier
    grid.querySelectorAll('.btn-delete-supplier').forEach((btn) => {
      btn.addEventListener('click', () => {
        const supId = btn.getAttribute('data-id');
        const supName = btn.getAttribute('data-name');
        showModal({
          title: `🗑️ حذف المورد (${supName})`,
          content: `
            <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 0.5rem;">
              <p style="color: var(--text-primary); font-size: 0.95rem; font-weight: 700; margin-bottom: 0.4rem;">
                هل أنت متأكد من حذف المورد <strong>${escapeHtml(supName)}</strong> نهائياً؟
              </p>
              <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0; line-height: 1.5;">
                سيتم إزالة جهة الاتصال من الدليل بشكل دائم.
              </p>
            </div>
          `,
          confirmText: 'نعم، حذف نهائي 🗑️',
          cancelText: 'إلغاء',
          onConfirm: async () => {
            try {
              await api.delete(`/suppliers/${supId}`);
              playSuccessChime();
              showToast(`تم حذف المورد ${supName} بنجاح`, 'success');
              reloadFn();
              return true;
            } catch (err) {
              showToast(err.message, 'error');
              return false;
            }
          },
        });
      });
    });
  }

  // --- Open Add / Edit Supplier Modal ---
  function openSupplierModal(supplier = null, reloadFn) {
    const isEdit = Boolean(supplier && supplier._id);
    const title = isEdit ? `✏️ تعديل بيانات المورد (${escapeHtml(supplier.fullName)})` : '➕ إضافة مورد أو متعامل جديد';

    const modalContent = `
      <form id="supplier-form" style="display: flex; flex-direction: column; gap: 0.85rem;">
        
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">
            الاسم الكامل / الصفة <span style="color: var(--danger);">*</span>:
          </label>
          <input
            type="text"
            id="inp-sup-name"
            class="form-control"
            placeholder="مثال: علي بن يوسف / محل الإخوة"
            value="${isEdit ? escapeHtml(supplier.fullName) : ''}"
            required
          >
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">
              رقم الهاتف الأساسي <span style="color: var(--danger);">*</span>:
            </label>
            <input
              type="tel"
              id="inp-sup-phone"
              class="form-control"
              placeholder="05 / 06 / 07 ..."
              value="${isEdit ? escapeHtml(supplier.phone) : ''}"
              required
              style="direction: ltr; text-align: right;"
            >
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">
              رقم هاتف إضافي (اختياري):
            </label>
            <input
              type="tel"
              id="inp-sup-phone2"
              class="form-control"
              placeholder="هاتف 2..."
              value="${isEdit ? escapeHtml(supplier.phone2 || '') : ''}"
              style="direction: ltr; text-align: right;"
            >
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">
              الفئة / نوع النشاط <span style="color: var(--danger);">*</span>:
            </label>
            <select id="inp-sup-cat" class="form-select" required>
              ${Object.entries(SUPPLIER_CATEGORIES).map(([key, cat]) => `
                <option value="${key}" ${isEdit && supplier.category === key ? 'selected' : (!isEdit && supplier?.category === key ? 'selected' : '')}>
                  ${cat.icon} ${cat.label}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">
              اسم المحل / الشركة (اختياري):
            </label>
            <input
              type="text"
              id="inp-sup-company"
              class="form-control"
              placeholder="مثال: مؤسسة الأمل لمواد البناء"
              value="${isEdit ? escapeHtml(supplier.company || '') : ''}"
            >
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">
            الموقع / المدينة / الورشة (اختياري):
          </label>
          <input
            type="text"
            id="inp-sup-location"
            class="form-control"
            placeholder="مثال: البليدة، المنطقة الصناعية"
            value="${isEdit ? escapeHtml(supplier.location || '') : ''}"
          >
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">
            ملاحظات وتفاصيل الخدمات (اختياري):
          </label>
          <textarea
            id="inp-sup-note"
            class="form-control"
            rows="2"
            placeholder="مثال: يوفر شاحنات 15 طن، متوفر يومياً من 7 صباحاً..."
          >${isEdit ? escapeHtml(supplier.note || '') : ''}</textarea>
        </div>

      </form>
    `;

    showModal({
      title,
      content: modalContent,
      confirmText: isEdit ? 'حفظ التعديلات 💾' : 'إضافة المورد ✅',
      cancelText: 'إلغاء',
      onConfirm: async (backdrop) => {
        const modalContainer = backdrop?.querySelector('.modal-body') || document.querySelector('.modal-body') || document;
        const fullName = modalContainer.querySelector('#inp-sup-name')?.value.trim();
        const phone = modalContainer.querySelector('#inp-sup-phone')?.value.trim();
        const phone2 = modalContainer.querySelector('#inp-sup-phone2')?.value.trim();
        const category = modalContainer.querySelector('#inp-sup-cat')?.value;
        const company = modalContainer.querySelector('#inp-sup-company')?.value.trim();
        const location = modalContainer.querySelector('#inp-sup-location')?.value.trim();
        const note = modalContainer.querySelector('#inp-sup-note')?.value.trim();

        if (!fullName) {
          showToast('يرجى إدخال اسم المورد أو المهني', 'error');
          return false;
        }
        if (!phone) {
          showToast('يرجى إدخال رقم الهاتف الأساسي', 'error');
          return false;
        }

        const payload = {
          fullName,
          phone,
          phone2: phone2 || undefined,
          category,
          company: company || undefined,
          location: location || undefined,
          note: note || undefined,
        };

        try {
          if (isEdit) {
            await api.put(`/suppliers/${supplier._id}`, payload);
            showToast('تم تحديث بيانات المورد بنجاح', 'success');
          } else {
            await api.post('/suppliers', payload);
            showToast('تمت إضافة المورد إلى الدليل بنجاح', 'success');
          }
          playSuccessChime();
          if (typeof reloadFn === 'function') {
            reloadFn(payload.category);
          }
          return true;
        } catch (err) {
          showToast(err.message, 'error');
          return false;
        }
      },
    });
  }
}
