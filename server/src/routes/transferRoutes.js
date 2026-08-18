const router = require('express').Router();
const transferController = require('../controllers/transferController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');

router.use(auth);
router.get('/', transferController.list);
router.post('/', authorize('ADMIN', 'SUPERVISOR', 'WAREHOUSE_MANAGER', 'STOREKEEPER'), transferController.create);
router.patch('/:id/confirm', authorize('ADMIN', 'SUPERVISOR', 'WAREHOUSE_MANAGER', 'STOREKEEPER'), transferController.confirm);

module.exports = router;
