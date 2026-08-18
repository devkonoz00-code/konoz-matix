/**
 * Settings & System Config Page Module
 */
import { api } from '../js/api.js';
import { showToast, showModal } from '../js/app.js';
import { i18n } from '../js/i18n.js';

export async function renderSettings(container) {
  document.getElementById('page-title').textContent = i18n.t('nav_settings');

  container.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);" data-i18n="nav_settings">System Settings</h2>
      <p style="color: var(--text-secondary); font-size: 0.85rem;">Manage logistics warehouses, product categories & system preferences</p>
    </div>

    <div class="grid-cols-2">
      <!-- Warehouses Card -->
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">Logistics Warehouses</h3>
          <button class="btn btn-sm btn-primary" id="btn-add-wh">+ New Warehouse</button>
        </div>
        <div id="settings-wh-list" style="display: flex; flex-direction: column; gap: 0.5rem;">
          <p style="color: var(--text-muted);">Loading warehouses...</p>
        </div>
      </div>

      <!-- Categories Card -->
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">Item Categories</h3>
          <button class="btn btn-sm btn-primary" id="btn-add-cat">+ New Category</button>
        </div>
        <div id="settings-cat-list" style="display: flex; flex-direction: column; gap: 0.5rem;">
          <p style="color: var(--text-muted);">Loading categories...</p>
        </div>
      </div>
    </div>
  `;

  i18n.translateDOM(container);

  async function loadSettingsData() {
    try {
      const [whRes, catRes] = await Promise.all([
        api.get('/warehouses'),
        api.get('/categories'),
      ]);

      const warehouses = whRes.data || [];
      const categories = catRes.data || [];

      // Render Warehouses
      const whContainer = document.getElementById('settings-wh-list');
      whContainer.innerHTML = warehouses.map(w => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-surface-elevated); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <div>
            <div style="font-weight: 600; color: var(--text-primary);">${w.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${w.location || ''}</div>
          </div>
          <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--primary); font-weight: 700;">${w.code}</span>
        </div>
      `).join('');

      // Render Categories
      const catContainer = document.getElementById('settings-cat-list');
      catContainer.innerHTML = categories.map(c => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-surface-elevated); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <div style="font-weight: 600; color: var(--text-primary);">${c.name}</div>
          <span class="badge badge-secondary">Active</span>
        </div>
      `).join('');

    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Add Warehouse Modal
  document.getElementById('btn-add-wh').addEventListener('click', () => {
    const content = `
      <form id="form-new-wh">
        <div class="form-group">
          <label class="form-label">Warehouse Name</label>
          <input type="text" id="inp-wh-name" class="form-control" placeholder="E.g. North Logistics Hub" required>
        </div>
        <div class="form-group">
          <label class="form-label">Warehouse Code</label>
          <input type="text" id="inp-wh-code" class="form-control" placeholder="E.g. WH-TNG-02" required>
        </div>
        <div class="form-group">
          <label class="form-label">Physical Location</label>
          <input type="text" id="inp-wh-loc" class="form-control" placeholder="E.g. Tanger Med Free Zone">
        </div>
      </form>
    `;

    showModal({
      title: 'Add New Warehouse',
      content,
      confirmText: 'Save Warehouse',
      onConfirm: async () => {
        const name = document.getElementById('inp-wh-name').value.trim();
        const code = document.getElementById('inp-wh-code').value.trim();
        const location = document.getElementById('inp-wh-loc').value.trim();

        if (!name || !code) {
          showToast('Name and Code are required', 'error');
          return false;
        }

        try {
          await api.post('/warehouses', { name, code, location });
          showToast('Warehouse added successfully', 'success');
          loadSettingsData();
          return true;
        } catch (err) {
          showToast(err.message, 'error');
          return false;
        }
      }
    });
  });

  // Add Category Modal
  document.getElementById('btn-add-cat').addEventListener('click', () => {
    const content = `
      <form id="form-new-cat">
        <div class="form-group">
          <label class="form-label">Category Name</label>
          <input type="text" id="inp-cat-name" class="form-control" placeholder="E.g. Safety & PPE" required>
        </div>
      </form>
    `;

    showModal({
      title: 'Add New Item Category',
      content,
      confirmText: 'Save Category',
      onConfirm: async () => {
        const name = document.getElementById('inp-cat-name').value.trim();
        if (!name) {
          showToast('Category name is required', 'error');
          return false;
        }

        try {
          await api.post('/categories', { name });
          showToast('Category created successfully', 'success');
          loadSettingsData();
          return true;
        } catch (err) {
          showToast(err.message, 'error');
          return false;
        }
      }
    });
  });

  loadSettingsData();
}
