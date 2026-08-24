/**
 * Cloudinary Service Wrapper (Node SDK 2.x)
 *
 * Provides secure server-side upload and deletion interfaces using the official
 * Cloudinary v2 SDK. All credentials remain strictly server-side in environment variables.
 */
const cloudinary = require('cloudinary').v2;
const env = require('../config/env');

let isConfigured = false;

if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  isConfigured = true;
}

/**
 * Check whether Cloudinary credentials are fully configured.
 * @returns {boolean}
 */
function isCloudinaryConfigured() {
  return isConfigured;
}

/**
 * Upload a memory buffer to Cloudinary using upload_stream.
 *
 * @param {Buffer} buffer - File buffer from Multer memory storage
 * @param {Object} options - Custom Cloudinary upload options
 * @returns {Promise<Object>} Cloudinary API response
 */
function uploadBuffer(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    if (!isConfigured) {
      return reject(new Error('Cloudinary is not configured on this server.'));
    }

    const uploadOptions = {
      folder: 'matix',
      resource_type: 'auto',
      ...options,
    };

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        // Sanitize error before rejecting: never leak API secrets or sensitive config
        const safeError = new Error(error.message || 'Cloudinary upload stream failed');
        safeError.http_code = error.http_code || 502;
        return reject(safeError);
      }
      resolve(result);
    });

    stream.end(buffer);
  });
}

/**
 * Delete a resource from Cloudinary by public ID.
 *
 * @param {string} publicId - Cloudinary public ID
 * @param {Object} options - Deletion options
 * @returns {Promise<Object>} Cloudinary API response
 */
function deleteResource(publicId, options = {}) {
  if (!isConfigured) {
    return Promise.resolve({ result: 'not_configured' });
  }
  return cloudinary.uploader.destroy(publicId, options);
}

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  uploadBuffer,
  deleteResource,
};
