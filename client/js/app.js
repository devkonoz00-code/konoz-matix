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
import { playSound, playSuccessChime, playConfirmBeep, playErrorTone } from './sound.js';

// Export sound functions for direct use across modules
export { playSound, playSuccessChime, playConfirmBeep, playErrorTone };

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
 * Legacy Cloudinary URLs may be protocol-relative or use HTTP, while local
 * uploads may be stored with or without a leading slash.
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

  if (clean.startsWith('http://')) {
    clean = `https://${clean.slice(7)}`;
  } else if (clean.startsWith('//')) {
    clean = `https:${clean}`;
  } else if (clean.startsWith('res.cloudinary.com') || clean.startsWith('cloudinary.com')) {
    clean = `https://${clean}`;
  } else if (!clean.startsWith('https://') && !clean.startsWith('data:') && !clean.startsWith('blob:')) {
    clean = clean.startsWith('/') ? clean : `/${clean}`;
  }

  return clean;
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

// Update User UI Elements
function updateUserInfoUI(user) {
  const nameEl = document.getElementById('sidebar-user-name');
  const roleEl = document.getElementById('sidebar-user-role');
  const avatarEl = document.getElementById('sidebar-user-avatar');

  if (user) {
    if (nameEl) nameEl.textContent = user.fullName;
    if (roleEl) roleEl.textContent = user.role.replace('_', ' ');
    if (avatarEl) avatarEl.textContent = (user.fullName || 'U').charAt(0).toUpperCase();
  }
}

// Check Notifications
async function checkNotifications() {
  if (!api.getToken()) return;
  try {
    const res = await api.get('/notifications?limit=5');
    const badge = document.getElementById('notif-badge');
    if (badge) {
      if (res.data?.unreadCount > 0) {
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
    }
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

  // Refresh the cached user profile on every app start. The API authorizes
  // requests from the live database user, so the UI must not keep using a
  // stale role from a previous login after an administrator changes it.
  if (api.getToken()) {
    try {
      const profile = await api.get('/auth/me');
      if (profile?.data) api.setCurrentUser(profile.data);
    } catch {
      // Keep the last cached profile for offline rendering. Authentication
      // failures are already handled centrally by the API client.
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
      if (user?.role === 'SUPERVISOR') {
        router.navigate('/scanner');
      } else {
        router.navigate('/dashboard');
      }
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

  // Mobile menu controls
  const sidebar = document.getElementById('app-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const toggleBtn = document.getElementById('btn-toggle-sidebar');
  const closeBtn = document.getElementById('btn-close-sidebar');

  function openSidebar() {
    sidebar?.classList.add('mobile-open');
    overlay?.classList.add('active');
  }

  function closeSidebar() {
    sidebar?.classList.remove('mobile-open');
    overlay?.classList.remove('active');
  }

  toggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (sidebar?.classList.contains('mobile-open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  closeBtn?.addEventListener('click', closeSidebar);
  overlay?.addEventListener('click', closeSidebar);

  // Close mobile sidebar automatically whenever any navigation link is clicked
  sidebar?.querySelectorAll('.sidebar-nav a').forEach((link) => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 900) {
        closeSidebar();
      }
    });
  });

  // Start Router
  router.start();

  // Periodic notification check (every 30s)
  checkNotifications();
  setInterval(checkNotifications, 30000);

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    let isReloadingForServiceWorker = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (isReloadingForServiceWorker) return;
      isReloadingForServiceWorker = true;
      window.location.reload();
    });

    navigator.serviceWorker.register('./service-worker.js')
      .then(registration => registration.update())
      .catch((err) => {
        console.warn('SW registration failed:', err);
      });
  }
}

// Start application
window.addEventListener('DOMContentLoaded', initApp);
