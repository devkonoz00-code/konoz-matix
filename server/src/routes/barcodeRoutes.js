const router = require('express').Router();
const barcodeController = require('../controllers/barcodeController');
const auth = require('../middleware/auth');

router.use(auth);
router.get('/:code', barcodeController.lookup);

module.exports = router;
