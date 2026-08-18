const router = require('express').Router();
const reportController = require('../controllers/reportController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');

router.use(auth);
router.get('/company-dashboard', authorize('ADMIN', 'WAREHOUSE_MANAGER', 'SUPERVISOR'), reportController.companyDashboard);
router.get('/export', authorize('ADMIN', 'WAREHOUSE_MANAGER', 'SUPERVISOR'), reportController.export);

module.exports = router;

