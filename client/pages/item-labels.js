/**
 * Printable Barcode & QR Label Printing Page Module (§11)
 * Supports single-item and multi-item batch printing packed onto A4 sheets.
 * Dynamic copies multiplier, stepper, presets, and live A4 sheet preview.
 * Renders scannable 1D Barcode symbol + 2D QR Code + Item Name + Code (footprint ≤10 cm).
 */
import { api } from '../js/api.js';
import { showToast } from '../js/app.js';
import { i18n } from '../js/i18n.js';

export async function renderItemLabels(container, params) {
  document.getElementById('page-title').textContent = i18n.t('btn_print_barcode') || 'Print Labels';
  const ids = params.ids || '';
  let copiesPerItem = Math.max(1, parseInt(params.copies, 10) || 1);

  container.innerHTML = `
    <div class="no-print" style="margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">
        <div>
          <a href="#/items" class="btn btn-sm btn-outline" style="margin-bottom: 0.5rem;">&larr; Back to Items Catalog</a>
          <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">Printable Barcode & QR Labels</h2>
          <p style="color: var(--text-secondary); font-size: 0.85rem;">
            Physical item labels (≤ 10 cm) optimized for A4 batch printing. Scannable by standard 1D laser & 2D mobile camera scanners.
          </p>
        </div>
        <div>
          <button class="btn btn-primary" id="btn-trigger-print" style="font-weight: 700; padding: 0.6rem 1.25rem;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            <span id="btn-print-text">Print Labels Now (A4)</span>
          </button>
        </div>
      </div>

      <!-- Copies Control & Print Settings Toolbar (§11) -->
      <div class="label-print-controls">
        <div class="label-controls-grid">
          <div>
            <label style="font-size: 0.82rem; font-weight: 700; color: var(--text-primary); display: block; margin-bottom: 0.4rem;">
              🏷️ عدد النسخ من نفس الملصق / Number of Copies:
            </label>
            <div class="label-stepper-wrapper">
              <div class="label-stepper">
                <button type="button" class="label-stepper-btn" id="btn-copies-dec" title="تقليل النسخ">-</button>
                <input type="number" id="inp-copies-count" class="label-stepper-input" min="1" max="500" value="${copiesPerItem}">
                <button type="button" class="label-stepper-btn" id="btn-copies-inc" title="زيادة النسخ">+</button>
              </div>

              <!-- Quick Preset Chips -->
              <div class="label-presets" id="copies-presets">
                <button type="button" class="label-preset-chip ${copiesPerItem === 1 ? 'active' : ''}" data-copies="1">1 نسخة</button>
                <button type="button" class="label-preset-chip ${copiesPerItem === 2 ? 'active' : ''}" data-copies="2">2</button>
                <button type="button" class="label-preset-chip ${copiesPerItem === 5 ? 'active' : ''}" data-copies="5">5</button>
                <button type="button" class="label-preset-chip ${copiesPerItem === 10 ? 'active' : ''}" data-copies="10">10</button>
                <button type="button" class="label-preset-chip ${copiesPerItem === 20 ? 'active' : ''}" data-copies="20">20</button>
                <button type="button" class="label-preset-chip ${copiesPerItem === 50 ? 'active' : ''}" data-copies="50">50</button>
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
            <div class="label-stats-pill" id="label-stats-badge">
              <span>📊 الإجمالي: <strong id="stat-total-labels">1</strong> ملصق</span>
              <span>•</span>
              <span>📄 <span id="stat-total-pages">~1 ورقة A4</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Printable Sheet Container -->
    <div id="labels-container" class="labels-sheet">
      <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
        Generating printable barcode and QR labels...
      </div>
    </div>
  `;

  i18n.translateDOM(container);

  // Trigger browser print
  document.getElementById('btn-trigger-print')?.addEventListener('click', () => {
    window.print();
  });

  try {
    const res = await api.get('/items/labels', { ids });
    const items = res.data || [];
    const sheet = document.getElementById('labels-container');

    if (items.length === 0) {
      sheet.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
          No items found to generate labels for. Please select items from the catalog.
        </div>
      `;
      return;
    }

    // Function to render all label cards according to copy count
    function renderLabels() {
      const copies = Math.max(1, copiesPerItem);
      const totalLabels = items.length * copies;
      const estimatedPages = Math.ceil(totalLabels / 8); // Approx 8-10 labels per A4 page

      // Update Toolbar Stats & Buttons
      const statTotalEl = document.getElementById('stat-total-labels');
      const statPagesEl = document.getElementById('stat-total-pages');
      const printBtnText = document.getElementById('btn-print-text');
      const copiesInput = document.getElementById('inp-copies-count');
      const decBtn = document.getElementById('btn-copies-dec');

      if (statTotalEl) statTotalEl.textContent = totalLabels;
      if (statPagesEl) statPagesEl.textContent = `~${estimatedPages} ورقة A4 (${totalLabels} ملصق)`;
      if (printBtnText) printBtnText.textContent = `طباعة الآن (${totalLabels} ملصق - A4)`;
      if (copiesInput && parseInt(copiesInput.value, 10) !== copies) copiesInput.value = copies;
      if (decBtn) decBtn.disabled = copies <= 1;

      // Update active preset chip
      document.querySelectorAll('#copies-presets .label-preset-chip').forEach(chip => {
        const val = parseInt(chip.dataset.copies, 10);
        chip.classList.toggle('active', val === copies);
      });

      // Build cards HTML
      let cardsHtml = '';
      for (let c = 0; c < copies; c++) {
        items.forEach((it, itIdx) => {
          const cardId = `${itIdx}-${c}`;
          const copyBadge = copies > 1 ? `<span style="font-size: 0.65rem; color: var(--text-muted); font-family: var(--font-mono);">[نسخة ${c + 1}/${copies}]</span>` : '';

          cardsHtml += `
            <div class="item-label-card" id="label-card-${cardId}">
              <div class="item-label-header">
                <div class="item-label-title">${it.name}</div>
                <div class="item-label-code" style="display: flex; flex-direction: column; align-items: flex-end;">
                  <span>${it.itemCode}</span>
                  ${copyBadge}
                </div>
              </div>

              <div class="item-label-body">
                <div class="item-label-barcode">
                  <svg id="barcode-svg-${cardId}"></svg>
                </div>
                <div class="item-label-qr">
                  <canvas id="qr-canvas-${cardId}"></canvas>
                </div>
              </div>

              <div class="item-label-footer">
                <span>${it.category || 'General'} • ${it.unit || 'unit'}</span>
                <span>${it.brand ? `${it.brand} ` : ''}${it.model || ''}</span>
                <span style="font-family: var(--font-mono); font-weight: 600;">${it.barcode}</span>
              </div>
            </div>
          `;
        });
      }

      sheet.innerHTML = cardsHtml;

      // Render Barcodes & QR codes client-side for each copy
      for (let c = 0; c < copies; c++) {
        items.forEach((it, itIdx) => {
          const cardId = `${itIdx}-${c}`;
          const barcodeValue = it.barcode || it.itemCode;
          const barcodeSvg = document.getElementById(`barcode-svg-${cardId}`);
          const qrCanvas = document.getElementById(`qr-canvas-${cardId}`);

          // 1. Render Barcode (1D Symbol) with intelligent format detection
          if (typeof JsBarcode !== 'undefined' && barcodeSvg) {
            const cleanVal = barcodeValue.replace(/\s+/g, '');
            let format = 'CODE128';
            if (it.barcodeType === 'EAN-13' || (/^\d{13}$/.test(cleanVal) && cleanVal.length === 13)) {
              format = 'EAN13';
            } else if (it.barcodeType === 'EAN-8' || (/^\d{8}$/.test(cleanVal) && cleanVal.length === 8)) {
              format = 'EAN8';
            } else if (it.barcodeType === 'UPC' || (/^\d{12}$/.test(cleanVal) && cleanVal.length === 12)) {
              format = 'UPC';
            }

            try {
              JsBarcode(barcodeSvg, cleanVal, {
                format,
                lineColor: '#0f172a',
                width: 1.4,
                height: 38,
                displayValue: true,
                fontSize: 10,
                margin: 2,
                font: 'monospace',
              });
            } catch (err) {
              try {
                JsBarcode(barcodeSvg, barcodeValue, {
                  format: 'CODE128',
                  lineColor: '#0f172a',
                  width: 1.4,
                  height: 38,
                  displayValue: true,
                  fontSize: 10,
                  margin: 2,
                  font: 'monospace',
                });
              } catch (e) {
                console.warn('JsBarcode error:', e);
              }
            }
          }

          // 2. Render QR Code (2D Symbol)
          if (qrCanvas) {
            try {
              if (window.MatixQR && typeof window.MatixQR.toCanvas === 'function') {
                window.MatixQR.toCanvas(qrCanvas, barcodeValue, {
                  width: 78,
                  margin: 1,
                  colorDark: '#0f172a',
                  colorLight: '#ffffff',
                });
              } else if (typeof QRCode !== 'undefined' && typeof QRCode.toCanvas === 'function') {
                QRCode.toCanvas(qrCanvas, barcodeValue, {
                  width: 78,
                  margin: 1,
                  color: { dark: '#0f172a', light: '#ffffff' },
                });
              }
            } catch (err) {
              console.warn('QR render error:', err);
            }
          }
        });
      }
    }

    // Initial render
    renderLabels();

    // Event listeners for copies controls
    const copiesInput = document.getElementById('inp-copies-count');
    const incBtn = document.getElementById('btn-copies-inc');
    const decBtn = document.getElementById('btn-copies-dec');

    incBtn?.addEventListener('click', () => {
      copiesPerItem = Math.min(500, copiesPerItem + 1);
      renderLabels();
    });

    decBtn?.addEventListener('click', () => {
      if (copiesPerItem > 1) {
        copiesPerItem = Math.max(1, copiesPerItem - 1);
        renderLabels();
      }
    });

    copiesInput?.addEventListener('change', () => {
      const val = parseInt(copiesInput.value, 10);
      if (!isNaN(val) && val >= 1 && val <= 500) {
        copiesPerItem = val;
      } else {
        copiesPerItem = 1;
      }
      renderLabels();
    });

    // Preset chips click
    document.querySelectorAll('#copies-presets .label-preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const val = parseInt(chip.dataset.copies, 10);
        if (!isNaN(val) && val >= 1) {
          copiesPerItem = val;
          renderLabels();
        }
      });
    });

  } catch (err) {
    showToast(err.message, 'error');
  }
}
