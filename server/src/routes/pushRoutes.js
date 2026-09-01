const router = require('express').Router();
const pushController = require('../controllers/pushController');
const auth = require('../middleware/auth');

// Public endpoint to get VAPID public key
router.get('/vapid-key', pushController.getVapidPublicKey);

// Authenticated endpoints
router.use(auth);
router.post('/subscribe', pushController.subscribe);
router.post('/unsubscribe', pushController.unsubscribe);
router.post('/test', pushController.testPush);

module.exports = router;
