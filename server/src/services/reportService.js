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
      projects,
    ] = await Promise.all([
      Project.countDocuments(),
      Project.countDocuments({ status: 'ACTIVE' }),
      Item.countDocuments({ isActive: true }),
      Movement.countDocuments({ status: 'CONFIRMED' }),
      MaterialRequest.countDocuments({ status: { $in: ['SUBMITTED', 'APPROVED'] } }),
      Warehouse.find({ isActive: true }).lean(),
      Project.find({ status: 'ACTIVE' }).lean(),
    ]);

    // Calculate project and warehouse values concurrently
    const [projectValues, warehouseValues, recentMovements] = await Promise.all([
      Promise.all(
        projects.map(async (project) => {
          const [currentValue, totalConsumption] = await Promise.all([
            stockService.getProjectCurrentValue(project._id),
            stockService.getProjectTotalConsumption(project._id),
          ]);
          return {
            project: { _id: project._id, projectCode: project.projectCode, name: project.name },
            currentValue,
            totalConsumption,
            totalValue: currentValue,
          };
        })
      ),
      Promise.all(
        warehouses.map(async (wh) => {
          const value = await stockService.getLocationValue('WAREHOUSE', wh._id.toString());
          return {
            warehouse: { _id: wh._id, code: wh.code, name: wh.name },
            totalValue: value,
          };
        })
      ),
      Movement.find({ status: 'CONFIRMED' })
        .populate('createdBy', 'fullName')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const totalProjectValue = projectValues.reduce((s, p) => s + p.currentValue, 0);
    const totalWarehouseValue = warehouseValues.reduce((s, w) => s + w.totalValue, 0);

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

