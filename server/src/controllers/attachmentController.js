const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const Attachment = require('../models/Attachment');
const { AppError } = require('../middleware/errorHandler');
const cloudinaryService = require('../services/cloudinaryService');

const uploadsDir = path.resolve(process.cwd(), 'uploads');

/**
 * Validate magic byte signatures against expected file types to prevent MIME spoofing.
 */
function validateFileSignature(buffer, mimetype) {
  if (!buffer || buffer.length < 4) return false;

  if (mimetype === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimetype === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }
  if (mimetype === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 && // RIFF
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50 // WEBP
    );
  }
  if (mimetype === 'application/pdf') {
    return (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46 // %PDF
    );
  }
  return false;
}

const attachmentController = {
  async list(req, res, next) {
    try {
      const query = {};
      if (req.query.entityType) query.entityType = req.query.entityType;
      if (req.query.entityId) query.entityId = req.query.entityId;
      const attachments = await Attachment.find(query)
        .populate('uploadedBy', 'fullName email role')
        .sort({ createdAt: -1 });
      res.json({ success: true, data: attachments });
    } catch (error) {
      next(error);
    }
  },

  async create(req, res, next) {
    try {
      if (!req.file) {
        throw new AppError('No file uploaded', 400, 'NO_FILE');
      }

      if (!req.body.entityType || !req.body.entityId) {
        throw new AppError('entityType and entityId are required fields', 400, 'MISSING_FIELDS');
      }

      // 1. Validate magic bytes / binary file signature
      const isValidSignature = validateFileSignature(req.file.buffer, req.file.mimetype);
      if (!isValidSignature) {
        throw new AppError(
          'File content does not match the declared MIME type. Executable or corrupted files are rejected.',
          400,
          'INVALID_FILE_SIGNATURE'
        );
      }

      let fileUrl;
      let cloudinaryPublicId = null;

      // 2. Upload to Cloudinary (Primary Architecture) or Local Storage (Fallback)
      if (cloudinaryService.isCloudinaryConfigured()) {
        try {
          const targetFolder = req.body.entityType === 'MaterialRequest'
            ? cloudinaryService.WORKER_REQUEST_IMAGE_FOLDER
            : (req.body.folder || 'matix');

          const result = await cloudinaryService.uploadBuffer(req.file.buffer, {
            folder: targetFolder,
            resource_type: 'auto',
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
          });
          cloudinaryPublicId = result.public_id;
          fileUrl = (result.secure_url || result.url || '').replace(/^http:\/\//i, 'https://');
        } catch (uploadError) {
          // Safe error handling: never leak provider credentials or internal stack to client
          throw new AppError('Failed to upload file to cloud storage provider', 502, 'STORAGE_UPLOAD_FAILED');
        }
      } else {
        // Secure local disk fallback
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const ext = path.extname(req.file.originalname || '').toLowerCase();
        const safeRandomName = `${crypto.randomBytes(16).toString('hex')}${ext}`;
        const destinationPath = path.join(uploadsDir, safeRandomName);

        await fs.promises.writeFile(destinationPath, req.file.buffer);
        fileUrl = `/uploads/${safeRandomName}`;
        cloudinaryPublicId = null;
      }

      // 3. Persist attachment record
      const sanitizedOriginalName = path.basename(req.file.originalname || 'unnamed_file');
      const attachment = await Attachment.create({
        entityType: req.body.entityType,
        entityId: req.body.entityId,
        cloudinaryPublicId,
        url: fileUrl,
        fileType: req.file.mimetype,
        fileName: sanitizedOriginalName,
        uploadedBy: req.user._id,
      });

      res.status(201).json({ success: true, data: attachment });
    } catch (error) {
      next(error);
    }
  },

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const attachment = await Attachment.findById(id);
      if (!attachment) {
        throw new AppError('Attachment not found', 404, 'NOT_FOUND');
      }

      // Clean up from Cloudinary if stored in cloud
      if (attachment.cloudinaryPublicId && cloudinaryService.isCloudinaryConfigured()) {
        try {
          await cloudinaryService.deleteResource(attachment.cloudinaryPublicId);
        } catch {}
      } else if (attachment.url && attachment.url.startsWith('/uploads/')) {
        // Clean up from local disk
        const localFileName = path.basename(attachment.url);
        const localFilePath = path.join(uploadsDir, localFileName);
        if (fs.existsSync(localFilePath)) {
          try {
            await fs.promises.unlink(localFilePath);
          } catch {}
        }
      }

      await Attachment.findByIdAndDelete(id);
      res.json({ success: true, message: 'Attachment deleted successfully' });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = attachmentController;
