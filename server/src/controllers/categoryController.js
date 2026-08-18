const Category = require('../models/Category');
const auditService = require('../services/auditService');
const { validateRequired } = require('../validators/common');

const categoryController = {
  async list(req, res, next) {
    try {
      const categories = await Category.find().populate('parentCategoryId', 'name').sort({ name: 1 });
      res.json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const category = await Category.findById(req.params.id).populate('parentCategoryId', 'name');
      if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
      res.json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  },

  async create(req, res, next) {
    try {
      validateRequired(req.body, ['name']);
      const category = await Category.create(req.body);
      await auditService.log({ userId: req.user._id, action: 'CREATE', entityType: 'Category', entityId: category._id, after: category.toJSON(), req });
      res.status(201).json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
      res.json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  },

  async delete(req, res, next) {
    try {
      const category = await Category.findByIdAndDelete(req.params.id);
      if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
      await auditService.log({ userId: req.user._id, action: 'DELETE', entityType: 'Category', entityId: category._id, before: category.toJSON(), req });
      res.json({ success: true, message: 'Category deleted' });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = categoryController;
