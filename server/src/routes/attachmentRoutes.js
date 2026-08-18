const router = require('express').Router();
const attachmentController = require('../controllers/attachmentController');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { AppError } = require('../middleware/errorHandler');

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();

  // Validate extension
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(
      new AppError(
        `Invalid file extension "${ext}". Only JPG, PNG, WEBP, and PDF files are permitted.`,
        400,
        'INVALID_FILE_TYPE'
      ),
      false
    );
  }

  // Validate declared MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new AppError(
        `Invalid MIME type "${file.mimetype}". Only JPG, PNG, WEBP, and PDF documents are permitted.`,
        400,
        'INVALID_FILE_TYPE'
      ),
      false
    );
  }

  cb(null, true);
};

// Use in-memory buffer storage with strict limits
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB maximum
    files: 1,
  },
});

// Wrapper to handle Multer errors (like LIMIT_FILE_SIZE) consistently
const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new AppError('File size exceeds the 5MB maximum limit.', 400, 'FILE_TOO_LARGE')
        );
      }
      return next(err);
    }
    next();
  });
};

router.use(auth);
router.get('/', attachmentController.list);
router.post('/', handleUpload, attachmentController.create);
router.delete('/:id', attachmentController.delete);

module.exports = router;
