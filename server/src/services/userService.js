/**
 * User service.
 * Handles user CRUD operations.
 */
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const { escapeRegex } = require('../utils/sanitizeRegex');

const userService = {
  async list(filters = {}) {
    const query = {};
    if (filters.role) query.role = filters.role;
    if (filters.isActive !== undefined) query.isActive = filters.isActive;
    if (filters.search) {
      const safeSearch = escapeRegex(filters.search.trim());
      query.$or = [
        { fullName: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
      ];
    }
    return User.find(query).sort({ fullName: 1 }).lean();
  },

  async getById(id) {
    const user = await User.findById(id);
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    return user;
  },

  async create(data, req) {
    const { validateEmail, validateEnum } = require('../validators/common');
    const { ROLES } = require('../models/User');

    const email = (data.email || '').trim().toLowerCase();
    validateEmail(email);
    validateEnum(data.role, ROLES, 'role');

    if (!data.password || data.password.length < 8) {
      throw new AppError('Password must be at least 8 characters long', 400, 'WEAK_PASSWORD');
    }

    const existing = await User.findOne({ email });
    if (existing) {
      throw new AppError('A user with this email address already exists', 409, 'USER_EXISTS');
    }

    const user = new User({
      fullName: data.fullName,
      email,
      phone: data.phone,
      passwordHash: data.password,
      role: data.role,
      avatarUrl: data.avatarUrl,
    });

    await user.save();

    await auditService.log({
      userId: req.user._id,
      action: 'CREATE',
      entityType: 'User',
      entityId: user._id,
      after: user.toJSON(),
      req,
    });

    return user;
  },

  async update(id, data, req) {
    const user = await User.findById(id);
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

    const before = user.toJSON();

    // Prevent demoting the last active administrator
    if (data.role && data.role !== 'ADMIN' && user.role === 'ADMIN') {
      const activeAdminCount = await User.countDocuments({ role: 'ADMIN', isActive: true });
      if (activeAdminCount <= 1) {
        throw new AppError('Cannot change role: System requires at least one active administrator', 400, 'LAST_ADMIN');
      }
    }

    if (data.fullName !== undefined) user.fullName = data.fullName.trim();
    if (data.email !== undefined) user.email = data.email.trim().toLowerCase();
    if (data.phone !== undefined) user.phone = data.phone;
    if (data.role !== undefined) {
      const { ROLES } = require('../models/User');
      const { validateEnum } = require('../validators/common');
      validateEnum(data.role, ROLES, 'role');
      user.role = data.role;
    }
    if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;
    if (data.password) {
      if (data.password.length < 8) {
        throw new AppError('Password must be at least 8 characters long', 400, 'WEAK_PASSWORD');
      }
      user.passwordHash = data.password;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    await user.save();

    await auditService.log({
      userId: req.user._id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: user._id,
      before,
      after: user.toJSON(),
      req,
    });

    return user;
  },

  async deactivate(id, req) {
    const user = await User.findById(id);
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

    // Prevent deactivating the last active administrator
    if (user.role === 'ADMIN') {
      const activeAdminCount = await User.countDocuments({ role: 'ADMIN', isActive: true });
      if (activeAdminCount <= 1) {
        throw new AppError('Cannot deactivate the last active administrator account', 400, 'LAST_ADMIN');
      }
    }

    const before = user.toJSON();
    user.isActive = false;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await auditService.log({
      userId: req.user._id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: user._id,
      before,
      after: user.toJSON(),
      req,
    });

    return user;
  },
};

module.exports = userService;
