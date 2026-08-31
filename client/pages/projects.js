/**
 * Projects List Page Module (§9, §13)
 * Lists all projects with distinct Current Value and Total Consumption financial metrics.
 */
import { api } from '../js/api.js';
import { showToast, showModal, getStatusBadge, formatDate, formatMoney, escapeHtml } from '../js/app.js';
import { i18n } from '../js/i18n.js';

export async function renderProjects(container) {
  document.getElementById('page-title').textContent = i18n.t('nav_projects');

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
      <div>
        <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);" data-i18n="nav_projects">Projects & Construction Sites</h2>
        <p style="color: var(--text-secondary); font-size: 0.85rem;">Manage active project locations, live material values & cumulative consumption</p>
      </div>
      <button class="btn btn-primary" id="btn-create-project">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span data-i18n="btn_new_project">New Project</span>
      </button>
    </div>

    <!-- Filters & Search Bar -->
    <div class="card" style="margin-bottom: 1.5rem; padding: 1rem;">
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 250px;">
          <input type="text" id="project-search" class="form-control" placeholder="Search by name, code or location...">
        </div>
        <div style="width: 180px;">
          <select id="project-status-filter" class="form-select">
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="PAUSED">PAUSED</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Projects Grid -->
    <div class="grid-cols-2" id="projects-grid">
      <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 3rem;">Loading projects...</div>
    </div>
  `;

  i18n.translateDOM(container);

  async function loadProjects() {
    const search = document.getElementById('project-search')?.value.trim() || '';
    const status = document.getElementById('project-status-filter')?.value || '';
    const grid = document.getElementById('projects-grid');

    try {
      const res = await api.get('/projects', { search, status });
      const projects = res.data || [];

      if (projects.length === 0) {
        grid.innerHTML = `<div class="card" style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">No projects found matching criteria.</div>`;
        return;
      }

      const currentUser = api.getCurrentUser();
      const isAdmin = currentUser?.role === 'ADMIN';

      grid.innerHTML = projects.map(p => `
        <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
              <div>
                <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent-cyan); font-weight: 600;">${escapeHtml(p.projectCode || '')}</span>
                <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary); margin-top: 0.15rem;">${escapeHtml(p.name || '')}</h3>
              </div>
              ${getStatusBadge(p.status)}
            </div>

            <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1rem; line-height: 1.4;">
              ${escapeHtml(p.description || 'No description provided.')}
            </p>

            <!-- Financial Layer (§9): Distinct Current Value & Total Consumption -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; background: var(--bg-surface-elevated); padding: 0.75rem 1rem; border-radius: var(--radius-md); margin-bottom: 1rem; border: 1px solid var(--border-subtle);">
              <div>
                <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted);">Current Value (On-Hand)</div>
                <div style="font-size: 1.05rem; font-weight: 700; color: var(--primary);">${formatMoney(p.currentValue || 0)}</div>
              </div>
              <div>
                <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted);">Total Consumption</div>
                <div style="font-size: 1.05rem; font-weight: 700; color: var(--purple);">${formatMoney(p.totalConsumption || 0)}</div>
              </div>
            </div>

            <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1.25rem;">
              <div>📍 <strong>Location:</strong> ${escapeHtml(p.location || 'Site not specified')}</div>
              <div>📅 <strong>Timeline:</strong> ${p.startDate ? formatDate(p.startDate).split(',')[0] : '—'} → ${p.expectedEndDate ? formatDate(p.expectedEndDate).split(',')[0] : '—'}</div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
              <a href="#/projects/${p._id}" class="btn btn-sm btn-primary">
                <span data-i18n="btn_view_details">Site Material View</span> &rarr;
              </a>
              <button class="btn btn-sm btn-outline btn-assign-pm" data-id="${p._id}" data-name="${escapeHtml(p.name || '')}">
                <span data-i18n="btn_assign_pm">Assign PM</span>
              </button>
            </div>
            ${isAdmin ? `
              <button class="btn btn-sm btn-outline btn-delete-project" data-id="${p._id}" data-name="${escapeHtml(p.name || '')}" data-code="${escapeHtml(p.projectCode || '')}" title="حذف المشروع (للأدمن فقط)" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.3);">
                <span>🗑️ حذف</span>
              </button>
            ` : ''}
          </div>
        </div>
      `).join('');

      // Bind Assign PM Buttons
      grid.querySelectorAll('.btn-assign-pm').forEach(btn => {
        btn.addEventListener('click', () => openAssignModal(btn.getAttribute('data-id'), btn.getAttribute('data-name')));
      });

      // Bind Delete Project Buttons (Admin only)
      grid.querySelectorAll('.btn-delete-project').forEach(btn => {
        btn.addEventListener('click', () => {
          const projectId = btn.getAttribute('data-id');
          const projectName = btn.getAttribute('data-name') || '';
          const projectCode = btn.getAttribute('data-code') || '';

          showModal({
            title: '⚠️ تأكيد حذف المشروع',
            content: `
              <p style="color: var(--text-primary); margin-bottom: 0.75rem;">
                هل أنت متأكد من رغبتك في حذف وأرشفة المشروع <strong>${projectName}</strong> (${projectCode})؟
              </p>
              <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-sm); padding: 0.75rem;">
                <p style="color: var(--danger); font-size: 0.82rem; margin-bottom: 0; line-height: 1.4;">
                  ⚠️ <strong>تنبيه:</strong> سيتم أرشفة المشروع وإلغاء تعيينات مديري المشروع. يُشترط ألا يكون هناك أي رصيد مواد/مخزون حالي في موقع المشروع لحماية السجلات المالية وحركات المواد.
                </p>
              </div>
            `,
            confirmText: 'تأكيد وحذف المشروع',
            onConfirm: async () => {
              try {
                await api.delete(`/projects/${projectId}`);
                showToast(`تم حذف وأرشفة المشروع "${projectName}" بنجاح`, 'success');
                loadProjects();
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

  // Bind Filters
  document.getElementById('project-search').addEventListener('input', loadProjects);
  document.getElementById('project-status-filter').addEventListener('change', loadProjects);

  // New Project Modal
  document.getElementById('btn-create-project').addEventListener('click', () => {
    const content = `
      <form id="form-new-project">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Project Code</label>
            <input type="text" id="inp-prj-code" class="form-control" placeholder="PRJ-2024-004" required>
          </div>
          <div class="form-group">
            <label class="form-label">Project Name</label>
            <input type="text" id="inp-prj-name" class="form-control" placeholder="E.g. Rabat Tech Park Phase 2" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Location / Site Address</label>
          <input type="text" id="inp-prj-loc" class="form-control" placeholder="E.g. Technopolis Rabat-Salé">
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea id="inp-prj-desc" class="form-control" rows="3" placeholder="Project scope, contract reference, main contractors..."></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Start Date</label>
            <input type="date" id="inp-prj-start" class="form-control">
          </div>
          <div class="form-group">
            <label class="form-label">Expected Completion</label>
            <input type="date" id="inp-prj-end" class="form-control">
          </div>
        </div>
      </form>
    `;

    showModal({
      title: 'Create New Construction Project',
      content,
      confirmText: 'Create Project',
      onConfirm: async () => {
        const projectCode = document.getElementById('inp-prj-code').value.trim();
        const name = document.getElementById('inp-prj-name').value.trim();
        const location = document.getElementById('inp-prj-loc').value.trim();
        const description = document.getElementById('inp-prj-desc').value.trim();
        const startDate = document.getElementById('inp-prj-start').value || undefined;
        const expectedEndDate = document.getElementById('inp-prj-end').value || undefined;

        if (!projectCode || !name) {
          showToast('Project Code and Name are required', 'error');
          return false;
        }

        try {
          await api.post('/projects', { projectCode, name, location, description, startDate, expectedEndDate });
          showToast('Project created successfully', 'success');
          loadProjects();
          return true;
        } catch (err) {
          showToast(err.message, 'error');
          return false;
        }
      }
    });
  });

  // Assign PM Modal (§7)
  async function openAssignModal(projectId, projectName) {
    try {
      const usersRes = await api.get('/users?role=PROJECT_MANAGER');
      const pms = usersRes.data || [];

      const content = `
        <p style="margin-bottom: 1rem; color: var(--text-secondary);">
          Assigning a Project Manager to <strong>${projectName}</strong> creates a dated assignment record and softly deactivates any previous assignment per §7.
        </p>
        <div class="form-group">
          <label class="form-label">Select Project Manager</label>
          <select id="sel-assign-user" class="form-select" required>
            ${pms.map(u => `<option value="${u._id}">${u.fullName} (${u.email})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Assigned Role Title</label>
          <input type="text" id="inp-assign-role" class="form-control" value="Lead Project Manager" required>
        </div>
      `;

      showModal({
        title: 'Assign Project Manager',
        content,
        confirmText: 'Assign & Record',
        onConfirm: async () => {
          const userId = document.getElementById('sel-assign-user').value;
          const role = document.getElementById('inp-assign-role').value.trim();

          try {
            await api.post('/project-assignments', { userId, projectId, role });
            showToast('Project Manager assigned successfully', 'success');
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

  loadProjects();
}

