const router = require('express').Router();
const returnController = require('../controllers/returnController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');

router.use(auth);
router.get('/', returnController.list);
router.post('/', authorize('ADMIN', 'SUPERVISOR', 'WAREHOUSE_MANAGER', 'STOREKEEPER'), returnController.create);
router.patch('/:id/confirm', authorize('ADMIN', 'WAREHOUSE_MANAGER', 'STOREKEEPER'), returnController.confirm);

module.exports = router;
