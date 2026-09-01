const webpush = require('web-push');
const env = require('../config/env');
const PushSubscription = require('../models/PushSubscription');

// Initialize Web Push with VAPID credentials
try {
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );
} catch (err) {
  console.error('Failed to initialize VAPID details for Web Push:', err.message);
}

const pushService = {
  /**
   * Return the public VAPID key for client registration
   */
  getPublicKey() {
    return env.VAPID_PUBLIC_KEY;
  },

  /**
   * Register or update a user's push subscription
   */
  async subscribe(userId, subscription, userAgent = '') {
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      throw new Error('Invalid push subscription payload');
    }

    const { endpoint, keys } = subscription;

    return await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        userId,
        endpoint,
        keys: {
          p256dh: keys.p256dh,
          auth: keys.auth,
        },
        userAgent,
        lastUsedAt: new Date(),
      },
      { upsert: true, new: true }
    );
  },

  /**
   * Remove a push subscription by endpoint or user
   */
  async unsubscribe(userId, endpoint) {
    if (endpoint) {
      return await PushSubscription.deleteOne({ endpoint, userId });
    }
    return await PushSubscription.deleteMany({ userId });
  },

  /**
   * Send Web Push notification to all active devices of a user
   */
  async sendToUser(userId, payload) {
    try {
      const subscriptions = await PushSubscription.find({ userId });
      if (!subscriptions || subscriptions.length === 0) {
        return { sent: 0, failed: 0 };
      }

      const formattedPayload = JSON.stringify({
        title: payload.title || 'MATIX — إشعار جديد',
        body: payload.body || payload.message || '',
        icon: payload.icon || '/assets/logo.png',
        badge: payload.badge || '/assets/logo.png',
        tag: payload.tag || `matix-notif-${Date.now()}`,
        vibrate: payload.vibrate || [200, 100, 200, 100, 200],
        data: {
          url: payload.url || '/#/requests',
          type: payload.type || 'NOTIFICATION',
          entityId: payload.relatedEntityId || null,
          timestamp: Date.now(),
          ...(payload.data || {}),
        },
      });

      let sent = 0;
      let failed = 0;

      const promises = subscriptions.map(async (sub) => {
        const pushConfig = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
          },
        };

        try {
          await webpush.sendNotification(pushConfig, formattedPayload, {
            TTL: 86400, // 24 hours
            urgency: 'high',
          });
          sent++;
          await PushSubscription.updateOne({ _id: sub._id }, { lastUsedAt: new Date() });
        } catch (err) {
          failed++;
          // If subscription is expired or revoked (404 / 410 Gone), automatically clean it up
          if (err.statusCode === 404 || err.statusCode === 410) {
            await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
          } else {
            console.warn(`Web push delivery error for user ${userId}:`, err.message);
          }
        }
      });

      await Promise.all(promises);
      return { sent, failed };
    } catch (error) {
      console.error(`PushService error sending to user ${userId}:`, error.message);
      return { sent: 0, failed: 0, error: error.message };
    }
  },

  /**
   * Send Web Push notification to multiple users simultaneously
   */
  async sendToUsers(userIds, payload) {
    if (!Array.isArray(userIds) || userIds.length === 0) return;
    const promises = userIds.map((uid) => this.sendToUser(uid, payload));
    return await Promise.all(promises);
  },
};

module.exports = pushService;
