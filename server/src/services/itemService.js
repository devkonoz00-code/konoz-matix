/**
 * Item service.
 * Handles item CRUD, search, and detail views including current location/project and unitPrice snapshotting.
 */
const Item = require('../models/Item');
const Barcode = require('../models/Barcode');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const { getNextSequence } = require('../utils/sequence');

const Warehouse = require('../models/Warehouse');
const Project = require('../models/Project');
const ProjectAssignment = require('../models/ProjectAssignment');
const stockService = require('./stockService');

const itemService = {
  async list(filters = {}) {
    const query = { isActive: true };
    if (filters.categoryId) query.categoryId = filters.categoryId;
    if (filters.itemType) query.itemType = filters.itemType;
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { itemCode: { $regex: filters.search, $options: 'i' } },
        { brand: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
      ];
    }

    const items = await Item.find(query)
      .populate('categoryId', 'name')
      .sort({ name: 1 });

    // Attach barcodes for each item
    const itemIds = items.map(i => i._id);
    const barcodes = await Barcode.find({ itemId: { $in: itemIds }, isActive: true });
    const barcodeMap = {};
    barcodes.forEach(b => {
      if (!barcodeMap[b.itemId.toString()]) barcodeMap[b.itemId.toString()] = [];
      barcodeMap[b.itemId.toString()].push(b);
    });

    return items.map(item => {
      const obj = item.toObject();
      obj.barcodes = barcodeMap[item._id.toString()] || [];
      return obj;
    });
  },

  async getLabels(ids) {
    let idList = [];
    if (typeof ids === 'string') {
      idList = ids.split(',').map(s => s.trim()).filter(Boolean);
    } else if (Array.isArray(ids)) {
      idList = ids;
    }

    const query = idList.length > 0 ? { _id: { $in: idList } } : { isActive: true };
    const items = await Item.find(query).populate('categoryId', 'name');
    const itemIds = items.map(i => i._id);
    const barcodes = await Barcode.find({ itemId: { $in: itemIds }, isActive: true });

    const barcodeMap = {};
    barcodes.forEach(b => {
      if (!barcodeMap[b.itemId.toString()]) barcodeMap[b.itemId.toString()] = [];
      barcodeMap[b.itemId.toString()].push(b);
    });

    return items.map(item => {
      const bList = barcodeMap[item._id.toString()] || [];
      const primaryBarcode = bList.find(b => b.isPrimary) || bList[0];
      return {
        _id: item._id,
        itemCode: item.itemCode,
        name: item.name,
        brand: item.brand,
        model: item.model,
        unit: item.unit,
        unitPrice: item.unitPrice,
        category: item.categoryId?.name,
        itemType: item.itemType,
        barcode: primaryBarcode ? primaryBarcode.code : item.itemCode,
        barcodeType: primaryBarcode ? primaryBarcode.type : 'CODE-128',
        barcodes: bList,
      };
    });
  },

  async getById(id) {
    const item = await Item.findById(id).populate('categoryId', 'name');
    if (!item) throw new AppError('Item not found', 404, 'NOT_FOUND');

    const barcodes = await Barcode.find({ itemId: id, isActive: true });
    const obj = item.toObject();
    obj.barcodes = barcodes;

    // Enrich with current locations with resolved names & responsible managers
    const rawLocations = await stockService.getItemLocations(id);
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
        value: loc.quantity * item.unitPrice,
      });
    }

    obj.currentLocations = enrichedLocations;

    // Get last movement
    const history = await stockService.getItemHistory(id);
    obj.lastMovement = history[0] || null;

    return obj;
  },

  async create(data, req) {
    const itemCode = data.itemCode || await getNextSequence('item', 'ITM');
    const unitPrice = data.unitPrice !== undefined ? data.unitPrice : (data.currentCostPrice || data.purchasePrice || 0);

    const item = await Item.create({
      itemCode,
      name: data.name,
      description: data.description,
      categoryId: data.categoryId,
      brand: data.brand,
      model: data.model,
      unit: data.unit,
      unitPrice,
      minimumStock: data.minimumStock,
      imageUrl: data.imageUrl,
      itemType: data.itemType,
    });

    // Auto-generate internal barcode if no barcode provided (§7)
    if (!data.barcode) {
      const barcodeCode = await getNextSequence('barcode', 'ITM');
      await Barcode.create({
        itemId: item._id,
        code: barcodeCode,
        type: 'CODE-128',
        isPrimary: true,
      });
    } else {
      await Barcode.create({
        itemId: item._id,
        code: data.barcode,
        type: data.barcodeType || 'CODE-128',
        isPrimary: true,
      });
    }

    await auditService.log({
      userId: req.user._id,
      action: 'CREATE',
      entityType: 'Item',
      entityId: item._id,
      after: item.toJSON(),
      req,
    });

    // Optional Initial Stock Allocation (§7, §8, user requirement)
    // Recorded strictly through a confirmed RECEIPT movement into the chosen warehouse
    if (data.initialQuantity && Number(data.initialQuantity) > 0 && data.warehouseId) {
      const movementService = require('./movementService');
      await movementService.create({
        type: 'RECEIPT',
        toLocation: { kind: 'WAREHOUSE', id: data.warehouseId.toString() },
        referenceDocNumber: data.referenceDocNumber || 'INITIAL-STOCK',
        note: data.initialStockNote || `Initial stock allocated upon creation of ${item.name}`,
        lines: [
          { itemId: item._id, quantity: Number(data.initialQuantity) },
        ],
      }, req);
    }

    return this.getById(item._id);
  },

  async update(id, data, req) {
    const item = await Item.findById(id);
    if (!item) throw new AppError('Item not found', 404, 'NOT_FOUND');

    const before = item.toJSON();

    const allowedFields = [
      'name', 'description', 'categoryId', 'brand', 'model', 'unit',
      'unitPrice', 'minimumStock', 'imageUrl', 'itemType', 'isActive',
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) item[field] = data[field];
    }
    // Handle fallback if frontend sent currentCostPrice
    if (data.unitPrice === undefined && data.currentCostPrice !== undefined) {
      item.unitPrice = data.currentCostPrice;
    }

    await item.save();

    await auditService.log({
      userId: req.user._id,
      action: 'UPDATE',
      entityType: 'Item',
      entityId: item._id,
      before,
      after: item.toJSON(),
      req,
    });

    return this.getById(item._id);
  },
};

module.exports = itemService;

