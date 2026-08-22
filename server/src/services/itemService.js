const path = require('path');
const fs = require('fs');
const Item = require('../models/Item');
const Category = require('../models/Category');
const Barcode = require('../models/Barcode');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const { getNextSequence } = require('../utils/sequence');

const Warehouse = require('../models/Warehouse');
const Project = require('../models/Project');
const ProjectAssignment = require('../models/ProjectAssignment');
const stockService = require('./stockService');

let csvArticlesCache = null;
let csvArticlesLastLoaded = 0;

function loadCsvArticles() {
  const possiblePaths = [
    path.resolve(__dirname, '../../../data/mm ADMIN.csv'),
    path.resolve(process.cwd(), 'data/mm ADMIN.csv'),
    'E:\\MATIX\\data\\mm ADMIN.csv'
  ];

  for (const csvPath of possiblePaths) {
    try {
      if (fs.existsSync(csvPath)) {
        const raw = fs.readFileSync(csvPath, 'latin1');
        const lines = raw.split(/\r?\n/).filter(l => l.trim());
        const set = new Set();
        const list = [];
        // Line 0 is header
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(';');
          const article = (cols[1] || '').trim();
          if (article && !set.has(article.toLowerCase())) {
            set.add(article.toLowerCase());
            list.push({
              name: article,
              code: (cols[2] || '').trim(),
              unitPrice: parseFloat((cols[5] || cols[6] || '0').replace(',', '.')) || 0,
            });
          }
        }
        csvArticlesCache = list;
        csvArticlesLastLoaded = Date.now();
        return list;
      }
    } catch (err) {
      console.warn(`[itemService] Failed to load CSV from ${csvPath}:`, err.message);
    }
  }

  return [];
}

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

  async delete(id, req) {
    const item = await Item.findById(id);
    if (!item) throw new AppError('Item not found', 404, 'NOT_FOUND');

    const before = item.toJSON();
    item.isActive = false;
    await item.save();

    // Deactivate associated barcodes
    await Barcode.updateMany({ itemId: id }, { isActive: false });

    await auditService.log({
      userId: req.user._id,
      action: 'DELETE',
      entityType: 'Item',
      entityId: item._id,
      before,
      req,
    });

    return { success: true, message: 'Item deleted successfully' };
  },

  async getArticleSuggestions(searchQuery = '') {
    if (!csvArticlesCache || (Date.now() - csvArticlesLastLoaded > 5 * 60 * 1000)) {
      loadCsvArticles();
    }
    const csvList = csvArticlesCache || [];
    const q = (searchQuery || '').trim().toLowerCase();

    // Fetch active items from DB
    const dbItems = await Item.find({ isActive: true })
      .select('name itemCode categoryId unit unitPrice brand model')
      .populate('categoryId', 'name')
      .lean();

    const dbMap = new Map();
    dbItems.forEach(it => {
      dbMap.set(it.name.trim().toLowerCase(), it);
    });

    const suggestions = [];
    const addedNames = new Set();

    // 1. Filter CSV items matching query
    for (const item of csvList) {
      const lowerName = item.name.toLowerCase();
      if (!q || lowerName.includes(q)) {
        const existsInDb = dbMap.has(lowerName);
        const existing = existsInDb ? dbMap.get(lowerName) : null;
        suggestions.push({
          name: item.name,
          code: item.code || null,
          existsInDb,
          existingItem: existing ? {
            _id: existing._id,
            itemCode: existing.itemCode,
            name: existing.name,
            unit: existing.unit,
            unitPrice: existing.unitPrice,
            category: existing.categoryId?.name || null,
            categoryId: existing.categoryId?._id || existing.categoryId,
            brand: existing.brand || null,
          } : null,
        });
        addedNames.add(lowerName);
        if (suggestions.length >= 60) break;
      }
    }

    // 2. Also include DB items matching query that weren't in CSV
    for (const it of dbItems) {
      const lowerName = it.name.trim().toLowerCase();
      if ((!q || lowerName.includes(q)) && !addedNames.has(lowerName)) {
        suggestions.push({
          name: it.name,
          code: it.itemCode || null,
          existsInDb: true,
          existingItem: {
            _id: it._id,
            itemCode: it.itemCode,
            name: it.name,
            unit: it.unit,
            unitPrice: it.unitPrice,
            category: it.categoryId?.name || null,
            categoryId: it.categoryId?._id || it.categoryId,
            brand: it.brand || null,
          },
        });
        addedNames.add(lowerName);
        if (suggestions.length >= 60) break;
      }
    }

    // 3. Sort suggestions: exact match first, then prefix match, then includes match
    if (q) {
      suggestions.sort((a, b) => {
        const aLower = a.name.toLowerCase();
        const bLower = b.name.toLowerCase();
        const aExact = aLower === q ? 1 : 0;
        const bExact = bLower === q ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;

        const aStarts = aLower.startsWith(q) ? 1 : 0;
        const bStarts = bLower.startsWith(q) ? 1 : 0;
        if (aStarts !== bStarts) return bStarts - aStarts;

        return aLower.localeCompare(bLower);
      });
    }

    return suggestions.slice(0, 30);
  },
};

module.exports = itemService;


