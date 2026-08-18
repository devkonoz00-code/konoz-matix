const itemService = require('../services/itemService');
const stockService = require('../services/stockService');
const Barcode = require('../models/Barcode');
const { getNextSequence } = require('../utils/sequence');
const auditService = require('../services/auditService');
const { validateRequired, validateEnum } = require('../validators/common');
const { ITEM_TYPES } = require('../models/Item');

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
};

module.exports = itemController;

