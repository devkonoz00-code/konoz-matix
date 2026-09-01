/**
 * Notification service.
 * Creates in-app notifications for relevant events.
 */
const Notification = require('../models/Notification');
const pushService = require('./pushService');

const notificationService = {
  async create({ userId, type, message, relatedEntityType, relatedEntityId, title, url }) {
    try {
      const notif = await Notification.create({
        userId,
        type,
        message,
        relatedEntityType,
        relatedEntityId,
      });

      // Automatically dispatch Web Push notification to user's phone / device
      try {
        let pushTitle = title || 'MATIX — إشعار لوجستي جديد';
        let targetUrl = url;

        if (!targetUrl) {
          if (type === 'WORKER_QUICK_REQUEST') {
            pushTitle = '🔔 طلب مواد فوري من الورشة';
            targetUrl = relatedEntityId ? `/#/requests/${relatedEntityId}` : '/#/requests';
          } else if (type === 'REQUEST_VALIDATED') {
            pushTitle = '✅ تمت معالجة طلبك (VALIDÉ)';
            targetUrl = '/#/worker-requests';
          } else if (relatedEntityType === 'MaterialRequest') {
            targetUrl = relatedEntityId ? `/#/requests/${relatedEntityId}` : '/#/requests';
          } else if (relatedEntityType === 'Project') {
            targetUrl = relatedEntityId ? `/#/projects/${relatedEntityId}` : '/#/projects';
          } else {
            targetUrl = '/#/dashboard';
          }
        }

        // Fire and forget push dispatch (does not block DB response)
        pushService.sendToUser(userId, {
          title: pushTitle,
          body: message,
          type,
          relatedEntityType,
          relatedEntityId,
          url: targetUrl,
          vibrate: [200, 100, 200, 100, 300],
        }).catch((pushErr) => {
          console.warn('Web push background dispatch error:', pushErr.message);
        });
      } catch (err) {
        console.warn('Failed to trigger web push for notification:', err.message);
      }

      return notif;
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
