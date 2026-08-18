const auditService = require('../services/auditService');

const auditLogController = {
  async list(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const result = await auditService.find(req.query, page, limit);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = auditLogController;
