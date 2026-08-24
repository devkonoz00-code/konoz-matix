const Barcode = require('../models/Barcode');
const Item = require('../models/Item');
const Warehouse = require('../models/Warehouse');
const Project = require('../models/Project');
const ProjectAssignment = require('../models/ProjectAssignment');
const stockService = require('../services/stockService');

const barcodeController = {
  async lookup(req, res, next) {
    try {
      const code = req.params.code?.trim();
      let barcode = await Barcode.findOne({ code, isActive: true })
        .populate({
          path: 'itemId',
          populate: { path: 'categoryId', select: 'name' },
        });

      let item = null;

      if (barcode && barcode.itemId && barcode.itemId.name) {
        item = barcode.itemId;
      } else if (barcode && barcode.itemId) {
        item = await Item.findById(barcode.itemId).populate('categoryId', 'name');
      } else {
        // Fallback: search by itemCode directly
        item = await Item.findOne({ itemCode: code, isActive: true })
          .populate('categoryId', 'name');

        if (!item && require('mongoose').Types.ObjectId.isValid(code)) {
          item = await Item.findById(code).populate('categoryId', 'name');
        }

        if (item) {
          const primaryBarcode = await Barcode.findOne({ itemId: item._id, isPrimary: true, isActive: true })
            || await Barcode.findOne({ itemId: item._id, isActive: true });

          barcode = {
            _id: primaryBarcode ? primaryBarcode._id : null,
            code: primaryBarcode ? primaryBarcode.code : item.itemCode,
            type: primaryBarcode ? primaryBarcode.type : 'CODE-128',
            itemId: item,
            isPrimary: true,
          };
        }
      }

      if (!item) {
        return res.status(404).json({
          success: false,
          code: 'NOT_FOUND',
          message: `Barcode / Item code "${code}" not found in system`,
          canRegister: req.user ? ['ADMIN', 'WAREHOUSE_MANAGER', 'SUPERVISOR'].includes(req.user.role) : false,
        });
      }

      // Query live locations & stock balances
      const rawLocations = await stockService.getItemLocations(item._id);
      const enrichedLocations = [];

      for (const loc of rawLocations) {
        let locationName = 'Unknown Location';
        let projectCode = null;
        let responsible = null;

        if (loc.locationKind === 'WAREHOUSE') {
          const wh = await Warehouse.findById(loc.locationId);
          if (wh) locationName = wh.name;
        } else if (loc.locationKind === 'PROJECT') {
          const prj = await Project.findById(loc.locationId);
          if (prj) {
            locationName = prj.name;
            projectCode = prj.projectCode;
            const assignment = await ProjectAssignment.findOne({ projectId: prj._id, isActive: true }).populate('userId', 'fullName email phone');
            if (assignment?.userId) {
              responsible = assignment.userId.fullName;
            }
          }
        }

        enrichedLocations.push({
          locationKind: loc.locationKind,
          locationId: loc.locationId,
          locationName,
          projectCode,
          responsible,
          quantity: loc.quantity,
          value: loc.quantity * (item.unitPrice || 0),
        });
      }

      // Contextual Actions construction (§13)
      const contextualActions = [];
      const userRole = req.user?.role || 'VIEWER';

      const warehouseLocs = enrichedLocations.filter(l => l.locationKind === 'WAREHOUSE');
      const projectLocs = enrichedLocations.filter(l => l.locationKind === 'PROJECT');

      if (['ADMIN', 'SUPERVISOR', 'WAREHOUSE_MANAGER', 'STOREKEEPER'].includes(userRole)) {
        // Warehouse stock actions: Issue to a project
        if (warehouseLocs.length > 0) {
          warehouseLocs.forEach(whLoc => {
            contextualActions.push({
              actionType: 'ISSUE',
              label: `Issue to a project (from ${whLoc.locationName})`,
              fromLocation: { kind: 'WAREHOUSE', id: whLoc.locationId, name: whLoc.locationName },
              availableQuantity: whLoc.quantity,
            });
          });
        }

        // Project stock actions: Transfer to another project or Return to warehouse
        projectLocs.forEach(prjLoc => {
          contextualActions.push({
            actionType: 'TRANSFER',
            label: `Transfer to another project (from ${prjLoc.locationName})`,
            fromLocation: { kind: 'PROJECT', id: prjLoc.locationId, name: prjLoc.locationName },
            availableQuantity: prjLoc.quantity,
          });
          contextualActions.push({
            actionType: 'RETURN',
            label: `Return to a warehouse (from ${prjLoc.locationName})`,
            fromLocation: { kind: 'PROJECT', id: prjLoc.locationId, name: prjLoc.locationName },
            availableQuantity: prjLoc.quantity,
          });
        });
      }

      // History summary
      const history = await stockService.getItemHistory(item._id);

      res.json({
        success: true,
        data: {
          barcode: typeof barcode?.toObject === 'function' ? barcode.toObject() : barcode,
          item: {
            _id: item._id,
            itemCode: item.itemCode,
            name: item.name,
            description: item.description,
            brand: item.brand,
            model: item.model,
            unit: item.unit,
            unitPrice: item.unitPrice,
            minimumStock: item.minimumStock,
            category: item.categoryId?.name || 'General',
            itemType: item.itemType,
            imageUrl: item.imageUrl,
          },
          currentLocations: enrichedLocations,
          totalStock: enrichedLocations.reduce((sum, l) => sum + l.quantity, 0),
          lastMovement: history[0] || null,
          contextualActions,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = barcodeController;

