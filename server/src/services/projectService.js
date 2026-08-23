/**
 * Project service.
 * Derives Current Value (on-hand) and Total Consumption (cumulative) dynamically per §9.
 */
const Project = require('../models/Project');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const stockService = require('./stockService');
const projectAssignmentService = require('./projectAssignmentService');
const { escapeRegex } = require('../utils/sanitizeRegex');
const Item = require('../models/Item');
const MovementLine = require('../models/MovementLine');
const mongoose = require('mongoose');

const projectService = {
  async list(filters = {}) {
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.search) {
      const safeSearch = escapeRegex(filters.search.trim());
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { projectCode: { $regex: safeSearch, $options: 'i' } },
      ];
    }
    const projects = await Project.find(query).sort({ createdAt: -1 }).lean();

    // Derive Current Value and Total Consumption per project (§9)
    const enrichedProjects = await Promise.all(
      projects.map(async (p) => {
        const [currentValue, totalConsumption] = await Promise.all([
          stockService.getProjectCurrentValue(p._id),
          stockService.getProjectTotalConsumption(p._id),
        ]);

        const obj = p.toObject();
        obj.currentValue = currentValue;
        obj.totalConsumption = totalConsumption;
        return obj;
      })
    );

    return enrichedProjects;
  },

  async getById(id) {
    const project = await Project.findById(id);
    if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');

    const [currentValue, totalConsumption] = await Promise.all([
      stockService.getProjectCurrentValue(project._id),
      stockService.getProjectTotalConsumption(project._id),
    ]);

    const obj = project.toObject();
    obj.currentValue = currentValue;
    obj.totalConsumption = totalConsumption;
    return obj;
  },

  async create(data, req) {
    const project = await Project.create(data);

    await auditService.log({
      userId: req.user._id,
      action: 'CREATE',
      entityType: 'Project',
      entityId: project._id,
      after: project.toJSON(),
      req,
    });

    return project;
  },

  async update(id, data, req) {
    const project = await Project.findById(id);
    if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');

    const before = project.toJSON();
    const fields = ['name', 'location', 'description', 'status', 'startDate', 'expectedEndDate'];
    fields.forEach(f => { if (data[f] !== undefined) project[f] = data[f]; });
    await project.save();

    await auditService.log({
      userId: req.user._id,
      action: 'UPDATE',
      entityType: 'Project',
      entityId: project._id,
      before,
      after: project.toJSON(),
      req,
    });

    return project;
  },

  async getDashboard(projectId) {
    const project = await this.getById(projectId);
    const [inventory, totalConsumption] = await Promise.all([
      stockService.getLocationInventory('PROJECT', projectId),
      stockService.getProjectTotalConsumption(projectId),
    ]);

    const currentValue = inventory.reduce((sum, i) => sum + (i.value || 0), 0);
    const members = await projectAssignmentService.getProjectMembers(projectId);

    // Populate item details
    const itemIds = inventory.map(i => i.itemId);
    const items = await Item.find({ _id: { $in: itemIds } }).populate('categoryId', 'name');
    const itemMap = {};
    items.forEach(i => { itemMap[i._id.toString()] = i; });

    const materials = inventory.map(inv => ({
      item: itemMap[inv.itemId.toString()],
      quantity: inv.quantity,
      value: inv.value,
    }));

    return {
      project,
      currentValue,
      totalConsumption,
      totalMaterialValue: currentValue,
      materialCount: inventory.length,
      members,
      materials,
    };
  },

  async getMaterials(projectId) {
    await this.getById(projectId); // ensure project exists
    const inventory = await stockService.getLocationInventory('PROJECT', projectId);

    const itemIds = inventory.map(i => i.itemId);
    const items = await Item.find({ _id: { $in: itemIds } }).populate('categoryId', 'name');
    const itemMap = {};
    items.forEach(i => { itemMap[i._id.toString()] = i; });

    return inventory.map(inv => ({
      item: itemMap[inv.itemId.toString()],
      quantity: inv.quantity,
      value: inv.value,
    }));
  },

  async getDecharge(projectId) {
    const project = await this.getById(projectId);
    const projectObjectId = new mongoose.Types.ObjectId(projectId.toString());

    const lines = await MovementLine.aggregate([
      {
        $lookup: {
          from: 'movements',
          localField: 'movementId',
          foreignField: '_id',
          as: 'movement',
        },
      },
      { $unwind: '$movement' },
      {
        $match: {
          'movement.status': 'CONFIRMED',
          'movement.toLocation.kind': 'PROJECT',
          'movement.toLocation.id': projectObjectId,
        },
      },
      {
        $lookup: {
          from: 'items',
          localField: 'itemId',
          foreignField: '_id',
          as: 'item',
        },
      },
      { $unwind: '$item' },
      {
        $sort: { 'movement.createdAt': 1 },
      },
    ]);

    const itemsMap = {};
    let grandTotal = 0;

    lines.forEach(l => {
      const itemId = l.itemId.toString();
      if (!itemsMap[itemId]) {
        itemsMap[itemId] = {
          itemId: l.itemId,
          itemCode: l.item.itemCode,
          name: l.item.name,
          unit: l.item.unit,
          quantity: 0,
          unitPrice: l.unitCostSnapshot,
          totalCost: 0,
        };
      }
      itemsMap[itemId].quantity += l.quantity;
      itemsMap[itemId].totalCost += l.totalCost;
      grandTotal += l.totalCost;
    });

    const linesSummary = Object.values(itemsMap);

    return {
      project: {
        _id: project._id,
        projectCode: project.projectCode,
        name: project.name,
        location: project.location,
      },
      lines: linesSummary,
      rawLines: lines.map(l => ({
        movementNumber: l.movement.movementNumber,
        date: l.movement.createdAt,
        itemCode: l.item.itemCode,
        name: l.item.name,
        unit: l.item.unit,
        quantity: l.quantity,
        unitCostSnapshot: l.unitCostSnapshot,
        totalCost: l.totalCost,
      })),
      grandTotal,
      currency: 'DZD',
      generatedAt: new Date(),
    };
  },
};

module.exports = projectService;

