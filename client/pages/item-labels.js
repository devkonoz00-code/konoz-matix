/**
 * Printable Barcode & QR Label Printing Page Module (§11)
 * Supports single-item and multi-item batch printing packed onto A4 sheets.
 * Renders scannable 1D Barcode symbol + 2D QR Code + Item Name + Code (footprint ≤10 cm).
 */
import { api } from '../js/api.js';
import { showToast } from '../js/app.js';
import { i18n } from '../js/i18n.js';

export async function renderItemLabels(container, params) {
  document.getElementById('page-title').textContent = i18n.t('btn_print_barcode') || 'Print Labels';
  const ids = params.ids || '';

  container.innerHTML = `
    <div class="no-print" style="margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div>
          <a href="#/items" class="btn btn-sm btn-outline" style="margin-bottom: 0.5rem;">&larr; Back to Items Catalog</a>
          <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">Printable Barcode & QR Labels</h2>
          <p style="color: var(--text-secondary); font-size: 0.85rem;">
            Physical item labels (≤ 10 cm) optimized for A4 batch printing. Scannable by standard 1D laser & 2D mobile camera scanners.
          </p>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <button class="btn btn-primary" id="btn-trigger-print">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            <span>Print Labels Now (A4)</span>
          </button>
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

    sheet.innerHTML = items.map((it, idx) => `
      <div class="item-label-card" id="label-card-${idx}">
        <div class="item-label-header">
          <div class="item-label-title">${it.name}</div>
          <div class="item-label-code">${it.itemCode}</div>
        </div>

        <div class="item-label-body">
          <div class="item-label-barcode">
            <svg id="barcode-svg-${idx}"></svg>
          </div>
          <div class="item-label-qr">
            <canvas id="qr-canvas-${idx}"></canvas>
          </div>
        </div>

        <div class="item-label-footer">
          <span>${it.category || 'General'} • ${it.unit || 'unit'}</span>
          <span>${it.brand ? `${it.brand} ` : ''}${it.model || ''}</span>
          <span style="font-family: var(--font-mono); font-weight: 600;">${it.barcode}</span>
        </div>
      </div>
    `).join('');

    // Render Barcodes & QR codes client-side
    items.forEach((it, idx) => {
      const barcodeValue = it.barcode || it.itemCode;
      const barcodeSvg = document.getElementById(`barcode-svg-${idx}`);
      const qrCanvas = document.getElementById(`qr-canvas-${idx}`);

      // 1. Render Barcode (1D Symbol)
      if (typeof JsBarcode !== 'undefined' && barcodeSvg) {
        try {
          const format = (it.barcodeType === 'EAN-13' && barcodeValue.length === 13) ? 'EAN13' : 'CODE128';
          JsBarcode(barcodeSvg, barcodeValue, {
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
          // Fallback to Code 128 if EAN checksum fails
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
      if (typeof QRCode !== 'undefined' && qrCanvas) {
        try {
          QRCode.toCanvas(qrCanvas, barcodeValue, {
            width: 78,
            margin: 1,
            color: {
              dark: '#0f172a',
              light: '#ffffff',
            },
          });
        } catch (err) {
          console.warn('QRCode error:', err);
        }
      }
    });

  } catch (err) {
    showToast(err.message, 'error');
  }
}
