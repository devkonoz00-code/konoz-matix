/**
 * Cloudinary Service Wrapper (Node SDK 2.x)
 *
 * Keeps credentials server-side and centralizes validation for managed product
 * images. Product images are stored only under ITEM_IMAGE_FOLDER.
 */
const cloudinary = require('cloudinary').v2;
const env = require('../config/env');

const ITEM_IMAGE_FOLDER = 'matix/items';
const DEFAULT_UPLOAD_TIMEOUT_MS = 60_000;
const MIN_UPLOAD_TIMEOUT_MS = 5_000;
const MAX_UPLOAD_TIMEOUT_MS = 120_000;
const NETWORK_ERROR_CODES = new Set([
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ESOCKETTIMEDOUT',
  'ETIMEDOUT',
]);

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

function parseCloudinaryUrl(cloudinaryUrl) {
  try {
    const parsed = new URL(cloudinaryUrl);
    if (parsed.protocol !== 'cloudinary:') {
      throw new Error('invalid protocol');
    }

    const cloudName = clean(safeDecode(parsed.hostname));
    const apiKey = clean(safeDecode(parsed.username));
    const apiSecret = clean(safeDecode(parsed.password));
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('missing URL credentials');
    }

    return {
      cloudName,
      credentials: {
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      },
    };
  } catch {
    return null;
  }
}

function credentialsMatch(first, second) {
  return (
    first.cloud_name.toLowerCase() === second.cloud_name.toLowerCase() &&
    first.api_key === second.api_key &&
    first.api_secret === second.api_secret
  );
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
  const hasCompleteExplicitConfiguration = Boolean(cloudName && apiKey && apiSecret);
  const explicitCredentials = {
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  };
  const urlConfiguration = cloudinaryUrl ? parseCloudinaryUrl(cloudinaryUrl) : null;

  if (cloudinaryUrl && !urlConfiguration) {
    return {
      configured: false,
      code: 'CLOUDINARY_INVALID_CONFIGURATION',
      message: 'CLOUDINARY_URL must use cloudinary://<api_key>:<api_secret>@<cloud_name>.',
    };
  }

  if (
    hasCompleteExplicitConfiguration &&
    urlConfiguration &&
    !credentialsMatch(explicitCredentials, urlConfiguration.credentials)
  ) {
    return {
      configured: false,
      code: 'CLOUDINARY_CONFLICTING_CONFIGURATION',
      message: 'CLOUDINARY_URL and the explicit Cloudinary variables identify different credentials. Keep only one source or make them match.',
    };
  }

  if (hasCompleteExplicitConfiguration) {
    return {
      configured: true,
      source: urlConfiguration ? 'explicit+url' : 'explicit',
      cloudName,
      credentials: explicitCredentials,
    };
  }

  if (urlConfiguration) {
    return {
      configured: true,
      source: 'url',
      cloudName: urlConfiguration.cloudName,
      credentials: urlConfiguration.credentials,
    };
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
  error.isStorageProviderError = true;
  return error;
}

function resolveUploadTimeoutMs(value) {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_UPLOAD_TIMEOUT_MS;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_UPLOAD_TIMEOUT_MS;
  return Math.min(MAX_UPLOAD_TIMEOUT_MS, Math.max(MIN_UPLOAD_TIMEOUT_MS, Math.trunc(parsed)));
}

function sanitizeProviderMessage(message) {
  let safeMessage = clean(message).replace(/[\r\n\t]+/g, ' ');
  if (!safeMessage) return null;

  // A provider/network error should not normally contain credentials, but
  // redact both URL-shaped credentials and the configured key/secret before
  // putting the diagnostic in application logs.
  safeMessage = safeMessage.replace(/cloudinary:\/\/[^\s"']+/gi, 'cloudinary://[REDACTED]');
  safeMessage = safeMessage
    .replace(/\b(api[_ -]?key|api[_ -]?secret|signature|token)\s*[:=]\s*[^\s,;&]+/gi, '$1=[REDACTED]')
    .replace(/([?&](?:api_key|signature|token)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/\bsignature\s+[a-f0-9]{16,}\b/gi, 'signature [REDACTED]');
  const credentials = configurationState?.credentials || {};
  for (const sensitiveValue of [credentials.api_key, credentials.api_secret]) {
    const value = clean(sensitiveValue);
    if (value.length >= 3) safeMessage = safeMessage.split(value).join('[REDACTED]');
  }

  return safeMessage.slice(0, 500);
}

function getProviderErrorDetails(error) {
  const nested = error && typeof error.error === 'object' ? error.error : null;
  const providerError = nested || error || {};
  const rawHttpCode = providerError.http_code ?? error?.http_code;
  const parsedHttpCode = Number(rawHttpCode);
  const httpCode = Number.isInteger(parsedHttpCode) && parsedHttpCode > 0
    ? parsedHttpCode
    : null;

  return {
    httpCode,
    providerCode: clean(providerError.code || error?.code) || null,
    providerName: clean(providerError.name || error?.name) || null,
    providerMessage: sanitizeProviderMessage(providerError.message || error?.message),
  };
}

/**
 * Convert Cloudinary/Node network failures into safe operational errors while
 * retaining non-secret diagnostics for server logs.
 */
function normalizeCloudinaryUploadError(error) {
  if (error?.isStorageProviderError) return error;

  const details = getProviderErrorDetails(error);
  const providerCode = (details.providerCode || '').toUpperCase();
  const providerName = (details.providerName || '').toLowerCase();
  const providerMessage = (details.providerMessage || '').toLowerCase();

  let code = 'STORAGE_UPLOAD_FAILED';
  let statusCode = 502;
  let message = 'Cloudinary could not upload the product image.';

  if (
    details.httpCode === 401 ||
    details.httpCode === 403 ||
    providerMessage.includes('invalid signature') ||
    providerMessage.includes('unknown api key') ||
    providerMessage.includes('authentication')
  ) {
    code = 'CLOUDINARY_AUTH_FAILED';
    statusCode = 503;
    message = 'Cloudinary rejected the server credentials. Verify the Cloudinary environment variables on the server.';
  } else if (details.httpCode === 404) {
    code = 'CLOUDINARY_ACCOUNT_NOT_FOUND';
    statusCode = 503;
    message = 'The configured Cloudinary cloud could not be found. Verify the Cloudinary cloud name on the server.';
  } else if (
    details.httpCode === 499 ||
    providerName.includes('timeout') ||
    providerCode.includes('TIMEOUT')
  ) {
    code = 'CLOUDINARY_UPLOAD_TIMEOUT';
    statusCode = 504;
    message = 'Cloudinary image upload timed out. Please retry.';
  } else if (details.httpCode === 420 || details.httpCode === 429) {
    code = 'CLOUDINARY_RATE_LIMITED';
    statusCode = 503;
    message = 'Cloudinary is rate limiting uploads. Please retry shortly.';
  } else if (
    NETWORK_ERROR_CODES.has(providerCode) ||
    (details.httpCode !== null && details.httpCode >= 500)
  ) {
    code = 'CLOUDINARY_UNAVAILABLE';
    statusCode = 502;
    message = 'Cloudinary is temporarily unavailable. Please retry.';
  } else if (details.httpCode === 400) {
    code = 'CLOUDINARY_UPLOAD_REJECTED';
    statusCode = 502;
    message = 'Cloudinary rejected the image upload. Check the image restrictions and Cloudinary account settings.';
  }

  const normalized = new Error(message);
  normalized.code = code;
  normalized.statusCode = statusCode;
  normalized.http_code = details.httpCode;
  normalized.providerCode = details.providerCode;
  normalized.providerName = details.providerName;
  normalized.providerMessage = details.providerMessage;
  normalized.isStorageProviderError = true;
  return normalized;
}

function getSafeProviderDiagnostic(error) {
  const configuration = getConfigurationStatus();
  const details = error?.isStorageProviderError
    ? {
        httpCode: error.http_code || null,
        providerCode: clean(error.providerCode) || null,
        providerName: clean(error.providerName) || null,
        providerMessage: sanitizeProviderMessage(error.providerMessage),
      }
    : getProviderErrorDetails(error);

  return {
    provider: 'cloudinary',
    configurationSource: configuration.source,
    cloudName: configuration.cloudName,
    code: clean(error?.code) || 'STORAGE_UPLOAD_FAILED',
    statusCode: error?.statusCode || 502,
    providerHttpCode: details.httpCode,
    providerCode: details.providerCode,
    providerName: details.providerName,
    providerMessage: details.providerMessage,
  };
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

function buildUploadOptions(options = {}) {
  const uploadOptions = {
    folder: 'matix',
    resource_type: 'auto',
    transformation: [
      { width: 1200, height: 1200, crop: 'limit' },
      { quality: 'auto:good', fetch_format: 'auto' },
    ],
    ...options,
  };
  uploadOptions.timeout = resolveUploadTimeoutMs(uploadOptions.timeout);
  return uploadOptions;
}

/**
 * Execute the Cloudinary v2 stream API. Its public signature is
 * upload_stream(options, callback), unlike the underlying v1 implementation.
 */
function executeUploadStream(uploader, buffer, uploadOptions) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      if (error) return reject(normalizeCloudinaryUploadError(error));
      resolve(result);
    };

    try {
      const stream = uploader.upload_stream(uploadOptions, finish);
      if (!stream || typeof stream.end !== 'function') {
        throw new Error('Cloudinary SDK did not return an upload stream.');
      }
      if (typeof stream.once === 'function') {
        stream.once('error', finish);
      }
      stream.end(buffer);
    } catch (error) {
      finish(error);
    }
  });
}

/** Upload a memory buffer to Cloudinary using upload_stream. */
function uploadBuffer(buffer, options = {}) {
  if (!configurationState.configured) {
    return Promise.reject(createConfigurationError());
  }

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const error = new Error('A non-empty file buffer is required for upload.');
    error.code = 'INVALID_UPLOAD_BUFFER';
    error.statusCode = 400;
    error.isStorageProviderError = true;
    return Promise.reject(error);
  }

  return executeUploadStream(cloudinary.uploader, buffer, buildUploadOptions(options));
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
  DEFAULT_UPLOAD_TIMEOUT_MS,
  isCloudinaryConfigured,
  getConfigurationStatus,
  createConfigurationError,
  getSafeProviderDiagnostic,
  isManagedItemPublicId,
  parseItemImageReference,
  uploadBuffer,
  deleteResource,
  deleteItemImage,
  __testing: {
    resolveCloudinaryConfiguration,
    resolveUploadTimeoutMs,
    buildUploadOptions,
    executeUploadStream,
    normalizeCloudinaryUploadError,
    parseItemImageReferenceForCloud,
  },
};
