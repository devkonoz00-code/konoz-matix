/**
 * Idempotency Middleware for MATIX API
 * Protects creation operations from duplicate submissions due to double-clicks,
 * network retries, or concurrent duplicate requests.
 */

const responseCache = new Map(); // key -> { statusCode, body, createdAt }
const inFlightRequests = new Map(); // key -> Promise

// Periodically clean entries older than 24 hours (every 30 minutes)
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000;
  for (const [key, entry] of responseCache.entries()) {
    if (now - entry.createdAt > maxAge) {
      responseCache.delete(key);
    }
  }
}, 30 * 60 * 1000).unref();

const idempotency = (req, res, next) => {
  const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || req.body?.idempotencyKey;

  // Only apply to state-modifying POST requests with a provided key
  if (!idempotencyKey || req.method !== 'POST') {
    return next();
  }

  // 1. If we have a previously processed successful response for this key, return it immediately
  if (responseCache.has(idempotencyKey)) {
    const cached = responseCache.get(idempotencyKey);
    res.setHeader('X-Idempotent-Replay', 'true');
    return res.status(cached.statusCode).json(cached.body);
  }

  // 2. If an identical request with this key is currently in-flight, wait for it
  if (inFlightRequests.has(idempotencyKey)) {
    return inFlightRequests.get(idempotencyKey)
      .then(() => {
        if (responseCache.has(idempotencyKey)) {
          const cached = responseCache.get(idempotencyKey);
          res.setHeader('X-Idempotent-Replay', 'true');
          return res.status(cached.statusCode).json(cached.body);
        }
        next();
      })
      .catch(next);
  }

  // 3. Register in-flight request
  let resolveInFlight;
  const inFlightPromise = new Promise((resolve) => {
    resolveInFlight = resolve;
  });
  inFlightRequests.set(idempotencyKey, inFlightPromise);

  // Hook into response completion to cache successful (2xx) responses
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      responseCache.set(idempotencyKey, {
        statusCode: res.statusCode,
        body,
        createdAt: Date.now(),
      });
    }
    inFlightRequests.delete(idempotencyKey);
    if (resolveInFlight) resolveInFlight();
    return originalJson(body);
  };

  const cleanup = () => {
    inFlightRequests.delete(idempotencyKey);
    if (resolveInFlight) resolveInFlight();
  };

  res.on('finish', cleanup);
  res.on('close', cleanup);

  next();
};

module.exports = idempotency;
