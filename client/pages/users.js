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
          WORKER: 'badge-purple',
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
              <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
                ${isAdmin ? `
                  <button class="btn btn-sm btn-outline btn-edit-user" data-id="${u._id}" data-name="${safeName}" data-email="${safeEmail}" data-phone="${safePhone}" data-role="${u.role}" title="تعديل صلاحية وبيانات المستخدم">
                    <span>✏️ تعديل</span>
                  </button>
                ` : ''}
                ${isAdmin && u.isActive && u._id !== currentUser._id ? `
                  <button class="btn btn-sm btn-danger btn-deact-user" data-id="${u._id}" data-name="${safeName}">Deactivate</button>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      // Bind Edit User buttons
      tbody.querySelectorAll('.btn-edit-user').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const name = btn.getAttribute('data-name');
          const email = btn.getAttribute('data-email');
          const phone = btn.getAttribute('data-phone') === '—' ? '' : btn.getAttribute('data-phone');
          const role = btn.getAttribute('data-role');

          const editContent = `
            <form id="form-edit-user">
              <div class="form-group">
                <label class="form-label">Full Name / الاسم الكامل</label>
                <input type="text" id="edit-u-name" class="form-control" value="${escapeHtml(name)}" required>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Email Address (Read-only)</label>
                  <input type="email" id="edit-u-email" class="form-control" value="${escapeHtml(email)}" disabled style="opacity: 0.7;">
                </div>
                <div class="form-group">
                  <label class="form-label">Phone Number / رقم الهاتف</label>
                  <input type="text" id="edit-u-phone" class="form-control" value="${escapeHtml(phone)}" placeholder="+212 600 000 000">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700; color: var(--primary);">System Role / الصلاحية والرتبة *</label>
                  <select id="edit-u-role" class="form-select" required style="border-color: var(--primary);">
                    <option value="WORKER" ${role === 'WORKER' ? 'selected' : ''}>WORKER (عامل ورشة / فني - شاشة طلبات ماسنجر سريعة)</option>
                    <option value="SUPERVISOR" ${role === 'SUPERVISOR' ? 'selected' : ''}>SUPERVISOR (مسؤول موقع وعمليات لوجستية)</option>
                    <option value="WAREHOUSE_MANAGER" ${role === 'WAREHOUSE_MANAGER' ? 'selected' : ''}>WAREHOUSE_MANAGER (مدير مستودع واعتمادات)</option>
                    <option value="STOREKEEPER" ${role === 'STOREKEEPER' ? 'selected' : ''}>STOREKEEPER (أمين مستودع)</option>
                    <option value="ADMIN" ${role === 'ADMIN' ? 'selected' : ''}>ADMIN (مدير نظام - كامل الصلاحيات)</option>
                    <option value="VIEWER" ${role === 'VIEWER' ? 'selected' : ''}>VIEWER (مطلع فقط - للقراءة)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">New Password (اتركه فارغاً لعدم التغيير)</label>
                  <input type="password" id="edit-u-pass" class="form-control" placeholder="••••••••">
                </div>
              </div>
            </form>
          `;

          showModal({
            title: `✏️ تعديل صلاحية وبيانات المستخدم (${name})`,
            content: editContent,
            confirmText: 'حفظ التعديلات',
            onConfirm: async () => {
              const updatedName = document.getElementById('edit-u-name').value.trim();
              const updatedPhone = document.getElementById('edit-u-phone').value.trim();
              const updatedRole = document.getElementById('edit-u-role').value;
              const updatedPass = document.getElementById('edit-u-pass').value;

              if (!updatedName) {
                showToast('الاسم الكامل مطلوب', 'error');
                return false;
              }

              const payload = {
                fullName: updatedName,
                phone: updatedPhone,
                role: updatedRole,
              };
              if (updatedPass) payload.password = updatedPass;

              try {
                await api.patch(`/users/${id}`, payload);
                showToast(`تم تحديث بيانات وصلاحية ${updatedName} بنجاح!`, 'success');
                loadUsers();
                return true;
              } catch (err) {
                showToast(err.message, 'error');
                return false;
              }
            }
          });
        });
      });

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
              <option value="WORKER">WORKER (عامل ورشة / فني - شاشة طلبات ماسنجر سريعة)</option>
              <option value="SUPERVISOR">SUPERVISOR (مسؤول موقع وعمليات لوجستية)</option>
              <option value="WAREHOUSE_MANAGER">WAREHOUSE_MANAGER (مدير مستودع واعتمادات)</option>
              <option value="STOREKEEPER">STOREKEEPER (أمين مستودع)</option>
              <option value="ADMIN">ADMIN (مدير نظام - كامل الصلاحيات)</option>
              <option value="VIEWER">VIEWER (مطلع فقط - للقراءة)</option>
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
