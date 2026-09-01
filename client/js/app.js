/**
 * MATIX Application Bootstrap
 */
import { i18n } from './i18n.js';
import { api } from './api.js';
import { router } from './router.js';

// Import View Modules
import { renderLogin } from '../pages/login.js';
import { renderDashboard } from '../pages/dashboard.js';
import { renderProjects } from '../pages/projects.js';
import { renderProjectDetail } from '../pages/project-detail.js';
import { renderItems } from '../pages/items.js';
import { renderItemDetail } from '../pages/item-detail.js';
import { renderItemLabels } from '../pages/item-labels.js';
import { renderScanner } from '../pages/scanner.js';
import { renderRequests } from '../pages/requests.js';
import { renderRequestDetail } from '../pages/request-detail.js';
import { renderMovements } from '../pages/movements.js';
import { renderTransfers } from '../pages/transfers.js';
import { renderReturns } from '../pages/returns.js';
import { renderDocuments } from '../pages/documents.js';
import { renderUsers } from '../pages/users.js';
import { renderReports } from '../pages/reports.js';
import { renderAuditLogs } from '../pages/audit-logs.js';
import { renderSettings } from '../pages/settings.js';
import { renderWorkerRequests } from '../pages/worker-requests.js';
import { playSound, playSuccessChime, playConfirmBeep, playErrorTone, playMessengerChime } from './sound.js';

// Export sound functions for direct use across modules
export { playSound, playSuccessChime, playConfirmBeep, playErrorTone, playMessengerChime };

// Immediate global mobile menu handlers (works synchronously on touch/click)
window.toggleMobileMenu = function(e) {
  if (e && e.preventDefault) e.preventDefault();
  const sb = document.getElementById('app-sidebar');
  const ov = document.getElementById('sidebar-overlay');
  if (!sb) return;
  const isRtl = document.documentElement.getAttribute('dir') === 'rtl' || (document.body && document.body.classList.contains('rtl'));
  const isOpen = sb.classList.contains('mobile-open') || (isRtl ? sb.style.right === '0px' : sb.style.left === '0px');
  if (isOpen) {
    window.closeMobileMenu();
  } else {
    sb.classList.add('mobile-open');
    sb.style.setProperty('display', 'flex', 'important');
    sb.style.setProperty('visibility', 'visible', 'important');
    sb.style.setProperty('opacity', '1', 'important');
    sb.style.setProperty('z-index', '999999', 'important');
    if (isRtl) {
      sb.style.setProperty('right', '0px', 'important');
      sb.style.setProperty('left', 'auto', 'important');
    } else {
      sb.style.setProperty('left', '0px', 'important');
      sb.style.setProperty('right', 'auto', 'important');
    }
    if (ov) {
      ov.classList.add('active');
      ov.style.setProperty('display', 'block', 'important');
      ov.style.setProperty('z-index', '999990', 'important');
    }
    document.body.style.overflow = 'hidden';
  }
};

window.closeMobileMenu = function(e) {
  if (e && e.preventDefault) e.preventDefault();
  const sb = document.getElementById('app-sidebar');
  const ov = document.getElementById('sidebar-overlay');
  const isRtl = document.documentElement.getAttribute('dir') === 'rtl' || (document.body && document.body.classList.contains('rtl'));
  if (sb) {
    sb.classList.remove('mobile-open');
    if (window.innerWidth <= 900) {
      if (isRtl) {
        sb.style.setProperty('right', '-320px', 'important');
        sb.style.setProperty('left', 'auto', 'important');
      } else {
        sb.style.setProperty('left', '-320px', 'important');
        sb.style.setProperty('right', 'auto', 'important');
      }
    }
  }
  if (ov) {
    ov.classList.remove('active');
    ov.style.setProperty('display', 'none', 'important');
  }
  document.body.style.overflow = '';
};

/**
 * Escapes unsafe characters in strings to prevent Stored/DOM-based XSS attacks.
 * Safe for inserting dynamic values into HTML templates and attributes.
 *
 * @param {*} unsafeStr - Raw input
 * @returns {string} - HTML-safe escaped string
 */
export function escapeHtml(unsafeStr) {
  if (unsafeStr === null || unsafeStr === undefined) return '';
  return String(unsafeStr)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Normalizes stored image references for safe browser loading.
 * Handles Cloudinary HTTPS URLs, local /uploads/ paths, data URIs, and full URLs without
 * breaking local HTTP origins or throwing protocol errors.
 *
 * @param {string} url - Raw image URL stored on the item
 * @returns {string} A browser-loadable URL, or an empty string when invalid
 */
export function formatImageUrl(url) {
  if (!url || typeof url !== 'string') return '';

  let clean = url.trim();
  if (!clean || clean === 'undefined' || clean === 'null' || clean === '/' || clean === '[object Object]') {
    return '';
  }

  // Handle data URIs and blob URLs directly
  if (clean.startsWith('data:') || clean.startsWith('blob:')) {
    return clean;
  }

  // Protocol-relative URLs (e.g. //res.cloudinary.com/...)
  if (clean.startsWith('//')) {
    clean = `https:${clean}`;
  }

  // Convert HTTP to HTTPS (required for production on HTTPS / Render)
  if (clean.startsWith('http://')) {
    clean = `https://${clean.slice(7)}`;
  }

  // Handle naked domain URLs like res.cloudinary.com/... or cloudinary.com/...
  if (clean.startsWith('res.cloudinary.com') || clean.startsWith('cloudinary.com') || clean.startsWith('res-')) {
    clean = `https://${clean}`;
  }

  // Handle relative upload paths (e.g. uploads/... -> /uploads/...)
  if (!clean.startsWith('https://') && !clean.startsWith('http://')) {
    clean = clean.startsWith('/') ? clean : `/${clean}`;
  }

  // Apply Cloudinary automatic WebP/AVIF format & quality optimization
  if (clean.includes('res.cloudinary.com') && clean.includes('/upload/') && !clean.includes('f_auto') && !clean.includes('q_auto')) {
    clean = clean.replace('/upload/', '/upload/f_auto,q_auto/');
  }

  return clean;
}

/**
 * Opens an in-platform image lightbox modal to view product photos enlarged with high clarity.
 */
export function openImageLightboxModal(imageUrl, title = 'صورة المادة / Item Photo') {
  const formattedUrl = formatImageUrl(imageUrl);
  if (!formattedUrl) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.style.cssText = 'z-index: 10000; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(4px); padding: 1rem;';
  backdrop.innerHTML = `
    <div style="position: relative; max-width: 90vw; max-height: 90vh; background: var(--bg-surface, #1e293b); border-radius: var(--radius-md, 8px); overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); border: 1px solid var(--border-subtle, #334155); display: flex; flex-direction: column;">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-subtle, #334155); background: var(--bg-surface-elevated, #0f172a);">
        <h4 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--text-primary, #fff);">${escapeHtml(title)}</h4>
        <button type="button" class="icon-button modal-lightbox-close" style="width: 32px; height: 32px; font-size: 1.25rem; color: var(--text-muted, #94a3b8); cursor: pointer; background: transparent; border: none; border-radius: 4px; display: flex; align-items: center; justify-content: center;">&times;</button>
      </div>
      <div style="padding: 1rem; display: flex; align-items: center; justify-content: center; overflow: auto; background: #020617; max-height: calc(90vh - 60px);">
        <img src="${escapeHtml(formattedUrl)}" alt="${escapeHtml(title)}" style="max-width: 100%; max-height: 75vh; object-fit: contain; border-radius: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);">
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const close = () => {
    backdrop.style.opacity = '0';
    backdrop.style.transition = 'opacity 0.2s ease';
    setTimeout(() => backdrop.remove(), 200);
  };

  backdrop.querySelector('.modal-lightbox-close')?.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  const onKey = (e) => {
    if (e.key === 'Escape') {
      close();
      window.removeEventListener('keydown', onKey);
    }
  };
  window.addEventListener('keydown', onKey);
}

/**
 * Opens a full-screen or modal camera barcode scanner popup.
 * Automatically initializes camera, detects 1D/2D barcodes/QRs, plays chime,
 * invokes callback with scanned code, and cleanly stops the camera.
 */
export async function openBarcodeScannerModal({ onScan, title = 'مسح باركود بالكاميرا / Scan Barcode' }) {
  const modalId = 'scanner_modal_' + Date.now();
  const readerId = 'modal-qr-reader-' + Date.now();

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.style.cssText = 'z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1rem;';
  backdrop.innerHTML = `
    <div class="modal-dialog" style="max-width: 520px; width: 100%;">
      <div class="modal-header">
        <h3 class="modal-title" style="display: flex; align-items: center; gap: 0.5rem;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>
          <span>${escapeHtml(title)}</span>
        </h3>
        <button type="button" class="icon-button modal-close-btn" style="width: 32px; height: 32px;">&times;</button>
      </div>
      <div class="modal-body" style="padding: 1rem;">
        <p style="font-size: 0.83rem; color: var(--text-secondary); margin-bottom: 0.75rem; text-align: center;">
          وجه كاميرا هاتفك أو جهازك نحو الباركود الأصلي المطبوع على المادة ليتم التقاطه تلقائياً.
        </p>

        <!-- Viewport Container -->
        <div style="position: relative; width: 100%; min-height: 250px; background: #0f172a; border-radius: var(--radius-md); overflow: hidden; border: 2px solid var(--border-subtle); display: flex; align-items: center; justify-content: center;">
          <div id="${readerId}" style="width: 100%; height: 100%;"></div>
          <div id="laser-${modalId}" style="position: absolute; left: 5%; right: 5%; height: 2px; background: #3b82f6; box-shadow: 0 0 10px #3b82f6; z-index: 10; animation: scanLineAnim 2s infinite ease-in-out;"></div>
        </div>

        <div id="status-${modalId}" style="margin-top: 0.75rem; font-size: 0.8rem; text-align: center; color: var(--text-muted);">
          جاري تشغيل الكاميرا...
        </div>
      </div>
      <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.75rem; color: var(--text-muted);">يدعم EAN-13, CODE-128, QR, UPC</span>
        <button type="button" class="btn btn-secondary modal-cancel-btn">إلغاء / Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  let html5ScannerInstance = null;
  let isClosed = false;

  const cleanupAndClose = async () => {
    if (isClosed) return;
    isClosed = true;
    if (html5ScannerInstance) {
      try {
        if (html5ScannerInstance.isScanning) {
          await html5ScannerInstance.stop();
        }
        await html5ScannerInstance.clear();
      } catch (e) {
        console.warn('Error stopping camera:', e);
      }
    }
    backdrop.remove();
  };

  backdrop.querySelector('.modal-close-btn')?.addEventListener('click', cleanupAndClose);
  backdrop.querySelector('.modal-cancel-btn')?.addEventListener('click', cleanupAndClose);

  // Initialize camera scanner
  try {
    if (typeof Html5Qrcode === 'undefined') {
      const statusEl = backdrop.querySelector(`#status-${modalId}`);
      if (statusEl) statusEl.textContent = 'تحميل مكتبة الكاميرا...';
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = './js/html5-qrcode.min.js';
        s.onload = resolve;
        s.onerror = () => {
          const s2 = document.createElement('script');
          s2.src = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
          s2.onload = resolve;
          s2.onerror = reject;
          document.head.appendChild(s2);
        };
        document.head.appendChild(s);
      });
    }

    if (isClosed) return;

    let formats = undefined;
    if (typeof Html5QrcodeSupportedFormats !== 'undefined') {
      formats = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_39,
      ];
    }

    html5ScannerInstance = new Html5Qrcode(readerId, {
      formatsToSupport: formats,
      verbose: false,
    });

    const qrboxSize = Math.min(260, window.innerWidth - 60);

    await html5ScannerInstance.start(
      { facingMode: 'environment' },
      {
        fps: 20,
        qrbox: { width: qrboxSize, height: Math.round(qrboxSize * 0.65) },
        aspectRatio: 1.33,
      },
      (decodedText, decodedResult) => {
        if (isClosed) return;
        playSuccessChime();
        if (navigator.vibrate) {
          try { navigator.vibrate(100); } catch {}
        }
        cleanupAndClose();
        if (typeof onScan === 'function') {
          onScan(decodedText.trim(), decodedResult);
        }
      },
      () => {
        // Scanning frame tick (silent)
      }
    );

    if (isClosed) {
      await html5ScannerInstance.stop();
      return;
    }

    const statusEl = backdrop.querySelector(`#status-${modalId}`);
    if (statusEl) {
      statusEl.innerHTML = '<span style="color: var(--success); font-weight: 600;">📷 الكاميرا جاهزة — وجّه العدسة نحو الباركود</span>';
    }
  } catch (cameraErr) {
    console.error('Camera start error:', cameraErr);
    const statusEl = backdrop.querySelector(`#status-${modalId}`);
    if (statusEl) {
      statusEl.innerHTML = `
        <span style="color: var(--danger); font-weight: 600;">⚠️ تعذر الوصول إلى الكاميرا (${escapeHtml(cameraErr.message || 'إذن الكاميرا مرفوض')}). يمكنك إدخال الباركود يدوياً.</span>
      `;
    }
  }
}


// ==========================================================================
// UI Helpers (Toasts, Modals, Formatters)
// ==========================================================================
export function showToast(message, type = 'info') {
  // Play appropriate sound feedback
  if (type === 'success') {
    playSuccessChime();
  } else if (type === 'error') {
    playErrorTone();
  } else if (type === 'warning') {
    playErrorTone();
  } else if (type === 'info') {
    playConfirmBeep();
  }

  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

export function showModal({ title, content, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="icon-button modal-close-btn" style="width: 32px; height: 32px;">&times;</button>
      </div>
      <div class="modal-body">${content}</div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-cancel-btn">${cancelText}</button>
        ${onConfirm ? `<button class="btn btn-primary modal-confirm-btn">${confirmText}</button>` : ''}
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const closeBtn = backdrop.querySelector('.modal-close-btn');
  let isSubmitting = false;
  const close = () => {
    if (isSubmitting) return;
    backdrop.remove();
  };
  closeBtn.addEventListener('click', close);
  backdrop.querySelector('.modal-cancel-btn').addEventListener('click', close);

  if (onConfirm) {
    const confirmBtn = backdrop.querySelector('.modal-confirm-btn');
    const cancelBtn = backdrop.querySelector('.modal-cancel-btn');

    confirmBtn?.addEventListener('click', async () => {
      if (isSubmitting) return;
      playConfirmBeep();
      isSubmitting = true;
      confirmBtn.disabled = true;
      if (cancelBtn) cancelBtn.disabled = true;
      if (closeBtn) closeBtn.disabled = true;
      const originalHtml = confirmBtn.innerHTML;
      confirmBtn.innerHTML = `
        <span style="display: inline-flex; align-items: center; gap: 0.4rem;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 0.8s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          <span>Processing...</span>
        </span>
      `;

      try {
        const result = await onConfirm(backdrop);
        if (result !== false) {
          isSubmitting = false;
          close();
        } else {
          isSubmitting = false;
          confirmBtn.disabled = false;
          if (cancelBtn) cancelBtn.disabled = false;
          if (closeBtn) closeBtn.disabled = false;
          confirmBtn.innerHTML = originalHtml;
        }
      } catch (err) {
        isSubmitting = false;
        confirmBtn.disabled = false;
        if (cancelBtn) cancelBtn.disabled = false;
        if (closeBtn) closeBtn.disabled = false;
        confirmBtn.innerHTML = originalHtml;
        throw err;
      }
    });
  }

  return backdrop;
}

export function formatMoney(amount = 0) {
  const currentLang = localStorage.getItem('matix_lang') || 'ar';
  const val = Number(amount) || 0;
  const formatted = new Intl.NumberFormat('fr-DZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);

  if (currentLang === 'ar') {
    return `${formatted} د.ج`;
  }
  return `${formatted} DZD`;
}

export function formatDate(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusBadge(status) {
  const map = {
    CONFIRMED: 'badge-success',
    FULFILLED: 'badge-success',
    ACTIVE: 'badge-success',
    APPROVED: 'badge-info',
    PENDING: 'badge-warning',
    SUBMITTED: 'badge-warning',
    PAUSED: 'badge-warning',
    PARTIALLY_FULFILLED: 'badge-purple',
    DRAFT: 'badge-secondary',
    REJECTED: 'badge-danger',
    CANCELLED: 'badge-danger',
    ARCHIVED: 'badge-secondary',
  };
  return `<span class="badge ${map[status] || 'badge-secondary'}">${status}</span>`;
}

export function getMovementTypeBadge(type) {
  const map = {
    RECEIPT: { cls: 'badge-success', label: 'Receipt (Inbound)' },
    ISSUE: { cls: 'badge-info', label: 'Issue to Site' },
    TRANSFER: { cls: 'badge-purple', label: 'Site Transfer' },
    RETURN: { cls: 'badge-warning', label: 'Return to WH' },
    ADJUSTMENT: { cls: 'badge-secondary', label: 'Adjustment' },
  };
  const item = map[type] || { cls: 'badge-secondary', label: type };
  return `<span class="badge ${item.cls}">${item.label}</span>`;
}

// Update User UI Elements & Role-based Navigation
function updateUserInfoUI(user) {
  const nameEl = document.getElementById('sidebar-user-name');
  const roleEl = document.getElementById('sidebar-user-role');
  const avatarEl = document.getElementById('sidebar-user-avatar');

  if (user) {
    if (nameEl) nameEl.textContent = user.fullName;
    if (roleEl) roleEl.textContent = user.role.replace('_', ' ');
    if (avatarEl) avatarEl.textContent = (user.fullName || 'U').charAt(0).toUpperCase();

    const isWorker = user.role === 'WORKER';

    // Adapt sidebar navigation for WORKER role
    const sidebarNav = document.querySelector('.sidebar-nav');
    if (sidebarNav) {
      // Toggle standard navigation elements
      sidebarNav.querySelectorAll('.nav-section-title, a:not(#nav-worker-requests)').forEach((el) => {
        el.style.display = isWorker ? 'none' : '';
      });

      // Ensure worker orders link exists
      let workerLink = document.getElementById('nav-worker-requests');
      if (isWorker) {
        if (!workerLink) {
          workerLink = document.createElement('a');
          workerLink.href = '#/worker-requests';
          workerLink.className = 'nav-link active';
          workerLink.id = 'nav-worker-requests';
          workerLink.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>طلبات الورشة (رسائل سريعة)</span>
          `;
          sidebarNav.prepend(workerLink);
        } else {
          workerLink.style.display = 'flex';
        }
      } else if (workerLink) {
        workerLink.style.display = 'none';
      }
    }

    // Adapt mobile bottom navigation bar
    const mobileNav = document.querySelector('.mobile-nav');
    if (mobileNav) {
      if (isWorker) {
        mobileNav.innerHTML = `
          <a href="#/worker-requests" class="mobile-nav-item active" style="flex: 1; justify-content: center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>طلبات الورشة 💬</span>
          </a>
        `;
      }
    }
  }
}

// Check Notifications with Messenger Audio Alert
let prevUnreadCount = 0;
let isFirstNotifCheck = true;

async function checkNotifications() {
  if (!api.getToken()) return;
  try {
    const res = await api.get('/notifications?limit=5');
    const badge = document.getElementById('notif-badge');
    const unreadCount = res.data?.unreadCount || 0;

    if (badge) {
      if (unreadCount > 0) {
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
    }

    // If new notifications arrived for supervisor/admin, play Messenger audio chime
    if (!isFirstNotifCheck && unreadCount > prevUnreadCount) {
      const user = api.getCurrentUser();
      if (user && ['ADMIN', 'SUPERVISOR', 'WAREHOUSE_MANAGER', 'WORKER'].includes(user.role)) {
        playMessengerChime();
        const latest = res.data?.notifications?.[0];
        if (latest && !latest.isRead) {
          showToast(latest.message, 'info');
        }
      }
    }

    prevUnreadCount = unreadCount;
    isFirstNotifCheck = false;
  } catch {}
}

// Notification Drawer Modal
async function openNotificationsModal() {
  try {
    const res = await api.get('/notifications?limit=20');
    const notifs = res.data?.notifications || [];

    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <span style="font-size: 0.85rem; color: var(--text-secondary);">${res.data?.unreadCount || 0} unread</span>
        <button class="btn btn-sm btn-outline" id="btn-mark-all-read">Mark all as read</button>
      </div>
      <div style="max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem;">
    `;

    if (notifs.length === 0) {
      html += `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No notifications</p>`;
    } else {
      notifs.forEach((n) => {
        html += `
          <div class="card" style="padding: 0.75rem 1rem; border-left: 3px solid ${n.isRead ? 'var(--border-subtle)' : 'var(--primary)'}; background: ${n.isRead ? 'transparent' : 'rgba(37,99,235,0.08)'}">
            <div style="font-size: 0.85rem; font-weight: ${n.isRead ? '400' : '600'};">${n.message}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.3rem;">${formatDate(n.createdAt)}</div>
          </div>
        `;
      });
    }
    html += `</div>`;

    const modal = showModal({
      title: 'Notifications',
      content: html,
      cancelText: 'Close',
    });

    modal.querySelector('#btn-mark-all-read')?.addEventListener('click', async () => {
      await api.patch('/notifications/read-all');
      showToast('All notifications marked as read', 'success');
      document.getElementById('notif-badge').style.display = 'none';
      prevUnreadCount = 0;
      modal.remove();
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================================================
// Initialization & Route Registration
// ==========================================================================
async function initApp() {
  await i18n.init();

  // Refresh the cached user profile on every app start.
  if (api.getToken()) {
    try {
      const profile = await api.get('/auth/me');
      if (profile?.data) api.setCurrentUser(profile.data);
    } catch {
      // Offline fallback
    }
  }

  // Register SPA Routes
  router.add('/login', renderLogin);
  router.add('/dashboard', renderDashboard);
  router.add('/projects', renderProjects);
  router.add('/projects/:id', renderProjectDetail);
  router.add('/items', renderItems);
  router.add('/items/labels', renderItemLabels);
  router.add('/items/:id', renderItemDetail);
  router.add('/scanner', renderScanner);
  router.add('/requests', renderRequests);
  router.add('/requests/:id', renderRequestDetail);
  router.add('/worker-requests', renderWorkerRequests);
  router.add('/movements', renderMovements);
  router.add('/transfers', renderTransfers);
  router.add('/returns', renderReturns);
  router.add('/documents', renderDocuments);
  router.add('/users', renderUsers);
  router.add('/reports', renderReports);
  router.add('/audit-logs', renderAuditLogs);
  router.add('/settings', renderSettings);

  // Auth Guard
  router.beforeEach(async (path) => {
    const isLogin = path === '/login';
    const user = api.getCurrentUser();
    const token = api.getToken();

    if (!token && !isLogin) {
      router.navigate('/login');
      return false;
    }

    if (token && isLogin) {
      if (user?.role === 'WORKER') {
        router.navigate('/worker-requests');
      } else if (user?.role === 'SUPERVISOR') {
        router.navigate('/scanner');
      } else {
        router.navigate('/dashboard');
      }
      return false;
    }

    // Role-based route guard for WORKER
    if (token && user?.role === 'WORKER' && path !== '/worker-requests') {
      router.navigate('/worker-requests');
      return false;
    }

    // Toggle layout visibility
    const sidebar = document.getElementById('app-sidebar');
    const header = document.querySelector('.top-header');
    const mobileNav = document.querySelector('.mobile-nav');
    const mainContent = document.getElementById('main-content');
    const mainWrapper = document.querySelector('.main-wrapper');

    mainContent?.classList.toggle('login-content', isLogin);
    mainWrapper?.classList.toggle('login-layout', isLogin);

    if (isLogin) {
      if (sidebar) sidebar.style.display = 'none';
      if (header) header.style.display = 'none';
      if (mobileNav) mobileNav.style.display = 'none';
      mainWrapper.style.margin = '0';
      mainWrapper.style.width = '100%';
    } else {
      if (sidebar) sidebar.style.display = 'flex';
      if (header) header.style.display = 'flex';
      if (mobileNav) mobileNav.style.display = 'flex';
      const isRtl = document.documentElement.getAttribute('dir') === 'rtl';
      const wrapper = mainWrapper;
      if (window.innerWidth > 900) {
        wrapper.style.marginLeft = isRtl ? '0' : 'var(--sidebar-width)';
        wrapper.style.marginRight = isRtl ? 'var(--sidebar-width)' : '0';
        wrapper.style.width = 'calc(100% - var(--sidebar-width))';
      }
      updateUserInfoUI(user);
    }

    return true;
  });

  // Language buttons event
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const lang = btn.getAttribute('data-lang');
      document.querySelectorAll('.lang-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      await i18n.setLanguage(lang);
      router.handleRouting(); // re-render active page in new language
    });
  });

  // Highlight active lang button
  const savedLang = localStorage.getItem('matix_lang') || 'en';
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    if (btn.getAttribute('data-lang') === savedLang) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Notifications button
  document.getElementById('btn-notifications')?.addEventListener('click', openNotificationsModal);

  // Logout button
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    api.clearTokens();
    router.navigate('/login');
  });

  // Bulletproof Mobile Menu Controls
  function openMobileSidebar() {
    const sb = document.getElementById('app-sidebar');
    const ov = document.getElementById('sidebar-overlay');
    sb?.classList.add('mobile-open');
    ov?.classList.add('active');
  }

  function closeMobileSidebar() {
    const sb = document.getElementById('app-sidebar');
    const ov = document.getElementById('sidebar-overlay');
    sb?.classList.remove('mobile-open');
    ov?.classList.remove('active');
  }

  // Delegated click on document for guaranteed responsiveness across all pages & languages
  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('#btn-toggle-sidebar');
    if (toggle) {
      e.preventDefault();
      e.stopPropagation();
      const sb = document.getElementById('app-sidebar');
      if (sb?.classList.contains('mobile-open')) {
        closeMobileSidebar();
      } else {
        openMobileSidebar();
      }
      return;
    }

    const close = e.target.closest('#btn-close-sidebar');
    if (close || e.target.id === 'sidebar-overlay') {
      e.preventDefault();
      closeMobileSidebar();
      return;
    }

    // Auto-close when clicking any navigation link on mobile
    if (window.innerWidth <= 900 && e.target.closest('#app-sidebar a')) {
      closeMobileSidebar();
    }
  });

  // Start Router
  router.start();

  // Periodic notification check (every 30s)
  checkNotifications();
  setInterval(checkNotifications, 30000);

  // Aggressively purge ALL caches on load to ensure zero stale image/code caching
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => {
        caches.delete(name);
      });
    }).catch(() => {});
  }

  // Register PWA Service Worker — updateViaCache:'none' forces the browser
  // to ALWAYS fetch service-worker.js from the network, never from HTTP cache
  if ('serviceWorker' in navigator) {
    let isReloadingForServiceWorker = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (isReloadingForServiceWorker) return;
      isReloadingForServiceWorker = true;
      window.location.reload();
    });

    navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' })
      .then((registration) => {
        registration.update();
      })
      .catch((err) => {
        console.warn('SW registration failed:', err);
      });
  }
}

// Start application
window.addEventListener('DOMContentLoaded', initApp);
