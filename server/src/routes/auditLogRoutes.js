const router = require('express').Router();
const auditLogController = require('../controllers/auditLogController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');

router.use(auth);
router.get('/', authorize('ADMIN'), auditLogController.list);

module.exports = router;
