const router = require('express').Router();
const projectAssignmentController = require('../controllers/projectAssignmentController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');

router.use(auth);
router.get('/', projectAssignmentController.list);
router.post('/', authorize('ADMIN', 'WAREHOUSE_MANAGER'), projectAssignmentController.create);

module.exports = router;
