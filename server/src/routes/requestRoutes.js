const router = require('express').Router();
const requestController = require('../controllers/requestController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');

router.use(auth);
router.get('/', requestController.list);
router.get('/:id', requestController.getById);
router.post('/', authorize('ADMIN', 'SUPERVISOR'), requestController.create);
router.post('/quick', authorize('WORKER', 'SUPERVISOR', 'ADMIN', 'WAREHOUSE_MANAGER'), requestController.createQuick);
router.patch('/:id/seen', authorize('SUPERVISOR', 'ADMIN', 'WAREHOUSE_MANAGER', 'STOREKEEPER'), requestController.markSeen);
router.patch('/:id/validate-quick', authorize('ADMIN', 'SUPERVISOR', 'WAREHOUSE_MANAGER'), requestController.validateQuick);
router.patch('/:id/submit', authorize('ADMIN', 'SUPERVISOR', 'WORKER'), requestController.submit);
router.patch('/:id/approve', authorize('ADMIN', 'WAREHOUSE_MANAGER', 'SUPERVISOR'), requestController.approve);
router.patch('/:id/reject', authorize('ADMIN', 'WAREHOUSE_MANAGER'), requestController.reject);
router.patch('/:id/cancel', authorize('ADMIN', 'SUPERVISOR', 'WAREHOUSE_MANAGER', 'WORKER'), requestController.cancel);
router.delete('/:id', authorize('ADMIN'), requestController.delete);

module.exports = router;

