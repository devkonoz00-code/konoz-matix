/**
 * Material Request service.
 * Handles request lifecycle: DRAFT → SUBMITTED → APPROVED → FULFILLED.
 * Creating a request NEVER changes location or stock.
 */
const MaterialRequest = require('../models/MaterialRequest');
const MaterialRequestLine = require('../models/MaterialRequestLine');
const Item = require('../models/Item');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const { getNextSequence } = require('../utils/sequence');
const auditService = require('./auditService');
const notificationService = require('./notificationService');

const VALID_TRANSITIONS = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'FULFILLED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED'],
  PARTIALLY_FULFILLED: ['FULFILLED', 'CANCELLED'],
  FULFILLED: [],
  REJECTED: [],
  CANCELLED: [],
};

const requestService = {
  async list(filters = {}, user = null) {
    const query = {};
    if (filters.projectId) query.projectId = filters.projectId;
    if (filters.status) {
      if (filters.status.includes(',')) {
        query.status = { $in: filters.status.split(',').map((s) => s.trim()) };
      } else {
        query.status = filters.status;
      }
    }
    if (filters.requestType) query.requestType = filters.requestType;

    // WORKER role can only see their own requests
    if (user && user.role === 'WORKER') {
      query.requestedBy = user._id;
    } else if (filters.requestedBy) {
      query.requestedBy = filters.requestedBy;
    }

    return MaterialRequest.find(query)
      .populate('projectId', 'projectCode name location')
      .populate('requestedBy', 'fullName email phone role')
      .populate('seenBy.user', 'fullName role')
      .populate('processedBy', 'fullName role')
      .sort({ createdAt: -1 })
      .lean();
  },

  async getById(id, user = null) {
    const request = await MaterialRequest.findById(id)
      .populate('projectId', 'projectCode name location')
      .populate('requestedBy', 'fullName email phone role')
      .populate('seenBy.user', 'fullName role')
      .populate('processedBy', 'fullName role')
      .lean();

    if (!request) throw new AppError('Request not found', 404, 'NOT_FOUND');

    // If requester is WORKER, ensure they own the request
    if (user && user.role === 'WORKER' && String(request.requestedBy?._id || request.requestedBy) !== String(user._id)) {
      throw new AppError('Access denied to this request', 403, 'FORBIDDEN');
    }

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

  /**
   * Fast Messenger-style request creation for workshop workers.
   * Instantly creates and submits the request, notifying all supervisors & admins.
   */
  async createQuickRequest(data, req) {
    if (!data.projectId) {
      throw new AppError('الرجاء اختيار المشروع / الورشة', 400, 'PROJECT_REQUIRED');
    }
    if (!data.textContent || !data.textContent.trim()) {
      throw new AppError('الرجاء كتابة المواد أو الأدوات المطلوبة', 400, 'TEXT_CONTENT_REQUIRED');
    }

    const requestNumber = await getNextSequence('request', 'REQ');

    const request = await MaterialRequest.create({
      requestNumber,
      requestType: 'WORKSHOP_QUICK',
      projectId: data.projectId,
      requestedBy: req.user._id,
      priority: data.priority || 'NORMAL',
      status: 'SUBMITTED', // Immediate submission for instant supervisor review
      textContent: data.textContent.trim(),
      photoUrls: Array.isArray(data.photoUrls) ? data.photoUrls.filter(Boolean) : (data.photoUrl ? [data.photoUrl] : []),
      note: data.note || '',
    });

    // Populate project name for notification message
    const populated = await MaterialRequest.findById(request._id)
      .populate('projectId', 'projectCode name')
      .populate('requestedBy', 'fullName')
      .lean();

    const workerName = populated.requestedBy?.fullName || req.user.fullName || 'العامل';
    const projectName = populated.projectId?.name || 'الورشة';

    // Broadcast in-app notification to all Admins and Supervisors
    try {
      const supervisorsAndAdmins = await User.find({
        role: { $in: ['ADMIN', 'SUPERVISOR', 'WAREHOUSE_MANAGER'] },
        isActive: true,
      }).select('_id');

      const notifPromises = supervisorsAndAdmins.map((u) =>
        notificationService.create({
          userId: u._id,
          type: 'WORKER_QUICK_REQUEST',
          message: `📩 طلب مواد جديد من ${workerName} لمشروع "${projectName}": ${data.textContent.slice(0, 60)}...`,
          relatedEntityType: 'MaterialRequest',
          relatedEntityId: request._id,
        })
      );
      await Promise.all(notifPromises);
    } catch (notifErr) {
      console.error('Notification dispatch failed for quick request:', notifErr.message);
    }

    await auditService.log({
      userId: req.user._id,
      action: 'CREATE_QUICK_REQUEST',
      entityType: 'MaterialRequest',
      entityId: request._id,
      after: { requestNumber, status: 'SUBMITTED', requestType: 'WORKSHOP_QUICK' },
      req,
    });

    return this.getById(request._id, req.user);
  },

  /**
   * Mark a request as seen/read by a supervisor or admin.
   * Does NOT alter the request status, but records who saw it and when.
   */
  async markAsSeen(id, req) {
    const request = await MaterialRequest.findById(id);
    if (!request) throw new AppError('Request not found', 404, 'NOT_FOUND');

    // Only mark seen if the viewer is not the requester
    if (String(request.requestedBy) !== String(req.user._id)) {
      const alreadySeen = request.seenBy.some(
        (s) => String(s.user) === String(req.user._id)
      );

      if (!alreadySeen) {
        request.seenBy.push({
          user: req.user._id,
          seenAt: new Date(),
        });
        await request.save();
      }
    }

    return this.getById(request._id, req.user);
  },

  /**
   * Fast Validation (VALIDE) by supervisor or admin after purchasing/delivering materials.
   * Transitions request directly to FULFILLED and archives it.
   */
  async validateQuickRequest(id, data = {}, req) {
    const request = await MaterialRequest.findById(id)
      .populate('projectId', 'name')
      .populate('requestedBy', 'fullName');

    if (!request) throw new AppError('Request not found', 404, 'NOT_FOUND');

    if (['FULFILLED', 'CANCELLED', 'REJECTED'].includes(request.status)) {
      throw new AppError(`الطلب بحالة "${request.status}" بالفعل ولا يمكن معالجته مجدداً.`, 400, 'ALREADY_PROCESSED');
    }

    const before = request.toJSON();

    request.status = 'FULFILLED';
    request.processedBy = req.user._id;
    request.processedAt = new Date();
    if (data.processingNote || data.note) {
      request.processingNote = (data.processingNote || data.note).trim();
    }

    // Ensure validator is also added to seenBy if not already
    if (!request.seenBy.some((s) => String(s.user) === String(req.user._id))) {
      request.seenBy.push({ user: req.user._id, seenAt: new Date() });
    }

    await request.save();

    // Notify the worker that their request has been fulfilled
    try {
      if (request.requestedBy?._id) {
        await notificationService.create({
          userId: request.requestedBy._id,
          type: 'REQUEST_VALIDATED',
          message: `✅ تمت معالجة وتأكيد طلبك للمشروع "${request.projectId?.name || ''}" بنجاح (VALIDÉ).`,
          relatedEntityType: 'MaterialRequest',
          relatedEntityId: request._id,
        });
      }
    } catch (notifErr) {
      console.error('Failed to notify requester:', notifErr.message);
    }

    await auditService.log({
      userId: req.user._id,
      action: 'VALIDATE_QUICK_REQUEST',
      entityType: 'MaterialRequest',
      entityId: request._id,
      before,
      after: request.toJSON(),
      req,
    });

    return this.getById(request._id, req.user);
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


