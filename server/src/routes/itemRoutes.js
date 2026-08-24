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

const handleImageUpload = (req, res, next) => {
  imageUpload.single('file')(req, res, error => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Product images cannot exceed 5 MB.'
        : 'Invalid product image upload.';
      return next(new AppError(message, 400, error.code || 'INVALID_UPLOAD'));
    }
    return next(error);
  });
};

router.use(auth);
router.get('/', itemController.list);
router.get('/labels', itemController.getLabels);
router.get('/suggestions', itemController.getSuggestions);
router.put('/:id/image', authorize('ADMIN', 'WAREHOUSE_MANAGER'), handleImageUpload, itemController.replaceImage);
router.delete('/:id/image', authorize('ADMIN', 'WAREHOUSE_MANAGER'), itemController.deleteImage);
router.get('/:id', itemController.getById);
router.get('/:id/history', itemController.getHistory);
router.post('/', authorize('ADMIN', 'WAREHOUSE_MANAGER'), itemController.create);
router.patch('/:id', authorize('ADMIN', 'WAREHOUSE_MANAGER'), itemController.update);
router.post('/:id/barcodes', authorize('ADMIN', 'WAREHOUSE_MANAGER'), itemController.addBarcode);
router.delete('/:id', authorize('ADMIN'), itemController.delete);

module.exports = router;
