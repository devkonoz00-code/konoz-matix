const userService = require('../services/userService');
const { validateRequired, validateEmail, validateEnum } = require('../validators/common');
const { ROLES } = require('../models/User');

const userController = {
  async list(req, res, next) {
    try {
      const users = await userService.list(req.query);
      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const user = await userService.getById(req.params.id);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  },

  async create(req, res, next) {
    try {
      validateRequired(req.body, ['fullName', 'email', 'password', 'role']);
      validateEmail(req.body.email);
      validateEnum(req.body.role, ROLES, 'role');

      const user = await userService.create(req.body, req);
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      if (req.body.email) validateEmail(req.body.email);
      if (req.body.role) validateEnum(req.body.role, ROLES, 'role');

      const user = await userService.update(req.params.id, req.body, req);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  },

  async deactivate(req, res, next) {
    try {
      const user = await userService.deactivate(req.params.id, req);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = userController;
