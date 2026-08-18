/**
 * Role-based access control middleware.
 * Factory function that returns middleware checking if req.user.role is in the allowed list.
 */
const { AppError } = require('./errorHandler');

/**
 * @param  {...string} allowedRoles - Roles allowed to access the route
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(
        `Access denied. Required role: ${allowedRoles.join(' or ')}`,
        403,
        'FORBIDDEN'
      ));
    }

    next();
  };
};

module.exports = authorize;
