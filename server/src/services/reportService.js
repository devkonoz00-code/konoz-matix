/**
 * Report service.
 * Company dashboard and export functionality.
 */
const Project = require('../models/Project');
const Item = require('../models/Item');
const Movement = require('../models/Movement');
const MovementLine = require('../models/MovementLine');
const MaterialRequest = require('../models/MaterialRequest');
const Warehouse = require('../models/Warehouse');
const stockService = require('./stockService');

const reportService = {
  async getCompanyDashboard() {
    const [
      totalProjects,
      activeProjects,
      totalItems,
      totalMovements,
      pendingRequests,
      warehouses,
    ] = await Promise.all([
      Project.countDocuments(),
      Project.countDocuments({ status: 'ACTIVE' }),
      Item.countDocuments({ isActive: true }),
      Movement.countDocuments({ status: 'CONFIRMED' }),
      MaterialRequest.countDocuments({ status: { $in: ['SUBMITTED', 'APPROVED'] } }),
      Warehouse.find({ isActive: true }),
    ]);

    // Get Current Value and Total Consumption per active project (§9)
    const projects = await Project.find({ status: 'ACTIVE' });
    const projectValues = [];
    for (const project of projects) {
      const [currentValue, totalConsumption] = await Promise.all([
        stockService.getProjectCurrentValue(project._id),
        stockService.getProjectTotalConsumption(project._id),
      ]);
      projectValues.push({
        project: { _id: project._id, projectCode: project.projectCode, name: project.name },
        currentValue,
        totalConsumption,
        totalValue: currentValue,
      });
    }

    // Get warehouse values
    const warehouseValues = [];
    for (const wh of warehouses) {
      const value = await stockService.getLocationValue('WAREHOUSE', wh._id.toString());
      warehouseValues.push({
        warehouse: { _id: wh._id, code: wh.code, name: wh.name },
        totalValue: value,
      });
    }

    const totalProjectValue = projectValues.reduce((s, p) => s + p.currentValue, 0);
    const totalWarehouseValue = warehouseValues.reduce((s, w) => s + w.totalValue, 0);

    // Recent movements
    const recentMovements = await Movement.find({ status: 'CONFIRMED' })
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 })
      .limit(10);

    return {
      summary: {
        totalProjects,
        activeProjects,
        totalItems,
        totalMovements,
        pendingRequests,
        totalProjectValue,
        totalWarehouseValue,
        totalSystemValue: totalProjectValue + totalWarehouseValue,
      },
      projectValues,
      warehouseValues,
      recentMovements,
    };
  },

  async exportItems(format) {
    return Item.find({ isActive: true })
      .populate('categoryId', 'name')
      .sort({ itemCode: 1 })
      .lean();
  },

  async exportMovements(format) {
    return Movement.find()
      .populate('createdBy', 'fullName email')
      .populate('projectId', 'projectCode name')
      .sort({ createdAt: -1 })
      .lean();
  },

  async exportRequests(format) {
    return MaterialRequest.find()
      .populate('projectId', 'projectCode name')
      .populate('requestedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();
  },
};

module.exports = reportService;

