/**
 * Notification service.
 * Creates in-app notifications for relevant events.
 */
const Notification = require('../models/Notification');

const notificationService = {
  async create({ userId, type, message, relatedEntityType, relatedEntityId }) {
    try {
      return await Notification.create({
        userId,
        type,
        message,
        relatedEntityType,
        relatedEntityId,
      });
    } catch (error) {
      console.error('Failed to create notification:', error.message);
    }
  },

  async getUserNotifications(userId, page = 1, limit = 20) {
    const total = await Notification.countDocuments({ userId });
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });
    return { notifications, total, unreadCount, page, totalPages: Math.ceil(total / limit) };
  },

  async markAsRead(notificationId, userId) {
    return Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true },
      { new: true }
    );
  },

  async markAllAsRead(userId) {
    return Notification.updateMany({ userId, isRead: false }, { isRead: true });
  },
};

module.exports = notificationService;
