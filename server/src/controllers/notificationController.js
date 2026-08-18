const notificationService = require('../services/notificationService');

const notificationController = {
  async list(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const result = await notificationService.getUserNotifications(req.user._id, page, limit);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async markAsRead(req, res, next) {
    try {
      await notificationService.markAsRead(req.params.id, req.user._id);
      res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
      next(error);
    }
  },

  async markAllAsRead(req, res, next) {
    try {
      await notificationService.markAllAsRead(req.user._id);
      res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = notificationController;
