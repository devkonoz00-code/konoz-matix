const Warehouse = require('../models/Warehouse');
const auditService = require('../services/auditService');
const { validateRequired } = require('../validators/common');

const warehouseController = {
  async list(req, res, next) {
    try {
      const warehouses = await Warehouse.find().sort({ name: 1 });
      res.json({ success: true, data: warehouses });
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const warehouse = await Warehouse.findById(req.params.id);
      if (!warehouse) return res.status(404).json({ success: false, message: 'Warehouse not found' });
      res.json({ success: true, data: warehouse });
    } catch (error) {
      next(error);
    }
  },

  async create(req, res, next) {
    try {
      validateRequired(req.body, ['name', 'code']);
      const warehouse = await Warehouse.create(req.body);
      await auditService.log({ userId: req.user._id, action: 'CREATE', entityType: 'Warehouse', entityId: warehouse._id, after: warehouse.toJSON(), req });
      res.status(201).json({ success: true, data: warehouse });
    } catch (error) {
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const warehouse = await Warehouse.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      if (!warehouse) return res.status(404).json({ success: false, message: 'Warehouse not found' });
      res.json({ success: true, data: warehouse });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = warehouseController;
