const projectService = require('../services/projectService');
const { validateRequired } = require('../validators/common');

const projectController = {
  async list(req, res, next) {
    try {
      const projects = await projectService.list(req.query);
      res.json({ success: true, data: projects });
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const project = await projectService.getById(req.params.id);
      res.json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  },

  async create(req, res, next) {
    try {
      validateRequired(req.body, ['projectCode', 'name']);
      const project = await projectService.create(req.body, req);
      res.status(201).json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const project = await projectService.update(req.params.id, req.body, req);
      res.json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  },

  async getDashboard(req, res, next) {
    try {
      const dashboard = await projectService.getDashboard(req.params.id);
      res.json({ success: true, data: dashboard });
    } catch (error) {
      next(error);
    }
  },

  async getMaterials(req, res, next) {
    try {
      const materials = await projectService.getMaterials(req.params.id);
      res.json({ success: true, data: materials });
    } catch (error) {
      next(error);
    }
  },

  async getDecharge(req, res, next) {
    try {
      const decharge = await projectService.getDecharge(req.params.id);
      res.json({ success: true, data: decharge });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = projectController;
