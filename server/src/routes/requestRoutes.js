const router = require('express').Router();
const requestController = require('../controllers/requestController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');

router.use(auth);
router.get('/', requestController.list);
router.get('/:id', requestController.getById);
router.post('/', authorize('ADMIN', 'SUPERVISOR'), requestController.create);
router.patch('/:id/submit', authorize('ADMIN', 'SUPERVISOR'), requestController.submit);
router.patch('/:id/approve', authorize('ADMIN', 'WAREHOUSE_MANAGER', 'SUPERVISOR'), requestController.approve);
router.patch('/:id/reject', authorize('ADMIN', 'WAREHOUSE_MANAGER'), requestController.reject);
router.patch('/:id/cancel', authorize('ADMIN', 'SUPERVISOR', 'WAREHOUSE_MANAGER'), requestController.cancel);

module.exports = router;
