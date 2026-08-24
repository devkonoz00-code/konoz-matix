/**
 * Cloudinary Service Wrapper (Node SDK 2.x)
 *
 * Keeps credentials server-side and centralizes validation for managed product
 * images. Product images are stored only under ITEM_IMAGE_FOLDER.
 */
const cloudinary = require('cloudinary').v2;
const env = require('../config/env');

const ITEM_IMAGE_FOLDER = 'matix/items';

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

/**
 * Resolve either CLOUDINARY_URL or the three explicit credential variables.
 * The returned error never contains a credential value.
 */
function resolveCloudinaryConfiguration(source = {}) {
  const cloudName = clean(source.CLOUDINARY_CLOUD_NAME);
  const apiKey = clean(source.CLOUDINARY_API_KEY);
  const apiSecret = clean(source.CLOUDINARY_API_SECRET);
  const cloudinaryUrl = clean(source.CLOUDINARY_URL);
  const hasAnyExplicitValue = Boolean(cloudName || apiKey || apiSecret);

  if (cloudName && apiKey && apiSecret) {
    return {
      configured: true,
      source: 'explicit',
      cloudName,
      credentials: { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret },
    };
  }

  if (cloudinaryUrl) {
    try {
      const parsed = new URL(cloudinaryUrl);
      if (parsed.protocol !== 'cloudinary:') {
        throw new Error('invalid protocol');
      }

      const urlCloudName = clean(safeDecode(parsed.hostname));
      const urlApiKey = clean(safeDecode(parsed.username));
      const urlApiSecret = clean(safeDecode(parsed.password));
      if (!urlCloudName || !urlApiKey || !urlApiSecret) {
        throw new Error('missing URL credentials');
      }

      return {
        configured: true,
        source: 'url',
        cloudName: urlCloudName,
        credentials: {
          cloud_name: urlCloudName,
          api_key: urlApiKey,
          api_secret: urlApiSecret,
        },
      };
    } catch {
      return {
        configured: false,
        code: 'CLOUDINARY_INVALID_CONFIGURATION',
        message: 'CLOUDINARY_URL must use cloudinary://<api_key>:<api_secret>@<cloud_name>.',
      };
    }
  }

  if (hasAnyExplicitValue) {
    return {
      configured: false,
      code: 'CLOUDINARY_INVALID_CONFIGURATION',
      message: 'Set all of CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
    };
  }

  return {
    configured: false,
    code: 'CLOUDINARY_NOT_CONFIGURED',
    message: 'Product image storage is not configured. Set CLOUDINARY_URL or all three Cloudinary credential variables.',
  };
}

let configurationState = resolveCloudinaryConfiguration(env);

if (configurationState.configured) {
  try {
    cloudinary.config({
      ...configurationState.credentials,
      secure: true,
    });
  } catch {
    configurationState = {
      configured: false,
      code: 'CLOUDINARY_INVALID_CONFIGURATION',
      message: 'Cloudinary rejected the configured credentials format.',
    };
  }
}

function isCloudinaryConfigured() {
  return configurationState.configured;
}

function getConfigurationStatus() {
  return {
    configured: configurationState.configured,
    source: configurationState.source || null,
    cloudName: configurationState.cloudName || null,
    code: configurationState.code || null,
    message: configurationState.message || null,
  };
}

function createConfigurationError() {
  const status = getConfigurationStatus();
  const error = new Error(status.message || 'Cloudinary is not configured on this server.');
  error.code = status.code || 'CLOUDINARY_NOT_CONFIGURED';
  error.statusCode = 503;
  return error;
}

function isManagedItemPublicId(publicId) {
  const value = clean(publicId);
  if (!value || value.length > 255 || value.includes('..') || value.includes('//') || value.endsWith('/')) return false;
  if (!value.startsWith(`${ITEM_IMAGE_FOLDER}/`)) return false;
  return /^[A-Za-z0-9/_-]+$/.test(value);
}

/**
 * Validate a Cloudinary delivery URL and bind it to a managed public ID.
 * Returns null for local/legacy/external URLs.
 */
function parseItemImageReferenceForCloud(imageUrl, expectedPublicId, expectedCloudName) {
  const rawUrl = clean(imageUrl);
  const cloudName = clean(expectedCloudName);
  if (!rawUrl || !cloudName) return null;

  let parsed;
  try {
    parsed = new URL(rawUrl.replace(/^http:\/\//i, 'https://'));
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'res.cloudinary.com') return null;
  if (parsed.username || parsed.password || parsed.port) return null;

  let segments;
  try {
    segments = parsed.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return null;
  }

  if (
    segments.length < 6 ||
    segments[0].toLowerCase() !== cloudName.toLowerCase() ||
    segments[1] !== 'image' ||
    segments[2] !== 'upload'
  ) {
    return null;
  }

  let assetSegments = segments.slice(3);
  if (/^v\d+$/.test(assetSegments[0] || '')) assetSegments = assetSegments.slice(1);
  if (assetSegments.length < 3) return null;

  const lastIndex = assetSegments.length - 1;
  assetSegments[lastIndex] = assetSegments[lastIndex].replace(/\.[A-Za-z0-9]+$/, '');
  const publicId = assetSegments.join('/');
  if (!isManagedItemPublicId(publicId)) return null;

  const suppliedPublicId = clean(expectedPublicId);
  if (suppliedPublicId && suppliedPublicId !== publicId) return null;

  parsed.protocol = 'https:';
  parsed.search = '';
  parsed.hash = '';

  return { url: parsed.toString(), publicId };
}

function parseItemImageReference(imageUrl, expectedPublicId) {
  if (!configurationState.configured) return null;
  return parseItemImageReferenceForCloud(imageUrl, expectedPublicId, configurationState.cloudName);
}

/** Upload a memory buffer to Cloudinary using upload_stream. */
function uploadBuffer(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    if (!configurationState.configured) {
      return reject(createConfigurationError());
    }

    const uploadOptions = {
      folder: 'matix',
      resource_type: 'auto',
      ...options,
    };

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        const safeError = new Error('Cloudinary upload failed.');
        safeError.code = 'STORAGE_UPLOAD_FAILED';
        safeError.http_code = error.http_code || 502;
        return reject(safeError);
      }
      resolve(result);
    });

    stream.end(buffer);
  });
}

/**
 * General resource deletion used by attachments. Product images should use
 * deleteItemImage so the managed-folder guard cannot be bypassed.
 */
function deleteResource(publicId, options = {}) {
  if (!configurationState.configured) {
    return Promise.resolve({ result: 'not_configured' });
  }
  return cloudinary.uploader.destroy(publicId, options);
}

function deleteItemImage(publicId) {
  if (!isManagedItemPublicId(publicId)) {
    const error = new Error('Refusing to delete an unmanaged product image.');
    error.code = 'INVALID_IMAGE_PUBLIC_ID';
    error.statusCode = 400;
    return Promise.reject(error);
  }
  if (!configurationState.configured) {
    return Promise.reject(createConfigurationError());
  }
  return cloudinary.uploader.destroy(publicId, {
    resource_type: 'image',
    invalidate: true,
  });
}

module.exports = {
  cloudinary,
  ITEM_IMAGE_FOLDER,
  isCloudinaryConfigured,
  getConfigurationStatus,
  createConfigurationError,
  isManagedItemPublicId,
  parseItemImageReference,
  uploadBuffer,
  deleteResource,
  deleteItemImage,
  __testing: {
    resolveCloudinaryConfiguration,
    parseItemImageReferenceForCloud,
  },
};
