/**
 * Users & Team Management Page Module
 */
import { api } from '../js/api.js';
import { formatDate, showToast, showModal, escapeHtml } from '../js/app.js';
import { i18n } from '../js/i18n.js';

export async function renderUsers(container) {
  document.getElementById('page-title').textContent = i18n.t('nav_users');

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
      <div>
        <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);" data-i18n="nav_users">Team & Users</h2>
        <p style="color: var(--text-secondary); font-size: 0.85rem;">Role-based access control (RBAC), project permissions & user directory</p>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-create-user">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span>Add User</span>
      </button>
    </div>

    <!-- Users Table -->
    <div class="card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Full Name</th>
              <th>Email Address</th>
              <th>Assigned Role</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Created</th>
              <th data-i18n="lbl_actions">Actions</th>
            </tr>
          </thead>
          <tbody id="users-table-body">
            <tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Loading team users...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  i18n.translateDOM(container);

  async function loadUsers() {
    const tbody = document.getElementById('users-table-body');
    const currentUser = api.getCurrentUser();
    const isAdmin = currentUser?.role === 'ADMIN';

    try {
      const res = await api.get('/users');
      const users = res.data || [];

      tbody.innerHTML = users.map(u => {
        const roleCls = {
          ADMIN: 'badge-danger',
          WAREHOUSE_MANAGER: 'badge-info',
          STOREKEEPER: 'badge-purple',
          SUPERVISOR: 'badge-success',
          VIEWER: 'badge-secondary',
        }[u.role] || 'badge-secondary';

        const safeName = escapeHtml(u.fullName);
        const safeEmail = escapeHtml(u.email);
        const safePhone = escapeHtml(u.phone || '—');
        const safeRole = escapeHtml((u.role || '').replace('_', ' '));

        return `
          <tr>
            <td>
              <div style="font-weight: 600; color: #fff;">${safeName}</div>
            </td>
            <td>${safeEmail}</td>
            <td><span class="badge ${roleCls}">${safeRole}</span></td>
            <td>${safePhone}</td>
            <td><span class="badge ${u.isActive ? 'badge-success' : 'badge-danger'}">${u.isActive ? 'Active' : 'Deactivated'}</span></td>
            <td>${formatDate(u.createdAt).split(',')[0]}</td>
            <td>
              ${isAdmin && u.isActive && u._id !== currentUser._id ? `
                <button class="btn btn-sm btn-danger btn-deact-user" data-id="${u._id}" data-name="${safeName}">Deactivate</button>
              ` : '<span style="color: var(--text-muted);">—</span>'}
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.btn-deact-user').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const name = btn.getAttribute('data-name');
          if (confirm(`Are you sure you want to deactivate ${name}?`)) {
            try {
              await api.patch(`/users/${id}/deactivate`);
              showToast(`${name} deactivated successfully`, 'info');
              loadUsers();
            } catch (err) {
              showToast(err.message, 'error');
            }
          }
        });
      });

    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Create User Modal (ADMIN)
  document.getElementById('btn-create-user').addEventListener('click', () => {
    const content = `
      <form id="form-new-user">
        <div class="form-group">
          <label class="form-label">Full Name</label>
          <input type="text" id="inp-u-name" class="form-control" placeholder="E.g. Yassine Bensalem" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" id="inp-u-email" class="form-control" placeholder="yassine@company.com" required>
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" id="inp-u-pass" class="form-control" placeholder="••••••••" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">System Role</label>
            <select id="inp-u-role" class="form-select" required>
              <option value="SUPERVISOR">SUPERVISOR (Site Operations & Logistics)</option>
              <option value="WAREHOUSE_MANAGER">WAREHOUSE_MANAGER (Logistics & Approval)</option>
              <option value="STOREKEEPER">STOREKEEPER (Warehouse Ops)</option>
              <option value="ADMIN">ADMIN (Full Access)</option>
              <option value="VIEWER">VIEWER (Read-Only)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Phone Number</label>
            <input type="text" id="inp-u-phone" class="form-control" placeholder="+212 600 000 000">
          </div>
        </div>
      </form>
    `;

    showModal({
      title: 'Create System User Account',
      content,
      confirmText: 'Create User',
      onConfirm: async () => {
        const fullName = document.getElementById('inp-u-name').value.trim();
        const email = document.getElementById('inp-u-email').value.trim();
        const password = document.getElementById('inp-u-pass').value;
        const role = document.getElementById('inp-u-role').value;
        const phone = document.getElementById('inp-u-phone').value.trim();

        if (!fullName || !email || !password) {
          showToast('Please fill all required fields', 'error');
          return false;
        }

        try {
          await api.post('/users', { fullName, email, password, role, phone });
          showToast('User created successfully', 'success');
          loadUsers();
          return true;
        } catch (err) {
          showToast(err.message, 'error');
          return false;
        }
      }
    });
  });

  loadUsers();
}
