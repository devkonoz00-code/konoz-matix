/**
 * Structured logger utility.
 * Never logs passwords, tokens, or secrets.
 */

const SENSITIVE_FIELDS = ['password', 'passwordHash', 'token', 'refreshToken', 'secret', 'apiKey', 'apiSecret'];

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key of Object.keys(sanitized)) {
    if (SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitize(sanitized[key]);
    }
  }
  return sanitized;
}

const logger = {
  info(message, data) {
    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      message,
      ...(data && { data: sanitize(data) }),
    }));
  },

  warn(message, data) {
    console.warn(JSON.stringify({
      level: 'warn',
      timestamp: new Date().toISOString(),
      message,
      ...(data && { data: sanitize(data) }),
    }));
  },

  error(message, data) {
    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      message,
      ...(data && { data: sanitize(data) }),
    }));
  },

  business(action, data) {
    console.log(JSON.stringify({
      level: 'business',
      timestamp: new Date().toISOString(),
      action,
      ...(data && { data: sanitize(data) }),
    }));
  },
};

module.exports = logger;
