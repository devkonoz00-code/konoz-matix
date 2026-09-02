const router = require('express').Router();
const supplierController = require('../controllers/supplierController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');

router.use(auth);

// All authenticated users can read/search suppliers
router.get('/', supplierController.list);
router.get('/:id', supplierController.getById);

// Admin-only operations
router.post('/', authorize('ADMIN'), supplierController.create);
router.put('/:id', authorize('ADMIN'), supplierController.update);
router.patch('/:id', authorize('ADMIN'), supplierController.update);
router.delete('/:id', authorize('ADMIN'), supplierController.delete);

module.exports = router;
