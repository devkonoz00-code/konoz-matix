/**
 * Auth service.
 * Handles login, token generation, and user authentication logic.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');

const authService = {
  async login(email, password, req) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail }).select('+passwordHash');

    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      throw new AppError('Account is deactivated. Please contact an administrator.', 401, 'ACCOUNT_DEACTIVATED');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const tokenVersion = user.tokenVersion || 0;

    const accessToken = jwt.sign(
      { userId: user._id, role: user.role, tokenVersion },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { userId: user._id, type: 'refresh', tokenVersion },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
    );

    await auditService.log({
      userId: user._id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user._id,
      req,
    });

    return {
      user: user.toJSON(),
      accessToken,
      refreshToken,
    };
  },

  async refreshToken(token) {
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
      }

      const currentVersion = user.tokenVersion || 0;
      if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== currentVersion) {
        throw new AppError('Refresh token has been revoked. Please login again.', 401, 'TOKEN_REVOKED');
      }

      const accessToken = jwt.sign(
        { userId: user._id, role: user.role, tokenVersion: currentVersion },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN }
      );

      return { accessToken };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
    }
  },

  async invalidateUserSessions(userId) {
    await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
  },

  async getProfile(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }
    return user;
  },
};

module.exports = authService;
