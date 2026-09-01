const requestService = require('../services/requestService');
const { validateRequired } = require('../validators/common');
const { AppError } = require('../middleware/errorHandler');

const requestController = {
  async list(req, res, next) {
    try {
      const requests = await requestService.list(req.query, req.user);
      res.json({ success: true, data: requests });
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const result = await requestService.getById(req.params.id, req.user);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async create(req, res, next) {
    try {
      validateRequired(req.body, ['projectId', 'lines']);

      const result = await requestService.create(req.body, req);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Quick Messenger-Style Material Request (for WORKER / SUPERVISOR / ADMIN)
   */
  async createQuick(req, res, next) {
    try {
      validateRequired(req.body, ['projectId', 'textContent']);

      const result = await requestService.createQuickRequest(req.body, req);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Mark request as seen/read by supervisor or admin
   */
  async markSeen(req, res, next) {
    try {
      const result = await requestService.markAsSeen(req.params.id, req);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Fast Validate (VALIDE) & Fulfill Quick Material Request
   */
  async validateQuick(req, res, next) {
    try {
      const result = await requestService.validateQuickRequest(req.params.id, req.body, req);
      res.json({ success: true, data: result, message: 'تمت معالجة واعتماد الطلب بنجاح (VALIDÉ)' });
    } catch (error) {
      next(error);
    }
  },

  async submit(req, res, next) {
    try {
      const result = await requestService.updateStatus(req.params.id, 'SUBMITTED', req.body, req);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async approve(req, res, next) {
    try {
      const result = await requestService.updateStatus(req.params.id, 'APPROVED', req.body, req);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async reject(req, res, next) {
    try {
      const result = await requestService.updateStatus(req.params.id, 'REJECTED', req.body, req);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async cancel(req, res, next) {
    try {
      const result = await requestService.updateStatus(req.params.id, 'CANCELLED', req.body, req);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = requestController;

