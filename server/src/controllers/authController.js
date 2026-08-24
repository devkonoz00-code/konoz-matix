const authService = require('../services/authService');
const auditService = require('../services/auditService');
const { validateRequired, validateEmail } = require('../validators/common');
const { authLimiter } = require('../middleware/rateLimiter');

const authController = {
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      validateRequired(req.body, ['email', 'password']);
      validateEmail(email);

      const cleanEmail = (email || '').trim().toLowerCase();

      // Check if this email is currently rate-limited BEFORE processing
      const limitStatus = authLimiter.check(cleanEmail);
      if (limitStatus.blocked) {
        return res.status(429).json({
          success: false,
          code: 'RATE_LIMIT_EXCEEDED',
          message: authLimiter.message,
          retryAfterSeconds: limitStatus.retryAfterSeconds,
        });
      }

      try {
        const result = await authService.login(email, password, req);

        // SUCCESS — reset the failure counter for this email
        authLimiter.reset(cleanEmail);

        res.json({ success: true, data: result });
      } catch (loginError) {
        // FAILURE — only increment the counter on actual auth failures
        if (loginError.code === 'INVALID_CREDENTIALS') {
          authLimiter.recordFailure(cleanEmail);
        }
        throw loginError;
      }
    } catch (error) {
      next(error);
    }
  },

  async logout(req, res, next) {
    try {
      await authService.invalidateUserSessions(req.user._id);
      await auditService.log({
        userId: req.user._id,
        action: 'LOGOUT',
        entityType: 'User',
        entityId: req.user._id,
        req,
      });
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  },

  async me(req, res, next) {
    try {
      const user = await authService.getProfile(req.user._id);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  },

  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body;
      validateRequired(req.body, ['refreshToken']);
      const result = await authService.refreshToken(refreshToken);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = authController;
