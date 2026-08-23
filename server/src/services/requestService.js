/**
 * Material Request service.
 * Handles request lifecycle: DRAFT → SUBMITTED → APPROVED → FULFILLED.
 * Creating a request NEVER changes location or stock.
 */
const MaterialRequest = require('../models/MaterialRequest');
const MaterialRequestLine = require('../models/MaterialRequestLine');
const Item = require('../models/Item');
const { AppError } = require('../middleware/errorHandler');
const { getNextSequence } = require('../utils/sequence');
const auditService = require('./auditService');
const notificationService = require('./notificationService');

const VALID_TRANSITIONS = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED'],
  PARTIALLY_FULFILLED: ['FULFILLED', 'CANCELLED'],
  FULFILLED: [],
  REJECTED: [],
  CANCELLED: [],
};

const requestService = {
  async list(filters = {}) {
    const query = {};
    if (filters.projectId) query.projectId = filters.projectId;
    if (filters.status) query.status = filters.status;
    if (filters.requestedBy) query.requestedBy = filters.requestedBy;

    return MaterialRequest.find(query)
      .populate('projectId', 'projectCode name')
      .populate('requestedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();
  },

  async getById(id) {
    const request = await MaterialRequest.findById(id)
      .populate('projectId', 'projectCode name')
      .populate('requestedBy', 'fullName email role')
      .lean();

    if (!request) throw new AppError('Request not found', 404, 'NOT_FOUND');

    const lines = await MaterialRequestLine.find({ requestId: id })
      .populate('itemId', 'itemCode name unit unitPrice imageUrl')
      .lean();

    return { request, lines };
  },

  async create(data, req) {
    const requestNumber = await getNextSequence('request', 'REQ');

    const request = await MaterialRequest.create({
      requestNumber,
      projectId: data.projectId,
      requestedBy: req.user._id,
      priority: data.priority || 'NORMAL',
      status: 'DRAFT',
      note: data.note,
    });

    // Create request lines
    if (data.lines && data.lines.length > 0) {
      const lines = [];
      for (const lineData of data.lines) {
        const item = await Item.findById(lineData.itemId);
        if (!item) throw new AppError(`Item not found: ${lineData.itemId}`, 404, 'NOT_FOUND');

        lines.push({
          requestId: request._id,
          itemId: lineData.itemId,
          requestedQuantity: lineData.requestedQuantity,
          unitCostSnapshot: item.unitPrice,
          note: lineData.note,
        });
      }
      await MaterialRequestLine.create(lines);
    }

    await auditService.log({
      userId: req.user._id,
      action: 'CREATE',
      entityType: 'MaterialRequest',
      entityId: request._id,
      after: { requestNumber, status: 'DRAFT' },
      req,
    });

    return this.getById(request._id);
  },

  async updateStatus(id, newStatus, data, req) {
    const request = await MaterialRequest.findById(id);
    if (!request) throw new AppError('Request not found', 404, 'NOT_FOUND');

    if (!VALID_TRANSITIONS[request.status].includes(newStatus)) {
      throw new AppError(
        `Cannot transition from ${request.status} to ${newStatus}`,
        400, 'INVALID_TRANSITION'
      );
    }

    const before = request.toJSON();
    request.status = newStatus;
    if (data && data.note) request.note = data.note;
    await request.save();

    // If approving, set approvedQuantity on lines
    if (newStatus === 'APPROVED' && data && data.lines) {
      for (const lineUpdate of data.lines) {
        await MaterialRequestLine.findByIdAndUpdate(lineUpdate.lineId, {
          approvedQuantity: lineUpdate.approvedQuantity,
        });
      }
    }

    const auditAction = newStatus === 'APPROVED' ? 'APPROVE' : 'UPDATE';
    await auditService.log({
      userId: req.user._id,
      action: auditAction,
      entityType: 'MaterialRequest',
      entityId: request._id,
      before,
      after: request.toJSON(),
      req,
    });

    return this.getById(request._id);
  },
};

module.exports = requestService;

