const router = require('express').Router();
const itemController = require('../controllers/itemController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');

router.use(auth);
router.get('/', itemController.list);
router.get('/labels', itemController.getLabels);
router.get('/:id', itemController.getById);
router.get('/:id/history', itemController.getHistory);
router.post('/', authorize('ADMIN', 'WAREHOUSE_MANAGER'), itemController.create);
router.patch('/:id', authorize('ADMIN', 'WAREHOUSE_MANAGER'), itemController.update);
router.post('/:id/barcodes', authorize('ADMIN', 'WAREHOUSE_MANAGER'), itemController.addBarcode);

module.exports = router;
