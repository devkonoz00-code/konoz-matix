/**
 * Material Request Detail Module
 */
import { api } from '../js/api.js';
import { formatMoney, formatDate, getStatusBadge, showToast, showModal, escapeHtml, openImageLightboxModal, playSuccessChime } from '../js/app.js';
import { i18n } from '../js/i18n.js';

export async function renderRequestDetail(container, params) {
  const requestId = params.id;
  document.getElementById('page-title').textContent = 'Material Request Detail';

  container.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <a href="#/requests" class="btn btn-sm btn-outline" style="margin-bottom: 1rem;">&larr; Back to Requests</a>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
        <div>
          <span style="font-family: var(--font-mono); color: var(--primary); font-weight: 700;" id="req-num">Loading...</span>
          <h2 style="font-size: 1.6rem; font-weight: 700; color: var(--text-primary); margin-top: 0.15rem;" id="req-prj-name">—</h2>
          <p style="color: var(--text-secondary); font-size: 0.85rem;" id="req-requester">—</p>
        </div>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;" id="req-actions-bar">
          <!-- Lifecycle Action Buttons -->
        </div>
      </div>
    </div>

    <!-- Request Status & Summary Cards -->
    <div class="grid-cols-4" style="margin-bottom: 1.5rem;">
      <div class="card stat-card">
        <div class="stat-icon purple">📌</div>
        <div class="stat-content">
          <div class="stat-label">Current Status</div>
          <div class="stat-value" style="font-size: 1.15rem; padding-top: 0.35rem;" id="stat-req-status">—</div>
          <div class="stat-subtext" id="stat-req-priority">Priority: —</div>
        </div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon blue">📅</div>
        <div class="stat-content">
          <div class="stat-label">Date Submitted</div>
          <div class="stat-value" style="font-size: 1rem; padding-top: 0.4rem;" id="stat-req-date">—</div>
          <div class="stat-subtext">Immutable log timestamp</div>
        </div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon cyan">📦</div>
        <div class="stat-content">
          <div class="stat-label">Request Type</div>
          <div class="stat-value" style="font-size: 1.05rem;" id="stat-req-type">—</div>
          <div class="stat-subtext" id="stat-req-line-count">—</div>
        </div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon green">💰</div>
        <div class="stat-content">
          <div class="stat-label">Estimated Value</div>
          <div class="stat-value" id="stat-req-est-value">—</div>
          <div class="stat-subtext" id="stat-req-seen-info">—</div>
        </div>
      </div>
    </div>

    <!-- Dynamic Content: Either Quick Messenger Chat View OR Catalog Lines Table -->
    <div id="req-main-content-container"></div>

    <!-- Request Notes / Audit Trail -->
    <div class="card" style="margin-top: 1.5rem;">
      <h3 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.5rem;">Request Notes & Tracking</h3>
      <p style="color: var(--text-secondary); font-size: 0.9rem;" id="req-note-text">—</p>
      <div id="req-seen-trail" style="margin-top: 0.75rem; font-size: 0.8rem; color: var(--text-muted);"></div>
    </div>
  `;

  i18n.translateDOM(container);

  async function loadRequest() {
    try {
      const res = await api.get(`/requests/${requestId}`);
      const { request, lines } = res.data;
      const currentUser = api.getCurrentUser();
      const isSupervisorOrAdmin = ['ADMIN', 'SUPERVISOR', 'WAREHOUSE_MANAGER'].includes(currentUser?.role);

      // Auto mark as seen by supervisor/admin if not requester
      if (isSupervisorOrAdmin && String(request.requestedBy?._id || request.requestedBy) !== String(currentUser?._id)) {
        api.patch(`/requests/${requestId}/seen`).catch(() => {});
      }

      const rawPhone = request.requestedBy?.phone || '';
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
        const waMsg = `السلام عليكم ${request.requestedBy?.fullName || ''}، بخصوص طلب المواد ${request.requestNumber} لمشروع "${request.projectId?.name || ''}".`;
        waUrl = `https://wa.me/${cleanDigits}?text=${encodeURIComponent(waMsg)}`;
        telUrl = `tel:${rawPhone}`;
      }

      document.getElementById('req-num').textContent = request.requestNumber;
      document.getElementById('req-prj-name').textContent = `Project: ${request.projectId?.name || 'Site'}`;
      document.getElementById('req-requester').innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-top: 0.25rem;">
          <span>👷‍♂️ مقدم الطلب: <strong>${escapeHtml(request.requestedBy?.fullName || '—')}</strong></span>
          ${telUrl ? `
            <a href="${telUrl}" class="btn btn-sm btn-outline" style="padding: 0.2rem 0.6rem; font-size: 0.75rem; color: var(--accent-cyan); border-color: rgba(6, 182, 212, 0.4); text-decoration: none; display: flex; align-items: center; gap: 0.25rem;">
              <span>📞 اتصال (${escapeHtml(rawPhone)})</span>
            </a>
          ` : ''}
          ${waUrl ? `
            <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-success" style="padding: 0.2rem 0.65rem; font-size: 0.75rem; background: #25D366; border-color: #25D366; color: #fff; font-weight: 700; text-decoration: none; display: flex; align-items: center; gap: 0.25rem; box-shadow: 0 2px 6px rgba(37, 211, 102, 0.3);">
              <span>💬 واتساب</span>
            </a>
          ` : ''}
        </div>
      `;
      document.getElementById('stat-req-status').innerHTML = getStatusBadge(request.status);
      document.getElementById('stat-req-priority').textContent = `Priority: ${request.priority}`;
      document.getElementById('stat-req-date').textContent = formatDate(request.createdAt).split(',')[0];

      const isQuick = request.requestType === 'WORKSHOP_QUICK';
      document.getElementById('stat-req-type').innerHTML = isQuick
        ? '<span class="badge badge-purple">💬 رسالة ورشة</span>'
        : '<span class="badge badge-secondary">📦 كتالوج مواد</span>';

      document.getElementById('stat-req-line-count').textContent = isQuick
        ? (request.photoUrls?.length ? `${request.photoUrls.length} صور مرفقة` : 'نص حر')
        : `${lines.length} مواد مسجلة`;

      const totalEst = lines.reduce((sum, l) => sum + (l.requestedQuantity * (l.unitCostSnapshot || 0)), 0);
      document.getElementById('stat-req-est-value').textContent = isQuick ? '—' : formatMoney(totalEst);

      // Seen info
      const seenEntries = request.seenBy || [];
      const seenEl = document.getElementById('stat-req-seen-info');
      if (seenEl) {
        seenEl.textContent = seenEntries.length > 0
          ? `شوهد بواسطة ${seenEntries[seenEntries.length - 1]?.user?.fullName || 'المشرف'}`
          : 'لم يُشاهد بعد';
      }

      document.getElementById('req-note-text').textContent = request.note || (isQuick ? request.textContent : 'No notes attached.');

      // Seen Trail
      const trailEl = document.getElementById('req-seen-trail');
      if (trailEl && seenEntries.length > 0) {
        trailEl.innerHTML = `<strong>سجل المشاهدات:</strong> ` +
          seenEntries.map(s => `👁️ ${escapeHtml(s.user?.fullName || 'مستخدم')} (${formatDate(s.seenAt)})`).join(' • ');
      }

      // Render Main Content
      const mainContainer = document.getElementById('req-main-content-container');
      if (isQuick) {
        // Quick Messenger-style Request View
        const photos = Array.isArray(request.photoUrls) ? request.photoUrls : [];
        mainContainer.innerHTML = `
          <div class="card" style="padding: 1.5rem; border: 1px solid rgba(59, 130, 246, 0.3); background: var(--bg-surface);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem;">
              <h3 style="font-size: 1.15rem; font-weight: 700; margin: 0; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                <span>💬 رسالة العامل وبيان المواد المطلوبة</span>
              </h3>
              <span class="badge ${request.priority === 'URGENT' ? 'badge-danger' : 'badge-secondary'}">${request.priority}</span>
            </div>

            <!-- Worker Message Bubble -->
            <div style="background: var(--bg-surface-elevated); padding: 1.25rem; border-radius: var(--radius-md); border-right: 5px solid var(--primary); margin-bottom: 1.25rem;">
              <div style="font-size: 0.8rem; color: var(--accent-cyan); font-weight: 600; margin-bottom: 0.4rem;">
                👷‍♂️ كَتَبَ العامل: ${escapeHtml(request.requestedBy?.fullName || 'العامل')}
              </div>
              <p style="margin: 0; font-size: 1.05rem; color: #fff; line-height: 1.6; white-space: pre-wrap; font-weight: 500;">${escapeHtml(request.textContent || request.note || '')}</p>
            </div>

            <!-- Photos Gallery -->
            ${photos.length > 0 ? `
              <div>
                <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.75rem;">
                  📷 الصور المرفقة من موقع الورشة (${photos.length})
                </h4>
                <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                  ${photos.map(pUrl => `
                    <div class="quick-req-photo-thumb" data-src="${escapeHtml(pUrl)}" style="cursor: pointer; width: 140px; height: 140px; border-radius: var(--radius-md); overflow: hidden; border: 2px solid var(--border-subtle); background: #000; box-shadow: 0 4px 10px rgba(0,0,0,0.3); transition: transform 0.2s;" onmouseenter="this.style.transform='scale(1.03)'" onmouseleave="this.style.transform='scale(1)'">
                      <img src="${escapeHtml(pUrl)}" alt="صورة المادة" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Processed Info if fulfilled -->
            ${request.status === 'FULFILLED' ? `
              <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: var(--radius-md); padding: 1rem; margin-top: 1.25rem;">
                <div style="font-weight: 700; color: var(--success); font-size: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                  <span>✅ تمت معالجة واعتماد هذا الطلب بنجاح (VALIDÉ)</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.35rem;">
                  المشرف المسؤول: <strong>${escapeHtml(request.processedBy?.fullName || 'المشرف')}</strong> • ${request.processedAt ? formatDate(request.processedAt) : ''}
                </div>
                ${request.processingNote ? `<div style="margin-top: 0.35rem; font-size: 0.85rem; color: var(--text-primary);">📝 ملاحظة: ${escapeHtml(request.processingNote)}</div>` : ''}
              </div>
            ` : ''}
          </div>
        `;

        mainContainer.querySelectorAll('.quick-req-photo-thumb').forEach(thumb => {
          thumb.addEventListener('click', () => {
            const src = thumb.getAttribute('data-src');
            if (src) openImageLightboxModal(src, 'صورة مادة الورشة المطلوبة');
          });
        });

      } else {
        // Standard Catalog Lines Table
        mainContainer.innerHTML = `
          <div class="card" style="margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 1rem;">Requested Material Lines</h3>
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Item Code</th>
                    <th>Material / Tool Name</th>
                    <th>Unit</th>
                    <th>Requested Qty</th>
                    <th>Approved Qty</th>
                    <th>Fulfilled Qty</th>
                    <th>Unit Snapshot Cost</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody id="req-lines-table-body">
                  ${lines.map(l => `
                    <tr>
                      <td><a href="#/items/${l.itemId?._id}" style="font-family: var(--font-mono); font-weight: 600; color: var(--primary);">${l.itemId?.itemCode || '—'}</a></td>
                      <td style="font-weight: 600; color: #fff;">${l.itemId?.name || 'Item'}</td>
                      <td>${l.itemId?.unit || 'unit'}</td>
                      <td style="font-weight: 700; color: var(--text-primary);">${l.requestedQuantity}</td>
                      <td style="font-weight: 700; color: var(--success);">${l.approvedQuantity !== undefined ? l.approvedQuantity : '—'}</td>
                      <td style="font-weight: 700; color: var(--accent-cyan);">${l.fulfilledQuantity || 0}</td>
                      <td>${formatMoney(l.unitCostSnapshot || 0)}</td>
                      <td style="font-size: 0.8rem; color: var(--text-muted);">${l.note || '—'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }

      // Build Lifecycle Actions Bar based on Status & Role
      const actionsBar = document.getElementById('req-actions-bar');
      actionsBar.innerHTML = '';

      if (isQuick) {
        if (request.status === 'SUBMITTED' && isSupervisorOrAdmin) {
          actionsBar.innerHTML = `
            <button class="btn btn-success btn-sm" id="btn-valide-quick-detail" style="font-weight: 700; font-size: 0.95rem; padding: 0.45rem 1.25rem;">
              <span>✅ تأكيد ومعالجة الطلب (VALIDÉ)</span>
            </button>
            <button class="btn btn-danger btn-sm" id="btn-cancel-req">رفض / إلغاء</button>
          `;

          actionsBar.querySelector('#btn-valide-quick-detail')?.addEventListener('click', async () => {
            showModal({
              title: `✅ تأكيد ومعالجة الطلب (${request.requestNumber})`,
              content: `
                <p style="color: var(--text-primary); margin-bottom: 0.75rem;">
                  هل تم شراء وتجهيز أو تسليم المواد المطلوبة للعامل <strong>${escapeHtml(request.requestedBy?.fullName || 'العامل')}</strong>؟
                </p>
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-size: 0.85rem;">ملاحظة التأكيد / مرجع الفاتورة (اختياري):</label>
                  <input type="text" id="inp-valide-note-detail" class="form-control" placeholder="مثال: تم الشراء والتسليم للورشة">
                </div>
              `,
              confirmText: 'تأكيد العملية (VALIDÉ)',
              onConfirm: async () => {
                const note = document.getElementById('inp-valide-note-detail')?.value.trim() || '';
                try {
                  await api.patch(`/requests/${requestId}/validate-quick`, { note });
                  playSuccessChime();
                  showToast('تمت معالجة واعتماد الطلب بنجاح (VALIDÉ)!', 'success');
                  loadRequest();
                  return true;
                } catch (err) {
                  showToast(err.message, 'error');
                  return false;
                }
              }
            });
          });

          actionsBar.querySelector('#btn-cancel-req')?.addEventListener('click', async () => {
            await api.patch(`/requests/${requestId}/cancel`);
            showToast('تم إلغاء الطلب', 'info');
            loadRequest();
          });
        }
      } else {
        // Standard Catalog lifecycle
        if (request.status === 'DRAFT') {
          actionsBar.innerHTML = `
            <button class="btn btn-primary btn-sm" id="btn-submit-req">
              <span data-i18n="btn_submit">Submit Request</span>
            </button>
            <button class="btn btn-danger btn-sm" id="btn-cancel-req">Cancel</button>
          `;
          actionsBar.querySelector('#btn-submit-req')?.addEventListener('click', async () => {
            await api.patch(`/requests/${requestId}/submit`);
            showToast('Request submitted for warehouse approval', 'success');
            loadRequest();
          });
          actionsBar.querySelector('#btn-cancel-req')?.addEventListener('click', async () => {
            await api.patch(`/requests/${requestId}/cancel`);
            showToast('Request cancelled', 'info');
            loadRequest();
          });
        } else if (request.status === 'SUBMITTED' && isSupervisorOrAdmin) {
          actionsBar.innerHTML = `
            <button class="btn btn-success btn-sm" id="btn-approve-req">
              <span data-i18n="btn_approve">Approve Request</span>
            </button>
            <button class="btn btn-danger btn-sm" id="btn-reject-req">
              <span data-i18n="btn_reject">Reject Request</span>
            </button>
          `;
          actionsBar.querySelector('#btn-approve-req')?.addEventListener('click', async () => {
            const approvalLines = lines.map(l => ({ lineId: l._id, approvedQuantity: l.requestedQuantity }));
            await api.patch(`/requests/${requestId}/approve`, { lines: approvalLines });
            showToast('Request approved! Ready for warehouse issue movement.', 'success');
            loadRequest();
          });
          actionsBar.querySelector('#btn-reject-req')?.addEventListener('click', async () => {
            await api.patch(`/requests/${requestId}/reject`, { note: 'Rejected by warehouse management' });
            showToast('Request rejected', 'info');
            loadRequest();
          });
        } else if (request.status === 'APPROVED' && ['ADMIN', 'WAREHOUSE_MANAGER', 'STOREKEEPER'].includes(currentUser?.role)) {
          actionsBar.innerHTML = `
            <a href="#/movements" class="btn btn-primary btn-sm">
              Execute ISSUE Movement &rarr;
            </a>
          `;
        }
      }

    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  loadRequest();
}

