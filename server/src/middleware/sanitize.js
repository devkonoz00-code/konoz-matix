/**
 * NoSQL Injection Sanitization Middleware
 * Recursively inspects and cleans `req.body`, `req.query`, and `req.params`.
 * Strips any keys starting with `$` or containing `.` (MongoDB operators like $gt, $ne, $where, $regex).
 */

function sanitizeObject(target) {
  if (!target || typeof target !== 'object') return target;

  if (Array.isArray(target)) {
    for (let i = 0; i < target.length; i++) {
      target[i] = sanitizeObject(target[i]);
    }
    return target;
  }

  for (const key of Object.keys(target)) {
    // Strip forbidden NoSQL operator characters
    if (key.startsWith('$') || key.includes('.')) {
      delete target[key];
      continue;
    }

    if (typeof target[key] === 'object' && target[key] !== null) {
      target[key] = sanitizeObject(target[key]);
    }
  }

  return target;
}

function sanitize(req, _res, next) {
  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);
  next();
}

module.exports = sanitize;
