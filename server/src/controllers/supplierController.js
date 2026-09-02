const supplierService = require('../services/supplierService');
const { validateRequired } = require('../validators/common');

const supplierController = {
  async list(req, res, next) {
    try {
      const result = await supplierService.list(req.query, req.query.page, req.query.limit);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const supplier = await supplierService.getById(req.params.id);
      res.json({ success: true, data: supplier });
    } catch (error) {
      next(error);
    }
  },

  async create(req, res, next) {
    try {
      validateRequired(req.body, ['fullName', 'phone', 'category']);
      const supplier = await supplierService.create(req.body, req.user._id, req);
      res.status(201).json({ success: true, data: supplier });
    } catch (error) {
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const supplier = await supplierService.update(req.params.id, req.body, req.user._id, req);
      res.json({ success: true, data: supplier });
    } catch (error) {
      next(error);
    }
  },

  async delete(req, res, next) {
    try {
      const result = await supplierService.delete(req.params.id, req.user._id, req);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = supplierController;
