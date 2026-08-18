const router = require('express').Router();
const warehouseController = require('../controllers/warehouseController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');

router.use(auth);
router.get('/', warehouseController.list);
router.get('/:id', warehouseController.getById);
router.post('/', authorize('ADMIN', 'WAREHOUSE_MANAGER'), warehouseController.create);
router.patch('/:id', authorize('ADMIN', 'WAREHOUSE_MANAGER'), warehouseController.update);

module.exports = router;
