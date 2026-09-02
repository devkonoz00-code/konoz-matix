/**
 * Material Requests Page Module — Mobile-First Redesign with Smart Archiving & Responsive Cards
 */
import { api } from '../js/api.js';
import {
  formatDate,
  getStatusBadge,
  showToast,
  showModal,
  escapeHtml,
  openImageLightboxModal,
  playSuccessChime,
  playConfirmBeep,
} from '../js/app.js';
import { i18n } from '../js/i18n.js';

export async function renderRequests(container) {
  document.getElementById('page-title').textContent = i18n.t('nav_requests');

  let activeTab = 'active'; // 'active' (Pending/Submitted) | 'archive' (Fulfilled/Cancelled)
  let viewMode = window.innerWidth <= 900 ? 'cards' : 'cards'; // 'cards' | 'table'
  let cachedRequests = [];

  container.innerHTML = `
    <!-- Top Header -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
      <div>
        <h2 style="font-size: 1.45rem; font-weight: 800; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 0.5rem;" data-i18n="nav_requests">
          <span>📋 طلبات المواد والورشات</span>
        </h2>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0.2rem 0 0 0;">
          استقبال واعتماد وتجهيز طلبات المواد من عمال الورشات والمشاريع
        </p>
      </div>
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
        <button class="btn btn-primary btn-sm" id="btn-create-quick-request" style="font-weight: 800; padding: 0.45rem 1rem; border-radius: var(--radius-md); background: linear-gradient(135deg, #7c3aed, #4f46e5); border: none; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4); display: flex; align-items: center; gap: 0.4rem;">
          <span>💬 + طلب ورشة فوري</span>
        </button>
        <button class="btn btn-outline btn-sm" id="btn-create-request" style="font-weight: 700; padding: 0.45rem 0.85rem; border-radius: var(--radius-md);">
          <span>📦 + طلب كتالوج قياسي</span>
        </button>
      </div>
    </div>

    <!-- Main Navigation Tabs: Active vs Archive -->
    <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 2px solid var(--border-subtle); padding-bottom: 0.5rem; flex-wrap: wrap;">
      <button class="tab-btn-requests active" id="tab-req-active" style="background: none; border: none; font-size: 0.95rem; font-weight: 700; padding: 0.6rem 1.2rem; border-radius: var(--radius-md); cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;">
        <span>⚡ الطلبات الحالية والمعلقة</span>
        <span id="badge-active-count" class="badge badge-warning" style="font-size: 0.72rem; padding: 0.15rem 0.5rem;">0</span>
      </button>
      <button class="tab-btn-requests" id="tab-req-archive" style="background: none; border: none; font-size: 0.95rem; font-weight: 600; padding: 0.6rem 1.2rem; border-radius: var(--radius-md); cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;">
        <span>🗄️ الأرشيف (المعالجة والملغاة)</span>
        <span id="badge-archive-count" class="badge badge-secondary" style="font-size: 0.72rem; padding: 0.15rem 0.5rem;">0</span>
      </button>
    </div>

    <!-- Smart Filter & Search Bar -->
    <div class="card" style="margin-bottom: 1.25rem; padding: 0.85rem 1rem; border-radius: var(--radius-md); background: var(--bg-surface-elevated);">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; align-items: center;">
        
        <!-- Search Input -->
        <div style="position: relative;">
          <input type="text" id="req-search-input" class="form-control" placeholder="🔍 بحث باسم العامل أو الورشة أو #REQ..." style="padding-left: 0.75rem; font-size: 0.88rem; height: 38px;">
        </div>

        <!-- Request Type Filter -->
        <div>
          <select id="req-type-filter" class="form-select" style="font-size: 0.88rem; height: 38px;">
            <option value="">جميع أنواع الطلبات (الكل)</option>
            <option value="WORKSHOP_QUICK">💬 طلبات الورشة الفورية (Workers)</option>
            <option value="STANDARD">📦 طلبات الكتالوج الرسمية</option>
          </select>
        </div>

        <!-- Project Filter -->
        <div>
          <select id="req-project-filter" class="form-select" style="font-size: 0.88rem; height: 38px;">
            <option value="">جميع المشاريع والورشات</option>
          </select>
        </div>

        <!-- View Toggle & Refresh -->
        <div style="display: flex; gap: 0.4rem; justify-content: flex-end;">
          <button class="btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-outline'}" id="btn-view-cards" title="عرض البطاقات السريعة للجوال" style="padding: 0.4rem 0.65rem;">
            <span>📱 بطاقات</span>
          </button>
          <button class="btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-outline'}" id="btn-view-table" title="عرض الجدول" style="padding: 0.4rem 0.65rem;">
            <span>🖥️ جدول</span>
          </button>
          <button class="btn btn-sm btn-outline" id="btn-refresh-reqs" title="تحديث القائمة" style="padding: 0.4rem 0.65rem;">
            <span>🔄</span>
          </button>
        </div>

      </div>
    </div>

    <!-- Requests Container (Cards Feed & Table) -->
    <div id="requests-content-area">
      <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
        <div class="spinner" style="margin: 0 auto 1rem;"></div>
        <div>جاري تحميل طلبات المواد...</div>
      </div>
    </div>
  `;

  i18n.translateDOM(container);

  // Tab switcher logic
  const tabActive = document.getElementById('tab-req-active');
  const tabArchive = document.getElementById('tab-req-archive');

  function updateTabStyles() {
    if (activeTab === 'active') {
      tabActive.style.background = 'var(--primary)';
      tabActive.style.color = '#fff';
      tabArchive.style.background = 'transparent';
      tabArchive.style.color = 'var(--text-secondary)';
    } else {
      tabArchive.style.background = 'rgba(255, 255, 255, 0.1)';
      tabArchive.style.color = '#fff';
      tabActive.style.background = 'transparent';
      tabActive.style.color = 'var(--text-secondary)';
    }
  }
  updateTabStyles();

  tabActive.addEventListener('click', () => {
    activeTab = 'active';
    updateTabStyles();
    renderFilteredData();
  });

  tabArchive.addEventListener('click', () => {
    activeTab = 'archive';
    updateTabStyles();
    renderFilteredData();
  });

  // View toggle buttons
  const btnCards = document.getElementById('btn-view-cards');
  const btnTable = document.getElementById('btn-view-table');

  btnCards.addEventListener('click', () => {
    viewMode = 'cards';
    btnCards.className = 'btn btn-sm btn-primary';
    btnTable.className = 'btn btn-sm btn-outline';
    renderFilteredData();
  });

  btnTable.addEventListener('click', () => {
    viewMode = 'table';
    btnTable.className = 'btn btn-sm btn-primary';
    btnCards.className = 'btn btn-sm btn-outline';
    renderFilteredData();
  });

  document.getElementById('btn-refresh-reqs')?.addEventListener('click', loadRequests);

  // Populate Projects in Filter
  try {
    const prjRes = await api.get('/projects');
    const prjSelect = document.getElementById('req-project-filter');
    if (prjSelect && prjRes.data) {
      prjRes.data.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p._id;
        opt.textContent = `${p.projectCode} — ${p.name}`;
        prjSelect.appendChild(opt);
      });
    }
  } catch {}

  // Fetch Requests from Backend
  async function loadRequests() {
    const requestType = document.getElementById('req-type-filter')?.value || '';
    const projectId = document.getElementById('req-project-filter')?.value || '';

    try {
      // Fetch all requests, we do instant smart client partitioning between active/archive
      const res = await api.get('/requests', { requestType, projectId });
      cachedRequests = res.data || [];

      // Update Counts
      const activeCount = cachedRequests.filter((r) =>
        ['SUBMITTED', 'DRAFT', 'APPROVED', 'PARTIALLY_FULFILLED'].includes(r.status)
      ).length;
      const archiveCount = cachedRequests.filter((r) =>
        ['FULFILLED', 'REJECTED', 'CANCELLED'].includes(r.status)
      ).length;

      const badgeActive = document.getElementById('badge-active-count');
      const badgeArchive = document.getElementById('badge-archive-count');
      if (badgeActive) badgeActive.textContent = activeCount;
      if (badgeArchive) badgeArchive.textContent = archiveCount;

      renderFilteredData();
    } catch (err) {
      const area = document.getElementById('requests-content-area');
      if (area) {
        area.innerHTML = `
          <div class="card" style="text-align: center; padding: 2.5rem 1rem; color: var(--danger);">
            <div style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem;">⚠️ تعذر تحميل الطلبات</div>
            <p style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(err.message)}</p>
            <button class="btn btn-sm btn-outline" onclick="window.location.reload()" style="margin-top: 1rem;">إعادة المحاولة</button>
          </div>
        `;
      }
      showToast(err.message, 'error');
    }
  }

  // Render Filtered Data (Cards or Table)
  function renderFilteredData() {
    const area = document.getElementById('requests-content-area');
    if (!area) return;

    const searchTerm = (document.getElementById('req-search-input')?.value || '').trim().toLowerCase();
    const requestType = document.getElementById('req-type-filter')?.value || '';
    const projectId = document.getElementById('req-project-filter')?.value || '';
    const currentUser = api.getCurrentUser();
    const canValidate = ['ADMIN', 'SUPERVISOR', 'WAREHOUSE_MANAGER'].includes(currentUser?.role);
    const isAdmin = currentUser?.role === 'ADMIN';

    // 1. Partition by Tab (Active vs Archive)
    let filtered = cachedRequests.filter((r) => {
      const isArchived = ['FULFILLED', 'REJECTED', 'CANCELLED'].includes(r.status);
      if (activeTab === 'active') return !isArchived;
      return isArchived;
    });

    // 2. Filter by Request Type
    if (requestType) {
      filtered = filtered.filter((r) => r.requestType === requestType);
    }

    // 3. Filter by Project
    if (projectId) {
      filtered = filtered.filter((r) => String(r.projectId?._id || r.projectId) === projectId);
    }

    // 4. Search Filter
    if (searchTerm) {
      filtered = filtered.filter((r) => {
        const num = (r.requestNumber || '').toLowerCase();
        const worker = (r.requestedBy?.fullName || '').toLowerCase();
        const prj = (r.projectId?.name || '').toLowerCase();
        const text = (r.textContent || r.note || '').toLowerCase();
        return num.includes(searchTerm) || worker.includes(searchTerm) || prj.includes(searchTerm) || text.includes(searchTerm);
      });
    }

    // Empty State
    if (filtered.length === 0) {
      area.innerHTML = `
        <div class="card" style="text-align: center; padding: 3.5rem 1.5rem; background: var(--bg-surface-elevated); border: 1px dashed var(--border-subtle); border-radius: var(--radius-lg);">
          <div style="font-size: 3rem; margin-bottom: 0.75rem;">${activeTab === 'active' ? '🎉' : '🗄️'}</div>
          <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.35rem;">
            ${activeTab === 'active' ? 'لا توجد طلبات معلقة حالياً' : 'الأرشيف فارغ'}
          </h3>
          <p style="color: var(--text-secondary); font-size: 0.85rem; max-width: 420px; margin: 0 auto 1.25rem;">
            ${activeTab === 'active' ? 'كافة طلبات المواد والورشات تمت معالجتها وشراؤها بنجاح.' : 'لا توجد سجلات طلبات مؤرشفة حتى الآن.'}
          </p>
          ${activeTab === 'active' ? `
            <button class="btn btn-outline btn-sm" id="btn-empty-archive-switch">
              <span>عرض سجل الأرشيف والطلبات السابقة &rarr;</span>
            </button>
          ` : ''}
        </div>
      `;

      area.querySelector('#btn-empty-archive-switch')?.addEventListener('click', () => {
        activeTab = 'archive';
        updateTabStyles();
        renderFilteredData();
      });
      return;
    }

    // --- Render Mode: Mobile Cards Feed ---
    if (viewMode === 'cards') {
      area.innerHTML = `
        <div class="requests-card-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem;">
          ${filtered.map((r) => renderRequestCard(r, canValidate, isAdmin)).join('')}
        </div>
      `;
    } else {
      // --- Render Mode: Desktop Dense Table ---
      area.innerHTML = `
        <div class="card" style="padding: 0; overflow: hidden; border-radius: var(--radius-md);">
          <div class="table-responsive">
            <table class="data-table" style="margin: 0;">
              <thead>
                <tr>
                  <th>Request #</th>
                  <th>النوع</th>
                  <th>المشروع / الورشة</th>
                  <th>مقدم الطلب</th>
                  <th>البيان / المواد</th>
                  <th>الحالة والمشاهدة</th>
                  <th>التاريخ</th>
                  <th style="text-align: center;">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map((r) => renderRequestTableRow(r, canValidate, isAdmin)).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // Bind Image Lightbox Clicks
    area.querySelectorAll('.req-photo-thumb').forEach((thumb) => {
      thumb.addEventListener('click', (e) => {
        e.stopPropagation();
        const src = thumb.getAttribute('data-src');
        if (src) openImageLightboxModal(src, 'صورة مادة الورشة المطلوبة');
      });
    });

    // Bind Fast VALIDE Buttons
    area.querySelectorAll('.btn-valide-req').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const reqId = btn.getAttribute('data-id');
        const reqNum = btn.getAttribute('data-num');
        const worker = btn.getAttribute('data-worker');
        const prjName = btn.getAttribute('data-project');

        showModal({
          title: `✅ تأكيد ومعالجة الطلب (${reqNum})`,
          content: `
            <div style="margin-bottom: 1rem; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); padding: 0.85rem; border-radius: var(--radius-md);">
              <div style="font-size: 0.95rem; color: #fff; font-weight: 700; margin-bottom: 0.25rem;">
                👷‍♂️ العامل: ${escapeHtml(worker)}
              </div>
              <div style="font-size: 0.82rem; color: var(--text-secondary);">
                🏗️ الورشة: ${escapeHtml(prjName)}
              </div>
            </div>
            <p style="color: var(--text-primary); font-size: 0.9rem; line-height: 1.5; margin-bottom: 1rem;">
              هل تم شراء وتجهيز أو تسليم المواد المطلوبة ونقل هذا الطلب إلى <strong>الأرشيف المكتمل</strong>؟
            </p>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-size: 0.85rem; font-weight: 600;">📝 ملاحظة التأكيد / الفاتورة (اختياري):</label>
              <input type="text" id="inp-valide-note" class="form-control" placeholder="مثال: تم الشراء نقداً وتسليمها في الورشة" style="font-size: 0.88rem;">
            </div>
          `,
          confirmText: 'تأكيد العملية (VALIDÉ) 🚀',
          onConfirm: async () => {
            const note = document.getElementById('inp-valide-note')?.value.trim() || '';
            try {
              await api.patch(`/requests/${reqId}/validate-quick`, { note });
              playSuccessChime();
              showToast(`تمت معالجة واعتماد الطلب ${reqNum} بنجاح!`, 'success');
              loadRequests();
              return true;
            } catch (err) {
              showToast(err.message, 'error');
              return false;
            }
          },
        });
      });
    });

    // Bind Admin Delete Buttons
    area.querySelectorAll('.btn-delete-req').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const reqId = btn.getAttribute('data-id');
        const reqNum = btn.getAttribute('data-num');

        showModal({
          title: `🗑️ حذف الطلب (${reqNum})`,
          content: `
            <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 0.5rem;">
              <p style="color: #fff; font-size: 0.95rem; font-weight: 700; margin-bottom: 0.4rem;">
                هل أنت متأكد من حذف الطلب (${escapeHtml(reqNum)}) نهائياً؟
              </p>
              <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0; line-height: 1.5;">
                سيتم حذف سجل الطلب وكافة صوره المرفقة من السحابة نهائياً ولا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>
          `,
          confirmText: 'نعم، حذف نهائي 🗑️',
          cancelText: 'إلغاء',
          onConfirm: async () => {
            try {
              await api.delete(`/requests/${reqId}`);
              playSuccessChime();
              showToast(`تم حذف الطلب ${reqNum} بنجاح`, 'success');
              loadRequests();
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

  // --- Helper: Render Mobile-First Request Card ---
  function renderRequestCard(r, canValidate, isAdmin) {
    const isQuick = r.requestType === 'WORKSHOP_QUICK';
    const isFulfilled = r.status === 'FULFILLED';
    const isUrgent = r.priority === 'URGENT' || r.priority === 'HIGH';
    const seenList = r.seenBy || [];
    const isSeen = seenList.length > 0;
    const lastSeen = isSeen ? seenList[seenList.length - 1] : null;

    const workerName = escapeHtml(r.requestedBy?.fullName || 'عامل الورشة');
    const workerPhone = escapeHtml(r.requestedBy?.phone || '');
    const projectName = escapeHtml(r.projectId?.name || 'الورشة');
    const projectCode = escapeHtml(r.projectId?.projectCode || '');
    const projectLoc = escapeHtml(r.projectId?.location || '');
    const textMessage = escapeHtml(r.textContent || r.note || 'طلب مواد');
    const photoUrls = r.photoUrls || (r.photoUrl ? [r.photoUrl] : []);

    // WhatsApp and Direct Phone Contact (Algeria +213 support)
    const rawPhone = r.requestedBy?.phone || '';
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
      const waMsg = `السلام عليكم ${r.requestedBy?.fullName || ''}، بخصوص طلب المواد ${r.requestNumber} لمشروع "${r.projectId?.name || ''}".`;
      waUrl = `https://wa.me/${cleanDigits}?text=${encodeURIComponent(waMsg)}`;
      telUrl = `tel:${rawPhone}`;
    }

    // Status & Seen Pill
    let seenBadge = '';
    if (isFulfilled) {
      seenBadge = '<span class="badge badge-success" style="font-size: 0.72rem; font-weight: 700;">✅ معالج (VALIDÉ)</span>';
    } else if (isSeen) {
      seenBadge = `<span class="badge badge-info" style="font-size: 0.72rem;" title="تم الاطلاع بواسطة ${escapeHtml(lastSeen?.user?.fullName || 'المشرف')}">👁️ تمت القراءة من طرف ${escapeHtml(lastSeen?.user?.fullName || 'المشرف')}</span>`;
    } else if (isQuick) {
      seenBadge = '<span class="badge badge-warning" style="font-size: 0.72rem; animation: pulse 2s infinite;">🟡 طلب جديد (غير مقروء)</span>';
    }

    const cardBorderColor = isFulfilled
      ? 'var(--success)'
      : isQuick && !isSeen
        ? 'var(--warning)'
        : 'var(--primary)';

    return `
      <div class="card req-mobile-card" style="padding: 1.1rem; border-radius: var(--radius-lg); border-top: 4px solid ${cardBorderColor}; background: var(--bg-surface-elevated); display: flex; flex-direction: column; justify-content: space-between; box-shadow: var(--shadow-sm); transition: transform 0.2s, box-shadow 0.2s;">
        
        <div>
          <!-- Header Bar: ID & Badges -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; gap: 0.5rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <a href="#/requests/${r._id}" style="font-family: var(--font-mono); font-weight: 800; font-size: 0.95rem; color: var(--primary); letter-spacing: 0.5px;">
                ${escapeHtml(r.requestNumber)}
              </a>
              ${isUrgent ? '<span class="badge badge-danger" style="font-size: 0.68rem; font-weight: 800; animation: pulse 1.5s infinite;">⚡ عاجل جداً</span>' : ''}
            </div>
            <div style="display: flex; gap: 0.35rem; align-items: center;">
              ${isQuick
                ? '<span class="badge badge-purple" style="font-size: 0.72rem; font-weight: 700;">💬 ورشة (عامل)</span>'
                : '<span class="badge badge-secondary" style="font-size: 0.72rem;">📦 كتالوج</span>'}
              ${getStatusBadge(r.status)}
            </div>
          </div>

          <!-- Worker & Project Details Box with Direct Call & WhatsApp -->
          <div style="background: rgba(0, 0, 0, 0.2); border-radius: var(--radius-md); padding: 0.75rem 0.85rem; margin-bottom: 0.85rem; border: 1px solid var(--border-subtle);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem; flex-wrap: wrap; gap: 0.4rem;">
              <div style="font-weight: 700; color: #fff; font-size: 0.92rem; display: flex; align-items: center; gap: 0.35rem;">
                <span>👷‍♂️ ${workerName}</span>
              </div>
              <div style="display: flex; gap: 0.4rem; align-items: center;">
                ${telUrl ? `
                  <a href="${telUrl}" class="badge badge-outline" style="color: var(--accent-cyan); text-decoration: none; font-size: 0.75rem; padding: 0.25rem 0.6rem; display: flex; align-items: center; gap: 0.2rem; border-color: rgba(6, 182, 212, 0.4);" title="اتصال هاتفي مباشر">
                    <span>📞 اتصال</span>
                  </a>
                ` : ''}
                ${waUrl ? `
                  <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="badge" style="background: #25D366; color: #fff; text-decoration: none; font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.65rem; display: flex; align-items: center; gap: 0.25rem; box-shadow: 0 2px 6px rgba(37, 211, 102, 0.3);" title="مراسلة العامل عبر واتساب مباشرة">
                    <span>💬 واتساب</span>
                  </a>
                ` : ''}
              </div>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.4rem;">
              <div>🏗️ <strong>${projectName}</strong> ${projectCode ? `(${projectCode})` : ''}</div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">🕒 ${formatDate(r.createdAt)}</div>
            </div>
          </div>

          <!-- Message Content Box -->
          <div style="background: ${isQuick ? 'rgba(124, 58, 237, 0.07)' : 'rgba(255, 255, 255, 0.03)'}; border-left: 3px solid ${isQuick ? 'var(--accent-purple)' : 'var(--border-subtle)'}; border-radius: 0 var(--radius-md) var(--radius-md) 0; padding: 0.75rem 0.9rem; margin-bottom: 0.85rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem; font-weight: 600;">
              ${isQuick ? '📝 نص طلب المواد المطلوب:' : '📋 ملاحظة الطلب:'}
            </div>
            <div style="font-size: 0.92rem; color: #fff; line-height: 1.5; white-space: pre-wrap; font-weight: 500;">${textMessage}</div>

            <!-- Photos Gallery (if any) -->
            ${photoUrls.length > 0 ? `
              <div style="margin-top: 0.75rem;">
                <div style="font-size: 0.73rem; color: var(--accent-cyan); font-weight: 600; margin-bottom: 0.4rem;">
                  📸 صور المواد المرفقة (${photoUrls.length}):
                </div>
                <div style="display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.35rem;">
                  ${photoUrls.map((pUrl) => `
                    <div class="req-photo-thumb" data-src="${escapeHtml(pUrl)}" style="cursor: pointer; width: 64px; height: 64px; min-width: 64px; border-radius: var(--radius-sm); overflow: hidden; border: 1.5px solid var(--border-subtle); background: #000; box-shadow: 0 2px 6px rgba(0,0,0,0.3); transition: transform 0.2s;">
                      <img src="${escapeHtml(pUrl)}" alt="صورة المادة" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Seen / Processed Status Pill -->
          <div style="margin-bottom: 0.85rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.4rem;">
            <div>${seenBadge}</div>
            ${isFulfilled && r.processedBy ? `
              <div style="font-size: 0.72rem; color: var(--success);">
                اعتماد: ${escapeHtml(r.processedBy.fullName || 'المشرف')}
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; border-top: 1px solid var(--border-subtle); padding-top: 0.75rem; flex-wrap: wrap;">
          ${canValidate && !isFulfilled && !['REJECTED', 'CANCELLED'].includes(r.status) ? `
            <button class="btn btn-sm btn-success btn-valide-req" data-id="${r._id}" data-num="${escapeHtml(r.requestNumber)}" data-worker="${workerName}" data-project="${projectName}" style="flex: 1; min-width: 100px; font-weight: 800; font-size: 0.85rem; padding: 0.55rem 0.5rem; border-radius: var(--radius-md); box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);">
              <span>✅ VALIDE مباشر</span>
            </button>
          ` : ''}
          <a href="#/requests/${r._id}" class="btn btn-sm btn-outline" style="flex: 1; min-width: 100px; font-size: 0.85rem; font-weight: 600; padding: 0.55rem 0.5rem; text-align: center; border-radius: var(--radius-md);">
            <span>🔍 التفاصيل &rarr;</span>
          </a>
          ${isAdmin ? `
            <button class="btn btn-sm btn-danger btn-delete-req" data-id="${r._id}" data-num="${escapeHtml(r.requestNumber)}" title="حذف الطلب نهائياً" style="font-weight: 700; padding: 0.55rem 0.75rem; border-radius: var(--radius-md); background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: var(--danger); display: flex; align-items: center; justify-content: center;">
              <span>🗑️</span>
            </button>
          ` : ''}
        </div>

      </div>
    `;
  }

  // --- Helper: Render Desktop Table Row ---
  function renderRequestTableRow(r, canValidate, isAdmin) {
    const isQuick = r.requestType === 'WORKSHOP_QUICK';
    const isFulfilled = r.status === 'FULFILLED';
    const seenList = r.seenBy || [];
    const isSeen = seenList.length > 0;
    const lastSeen = isSeen ? seenList[seenList.length - 1] : null;

    const workerName = escapeHtml(r.requestedBy?.fullName || '—');
    const projectName = escapeHtml(r.projectId?.name || '—');
    const rawPhone = r.requestedBy?.phone || '';
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
      const waMsg = `السلام عليكم ${r.requestedBy?.fullName || ''}، بخصوص طلب المواد ${r.requestNumber} لمشروع "${r.projectId?.name || ''}".`;
      waUrl = `https://wa.me/${cleanDigits}?text=${encodeURIComponent(waMsg)}`;
      telUrl = `tel:${rawPhone}`;
    }

    const contentSnippet = isQuick
      ? `<div style="font-size: 0.88rem; color: #fff; font-weight: 500; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(r.textContent || r.note || 'طلب مادة')}</div>
         ${r.photoUrls?.length > 0 ? `<span class="badge badge-info req-photo-thumb" data-src="${escapeHtml(r.photoUrls[0])}" style="cursor: pointer; font-size: 0.7rem; margin-top: 0.2rem;">📷 ${r.photoUrls.length} صور مرفقة</span>` : ''}`
      : `<span style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(r.note || 'طلب كتالوج قياسي')}</span>`;

    let seenBadge = '';
    if (isFulfilled) {
      seenBadge = '<span class="badge badge-success" style="font-size: 0.72rem;">✅ معالج (VALIDÉ)</span>';
    } else if (isSeen) {
      seenBadge = `<span class="badge badge-info" style="font-size: 0.72rem;">👁️ شوهد (${escapeHtml(lastSeen?.user?.fullName || 'المشرف')})</span>`;
    } else if (isQuick) {
      seenBadge = '<span class="badge badge-warning" style="font-size: 0.72rem; animation: pulse 2s infinite;">🟡 غير مقروء</span>';
    }

    return `
      <tr style="${isQuick && !isSeen && !isFulfilled ? 'background: rgba(245, 158, 11, 0.05);' : ''}">
        <td>
          <a href="#/requests/${r._id}" style="font-family: var(--font-mono); font-weight: 700; color: var(--primary);">${escapeHtml(r.requestNumber)}</a>
        </td>
        <td>
          ${isQuick
            ? '<span class="badge badge-purple" style="font-weight: 700;">💬 ورشة</span>'
            : '<span class="badge badge-secondary">📦 كتالوج</span>'}
        </td>
        <td style="font-weight: 600; color: var(--text-primary);">${projectName}</td>
        <td>
          <div style="font-weight: 600; color: #fff;">${workerName}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; gap: 0.35rem; align-items: center; margin-top: 0.2rem; flex-wrap: wrap;">
            ${telUrl ? `<a href="${telUrl}" style="color: var(--accent-cyan); text-decoration: none;">📞 ${escapeHtml(rawPhone)}</a>` : '<span>—</span>'}
            ${waUrl ? `<a href="${waUrl}" target="_blank" rel="noopener noreferrer" style="color: #25D366; text-decoration: none; font-weight: 700;">💬 واتساب</a>` : ''}
          </div>
        </td>
        <td>${contentSnippet}</td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            ${getStatusBadge(r.status)}
            ${seenBadge}
          </div>
        </td>
        <td style="font-size: 0.8rem; color: var(--text-muted);">${formatDate(r.createdAt).split(',')[0]}</td>
        <td>
          <div style="display: flex; gap: 0.35rem; align-items: center; justify-content: center; flex-wrap: wrap;">
            ${canValidate && !isFulfilled && !['REJECTED', 'CANCELLED'].includes(r.status) ? `
              <button class="btn btn-sm btn-success btn-valide-req" data-id="${r._id}" data-num="${escapeHtml(r.requestNumber)}" data-worker="${workerName}" data-project="${projectName}" title="تأكيد ومعالجة الطلب (VALIDÉ)" style="font-weight: 700; padding: 0.3rem 0.65rem;">
                <span>✅ VALIDE</span>
              </button>
            ` : ''}
            <a href="#/requests/${r._id}" class="btn btn-sm btn-outline" title="عرض التفاصيل الكاملة">
              <span>التفاصيل &rarr;</span>
            </a>
            ${isAdmin ? `
              <button class="btn btn-sm btn-danger btn-delete-req" data-id="${r._id}" data-num="${escapeHtml(r.requestNumber)}" title="حذف الطلب نهائياً" style="padding: 0.3rem 0.55rem; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: var(--danger);">
                <span>🗑️</span>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }

  // Filter change event handlers
  document.getElementById('req-search-input')?.addEventListener('input', renderFilteredData);
  document.getElementById('req-type-filter')?.addEventListener('change', loadRequests);
  document.getElementById('req-project-filter')?.addEventListener('change', loadRequests);

  // High-performance client-side image compression for mobile phones
  async function compressImageFile(file, maxWidth = 1400, maxHeight = 1400, quality = 0.82) {
    if (!file || !file.type.startsWith('image/')) return file;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => resolve(file);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  }

  // Messenger-Style Quick Request Modal (Admin / Supervisor / All Roles)
  document.getElementById('btn-create-quick-request')?.addEventListener('click', async () => {
    let projects = [];
    try {
      const prjRes = await api.get('/projects');
      const allProjects = prjRes.data || [];
      projects = allProjects.filter((p) => p.status !== 'ARCHIVED');
      if (projects.length === 0 && allProjects.length > 0) {
        projects = allProjects;
      }
    } catch (err) {
      showToast('تعذر تحميل قائمة المشاريع: ' + err.message, 'error');
    }

    const currentUser = api.getCurrentUser();
    let uploadedPhotoUrls = [];

    const optionsHtml = projects.length === 0
      ? '<option value="">-- لا توجد مشاريع مسجلة في النظام بعد --</option>'
      : (projects.length > 1 ? '<option value="">-- اختر المشروع أو الورشة --</option>' : '') +
        projects.map((p) => `<option value="${p._id}">${p.projectCode ? escapeHtml(p.projectCode) + ' — ' : ''}${escapeHtml(p.name)}</option>`).join('');

    const content = `
      <form id="form-popup-quick-request">
        <!-- Project Selector -->
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label" style="font-weight: 700; font-size: 0.9rem;">المشروع / الورشة الوجهة *</label>
          <select id="popup-quick-project" class="form-select" required style="font-size: 0.9rem; padding: 0.6rem;">
            ${optionsHtml}
          </select>
        </div>

        <!-- Messenger Textarea -->
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label" style="font-weight: 700; font-size: 0.9rem;">نص الطلب وبيان المواد المطلوبة *</label>
          <textarea id="popup-quick-text" class="form-control" rows="4" placeholder="✍️ اكتب هنا بالتفصيل ما تحتاجه (مثال: أحتاج 10 أكياس إسمنت، سلك ربط 2 لفة، 5 أقراص قطع حديد...)" required style="font-size: 0.95rem; line-height: 1.5; resize: vertical; border-radius: var(--radius-md); background: var(--bg-surface-elevated);"></textarea>
        </div>

        <!-- Urgency Toggle -->
        <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: var(--radius-md); padding: 0.65rem 0.85rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 0.4rem;">
            <span style="font-size: 1.1rem;">⚡</span>
            <span style="font-size: 0.88rem; font-weight: 700; color: #fff;">طلب عاجل جداً (Urgent Priority)</span>
          </div>
          <label class="switch" style="margin: 0; cursor: pointer;">
            <input type="checkbox" id="popup-quick-urgent">
            <span class="slider round"></span>
          </label>
        </div>

        <!-- Photos Attachment Section -->
        <div style="margin-bottom: 1.25rem;">
          <label class="form-label" style="font-weight: 700; font-size: 0.88rem; margin-bottom: 0.4rem; display: flex; justify-content: space-between;">
            <span>📸 إرفاق صور المواد أو الفواتير (اختياري)</span>
            <span style="font-size: 0.75rem; color: var(--accent-cyan);">ضغط فوري سحابي</span>
          </label>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button type="button" class="btn btn-sm btn-outline" id="btn-popup-camera" style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.82rem;">
              <span>📷 التقاط بالكاميرا</span>
            </button>
            <button type="button" class="btn btn-sm btn-outline" id="btn-popup-gallery" style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.82rem;">
              <span>🖼️ اختيار من المعرض</span>
            </button>
            <input type="file" id="popup-camera-input" accept="image/*" capture="environment" style="display: none;">
            <input type="file" id="popup-gallery-input" accept="image/*" multiple style="display: none;">
          </div>
          <div id="popup-photos-preview" style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem;"></div>
        </div>
      </form>
    `;

    const modal = showModal({
      title: '💬 إنشاء طلب ورشة فوري',
      content,
      confirmText: '🚀 إرسال الطلب الفوري',
      onConfirm: async (modalEl) => {
        const container = modalEl || modal;
        const projectSelect = container?.querySelector('#popup-quick-project') || document.getElementById('popup-quick-project');
        const textInput = container?.querySelector('#popup-quick-text') || document.getElementById('popup-quick-text');
        const urgentCheckbox = container?.querySelector('#popup-quick-urgent') || document.getElementById('popup-quick-urgent');

        const projectId = projectSelect ? projectSelect.value.trim() : '';
        const textContent = textInput ? textInput.value.trim() : '';
        const isUrgent = urgentCheckbox ? urgentCheckbox.checked : false;

        if (!projectId) {
          showToast('الرجاء اختيار المشروع أو الورشة أولاً', 'warning');
          projectSelect?.focus();
          return false;
        }

        if (!textContent) {
          showToast('الرجاء كتابة المواد المطلوبة في الحقل', 'warning');
          textInput?.focus();
          return false;
        }

        try {
          await api.post('/requests/quick', {
            projectId,
            textContent,
            priority: isUrgent ? 'URGENT' : 'NORMAL',
            photoUrls: uploadedPhotoUrls,
          });

          playSuccessChime();
          showToast('🚀 تم إرسال طلب الورشة الفوري بنجاح وظهر في القائمة!', 'success');
          loadRequests();
          return true;
        } catch (err) {
          showToast(err.message, 'error');
          return false;
        }
      },
    });

    // Handle Photos Upload & Preview
    async function handlePopupImage(rawFile) {
      if (!rawFile) return;
      const previewContainer = modal.querySelector('#popup-photos-preview');
      if (!previewContainer) return;

      const loadingEl = document.createElement('div');
      loadingEl.style.cssText = 'width: 60px; height: 60px; border-radius: var(--radius-sm); background: var(--bg-surface-elevated); display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 0.65rem; border: 1px dashed var(--primary); color: var(--primary); text-align: center;';
      loadingEl.innerHTML = '<span style="animation: pulse 1s infinite;">⚡ ضغط...</span>';
      previewContainer.appendChild(loadingEl);

      try {
        const fileToUpload = await compressImageFile(rawFile);
        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('entityType', 'MaterialRequest');
        formData.append('entityId', currentUser?._id || 'temp');

        const uploadRes = api.postFormData
          ? await api.postFormData('/attachments', formData)
          : await api.post('/attachments', formData);
        const url = uploadRes.data?.url || uploadRes.url || uploadRes.data?.attachment?.url;

        if (!url) throw new Error('فشل الحصول على رابط الصورة');

        uploadedPhotoUrls.push(url);
        playConfirmBeep();
        renderPopupPhotos();
      } catch (err) {
        loadingEl.remove();
        showToast(err.message || 'فشل رفع الصورة', 'error');
      }
    }

    function renderPopupPhotos() {
      const previewContainer = modal.querySelector('#popup-photos-preview');
      if (!previewContainer) return;

      previewContainer.innerHTML = uploadedPhotoUrls.map((url, idx) => `
        <div style="position: relative; width: 60px; height: 60px; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border-subtle); background: #000;">
          <img src="${escapeHtml(url)}" style="width: 100%; height: 100%; object-fit: cover;" alt="صورة المادة">
          <button type="button" class="btn-remove-popup-photo" data-idx="${idx}" style="position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; border-radius: 50%; background: rgba(239,68,68,0.9); color: #fff; border: none; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;" title="حذف الصورة">&times;</button>
        </div>
      `).join('');

      previewContainer.querySelectorAll('.btn-remove-popup-photo').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const idx = parseInt(btn.dataset.idx, 10);
          uploadedPhotoUrls.splice(idx, 1);
          renderPopupPhotos();
        });
      });
    }

    modal.querySelector('#btn-popup-camera')?.addEventListener('click', () => {
      modal.querySelector('#popup-camera-input')?.click();
    });

    modal.querySelector('#btn-popup-gallery')?.addEventListener('click', () => {
      modal.querySelector('#popup-gallery-input')?.click();
    });

    modal.querySelector('#popup-camera-input')?.addEventListener('change', (e) => {
      if (e.target.files?.[0]) handlePopupImage(e.target.files[0]);
      e.target.value = '';
    });

    modal.querySelector('#popup-gallery-input')?.addEventListener('change', (e) => {
      if (e.target.files) {
        Array.from(e.target.files).forEach((f) => handlePopupImage(f));
      }
      e.target.value = '';
    });
  });

  // New Request Modal (Standard Catalog)
  document.getElementById('btn-create-request').addEventListener('click', async () => {
    const [prjRes, itmRes] = await Promise.all([
      api.get('/projects?status=ACTIVE'),
      api.get('/items'),
    ]);

    const projects = prjRes.data || [];
    const items = itmRes.data || [];

    const content = `
      <form id="form-new-request">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">المشروع / الورشة الوجهة *</label>
            <select id="inp-req-project" class="form-select" required>
              ${projects.map((p) => `<option value="${p._id}">${p.projectCode} — ${p.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">مستوى الأولوية</label>
            <select id="inp-req-priority" class="form-select">
              <option value="NORMAL">عادي (NORMAL)</option>
              <option value="LOW">منخفض (LOW)</option>
              <option value="HIGH">مرتفع (HIGH)</option>
              <option value="URGENT">عاجل جداً (URGENT)</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">ملاحظة الطلب / الغرض</label>
          <input type="text" id="inp-req-note" class="form-control" placeholder="مثال: تجهيزات صب الأساسات ليوم الثلاثاء">
        </div>

        <div style="margin-top: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <label class="form-label" style="margin-bottom: 0; font-weight: 700;">قائمة المواد المطلوبة من الكتالوج</label>
            <button type="button" class="btn btn-sm btn-outline" id="btn-add-line">+ إضافة مادة</button>
          </div>
          <div id="request-lines-container" style="display: flex; flex-direction: column; gap: 0.75rem;">
            <!-- Lines dynamically added -->
          </div>
        </div>
      </form>
    `;

    const modal = showModal({
      title: 'إنشاء طلب مواد قياسي (كتالوج)',
      content,
      confirmText: 'حفظ وإرسال الطلب',
      onConfirm: async () => {
        const projectId = document.getElementById('inp-req-project').value;
        const priority = document.getElementById('inp-req-priority').value;
        const note = document.getElementById('inp-req-note').value.trim();

        const lineRows = document.querySelectorAll('.req-line-row');
        const lines = [];

        lineRows.forEach((row) => {
          const itemId = row.querySelector('.sel-item').value;
          const qty = parseFloat(row.querySelector('.inp-qty').value);
          const lineNote = row.querySelector('.inp-line-note').value.trim();
          if (itemId && qty > 0) {
            lines.push({ itemId, requestedQuantity: qty, note: lineNote });
          }
        });

        if (lines.length === 0) {
          showToast('الرجاء إضافة مادة واحدة على الأقل مع تحديد الكمية', 'error');
          return false;
        }

        const reqKey = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
        try {
          const res = await api.post('/requests', { projectId, priority, note, lines }, {
            headers: { 'Idempotency-Key': reqKey },
          });
          playSuccessChime();
          showToast(`تم إنشاء الطلب ${res.data?.request?.requestNumber || ''} بنجاح`, 'success');
          loadRequests();
          return true;
        } catch (err) {
          showToast(err.message, 'error');
          return false;
        }
      },
    });

    function addLineRow() {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'req-line-row';
      lineDiv.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 1.5fr auto; gap: 0.5rem; align-items: center; background: var(--bg-surface-elevated); padding: 0.5rem; border-radius: var(--radius-md);';
      lineDiv.innerHTML = `
        <select class="form-select sel-item">
          ${items.map((i) => `<option value="${i._id}">${i.itemCode} — ${i.name} (${i.unit})</option>`).join('')}
        </select>
        <input type="number" step="0.01" class="form-control inp-qty" placeholder="الكمية" value="1" min="0.01" required>
        <input type="text" class="form-control inp-line-note" placeholder="ملاحظة السطر">
        <button type="button" class="icon-button btn-remove-line" style="color: var(--danger); width: 32px; height: 32px;">&times;</button>
      `;

      lineDiv.querySelector('.btn-remove-line').addEventListener('click', () => lineDiv.remove());
      modal.querySelector('#request-lines-container').appendChild(lineDiv);
    }

    modal.querySelector('#btn-add-line').addEventListener('click', addLineRow);
    addLineRow();
  });

  // Initial load
  loadRequests();

  // Auto-refresh interval (every 25 seconds)
  const refreshInterval = setInterval(() => {
    if (document.getElementById('requests-content-area')) {
      loadRequests();
    } else {
      clearInterval(refreshInterval);
    }
  }, 25000);
}
