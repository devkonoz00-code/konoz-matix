const projectAssignmentService = require('../services/projectAssignmentService');
const { validateRequired, validateObjectId } = require('../validators/common');

const projectAssignmentController = {
  async list(req, res, next) {
    try {
      const assignments = await projectAssignmentService.list(req.query);
      res.json({ success: true, data: assignments });
    } catch (error) {
      next(error);
    }
  },

  async create(req, res, next) {
    try {
      validateRequired(req.body, ['userId', 'projectId', 'role']);
      validateObjectId(req.body.userId, 'userId');
      validateObjectId(req.body.projectId, 'projectId');

      const assignment = await projectAssignmentService.create(req.body, req);
      res.status(201).json({ success: true, data: assignment });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = projectAssignmentController;
