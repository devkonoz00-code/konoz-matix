const movementService = require('../services/movementService');
const { validateRequired, validateEnum } = require('../validators/common');
const { MOVEMENT_TYPES } = require('../models/Movement');

const projectAssignmentService = require('../services/projectAssignmentService');
const { AppError } = require('../middleware/errorHandler');

const movementController = {
  async list(req, res, next) {
    try {
      const movements = await movementService.list(req.query);
      res.json({ success: true, data: movements });
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const result = await movementService.getById(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async create(req, res, next) {
    try {
      validateRequired(req.body, ['type', 'lines']);
      validateEnum(req.body.type, ['RECEIPT', 'ISSUE', 'ADJUSTMENT'], 'type');

      // Role permission checks per §8 and §14:
      if (req.user.role === 'PROJECT_MANAGER') {
        if (req.body.type !== 'ISSUE') {
          throw new AppError('Project Managers can only directly create ISSUE movements to their assigned projects', 403, 'FORBIDDEN');
        }
        const targetProjectId = req.body.toLocation?.id || req.body.projectId;
        if (!targetProjectId) {
          throw new AppError('Destination project is required for direct issue movement', 400, 'PROJECT_REQUIRED');
        }
        const isAssigned = await projectAssignmentService.isUserAssignedToProject(req.user._id, targetProjectId);
        if (!isAssigned) {
          throw new AppError('You can only directly issue materials to your own assigned projects', 403, 'FORBIDDEN');
        }
      }

      if (req.user.role === 'STOREKEEPER' && req.body.type === 'ADJUSTMENT') {
        throw new AppError('Stock adjustments can only be performed by Warehouse Managers or Administrators', 403, 'FORBIDDEN');
      }

      const result = await movementService.createMovement(req.body, req);
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
};

module.exports = movementController;
