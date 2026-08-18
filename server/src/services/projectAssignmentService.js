/**
 * Project Assignment service.
 * Handles assignment CRUD with the key rule: reassigning creates a new record
 * and deactivates the old one (never deletes).
 */
const ProjectAssignment = require('../models/ProjectAssignment');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');

const projectAssignmentService = {
  async list(filters = {}) {
    const query = {};
    if (filters.userId) query.userId = filters.userId;
    if (filters.projectId) query.projectId = filters.projectId;
    if (filters.isActive !== undefined) query.isActive = filters.isActive;
    return ProjectAssignment.find(query)
      .populate('userId', 'fullName email role')
      .populate('projectId', 'projectCode name status')
      .sort({ createdAt: -1 });
  },

  async create(data, req) {
    // Deactivate any existing active assignment for this user on this project
    const existing = await ProjectAssignment.findOne({
      userId: data.userId,
      projectId: data.projectId,
      isActive: true,
    });

    if (existing) {
      existing.isActive = false;
      existing.endDate = new Date();
      await existing.save();
    }

    const assignment = await ProjectAssignment.create({
      userId: data.userId,
      projectId: data.projectId,
      role: data.role,
      startDate: data.startDate || new Date(),
    });

    await auditService.log({
      userId: req.user._id,
      action: 'CREATE',
      entityType: 'ProjectAssignment',
      entityId: assignment._id,
      before: existing ? existing.toJSON() : null,
      after: assignment.toJSON(),
      req,
    });

    return assignment.populate([
      { path: 'userId', select: 'fullName email role' },
      { path: 'projectId', select: 'projectCode name status' },
    ]);
  },

  async getActiveAssignments(userId) {
    return ProjectAssignment.find({ userId, isActive: true })
      .populate('projectId', 'projectCode name status location');
  },

  async isUserAssignedToProject(userId, projectId) {
    const assignment = await ProjectAssignment.findOne({
      userId,
      projectId,
      isActive: true,
    });
    return !!assignment;
  },

  async getProjectMembers(projectId) {
    return ProjectAssignment.find({ projectId, isActive: true })
      .populate('userId', 'fullName email role phone');
  },
};

module.exports = projectAssignmentService;
