const router = require('express').Router();
const categoryController = require('../controllers/categoryController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');

router.use(auth);
router.get('/', categoryController.list);
router.get('/:id', categoryController.getById);
router.post('/', authorize('ADMIN', 'WAREHOUSE_MANAGER'), categoryController.create);
router.patch('/:id', authorize('ADMIN', 'WAREHOUSE_MANAGER'), categoryController.update);
router.delete('/:id', authorize('ADMIN'), categoryController.delete);

module.exports = router;
