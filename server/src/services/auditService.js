/**
 * Audit log service.
 * Records every sensitive action with before/after snapshots.
 * Never exposes delete operations.
 */
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

const auditService = {
  /**
   * Create an audit log entry.
   * @param {Object} params
   * @param {string} params.userId - User performing the action
   * @param {string} params.action - Action type (CREATE, UPDATE, etc.)
   * @param {string} params.entityType - Type of entity affected
   * @param {string} params.entityId - ID of entity affected
   * @param {Object} params.before - State before the action (optional)
   * @param {Object} params.after - State after the action (optional)
   * @param {Object} params.req - Express request object for IP/UA
   */
  async log({ userId, action, entityType, entityId, before, after, req }) {
    try {
      await AuditLog.create({
        userId,
        action,
        entityType,
        entityId,
        before: before || undefined,
        after: after || undefined,
        ip: req ? (req.ip || req.connection?.remoteAddress || 'unknown') : 'system',
        userAgent: req ? (req.headers['user-agent'] || 'unknown') : 'system',
      });
      logger.business(action, { entityType, entityId, userId: userId.toString() });
    } catch (error) {
      // Audit logging should never break the main operation
      logger.error('Failed to create audit log', { error: error.message, action, entityType, entityId });
    }
  },

  async find(filters = {}, page = 1, limit = 50) {
    const query = {};
    if (filters.entityType) query.entityType = filters.entityType;
    if (filters.entityId) query.entityId = filters.entityId;
    if (filters.userId) query.userId = filters.userId;
    if (filters.action) query.action = filters.action;

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .populate('userId', 'fullName email role')
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return { logs, total, page, totalPages: Math.ceil(total / limit) };
  },
};

module.exports = auditService;
