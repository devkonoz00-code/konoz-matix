/**
 * Movement service.
 * Core of the system — handles all movement types with proper validation,
 * cost snapshot freezing from item.unitPrice, and MongoDB transactions for multi-location operations.
 */
const mongoose = require('mongoose');
const Movement = require('../models/Movement');
const MovementLine = require('../models/MovementLine');
const Item = require('../models/Item');
const Warehouse = require('../models/Warehouse');
const Project = require('../models/Project');
const ProjectAssignment = require('../models/ProjectAssignment');
const { AppError } = require('../middleware/errorHandler');
const { getNextSequence } = require('../utils/sequence');
const auditService = require('./auditService');
const notificationService = require('./notificationService');
const stockService = require('./stockService');

async function executeTransaction(callback) {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch (err) {
    session = null;
  }

  if (session) {
    try {
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } else {
    return callback(null);
  }
}

const movementService = {
  async list(filters = {}) {
    const query = {};
    if (filters.projectId) {
      query.$or = [
        { 'fromLocation.id': new mongoose.Types.ObjectId(filters.projectId), 'fromLocation.kind': 'PROJECT' },
        { 'toLocation.id': new mongoose.Types.ObjectId(filters.projectId), 'toLocation.kind': 'PROJECT' },
        { projectId: filters.projectId },
      ];
    }
    if (filters.type) query.type = filters.type;
    if (filters.status) query.status = filters.status;

    return Movement.find(query)
      .populate('createdBy', 'fullName email')
      .populate('approvedBy', 'fullName email')
      .populate('receivedBy', 'fullName email')
      .populate('projectId', 'projectCode name')
      .populate('companyDocumentId', 'documentNumber documentType')
      .sort({ createdAt: -1 });
  },

  async getById(id) {
    const movement = await Movement.findById(id)
      .populate('createdBy', 'fullName email role')
      .populate('approvedBy', 'fullName email')
      .populate('receivedBy', 'fullName email')
      .populate('projectId', 'projectCode name')
      .populate('requestId', 'requestNumber status')
      .populate('companyDocumentId', 'documentNumber documentType documentDate');

    if (!movement) throw new AppError('Movement not found', 404, 'NOT_FOUND');

    const lines = await MovementLine.find({ movementId: id })
      .populate('itemId', 'itemCode name unit imageUrl unitPrice')
      .populate('barcodeId', 'code type');

    return { movement, lines };
  },

  /**
   * Create a movement (RECEIPT, ISSUE, ADJUSTMENT).
   * RECEIPT and ADJUSTMENT auto-confirm. ISSUE can auto-confirm or start as PENDING.
   */
  async createMovement(data, req) {
    // 1. Role validation for RECEIPT (§8, §14)
    if (data.type === 'RECEIPT') {
      if (!['ADMIN', 'WAREHOUSE_MANAGER', 'SUPERVISOR'].includes(req.user.role)) {
        throw new AppError('Only ADMIN, WAREHOUSE_MANAGER, and SUPERVISOR can record stock receipts', 403, 'FORBIDDEN');
      }
      if (!data.toLocation || data.toLocation.kind !== 'WAREHOUSE' || !data.toLocation.id) {
        throw new AppError('A destination warehouse (المحل or المخزن) is required for receiving stock', 400, 'WAREHOUSE_REQUIRED');
      }
      const wh = await Warehouse.findById(data.toLocation.id);
      if (!wh) throw new AppError('Destination warehouse not found', 404, 'NOT_FOUND');
    }

    if (!data.lines || data.lines.length === 0) {
      throw new AppError('At least one item line is required', 400, 'EMPTY_LINES');
    }

    const movementId = await executeTransaction(async (session) => {
      const movementNumber = await getNextSequence('movement', 'MOV');

      // Validate items and build lines with frozen costs from item.unitPrice
      const lines = [];
      for (const lineData of data.lines) {
        if (typeof lineData.quantity !== 'number' || isNaN(lineData.quantity) || lineData.quantity <= 0) {
          throw new AppError('Quantity must be a positive number', 400, 'INVALID_QUANTITY');
        }

        const item = session
          ? await Item.findById(lineData.itemId).session(session)
          : await Item.findById(lineData.itemId);
        if (!item) throw new AppError(`Item not found: ${lineData.itemId}`, 404, 'NOT_FOUND');

        const unitCost = item.unitPrice;
        lines.push({
          itemId: item._id,
          barcodeId: lineData.barcodeId || undefined,
          quantity: lineData.quantity,
          unitCostSnapshot: unitCost,
          totalCost: unitCost * lineData.quantity,
          note: lineData.note,
        });
      }

      // Validate stock availability for ISSUE and outbound ADJUSTMENT (§8)
      if (data.type === 'ISSUE' && data.fromLocation) {
        for (const line of lines) {
          const available = await stockService.getStockAtLocation(
            line.itemId, data.fromLocation.kind, data.fromLocation.id
          );
          const item = await Item.findById(line.itemId);
          if (available <= 0) {
            throw new AppError(
              `Item "${item.name}" is out of stock at this location`,
              400, 'OUT_OF_STOCK'
            );
          }
          if (available < line.quantity) {
            throw new AppError(
              `Insufficient stock for ${item.name}. Available: ${available} ${item.unit}, Requested: ${line.quantity}`,
              400, 'INSUFFICIENT_STOCK'
            );
          }
        }
      }

      // Determine auto-confirm status (§8)
      // RECEIPT and ADJUSTMENT resolve immediately. ISSUE, TRANSFER, and RETURN start as PENDING.
      const autoConfirm = ['RECEIPT', 'ADJUSTMENT'].includes(data.type) || Boolean(data.autoConfirm);

      const movementPayload = {
        movementNumber,
        type: data.type,
        fromLocation: data.fromLocation || null,
        toLocation: data.toLocation || null,
        projectId: data.projectId || (data.toLocation?.kind === 'PROJECT' ? data.toLocation.id : undefined),
        requestId: data.requestId,
        companyDocumentId: data.companyDocumentId,
        createdBy: req.user._id,
        approvedBy: autoConfirm ? req.user._id : undefined,
        receivedBy: autoConfirm ? req.user._id : undefined,
        status: autoConfirm ? 'CONFIRMED' : 'PENDING',
        note: data.note,
      };

      const [movement] = session
        ? await Movement.create([movementPayload], { session })
        : await Movement.create([movementPayload]);

      const movementLines = lines.map(l => ({ ...l, movementId: movement._id }));
      await MovementLine.insertMany(movementLines, session ? { session } : {});

      // Audit log
      const auditAction = data.type === 'ISSUE' ? 'ISSUE' : 'CREATE';
      await auditService.log({
        userId: req.user._id,
        action: auditAction,
        entityType: 'Movement',
        entityId: movement._id,
        after: { movementNumber, type: data.type, status: movement.status, linesCount: lines.length },
        req,
      });

      return movement._id;
    });

    return this.getById(movementId);
  },

  /**
   * Create a TRANSFER movement (Project A → Project B).
   * Always starts as PENDING; destination must confirm.
   */
  async createTransfer(data, req) {
    if (!data.fromLocation?.id || !data.toLocation?.id) {
      throw new AppError('Source and destination project locations are required', 400, 'LOCATIONS_REQUIRED');
    }
    if (data.fromLocation.id.toString() === data.toLocation.id.toString()) {
      throw new AppError('Source and destination project cannot be the same', 400, 'SAME_LOCATION');
    }

    if (!data.lines || data.lines.length === 0) {
      throw new AppError('At least one item line is required for transfer', 400, 'EMPTY_LINES');
    }

    const movementId = await executeTransaction(async (session) => {
      const movementNumber = await getNextSequence('movement', 'TRF');

      const lines = [];
      for (const lineData of data.lines) {
        if (typeof lineData.quantity !== 'number' || isNaN(lineData.quantity) || lineData.quantity <= 0) {
          throw new AppError('Quantity must be a positive number', 400, 'INVALID_QUANTITY');
        }

        const item = session
          ? await Item.findById(lineData.itemId).session(session)
          : await Item.findById(lineData.itemId);
        if (!item) throw new AppError(`Item not found: ${lineData.itemId}`, 404, 'NOT_FOUND');

        // Validate stock at source project atomically
        const available = await stockService.getStockAtLocation(
          item._id, 'PROJECT', data.fromLocation.id
        );
        if (available <= 0) {
          throw new AppError(
            `Item "${item.name}" is out of stock at source project`,
            400, 'OUT_OF_STOCK'
          );
        }
        if (available < lineData.quantity) {
          throw new AppError(
            `Insufficient stock for ${item.name} at source project. Available: ${available} ${item.unit}, Requested: ${lineData.quantity}`,
            400, 'INSUFFICIENT_STOCK'
          );
        }

        const unitCost = item.unitPrice;
        lines.push({
          itemId: item._id,
          barcodeId: lineData.barcodeId,
          quantity: lineData.quantity,
          unitCostSnapshot: unitCost,
          totalCost: unitCost * lineData.quantity,
          note: lineData.note,
        });
      }

      const transferPayload = {
        movementNumber,
        type: 'TRANSFER',
        fromLocation: { kind: 'PROJECT', id: data.fromLocation.id },
        toLocation: { kind: 'PROJECT', id: data.toLocation.id },
        projectId: data.fromLocation.id,
        createdBy: req.user._id,
        status: 'PENDING',
        note: data.note,
      };

      const [movement] = session
        ? await Movement.create([transferPayload], { session })
        : await Movement.create([transferPayload]);

      const movementLines = lines.map(l => ({ ...l, movementId: movement._id }));
      await MovementLine.insertMany(movementLines, session ? { session } : {});

      await auditService.log({
        userId: req.user._id,
        action: 'TRANSFER',
        entityType: 'Movement',
        entityId: movement._id,
        after: { movementNumber, type: 'TRANSFER', status: 'PENDING' },
        req,
      });

      return movement._id;
    });

    return this.getById(movementId);
  },

  /**
   * Create a RETURN movement (Project → Warehouse).
   * Starts as PENDING; warehouse must confirm.
   */
  async createReturn(data, req) {
    if (!data.fromLocation?.id || !data.toLocation?.id) {
      throw new AppError('Source project and destination warehouse are required', 400, 'LOCATIONS_REQUIRED');
    }

    if (!data.lines || data.lines.length === 0) {
      throw new AppError('At least one item line is required for return', 400, 'EMPTY_LINES');
    }

    const movementId = await executeTransaction(async (session) => {
      const movementNumber = await getNextSequence('movement', 'RET');

      const lines = [];
      for (const lineData of data.lines) {
        if (typeof lineData.quantity !== 'number' || isNaN(lineData.quantity) || lineData.quantity <= 0) {
          throw new AppError('Quantity must be a positive number', 400, 'INVALID_QUANTITY');
        }

        const item = session
          ? await Item.findById(lineData.itemId).session(session)
          : await Item.findById(lineData.itemId);
        if (!item) throw new AppError(`Item not found: ${lineData.itemId}`, 404, 'NOT_FOUND');

        const available = await stockService.getStockAtLocation(
          item._id, 'PROJECT', data.fromLocation.id
        );
        if (available <= 0) {
          throw new AppError(
            `Item "${item.name}" is out of stock at source project`,
            400, 'OUT_OF_STOCK'
          );
        }
        if (available < lineData.quantity) {
          throw new AppError(
            `Insufficient stock for ${item.name} at project. Available: ${available} ${item.unit}, Requested: ${lineData.quantity}`,
            400, 'INSUFFICIENT_STOCK'
          );
        }

        const unitCost = item.unitPrice;
        lines.push({
          itemId: item._id,
          barcodeId: lineData.barcodeId,
          quantity: lineData.quantity,
          unitCostSnapshot: unitCost,
          totalCost: unitCost * lineData.quantity,
          note: lineData.note,
        });
      }

      const returnPayload = {
        movementNumber,
        type: 'RETURN',
        fromLocation: { kind: 'PROJECT', id: data.fromLocation.id },
        toLocation: { kind: 'WAREHOUSE', id: data.toLocation.id },
        projectId: data.fromLocation.id,
        createdBy: req.user._id,
        status: 'PENDING',
        note: data.note,
      };

      const [movement] = session
        ? await Movement.create([returnPayload], { session })
        : await Movement.create([returnPayload]);

      const movementLines = lines.map(l => ({ ...l, movementId: movement._id }));
      await MovementLine.insertMany(movementLines, session ? { session } : {});

      await auditService.log({
        userId: req.user._id,
        action: 'RETURN',
        entityType: 'Movement',
        entityId: movement._id,
        after: { movementNumber, type: 'RETURN', status: 'PENDING' },
        req,
      });

      return movement._id;
    });

    return this.getById(movementId);
  },

  /**
   * Confirm a PENDING movement (ISSUE, TRANSFER or RETURN).
   * Sets status to CONFIRMED, records receivedBy.
   */
  async confirmMovement(id, req) {
    const movement = await Movement.findById(id);
    if (!movement) throw new AppError('Movement not found', 404, 'NOT_FOUND');

    if (movement.status !== 'PENDING') {
      throw new AppError('Only PENDING movements can be confirmed', 400, 'INVALID_STATUS');
    }

    const before = movement.toJSON();
    movement.status = 'CONFIRMED';
    movement.receivedBy = req.user._id;
    if (!movement.approvedBy) movement.approvedBy = req.user._id;
    await movement.save();

    await auditService.log({
      userId: req.user._id,
      action: 'RECEIVE',
      entityType: 'Movement',
      entityId: movement._id,
      before,
      after: movement.toJSON(),
      req,
    });

    return this.getById(movement._id);
  },

  /**
   * Unified movement creation interface.
   */
  async create(data, req) {
    if (data.type === 'TRANSFER') {
      return this.createTransfer(data, req);
    }
    if (data.type === 'RETURN') {
      return this.createReturn(data, req);
    }
    return this.createMovement(data, req);
  },

  /**
   * Cancel a PENDING movement.
   */
  async cancelMovement(id, req) {
    const movement = await Movement.findById(id);
    if (!movement) throw new AppError('Movement not found', 404, 'NOT_FOUND');

    if (movement.status !== 'PENDING') {
      throw new AppError('Only PENDING movements can be cancelled', 400, 'INVALID_STATUS');
    }

    const before = movement.toJSON();
    movement.status = 'CANCELLED';
    await movement.save();

    await auditService.log({
      userId: req.user._id,
      action: 'UPDATE',
      entityType: 'Movement',
      entityId: movement._id,
      before,
      after: movement.toJSON(),
      req,
    });

    return this.getById(movement._id);
  },
};

module.exports = movementService;

