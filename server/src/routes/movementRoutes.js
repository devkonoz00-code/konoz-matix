const router = require('express').Router();
const movementController = require('../controllers/movementController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');

router.use(auth);
router.get('/', movementController.list);
router.get('/:id', movementController.getById);
router.post('/', authorize('ADMIN', 'WAREHOUSE_MANAGER', 'STOREKEEPER', 'SUPERVISOR'), movementController.create);
router.patch('/:id/confirm', authorize('ADMIN', 'WAREHOUSE_MANAGER', 'STOREKEEPER', 'SUPERVISOR'), movementController.confirm);

module.exports = router;
