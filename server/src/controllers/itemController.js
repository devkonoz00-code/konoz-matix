const itemService = require('../services/itemService');
const stockService = require('../services/stockService');
const Barcode = require('../models/Barcode');
const { getNextSequence } = require('../utils/sequence');
const auditService = require('../services/auditService');
const { validateRequired, validateEnum } = require('../validators/common');
const { ITEM_TYPES } = require('../models/Item');
const cloudinaryService = require('../services/cloudinaryService');
const { AppError } = require('../middleware/errorHandler');

/**
 * Validate magic byte signatures to prevent MIME spoofing.
 */
function validateFileSignature(buffer, mimetype) {
  if (!buffer || buffer.length < 4) return false;
  if (mimetype === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimetype === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
      buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
    );
  }
  if (mimetype === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    );
  }
  return false;
}

function validateImageFile(file) {
  if (!file) {
    throw new AppError('No image file uploaded', 400, 'NO_FILE');
  }

  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new AppError('Only JPEG, PNG, and WebP images are allowed', 400, 'INVALID_FILE_TYPE');
  }

  if (!validateFileSignature(file.buffer, file.mimetype)) {
    throw new AppError('File content does not match the declared image type', 400, 'INVALID_FILE_SIGNATURE');
  }
}

function assertProductImageStorageConfigured() {
  if (cloudinaryService.isCloudinaryConfigured()) return;
  const status = cloudinaryService.getConfigurationStatus();
  throw new AppError(
    status.message || 'Product image storage is not configured.',
    503,
    status.code || 'CLOUDINARY_NOT_CONFIGURED'
  );
}

const itemController = {
  async list(req, res, next) {
    try {
      const items = await itemService.list(req.query);
      res.json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  },

  async getLabels(req, res, next) {
    try {
      const labels = await itemService.getLabels(req.query.ids);
      res.json({ success: true, data: labels });
    } catch (error) {
      next(error);
    }
  },

  async getSuggestions(req, res, next) {
    try {
      const query = req.query.q || req.query.search || req.query.name || '';
      const suggestions = await itemService.getArticleSuggestions(query);
      res.json({ success: true, data: suggestions });
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const item = await itemService.getById(req.params.id);
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  },

  async getHistory(req, res, next) {
    try {
      const history = await stockService.getItemHistory(req.params.id);
      res.json({ success: true, data: history });
    } catch (error) {
      next(error);
    }
  },

  async create(req, res, next) {
    try {
      const body = req.body;
      if (body.unitPrice === undefined && body.currentCostPrice !== undefined) {
        body.unitPrice = body.currentCostPrice;
      }
      validateRequired(body, ['name', 'categoryId', 'unit', 'unitPrice', 'itemType']);
      validateEnum(body.itemType, ITEM_TYPES, 'itemType');

      const item = await itemService.create(body, req);
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      if (req.body.itemType) validateEnum(req.body.itemType, ITEM_TYPES, 'itemType');
      if (req.body.isActive !== undefined && req.user?.role !== 'ADMIN') {
        throw new AppError('Only administrators can change item activation status.', 403, 'FORBIDDEN');
      }
      const item = await itemService.update(req.params.id, req.body, req);
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  },

  async addBarcode(req, res, next) {
    try {
      const itemId = req.params.id;
      let code = req.body.code;
      const type = req.body.type || 'CODE-128';

      // If no code provided, auto-generate
      if (!code) {
        code = await getNextSequence('barcode', 'ITM');
      }

      const barcode = await Barcode.create({
        itemId,
        code,
        type,
        isPrimary: req.body.isPrimary || false,
      });

      await auditService.log({ userId: req.user._id, action: 'CREATE', entityType: 'Barcode', entityId: barcode._id, after: barcode.toJSON(), req });
      res.status(201).json({ success: true, data: barcode });
    } catch (error) {
      next(error);
    }
  },

  async replaceImage(req, res, next) {
    try {
      validateImageFile(req.file);
      assertProductImageStorageConfigured();
      const item = await itemService.replaceImage(req.params.id, req.file, req);
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  },

  async deleteImage(req, res, next) {
    try {
      const item = await itemService.removeImage(req.params.id, req);
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  },

  async delete(req, res, next) {
    try {
      const result = await itemService.delete(req.params.id, req);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = itemController;
