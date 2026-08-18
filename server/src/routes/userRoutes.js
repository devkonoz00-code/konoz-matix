const router = require('express').Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');

router.use(auth);
router.get('/', userController.list);
router.get('/:id', userController.getById);
router.post('/', authorize('ADMIN'), userController.create);
router.patch('/:id', authorize('ADMIN'), userController.update);
router.patch('/:id/deactivate', authorize('ADMIN'), userController.deactivate);

module.exports = router;
