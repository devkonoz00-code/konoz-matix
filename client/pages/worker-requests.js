/**
 * Worker Material Requests Page Module (Messenger Style)
 * Ultra-simple, friendly chat-like interface for workshop workers & field staff.
 */
import { api } from '../js/api.js';
import {
  formatDate,
  showToast,
  escapeHtml,
  openImageLightboxModal,
  playSuccessChime,
  playConfirmBeep,
  playErrorTone,
} from '../js/app.js';
import { i18n } from '../js/i18n.js';

export async function renderWorkerRequests(container) {
  document.getElementById('page-title').textContent = 'طلبات الورشة / Material Orders';

  const currentUser = api.getCurrentUser();
  const workerName = escapeHtml(currentUser?.fullName || 'العامل');

  container.innerHTML = `
    <div class="worker-requests-wrapper" style="max-width: 800px; margin: 0 auto; padding-bottom: 2rem;">

      <!-- Worker Welcome Header Card -->
      <div class="card" style="background: linear-gradient(135deg, rgba(37, 99, 235, 0.15), rgba(168, 85, 247, 0.1)); border: 1px solid rgba(59, 130, 246, 0.3); margin-bottom: 1.25rem; padding: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; font-weight: 700; box-shadow: 0 4px 10px rgba(37,99,235,0.4);">
              👷‍♂️
            </div>
            <div>
              <h2 style="font-size: 1.25rem; font-weight: 700; margin: 0; color: var(--text-primary);">
                مرحباً بك، ${workerName}
              </h2>
              <p style="margin: 0; font-size: 0.82rem; color: var(--text-secondary);">
                اطلب ما تحتاجه من مواد وأدوات للورشة مباشرة بضغطة زر
              </p>
            </div>
          </div>
          <button class="btn btn-sm btn-outline" id="btn-refresh-worker-orders" title="تحديث القائمة" style="display: flex; align-items: center; gap: 0.35rem;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            <span>تحديث</span>
          </button>
        </div>
      </div>

      <!-- Messenger Request Composer Box -->
      <div class="card" style="margin-bottom: 1.5rem; padding: 1.25rem; border: 1px solid var(--border-subtle); box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem;">
          <span style="font-size: 1.2rem;">✍️</span>
          <h3 style="font-size: 1.05rem; font-weight: 700; margin: 0; color: var(--text-primary);">
            إنشاء طلب مادة جديد (رسالة سريعة)
          </h3>
        </div>

        <form id="form-worker-request">
          <!-- Project Selection -->
          <div class="form-group" style="margin-bottom: 1rem;">
            <label class="form-label" style="font-weight: 600; font-size: 0.88rem; display: flex; align-items: center; gap: 0.4rem;">
              <span>📍 اختر الورشة أو المشروع *</span>
            </label>
            <select id="worker-project-select" class="form-select" required style="font-size: 0.92rem; padding: 0.6rem 0.8rem;">
              <option value="">-- جاري تحميل المشاريع والورشات --</option>
            </select>
          </div>

          <!-- Freeform Text Content (Messenger Input) -->
          <div class="form-group" style="margin-bottom: 1rem;">
            <label class="form-label" style="font-weight: 600; font-size: 0.88rem; display: flex; justify-content: space-between;">
              <span>💬 ماذا تحتاج في الورشة؟ *</span>
              <span style="font-size: 0.75rem; color: var(--text-muted);">اكتب بالعامية أو الفصحى</span>
            </label>
            <textarea
              id="worker-text-content"
              class="form-control"
              rows="3"
              placeholder="مثال: أحتاج 4 علب براغي 6مم، 2 رول شريط لاصق، و3 أكياس جبس للموقع..."
              required
              style="font-size: 0.95rem; line-height: 1.5; resize: vertical; min-height: 85px;"
            ></textarea>
          </div>

          <!-- Uploaded Photos Previews -->
          <div id="worker-photos-preview" style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem;"></div>

          <!-- Attachment Toolbar & Actions -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; background: var(--bg-surface-elevated); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            
            <!-- Media buttons -->
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <!-- Camera capture button -->
              <label class="btn btn-sm btn-outline" style="cursor: pointer; display: flex; align-items: center; gap: 0.35rem; margin: 0;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <span>التقاط صورة 📸</span>
                <input type="file" id="worker-camera-input" accept="image/*" capture="environment" style="display: none;">
              </label>

              <!-- Gallery upload button -->
              <label class="btn btn-sm btn-outline" style="cursor: pointer; display: flex; align-items: center; gap: 0.35rem; margin: 0;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                <span>معرض الصور 🖼️</span>
                <input type="file" id="worker-gallery-input" accept="image/*" multiple style="display: none;">
              </label>
            </div>

            <!-- Priority & Submit Button -->
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <label style="display: flex; align-items: center; gap: 0.35rem; cursor: pointer; font-size: 0.85rem; color: var(--text-primary); user-select: none;">
                <input type="checkbox" id="worker-is-urgent" style="cursor: pointer; width: 16px; height: 16px;">
                <span>⚡ عاجل جداً</span>
              </label>

              <button type="submit" class="btn btn-primary" id="btn-send-worker-request" style="font-weight: 700; padding: 0.55rem 1.25rem; display: flex; align-items: center; gap: 0.4rem;">
                <span>إرسال الطلب 🚀</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      <!-- Navigation Tabs: Active Orders vs Past Archived Orders -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-sm btn-primary active tab-filter-btn" id="tab-active-orders" data-tab="active">
            <span>الطلبات الحالية (قيد المتابعة)</span>
            <span class="badge badge-secondary" id="badge-active-count" style="margin-right: 0.35rem;">0</span>
          </button>
          <button class="btn btn-sm btn-outline tab-filter-btn" id="tab-past-orders" data-tab="past">
            <span>الطلبات السابقة المعالجة (الأرشيف) 📁</span>
            <span class="badge badge-secondary" id="badge-past-count" style="margin-right: 0.35rem;">0</span>
          </button>
        </div>
      </div>

      <!-- Orders Feed List -->
      <div id="worker-orders-feed" style="display: flex; flex-direction: column; gap: 1rem;">
        <div class="card" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          جاري تحميل طلباتك...
        </div>
      </div>

    </div>
  `;

  i18n.translateDOM(container);

  // State
  let uploadedPhotoUrls = [];
  let currentTab = 'active';
  let allWorkerOrders = [];

  // Load Projects into select
  async function loadProjectsList() {
    const prjSelect = document.getElementById('worker-project-select');
    if (!prjSelect) return;
    try {
      const res = await api.get('/projects');
      const projects = res.data || [];
      if (projects.length === 0) {
        prjSelect.innerHTML = '<option value="">لا توجد مشاريع مسجلة حالياً</option>';
        return;
      }

      const savedProject = localStorage.getItem('matix_last_worker_project') || '';

      prjSelect.innerHTML = '<option value="">-- اختر الورشة أو المشروع --</option>' +
        projects.map(p => `
          <option value="${p._id}" ${p._id === savedProject ? 'selected' : ''}>
            ${escapeHtml(p.projectCode)} — ${escapeHtml(p.name)} (${escapeHtml(p.location || 'الموقع')})
          </option>
        `).join('');

      // Auto-save project selection on change
      prjSelect.addEventListener('change', () => {
        if (prjSelect.value) {
          localStorage.setItem('matix_last_worker_project', prjSelect.value);
        }
      });
    } catch (err) {
      prjSelect.innerHTML = '<option value="">تعذر تحميل المشاريع</option>';
    }
  }

  // High-performance client-side image compression for mobile phones
  async function compressImageFile(file, maxWidth = 1400, maxHeight = 1400, quality = 0.82) {
    if (!file || !file.type.startsWith('image/')) return file;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => resolve(file);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  }

  // Handle Image Upload Helper with instant compression
  async function handleImageFile(rawFile) {
    if (!rawFile) return;

    const previewContainer = document.getElementById('worker-photos-preview');
    const loadingId = 'img-load-' + Date.now();
    const loadingEl = document.createElement('div');
    loadingEl.id = loadingId;
    loadingEl.style.cssText = 'width: 65px; height: 65px; border-radius: var(--radius-sm); background: var(--bg-surface-elevated); display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 0.68rem; border: 1px dashed var(--primary); color: var(--primary); text-align: center;';
    loadingEl.innerHTML = '<span style="animation: pulse 1s infinite;">⚡ ضغط ورفع...</span>';
    previewContainer.appendChild(loadingEl);

    try {
      // 1. Compress image client-side to < 300KB
      const fileToUpload = await compressImageFile(rawFile);

      // 2. Upload to Cloudinary folder (matix/worker-requests)
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('entityType', 'MaterialRequest');
      formData.append('entityId', currentUser._id); // Temporary anchor ID

      const uploadRes = api.postFormData
        ? await api.postFormData('/attachments', formData)
        : await api.post('/attachments', formData);
      const url = uploadRes.data?.url || uploadRes.url || uploadRes.data?.attachment?.url;

      if (!url) throw new Error('فشل الحصول على رابط الصورة');

      uploadedPhotoUrls.push(url);
      playConfirmBeep();
      renderPhotosPreview();
    } catch (err) {
      loadingEl.remove();
      showToast(err.message || 'فشل رفع الصورة', 'error');
    }
  }

  function renderPhotosPreview() {
    const previewContainer = document.getElementById('worker-photos-preview');
    if (!previewContainer) return;

    previewContainer.innerHTML = uploadedPhotoUrls.map((url, idx) => `
      <div style="position: relative; width: 65px; height: 65px; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border-subtle); background: #000;">
        <img src="${escapeHtml(url)}" style="width: 100%; height: 100%; object-fit: cover;" alt="صورة المادة">
        <button type="button" class="btn-remove-photo" data-idx="${idx}" style="position: absolute; top: 2px; right: 2px; width: 20px; height: 20px; border-radius: 50%; background: rgba(239,68,68,0.9); color: #fff; border: none; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;" title="حذف الصورة">&times;</button>
      </div>
    `).join('');

    previewContainer.querySelectorAll('.btn-remove-photo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = parseInt(btn.dataset.idx, 10);
        uploadedPhotoUrls.splice(idx, 1);
        renderPhotosPreview();
      });
    });
  }

  // Camera and Gallery Inputs
  const cameraInput = document.getElementById('worker-camera-input');
  const galleryInput = document.getElementById('worker-gallery-input');

  cameraInput?.addEventListener('change', (e) => {
    if (e.target.files?.[0]) handleImageFile(e.target.files[0]);
    cameraInput.value = '';
  });

  galleryInput?.addEventListener('change', (e) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(f => handleImageFile(f));
    }
    galleryInput.value = '';
  });

  // Submit Request Form
  const form = document.getElementById('form-worker-request');
  const submitBtn = document.getElementById('btn-send-worker-request');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const projectId = document.getElementById('worker-project-select').value;
    const textContent = document.getElementById('worker-text-content').value.trim();
    const isUrgent = document.getElementById('worker-is-urgent').checked;

    if (!projectId) {
      showToast('الرجاء اختيار المشروع / الورشة أولاً', 'warning');
      document.getElementById('worker-project-select').focus();
      return;
    }

    if (!textContent) {
      showToast('الرجاء كتابة ما تحتاجه في حقل الرسالة', 'warning');
      document.getElementById('worker-text-content').focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>جاري الإرسال...</span>';

    try {
      await api.post('/requests/quick', {
        projectId,
        textContent,
        priority: isUrgent ? 'URGENT' : 'NORMAL',
        photoUrls: uploadedPhotoUrls,
      });

      playSuccessChime();
      showToast('🚀 تم إرسال طلبك بنجاح للمشرفين والمسؤولين!', 'success');

      // Reset form
      document.getElementById('worker-text-content').value = '';
      document.getElementById('worker-is-urgent').checked = false;
      uploadedPhotoUrls = [];
      renderPhotosPreview();

      // Reload orders
      await loadWorkerOrders();

    } catch (err) {
      playErrorTone();
      showToast(err.message || 'فشل إرسال الطلب، يرجى المحاولة ثانية', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>إرسال الطلب 🚀</span>';
    }
  });

  // Render Orders Feed
  function renderOrdersList() {
    const feed = document.getElementById('worker-orders-feed');
    if (!feed) return;

    const activeOrders = allWorkerOrders.filter(o => !['FULFILLED', 'CANCELLED', 'REJECTED'].includes(o.status));
    const pastOrders = allWorkerOrders.filter(o => ['FULFILLED', 'CANCELLED', 'REJECTED'].includes(o.status));

    // Update Tab Badges
    const badgeActive = document.getElementById('badge-active-count');
    const badgePast = document.getElementById('badge-past-count');
    if (badgeActive) badgeActive.textContent = activeOrders.length;
    if (badgePast) badgePast.textContent = pastOrders.length;

    const currentList = currentTab === 'active' ? activeOrders : pastOrders;

    if (currentList.length === 0) {
      feed.innerHTML = `
        <div class="card" style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">${currentTab === 'active' ? '📬' : '📁'}</div>
          <h4 style="color: var(--text-primary); margin-bottom: 0.25rem;">
            ${currentTab === 'active' ? 'لا توجد طلبات جارية معلقة حالياً' : 'لا توجد طلبات سابقة مؤرشفة بعد'}
          </h4>
          <p style="font-size: 0.85rem;">
            ${currentTab === 'active' ? 'عند إرسال أي طلب جديد سيظهر هنا وتستطيع متابعته مباشرة.' : 'الطلبات التي يشتريها ويعتمدها المشرفون ستتأرشف هنا.'}
          </p>
        </div>
      `;
      return;
    }

    feed.innerHTML = currentList.map(order => {
      const reqNum = escapeHtml(order.requestNumber || '');
      const prjName = escapeHtml(order.projectId?.name || 'الورشة');
      const prjCode = escapeHtml(order.projectId?.projectCode || '');
      const timeStr = formatDate(order.createdAt);
      const isUrgent = order.priority === 'URGENT' || order.priority === 'HIGH';
      const text = escapeHtml(order.textContent || order.note || 'طلب مواد');
      const photos = Array.isArray(order.photoUrls) ? order.photoUrls : [];

      // Status & Seen details
      const isFulfilled = order.status === 'FULFILLED';
      const isRejected = order.status === 'REJECTED';
      const seenEntries = order.seenBy || [];
      const hasBeenSeen = seenEntries.length > 0;
      const lastSeen = hasBeenSeen ? seenEntries[seenEntries.length - 1] : null;
      const supervisorName = escapeHtml(lastSeen?.user?.fullName || 'المشرف');
      const seenTime = lastSeen?.seenAt ? formatDate(lastSeen.seenAt) : '';

      // Status Tracking Banner Design
      let statusBanner = '';
      if (isFulfilled) {
        const processorName = escapeHtml(order.processedBy?.fullName || 'المشرف');
        const processTime = order.processedAt ? formatDate(order.processedAt) : '';
        const processNote = escapeHtml(order.processingNote || '');
        statusBanner = `
          <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: var(--radius-sm); padding: 0.75rem 1rem; margin-top: 0.85rem; display: flex; align-items: flex-start; gap: 0.6rem;">
            <span style="font-size: 1.25rem;">✅</span>
            <div>
              <div style="font-weight: 700; color: var(--success); font-size: 0.92rem;">
                تمت المعالجة والشراء بنجاح (VALIDÉ)
              </div>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.15rem;">
                تم اعتماد وشراء المواد من طرف: <strong>${processorName}</strong> ${processTime ? `• ${processTime}` : ''}
              </div>
              ${processNote ? `<div style="font-size: 0.8rem; color: var(--text-primary); margin-top: 0.3rem; background: rgba(0,0,0,0.2); padding: 0.35rem 0.6rem; border-radius: 4px;">📝 ملاحظة: ${processNote}</div>` : ''}
            </div>
          </div>
        `;
      } else if (isRejected) {
        statusBanner = `
          <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-sm); padding: 0.65rem 0.85rem; margin-top: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.1rem;">❌</span>
            <div style="font-weight: 600; color: var(--danger); font-size: 0.85rem;">تم رفض الطلب من طرف الإدارة</div>
          </div>
        `;
      } else if (hasBeenSeen) {
        statusBanner = `
          <div style="background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.35); border-radius: var(--radius-sm); padding: 0.65rem 0.85rem; margin-top: 0.85rem; display: flex; align-items: center; gap: 0.6rem;">
            <span style="font-size: 1.15rem;">👁️</span>
            <div>
              <div style="font-weight: 700; color: var(--primary); font-size: 0.88rem;">
                تمت القراءة من طرف المشرف (${supervisorName})
              </div>
              <div style="font-size: 0.78rem; color: var(--text-secondary);">
                الطلب قيد المراجعة والشراء من قِبل المشرف المسؤول • ${seenTime}
              </div>
            </div>
          </div>
        `;
      } else {
        statusBanner = `
          <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-sm); padding: 0.65rem 0.85rem; margin-top: 0.85rem; display: flex; align-items: center; gap: 0.6rem;">
            <span style="font-size: 1.15rem;">🟡</span>
            <div>
              <div style="font-weight: 600; color: var(--warning); font-size: 0.88rem;">
                تم الإرسال بنجاح (معلق في انتظار فتح المشرف)
              </div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">
                تم إرسال إشعار للمشرفين والمسؤولين في هواتفهم
              </div>
            </div>
          </div>
        `;
      }

      return `
        <div class="card" style="padding: 1.15rem; border: 1px solid ${isFulfilled ? 'rgba(16,185,129,0.3)' : hasBeenSeen ? 'rgba(59,130,246,0.3)' : 'var(--border-subtle)'}; background: var(--bg-surface);">
          
          <!-- Header info -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <span style="font-family: var(--font-mono); font-weight: 700; color: var(--primary); font-size: 0.9rem;">${reqNum}</span>
                <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary);">📍 ${prjName}</span>
                ${prjCode ? `<span class="badge badge-secondary" style="font-size: 0.72rem;">${prjCode}</span>` : ''}
              </div>
              <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 0.2rem;">
                📅 أُرسل في: ${timeStr}
              </div>
            </div>

            <div>
              ${isUrgent ? '<span class="badge badge-danger" style="font-weight: 700;">⚡ عاجل جداً</span>' : '<span class="badge badge-secondary">عادي</span>'}
            </div>
          </div>

          <!-- Message bubble -->
          <div style="background: var(--bg-surface-elevated); padding: 0.85rem 1rem; border-radius: var(--radius-md); border-right: 4px solid var(--primary); margin-bottom: 0.5rem;">
            <p style="margin: 0; font-size: 0.95rem; color: #fff; line-height: 1.5; white-space: pre-wrap;">${text}</p>
          </div>

          <!-- Attached Photos Preview -->
          ${photos.length > 0 ? `
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem;">
              ${photos.map(pUrl => `
                <div class="order-photo-thumb" data-src="${escapeHtml(pUrl)}" style="cursor: pointer; width: 70px; height: 70px; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border-subtle); background: #000; position: relative;">
                  <img src="${escapeHtml(pUrl)}" alt="صورة مرفقة" style="width: 100%; height: 100%; object-fit: cover;">
                  <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0">
                    <span style="font-size: 1.1rem;">🔍</span>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <!-- Live Status Tracking Banner -->
          ${statusBanner}

        </div>
      `;
    }).join('');

    // Bind Lightbox on photos
    feed.querySelectorAll('.order-photo-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        const src = thumb.getAttribute('data-src');
        if (src) openImageLightboxModal(src, 'صورة مادة الورشة المطلوبة');
      });
    });
  }

  // Load Worker Orders from Backend
  async function loadWorkerOrders() {
    try {
      const res = await api.get('/requests');
      allWorkerOrders = res.data || [];
      renderOrdersList();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Tab switching (Active vs Past)
  document.getElementById('tab-active-orders')?.addEventListener('click', () => {
    currentTab = 'active';
    document.getElementById('tab-active-orders').classList.add('btn-primary', 'active');
    document.getElementById('tab-active-orders').classList.remove('btn-outline');
    document.getElementById('tab-past-orders').classList.remove('btn-primary', 'active');
    document.getElementById('tab-past-orders').classList.add('btn-outline');
    renderOrdersList();
  });

  document.getElementById('tab-past-orders')?.addEventListener('click', () => {
    currentTab = 'past';
    document.getElementById('tab-past-orders').classList.add('btn-primary', 'active');
    document.getElementById('tab-past-orders').classList.remove('btn-outline');
    document.getElementById('tab-active-orders').classList.remove('btn-primary', 'active');
    document.getElementById('tab-active-orders').classList.add('btn-outline');
    renderOrdersList();
  });

  // Refresh Button
  document.getElementById('btn-refresh-worker-orders')?.addEventListener('click', async () => {
    playConfirmBeep();
    await loadWorkerOrders();
    showToast('تم تحديث قائمة الطلبات', 'info');
  });

  // Initial Load
  await loadProjectsList();
  await loadWorkerOrders();

  // Polling every 20s to reflect supervisor reading / validation status automatically
  const intervalId = setInterval(() => {
    if (window.location.hash.includes('/worker-requests')) {
      loadWorkerOrders();
    } else {
      clearInterval(intervalId);
    }
  }, 20000);
}
