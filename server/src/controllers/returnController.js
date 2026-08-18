const movementService = require('../services/movementService');
const { validateRequired } = require('../validators/common');

const returnController = {
  async create(req, res, next) {
    try {
      validateRequired(req.body, ['fromLocation', 'toLocation', 'lines']);
      const result = await movementService.createReturn(req.body, req);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async confirm(req, res, next) {
    try {
      const result = await movementService.confirmMovement(req.params.id, req);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async list(req, res, next) {
    try {
      const movements = await movementService.list({ ...req.query, type: 'RETURN' });
      res.json({ success: true, data: movements });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = returnController;
