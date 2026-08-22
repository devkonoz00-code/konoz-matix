const router = require('express').Router();
const itemController = require('../controllers/itemController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const multer = require('multer');
const { AppError } = require('../middleware/errorHandler');

const imageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new AppError('Only JPEG, PNG, and WebP images are allowed', 400, 'INVALID_FILE_TYPE'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

router.use(auth);
router.get('/', itemController.list);
router.get('/labels', itemController.getLabels);
router.post('/upload-image', authorize('ADMIN', 'WAREHOUSE_MANAGER'), imageUpload.single('file'), itemController.uploadImage);
router.get('/:id', itemController.getById);
router.get('/:id/history', itemController.getHistory);
router.post('/', authorize('ADMIN', 'WAREHOUSE_MANAGER'), itemController.create);
router.patch('/:id', authorize('ADMIN', 'WAREHOUSE_MANAGER'), itemController.update);
router.post('/:id/barcodes', authorize('ADMIN', 'WAREHOUSE_MANAGER'), itemController.addBarcode);

module.exports = router;

