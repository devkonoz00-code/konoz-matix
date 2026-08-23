const path = require('path');
const fs = require('fs');
const Item = require('../models/Item');
const Category = require('../models/Category');
const Barcode = require('../models/Barcode');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const { getNextSequence } = require('../utils/sequence');
const { escapeRegex } = require('../utils/sanitizeRegex');

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
      const safeSearch = escapeRegex(filters.search.trim());
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { itemCode: { $regex: safeSearch, $options: 'i' } },
        { brand: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const items = await Item.find(query)
      .populate('categoryId', 'name')
      .sort({ name: 1 })
      .lean();

    // Attach barcodes for each item
    const itemIds = items.map(i => i._id);
    const barcodes = await Barcode.find({ itemId: { $in: itemIds }, isActive: true }).lean();
    const barcodeMap = {};
    barcodes.forEach(b => {
      const key = b.itemId.toString();
      if (!barcodeMap[key]) barcodeMap[key] = [];
      barcodeMap[key].push(b);
    });

    return items.map(item => {
      item.barcodes = barcodeMap[item._id.toString()] || [];
      return item;
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
    const items = await Item.find(query).populate('categoryId', 'name').lean();
    const itemIds = items.map(i => i._id);
    const barcodes = await Barcode.find({ itemId: { $in: itemIds }, isActive: true }).lean();

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
    const rawQuery = (searchQuery || '').trim();

    // Normalization helper (supports French accents, Arabic variants, punctuation)
    const normalize = (text) => {
      if (!text) return '';
      return text
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/[يى]/g, 'ي')
        .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const normQuery = normalize(rawQuery);
    const tokens = normQuery ? normQuery.split(' ').filter(t => t.length > 0) : [];

    // Fetch active items from DB
    const dbItems = await Item.find({ isActive: true })
      .select('name itemCode categoryId unit unitPrice brand model')
      .populate('categoryId', 'name')
      .lean();

    const dbMap = new Map();
    dbItems.forEach(it => {
      dbMap.set(normalize(it.name), it);
    });

    const suggestions = [];
    const addedNormalizedNames = new Set();

    const calculateScore = (name) => {
      if (!normQuery) return 10;
      const normName = normalize(name);
      if (normName === normQuery) return 1000;
      if (normName.startsWith(normQuery)) return 800;

      const words = normName.split(' ');
      if (words.some(w => w.startsWith(normQuery))) return 600;
      if (normName.includes(normQuery)) return 400;

      if (tokens.length > 1 && tokens.every(t => normName.includes(t))) {
        const startsEveryToken = tokens.every(t => words.some(w => w.startsWith(t)));
        return startsEveryToken ? 350 : 250;
      }
      return 0;
    };

    // 1. Check CSV items
    for (const item of csvList) {
      const normName = normalize(item.name);
      const score = calculateScore(item.name);

      if (!normQuery || score > 0) {
        const existsInDb = dbMap.has(normName);
        const existing = existsInDb ? dbMap.get(normName) : null;
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
          score,
        });
        addedNormalizedNames.add(normName);
      }
    }

    // 2. Also check DB items not in CSV
    for (const it of dbItems) {
      const normName = normalize(it.name);
      if (!addedNormalizedNames.has(normName)) {
        const score = calculateScore(it.name);
        if (!normQuery || score > 0) {
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
            score,
          });
          addedNormalizedNames.add(normName);
        }
      }
    }

    // 3. Sort by Score descending, then alphabetically
    suggestions.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.name.localeCompare(b.name);
    });

    return suggestions.slice(0, 30).map(({ score, ...rest }) => rest);
  },
};

module.exports = itemService;


