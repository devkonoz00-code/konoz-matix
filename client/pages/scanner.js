/**
 * Camera Barcode & QR Scanner Page Module (§10, §13)
 * Primary scanner-first interface for Project Managers and Site Personnel.
 * Renders live camera feed, manual entry, item identity, location, valuation, and contextual action triggers.
 */
import { api } from '../js/api.js';
import { formatMoney, formatDate, showToast, showModal } from '../js/app.js';
import { i18n } from '../js/i18n.js';
import { router } from '../js/router.js';

let html5QrCode = null;

export function renderScanner(container) {
  document.getElementById('page-title').textContent = i18n.t('nav_scanner');

  container.innerHTML = `
    <div style="max-width: 680px; margin: 0 auto;">
      <div style="margin-bottom: 1.5rem;">
        <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);" data-i18n="scanner_title">Barcode & QR Mobile Scanner</h2>
        <p style="color: var(--text-secondary); font-size: 0.85rem;" data-i18n="scanner_instruction">
          Point your device camera at an item barcode or printed QR label.
        </p>
      </div>

      <!-- Camera Viewport Box -->
      <div class="card" style="padding: 1rem; margin-bottom: 1.5rem;">
        <div id="reader" style="width: 100%; min-height: 260px; border-radius: var(--radius-md); overflow: hidden; background: #0f172a; position: relative;">
          <!-- Laser animation line -->
          <div style="position: absolute; left: 0; right: 0; height: 2px; background: #2563eb; top: 50%; box-shadow: 0 0 8px #2563eb; display: none;" id="scanner-laser-line"></div>
        </div>

        <div style="display: flex; justify-content: center; gap: 0.75rem; margin-top: 1rem;">
          <button class="btn btn-sm btn-primary" id="btn-start-camera">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span>Start Camera Scanner</span>
          </button>
          <button class="btn btn-sm btn-secondary" id="btn-stop-camera" style="display: none;">Stop Camera</button>
        </div>
      </div>

      <!-- Manual Barcode Entry Fallback -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <label class="form-label" data-i18n="scanner_manual_entry">Or enter barcode / item code manually:</label>
        <form id="manual-barcode-form" style="display: flex; gap: 0.5rem;">
          <input type="text" id="manual-barcode-input" class="form-control" placeholder="E.g. ITM-000101 or barcode digits" required>
          <button type="submit" class="btn btn-primary" style="flex-shrink: 0;">Lookup</button>
        </form>
      </div>

      <!-- Scanned Item Result Card -->
      <div id="scanner-result" style="display: none;"></div>
    </div>
  `;

  i18n.translateDOM(container);

  const startBtn = document.getElementById('btn-start-camera');
  const stopBtn = document.getElementById('btn-stop-camera');

  function showReaderError(message, showRetry = true) {
    const reader = document.getElementById('reader');
    if (!reader) return;
    reader.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 260px; padding: 1.5rem; text-align: center;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5" style="margin-bottom: 1rem; opacity: 0.8;">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <p style="color: #f87171; font-weight: 600; font-size: 0.95rem; margin-bottom: 0.5rem;">${message}</p>
        ${showRetry ? '<button class="btn btn-sm btn-primary" id="btn-retry-scanner" style="margin-top: 0.75rem;">Tap to Retry</button>' : ''}
      </div>
    `;
    if (showRetry) {
      document.getElementById('btn-retry-scanner')?.addEventListener('click', () => {
        reader.innerHTML = '<div id="scanner-laser-line" style="display:none;"></div>';
        startScanner();
      });
    }
    startBtn.style.display = 'inline-flex';
    stopBtn.style.display = 'none';
  }

  function waitForLibrary(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      if (typeof Html5Qrcode !== 'undefined') return resolve();
      const interval = 500;
      let elapsed = 0;
      const timer = setInterval(() => {
        elapsed += interval;
        if (typeof Html5Qrcode !== 'undefined') {
          clearInterval(timer);
          resolve();
        } else if (elapsed >= timeoutMs) {
          clearInterval(timer);
          reject(new Error('LIBRARY_TIMEOUT'));
        }
      }, interval);
    });
  }

  async function startScanner() {
    try {
      await waitForLibrary(8000);
    } catch (_) {
      console.error('html5-qrcode library failed to load within 8 seconds');
      showReaderError('Camera scanner library failed to load. Check your internet connection and try again.');
      return;
    }

    try {
      if (!html5QrCode) {
        html5QrCode = new Html5Qrcode('reader');
      }

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: { width: 250, height: 180 },
        },
        onScanSuccess,
        (_errorMessage) => {}
      );

      startBtn.style.display = 'none';
      stopBtn.style.display = 'inline-flex';
      const laser = document.getElementById('scanner-laser-line');
      if (laser) laser.style.display = 'block';

    } catch (err) {
      console.warn('Camera start error:', err);
      const errStr = String(err?.message || err || '').toLowerCase();
      if (errStr.includes('notallowed') || errStr.includes('permission')) {
        showReaderError('Camera permission denied. Please allow camera access in your browser settings, then tap retry.');
      } else if (errStr.includes('notfound') || errStr.includes('device')) {
        showReaderError('No camera found on this device. Try using a device with a camera, or use manual entry below.', false);
      } else {
        showReaderError("Camera didn't start — tap to retry.");
      }
    }
  }

  async function stopScanner() {
    if (html5QrCode) {
      try {
        await html5QrCode.stop();
        startBtn.style.display = 'inline-flex';
        stopBtn.style.display = 'none';
        const laser = document.getElementById('scanner-laser-line');
        if (laser) laser.style.display = 'none';
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
    }
  }

  startBtn.addEventListener('click', startScanner);
  stopBtn.addEventListener('click', stopScanner);

  async function onScanSuccess(decodedText) {
    if (navigator.vibrate) navigator.vibrate(100);
    showToast(`Barcode detected: ${decodedText}`, 'info');
    lookupBarcode(decodedText);
  }

  async function lookupBarcode(code) {
    const resultContainer = document.getElementById('scanner-result');
    resultContainer.style.display = 'block';
    resultContainer.innerHTML = `
      <div class="card" style="text-align: center; padding: 2rem;">
        <p style="color: var(--text-secondary);">Looking up code <strong>${code}</strong> in MATIX ledger...</p>
      </div>
    `;

    try {
      const barcodeRes = await api.get(`/barcodes/${encodeURIComponent(code)}`);
      const { item, currentLocations, lastMovement, contextualActions } = barcodeRes.data;

      const primaryLoc = currentLocations?.[0];
      const locName = primaryLoc ? primaryLoc.locationName : 'None (Zero Stock)';
      const responsible = primaryLoc?.responsible || '—';
      const totalAvailable = currentLocations?.reduce((sum, l) => sum + l.quantity, 0) || 0;

      // Build Action Buttons
      let actionsHtml = '';
      if (contextualActions && contextualActions.length > 0) {
        actionsHtml = `
          <div style="margin-top: 1.25rem; border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.75rem;">
              ⚡ Available Actions for You:
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              ${contextualActions.map((act, idx) => `
                <button class="btn btn-primary btn-contextual-action" data-idx="${idx}" style="justify-content: space-between; text-align: left; padding: 0.65rem 1rem;">
                  <span>${act.label}</span>
                  <span class="badge" style="background: rgba(255,255,255,0.25); color: #fff;">${act.availableQuantity} ${item.unit} Avail.</span>
                </button>
              `).join('')}
            </div>
          </div>
        `;
      } else {
        actionsHtml = `
          <div style="margin-top: 1rem; padding: 0.75rem; background: var(--bg-surface-elevated); border-radius: var(--radius-md); font-size: 0.8rem; color: var(--text-muted); text-align: center;">
            ℹ️ Read-only view (no pending site actions available for your role at this location).
          </div>
        `;
      }

      resultContainer.innerHTML = `
        <div class="card" style="border: 2px solid var(--primary); animation: slideIn 0.3s ease;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
            <div>
              <span class="badge badge-success" style="margin-bottom: 0.35rem;" data-i18n="scanner_item_found">Item Identified</span>
              <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">${item.name}</h3>
              <div style="font-size: 0.82rem; font-family: var(--font-mono); color: var(--primary); font-weight: 600;">${item.itemCode}</div>
            </div>
            <span class="badge badge-info">${item.itemType}</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; background: var(--bg-surface-elevated); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.25rem; font-size: 0.85rem; border: 1px solid var(--border-subtle);">
            <div>
              <div style="color: var(--text-muted); font-size: 0.72rem; font-weight: 700; text-transform: uppercase;">Current Location</div>
              <div style="font-weight: 600; color: var(--text-primary);">${locName}</div>
            </div>
            <div>
              <div style="color: var(--text-muted); font-size: 0.72rem; font-weight: 700; text-transform: uppercase;">Available Quantity</div>
              <div style="font-weight: 700; color: var(--accent-cyan); font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                <span>${totalAvailable} ${item.unit}</span>
                ${item.minimumStock != null && totalAvailable <= item.minimumStock ? `
                  <span class="badge badge-warning" style="font-size: 0.68rem; padding: 0.2rem 0.45rem;">⚠️ Low Stock (Min: ${item.minimumStock})</span>
                ` : ''}
              </div>
            </div>
            <div>
              <div style="color: var(--text-muted); font-size: 0.72rem; font-weight: 700; text-transform: uppercase;">Responsible Party</div>
              <div style="font-weight: 600; color: var(--text-primary);">${responsible}</div>
            </div>
            <div>
              <div style="color: var(--text-muted); font-size: 0.72rem; font-weight: 700; text-transform: uppercase;">Unit Valuation</div>
              <div style="font-weight: 600; color: var(--success);">${formatMoney(item.unitPrice)}</div>
            </div>
            <div style="grid-column: 1 / -1; border-top: 1px solid var(--border-subtle); padding-top: 0.5rem;">
              <div style="color: var(--text-muted); font-size: 0.72rem; font-weight: 700; text-transform: uppercase;">Last Movement Event</div>
              <div style="font-weight: 500; color: var(--text-primary);">
                ${lastMovement ? `${lastMovement.type} (${lastMovement.movementNumber}) — ${formatDate(lastMovement.date)}` : 'None recorded'}
              </div>
            </div>
          </div>

          <!-- Contextual Action Buttons (§13) -->
          ${actionsHtml}

          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1rem;">
            <a href="#/items/${item._id}" class="btn btn-outline" style="flex: 1;">
              <span data-i18n="btn_view_history">Full Movement History</span> &rarr;
            </a>
            <a href="#/items/labels?ids=${item._id}" class="btn btn-outline">
              <span>🖨️ Print Label</span>
            </a>
          </div>
        </div>
      `;

      i18n.translateDOM(resultContainer);

      // Bind contextual action buttons
      resultContainer.querySelectorAll('.btn-contextual-action').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-idx'));
          const act = contextualActions[idx];
          handleContextualAction(act, item, code);
        });
      });

    } catch (err) {
      const canRegister = err.data?.canRegister || err.response?.data?.canRegister || true;
      resultContainer.innerHTML = `
        <div class="card" style="border: 1px solid var(--danger); text-align: center; padding: 2rem;">
          <h4 style="color: var(--danger); font-size: 1.1rem; margin-bottom: 0.5rem;" data-i18n="scanner_not_found">Barcode Not Registered</h4>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1rem;">
            No item corresponds to barcode <code>${code}</code> in the MATIX ledger.
          </p>
          ${canRegister ? `
            <a href="#/items" class="btn btn-sm btn-primary">Register New Item with this Code</a>
          ` : ''}
        </div>
      `;
      i18n.translateDOM(resultContainer);
    }
  }

  // Handle Contextual Action Execution Modal (§13)
  async function handleContextualAction(act, item, barcode) {
    if (act.actionType === 'DIRECT_ISSUE' || act.actionType === 'ISSUE') {
      let allowedProjects = act.allowedProjects;
      if (!allowedProjects || allowedProjects.length === 0) {
        const prjRes = await api.get('/projects?status=ACTIVE');
        allowedProjects = (prjRes.data || []).map(p => ({
          id: p._id,
          name: p.name,
          projectCode: p.projectCode,
        }));
      }

      const content = `
        <form id="form-direct-issue">
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1rem;">
            Directly issuing <strong>${item.name}</strong> from <strong>${act.fromLocation.name}</strong> to a project site.
          </p>
          <div class="form-group">
            <label class="form-label">Destination Project</label>
            <select id="sel-direct-project" class="form-select" required>
              ${allowedProjects.map(p => `<option value="${p.id}">${p.projectCode} — ${p.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Quantity (Available: ${act.availableQuantity} ${item.unit})</label>
            <input type="number" step="0.01" id="inp-direct-qty" class="form-control" value="1" min="0.01" max="${act.availableQuantity}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Note / Reference (Optional)</label>
            <input type="text" id="inp-direct-note" class="form-control" placeholder="E.g. Fast-path scanner issue for urgent framing work">
          </div>
        </form>
      `;

      showModal({
        title: `Direct Issue — ${item.name}`,
        content,
        confirmText: 'Confirm & Issue',
        onConfirm: async () => {
          const projectId = document.getElementById('sel-direct-project').value;
          const qty = parseFloat(document.getElementById('inp-direct-qty').value);
          const note = document.getElementById('inp-direct-note').value.trim();

          if (isNaN(qty) || qty <= 0) {
            showToast('Please enter a valid quantity', 'error');
            return false;
          }
          if (qty > act.availableQuantity) {
            showToast(`Insufficient stock. Only ${act.availableQuantity} ${item.unit} available at warehouse`, 'error');
            return false;
          }

          try {
            await api.post('/movements', {
              type: 'ISSUE',
              fromLocation: { kind: 'WAREHOUSE', id: act.fromLocation.id },
              toLocation: { kind: 'PROJECT', id: projectId },
              projectId,
              note: note || 'Direct issue via mobile scanner',
              lines: [{ itemId: item._id, quantity: qty }],
            });
            showToast(`Issued ${qty} ${item.unit} of ${item.name} to project site!`, 'success');
            lookupBarcode(barcode);
            return true;
          } catch (err) {
            showToast(err.message, 'error');
            return false;
          }
        }
      });

    } else if (act.actionType === 'TRANSFER') {
      const prjRes = await api.get('/projects?status=ACTIVE');
      const allProjects = (prjRes.data || []).filter(p => p._id.toString() !== act.fromLocation.id.toString());

      const content = `
        <form id="form-scanner-transfer">
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1rem;">
            Transferring <strong>${item.name}</strong> from <strong>${act.fromLocation.name}</strong> to another active site.
          </p>
          <div class="form-group">
            <label class="form-label">Destination Project</label>
            <select id="sel-trf-dest" class="form-select" required>
              ${allProjects.map(p => `<option value="${p._id}">${p.projectCode} — ${p.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Transfer Quantity (Available: ${act.availableQuantity} ${item.unit})</label>
            <input type="number" step="0.01" id="inp-trf-qty" class="form-control" value="1" min="0.01" max="${act.availableQuantity}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Transfer Note</label>
            <input type="text" id="inp-trf-note" class="form-control" placeholder="E.g. Relocating equipment to site 2">
          </div>
        </form>
      `;

      showModal({
        title: `Site Transfer — ${item.name}`,
        content,
        confirmText: 'Submit Transfer',
        onConfirm: async () => {
          const destId = document.getElementById('sel-trf-dest').value;
          const qty = parseFloat(document.getElementById('inp-trf-qty').value);
          const note = document.getElementById('inp-trf-note').value.trim();

          if (isNaN(qty) || qty <= 0) {
            showToast('Please enter a valid quantity', 'error');
            return false;
          }
          if (qty > act.availableQuantity) {
            showToast(`Insufficient stock at source project. Available: ${act.availableQuantity} ${item.unit}`, 'error');
            return false;
          }

          try {
            await api.post('/transfers', {
              fromLocation: { kind: 'PROJECT', id: act.fromLocation.id },
              toLocation: { kind: 'PROJECT', id: destId },
              note: note || 'Transfer initiated via scanner',
              lines: [{ itemId: item._id, quantity: qty }],
            });
            showToast('Transfer submitted! Awaiting destination site confirmation.', 'success');
            lookupBarcode(barcode);
            return true;
          } catch (err) {
            showToast(err.message, 'error');
            return false;
          }
        }
      });

    } else if (act.actionType === 'RETURN') {
      const whRes = await api.get('/warehouses');
      const warehouses = whRes.data || [];

      const content = `
        <form id="form-scanner-return">
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1rem;">
            Returning <strong>${item.name}</strong> from <strong>${act.fromLocation.name}</strong> to central warehouse.
          </p>
          <div class="form-group">
            <label class="form-label">Destination Warehouse</label>
            <select id="sel-ret-dest" class="form-select" required>
              ${warehouses.map(w => `<option value="${w._id}">${w.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Return Quantity (Available: ${act.availableQuantity} ${item.unit})</label>
            <input type="number" step="0.01" id="inp-ret-qty" class="form-control" value="1" min="0.01" max="${act.availableQuantity}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Reason for Return</label>
            <input type="text" id="inp-ret-note" class="form-control" placeholder="E.g. Surplus returned after concrete pour">
          </div>
        </form>
      `;

      showModal({
        title: `Return to Warehouse — ${item.name}`,
        content,
        confirmText: 'Submit Return',
        onConfirm: async () => {
          const whId = document.getElementById('sel-ret-dest').value;
          const qty = parseFloat(document.getElementById('inp-ret-qty').value);
          const note = document.getElementById('inp-ret-note').value.trim();

          if (isNaN(qty) || qty <= 0) {
            showToast('Please enter a valid quantity', 'error');
            return false;
          }
          if (qty > act.availableQuantity) {
            showToast(`Insufficient stock at site. Available: ${act.availableQuantity} ${item.unit}`, 'error');
            return false;
          }

          try {
            await api.post('/returns', {
              fromLocation: { kind: 'PROJECT', id: act.fromLocation.id },
              toLocation: { kind: 'WAREHOUSE', id: whId },
              note: note || 'Return initiated via scanner',
              lines: [{ itemId: item._id, quantity: qty }],
            });
            showToast('Return submitted! Awaiting warehouse confirmation.', 'success');
            lookupBarcode(barcode);
            return true;
          } catch (err) {
            showToast(err.message, 'error');
            return false;
          }
        }
      });
    }
  }

  // Handle Manual Form Submission
  const manualForm = document.getElementById('manual-barcode-form');
  manualForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = document.getElementById('manual-barcode-input').value.trim();
    if (code) lookupBarcode(code);
  });

  // Auto-start camera if mobile
  if (window.innerWidth <= 900) {
    setTimeout(startScanner, 400);
  }
}

