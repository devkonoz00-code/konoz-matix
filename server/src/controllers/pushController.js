const pushService = require('../services/pushService');

const pushController = {
  /**
   * Get the public VAPID key
   */
  getVapidPublicKey(req, res) {
    const publicKey = pushService.getPublicKey();
    res.json({ success: true, data: { publicKey } });
  },

  /**
   * Subscribe to Web Push notifications
   */
  async subscribe(req, res, next) {
    try {
      const { subscription } = req.body;
      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_SUBSCRIPTION',
          message: 'Missing or invalid push subscription data',
        });
      }

      await pushService.subscribe(
        req.user._id,
        subscription,
        req.headers['user-agent'] || ''
      );

      res.status(201).json({
        success: true,
        message: 'Push subscription saved successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Unsubscribe from Web Push notifications
   */
  async unsubscribe(req, res, next) {
    try {
      const { endpoint } = req.body;
      await pushService.unsubscribe(req.user._id, endpoint);
      res.json({
        success: true,
        message: 'Unsubscribed from push notifications',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Send a test push notification to the logged-in user
   */
  async testPush(req, res, next) {
    try {
      const result = await pushService.sendToUser(req.user._id, {
        title: '🔔 إشعار تجريبي من MATIX',
        body: 'تم تفعيل إشعارات الهاتف بنجاح! ستصلك التنبيهات حتى والتطبيق مغلق.',
        url: '/#/requests',
      });

      res.json({
        success: true,
        data: result,
        message: 'Test notification triggered',
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = pushController;
