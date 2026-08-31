const router = require('express').Router();
const projectController = require('../controllers/projectController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');

router.use(auth);
router.get('/', projectController.list);
router.get('/:id', projectController.getById);
router.get('/:id/dashboard', projectController.getDashboard);
router.get('/:id/materials', projectController.getMaterials);
router.get('/:id/decharge', projectController.getDecharge);
router.post('/', authorize('ADMIN', 'WAREHOUSE_MANAGER'), projectController.create);
router.patch('/:id', authorize('ADMIN', 'WAREHOUSE_MANAGER', 'SUPERVISOR'), projectController.update);
router.delete('/:id', authorize('ADMIN'), projectController.delete);

module.exports = router;
