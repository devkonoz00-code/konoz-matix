/**
 * Company Documents (Bon de Vente References) Page Module
 */
import { api } from '../js/api.js';
import { formatDate, showToast, showModal, escapeHtml } from '../js/app.js';
import { i18n } from '../js/i18n.js';

export async function renderDocuments(container) {
  document.getElementById('page-title').textContent = i18n.t('nav_documents');

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
      <div>
        <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);" data-i18n="nav_documents">Company Documents (ERP References)</h2>
        <p style="color: var(--text-secondary); font-size: 0.85rem;">Official warehouse exit documents (Bon de Vente / Sage ERP) linked to ledger movements</p>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-create-doc">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span>Register Company Document</span>
      </button>
    </div>

    <!-- Documents Table -->
    <div class="card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Document Reference #</th>
              <th>Document Type</th>
              <th>Document Date</th>
              <th>External ERP Ref</th>
              <th>Source System</th>
              <th>Notes / Validation</th>
            </tr>
          </thead>
          <tbody id="documents-table-body">
            <tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Loading company documents...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  i18n.translateDOM(container);

  async function loadDocuments() {
    const tbody = document.getElementById('documents-table-body');
    try {
      const res = await api.get('/documents');
      const docs = res.data || [];

      if (docs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No company documents recorded.</td></tr>`;
        return;
      }

      tbody.innerHTML = docs.map(d => `
        <tr>
          <td>
            <span style="font-family: var(--font-mono); font-weight: 700; color: var(--purple); font-size: 0.95rem;">${escapeHtml(d.documentNumber)}</span>
          </td>
          <td><span class="badge badge-secondary">${escapeHtml(d.documentType)}</span></td>
          <td>${formatDate(d.documentDate).split(',')[0]}</td>
          <td style="font-family: var(--font-mono); color: var(--text-secondary);">${escapeHtml(d.externalReference || '—')}</td>
          <td style="color: var(--accent-cyan); font-weight: 500;">${escapeHtml(d.sourceSystem || 'Internal ERP')}</td>
          <td style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(d.note || '—')}</td>
        </tr>
      `).join('');

    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Register Document Modal
  document.getElementById('btn-create-doc').addEventListener('click', () => {
    const content = `
      <form id="form-new-doc">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Document Number</label>
            <input type="text" id="inp-doc-num" class="form-control" placeholder="E.g. BV-2024-01050" required>
          </div>
          <div class="form-group">
            <label class="form-label">Document Type</label>
            <input type="text" id="inp-doc-type" class="form-control" value="Bon de Vente Externe" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Document Date</label>
            <input type="date" id="inp-doc-date" class="form-control" required>
          </div>
          <div class="form-group">
            <label class="form-label">External Reference</label>
            <input type="text" id="inp-doc-ext" class="form-control" placeholder="E.g. SAP-SO-88412">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Source System</label>
          <input type="text" id="inp-doc-sys" class="form-control" value="Internal Sage ERP">
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <input type="text" id="inp-doc-note" class="form-control" placeholder="E.g. Authorized by Chief Controller">
        </div>
      </form>
    `;

    showModal({
      title: 'Register Company Document Reference',
      content,
      confirmText: 'Save Document',
      onConfirm: async () => {
        const documentNumber = document.getElementById('inp-doc-num').value.trim();
        const documentType = document.getElementById('inp-doc-type').value.trim();
        const documentDate = document.getElementById('inp-doc-date').value;
        const externalReference = document.getElementById('inp-doc-ext').value.trim();
        const sourceSystem = document.getElementById('inp-doc-sys').value.trim();
        const note = document.getElementById('inp-doc-note').value.trim();

        if (!documentNumber || !documentType || !documentDate) {
          showToast('Please fill all required fields', 'error');
          return false;
        }

        try {
          await api.post('/documents', { documentNumber, documentType, documentDate, externalReference, sourceSystem, note });
          showToast('Company Document recorded', 'success');
          loadDocuments();
          return true;
        } catch (err) {
          showToast(err.message, 'error');
          return false;
        }
      }
    });
  });

  loadDocuments();
}
