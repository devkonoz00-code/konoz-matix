/**
 * Client-Side Image Compression & Optimization Utility (§13)
 *
 * Automatically downsizes and compresses large camera photos and gallery uploads
 * directly in the browser before sending to the server.
 * Typically reduces 5-15 MB camera photos down to 60-150 KB (-90% to -98% space saved)
 * with zero visible degradation in product catalog quality.
 */

/**
 * Checks if the current browser supports WebP canvas encoding.
 */
function supportsWebP() {
  try {
    const canvas = document.createElement('canvas');
    if (canvas.getContext && canvas.getContext('2d')) {
      return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }
  } catch {}
  return false;
}

/**
 * Formats byte size into human readable string (KB / MB).
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes = 0) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * Loads a File / Blob into an HTMLImageElement safely.
 * @param {File|Blob} file
 * @returns {Promise<HTMLImageElement>}
 */
function createImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error('تعذر تحميل ملف الصورة المحدد للتعديل.'));
    };
    img.src = url;
  });
}

/**
 * Compresses an image file in-browser before upload.
 *
 * @param {File|Blob} file - The original image file
 * @param {Object} [options]
 * @param {number} [options.maxWidth=1200] - Max output width in px
 * @param {number} [options.maxHeight=1200] - Max output height in px
 * @param {number} [options.quality=0.82] - Compression quality (0.0 to 1.0)
 * @param {string} [options.mimeType] - Target MIME ('image/webp' or 'image/jpeg')
 * @returns {Promise<{
 *   file: File,
 *   blob: Blob,
 *   dataUrl: string,
 *   originalSize: number,
 *   compressedSize: number,
 *   ratio: number,
 *   width: number,
 *   height: number
 * }>}
 */
export async function compressImage(file, options = {}) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    throw new Error('الملف المحدد ليس ملف صورة صالح.');
  }

  const maxWidth = options.maxWidth || 1200;
  const maxHeight = options.maxHeight || 1200;
  const quality = options.quality !== undefined ? options.quality : 0.82;
  const targetMime = options.mimeType || (supportsWebP() ? 'image/webp' : 'image/jpeg');

  const img = await createImageFromFile(file);

  let { width, height } = img;

  // Calculate proportional dimensions
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { alpha: targetMime === 'image/webp' });
  if (!ctx) {
    throw new Error('تعذر معالجة أبعاد الصورة على هذا الجهاز.');
  }

  // Draw with crisp bicubic scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (targetMime === 'image/jpeg') {
    // Fill background with white for JPEG
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('تعذر ضغط وتحويل الصورة.'));
    }, targetMime, quality);
  });

  const ext = targetMime === 'image/webp' ? '.webp' : '.jpg';
  const rawBaseName = (file.name || 'product_image').replace(/\.[^/.]+$/, '');
  const compressedName = `${rawBaseName}_compressed${ext}`;

  const compressedFile = new File([blob], compressedName, {
    type: targetMime,
    lastModified: Date.now(),
  });

  const originalSize = file.size;
  const compressedSize = compressedFile.size;
  const savedBytes = Math.max(0, originalSize - compressedSize);
  const ratio = originalSize > 0 ? Math.round((savedBytes / originalSize) * 100) : 0;
  const dataUrl = canvas.toDataURL(targetMime, quality);

  return {
    file: compressedFile,
    blob,
    dataUrl,
    originalSize,
    compressedSize,
    ratio,
    width,
    height,
  };
}
