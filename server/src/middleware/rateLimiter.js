/**
 * Rate Limiting Middleware
 * Enterprise defense against brute-force, credential stuffing, and DoS attacks.
 * Implements an in-memory sliding-window token bucket with automatic stale-entry cleanup.
 */

class MemoryRateLimiter {
  constructor(windowMs, maxRequests, message = 'Too many requests. Please try again later.') {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.message = message;
    this.hits = new Map();

    // Auto-cleanup interval every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
  }

  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.hits.entries()) {
      if (now - record.startTime > this.windowMs) {
        this.hits.delete(key);
      }
    }
  }

  middleware() {
    return (req, res, next) => {
      const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const key = `${ip}_${req.baseUrl || ''}${req.path || ''}`;
      const now = Date.now();

      let record = this.hits.get(key);

      if (!record || now - record.startTime > this.windowMs) {
        record = { count: 1, startTime: now };
        this.hits.set(key, record);
      } else {
        record.count++;
      }

      const remaining = Math.max(0, this.maxRequests - record.count);
      const resetTime = Math.ceil((record.startTime + this.windowMs - now) / 1000);

      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetTime);

      if (record.count > this.maxRequests) {
        res.setHeader('Retry-After', resetTime);
        return res.status(429).json({
          success: false,
          code: 'RATE_LIMIT_EXCEEDED',
          message: this.message,
          retryAfterSeconds: resetTime,
        });
      }

      next();
    };
  }
}

// 1. Strict Auth Limiter: 5 attempts per 15 minutes window
const authLimiter = new MemoryRateLimiter(
  15 * 60 * 1000,
  5,
  'Too many login attempts. Please wait 15 minutes before trying again.'
);

// 2. General API Limiter: 120 requests per minute
const apiLimiter = new MemoryRateLimiter(
  60 * 1000,
  120,
  'API rate limit exceeded. Please slow down your requests.'
);

// 3. Export / Heavy Operation Limiter: 10 requests per minute
const exportLimiter = new MemoryRateLimiter(
  60 * 1000,
  10,
  'Too many export requests generated. Please wait a minute.'
);

module.exports = {
  authLimiter: authLimiter.middleware(),
  apiLimiter: apiLimiter.middleware(),
  exportLimiter: exportLimiter.middleware(),
  MemoryRateLimiter,
};
