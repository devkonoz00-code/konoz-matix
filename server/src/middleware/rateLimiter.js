/**
 * Rate Limiting Middleware
 * Enterprise defense against brute-force, credential stuffing, and DoS attacks.
 *
 * AUTH LIMITER:  Tracks by email address (NOT by IP) so users on the same
 *                network are never blocked by someone else's failed attempts.
 *                Only increments on FAILED login — successful login resets the counter.
 *
 * API LIMITER:   Standard per-IP sliding-window token bucket.
 * EXPORT LIMITER: Per-IP limiter for heavy export operations.
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
      const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || req.connection?.remoteAddress || 'unknown';
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


/**
 * Auth Rate Limiter — tracks by EMAIL, only increments on failure.
 *
 * Why by email instead of IP?
 *   - Multiple users on the same WiFi/office share one public IP.
 *   - One user's brute-force failures must NOT block other legitimate users.
 *   - Tracking by email ensures only the targeted account is throttled.
 *
 * Usage (inside authController):
 *   1. Call authLimiter.check(email) BEFORE processing login.
 *   2. On SUCCESS: call authLimiter.reset(email) to clear the counter.
 *   3. On FAILURE: call authLimiter.recordFailure(email) to increment.
 */
class AuthRateLimiter {
  constructor(windowMs, maxFailures, message) {
    this.windowMs = windowMs;
    this.maxFailures = maxFailures;
    this.message = message;
    this.failures = new Map();

    // Auto-cleanup every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
  }

  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.failures.entries()) {
      if (now - record.startTime > this.windowMs) {
        this.failures.delete(key);
      }
    }
  }

  /**
   * Check if the email is currently rate-limited.
   */
  check(email) {
    const key = (email || '').toLowerCase().trim();
    if (!key) return { blocked: false, remaining: this.maxFailures };

    const now = Date.now();
    const record = this.failures.get(key);

    if (!record || now - record.startTime > this.windowMs) {
      return { blocked: false, remaining: this.maxFailures };
    }

    const remaining = Math.max(0, this.maxFailures - record.count);
    const retryAfterSeconds = Math.ceil((record.startTime + this.windowMs - now) / 1000);

    if (record.count >= this.maxFailures) {
      return { blocked: true, retryAfterSeconds, remaining: 0 };
    }

    return { blocked: false, remaining, retryAfterSeconds };
  }

  /**
   * Record a failed login attempt for this email.
   */
  recordFailure(email) {
    const key = (email || '').toLowerCase().trim();
    if (!key) return;

    const now = Date.now();
    let record = this.failures.get(key);

    if (!record || now - record.startTime > this.windowMs) {
      record = { count: 1, startTime: now };
      this.failures.set(key, record);
    } else {
      record.count++;
    }
  }

  /**
   * Reset the failure counter on successful login.
   */
  reset(email) {
    const key = (email || '').toLowerCase().trim();
    if (key) {
      this.failures.delete(key);
    }
  }
}

// 1. Auth Limiter: 5 failed attempts per 15 minutes, tracked by email
const authLimiter = new AuthRateLimiter(
  15 * 60 * 1000,
  5,
  'Too many login attempts. Please wait 15 minutes before trying again.'
);

// 2. General API Limiter: 120 requests per minute (per IP)
const apiLimiter = new MemoryRateLimiter(
  60 * 1000,
  120,
  'API rate limit exceeded. Please slow down your requests.'
);

// 3. Export / Heavy Operation Limiter: 10 requests per minute (per IP)
const exportLimiter = new MemoryRateLimiter(
  60 * 1000,
  10,
  'Too many export requests generated. Please wait a minute.'
);

module.exports = {
  authLimiter,
  apiLimiter: apiLimiter.middleware(),
  exportLimiter: exportLimiter.middleware(),
  MemoryRateLimiter,
  AuthRateLimiter,
};
