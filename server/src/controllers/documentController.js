const CompanyDocument = require('../models/CompanyDocument');
const auditService = require('../services/auditService');
const { validateRequired } = require('../validators/common');

const documentController = {
  async list(req, res, next) {
    try {
      const docs = await CompanyDocument.find().sort({ createdAt: -1 });
      res.json({ success: true, data: docs });
    } catch (error) {
      next(error);
    }
  },

  async create(req, res, next) {
    try {
      validateRequired(req.body, ['documentNumber', 'documentType', 'documentDate']);
      const doc = await CompanyDocument.create(req.body);
      await auditService.log({ userId: req.user._id, action: 'CREATE', entityType: 'CompanyDocument', entityId: doc._id, after: doc.toJSON(), req });
      res.status(201).json({ success: true, data: doc });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = documentController;
