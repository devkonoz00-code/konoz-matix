const router = require('express').Router();
const documentController = require('../controllers/documentController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');

router.use(auth);
router.get('/', documentController.list);
router.post('/', authorize('ADMIN', 'WAREHOUSE_MANAGER'), documentController.create);

module.exports = router;
