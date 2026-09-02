const Supplier = require('../models/Supplier');
const auditService = require('./auditService');
const { AppError } = require('../middleware/errorHandler');

const supplierService = {
  /**
   * List suppliers with search, category filtering, and pagination.
   */
  async list(filters = {}, page = 1, limit = 100) {
    const query = {};

    if (filters.category && filters.category !== 'ALL') {
      query.category = filters.category;
    }

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive === 'true' || filters.isActive === true;
    }

    if (filters.search) {
      const searchRegex = new RegExp(filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { fullName: searchRegex },
        { company: searchRegex },
        { location: searchRegex },
        { phone: searchRegex },
        { phone2: searchRegex },
        { note: searchRegex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 100));
    const skip = (pageNum - 1) * limitNum;

    const [suppliers, total] = await Promise.all([
      Supplier.find(query)
        .populate('addedBy', 'fullName email role')
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Supplier.countDocuments(query),
    ]);

    return {
      suppliers,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    };
  },

  /**
   * Get single supplier by ID.
   */
  async getById(id) {
    const supplier = await Supplier.findById(id).populate('addedBy', 'fullName email role');
    if (!supplier) {
      throw new AppError('المورد غير موجود', 404, 'NOT_FOUND');
    }
    return supplier;
  },

  /**
   * Create new supplier (Admin only).
   */
  async create(data, userId, req) {
    const supplier = await Supplier.create({
      fullName: data.fullName,
      phone: data.phone,
      phone2: data.phone2 || undefined,
      category: data.category,
      company: data.company || undefined,
      location: data.location || undefined,
      note: data.note || undefined,
      isActive: data.isActive !== undefined ? data.isActive : true,
      addedBy: userId,
    });

    await auditService.log({
      userId,
      action: 'CREATE',
      entityType: 'Supplier',
      entityId: supplier._id,
      after: supplier.toObject(),
      req,
    });

    return supplier;
  },

  /**
   * Update existing supplier (Admin only).
   */
  async update(id, data, userId, req) {
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      throw new AppError('المورد غير موجود', 404, 'NOT_FOUND');
    }

    const before = supplier.toObject();

    const allowedFields = ['fullName', 'phone', 'phone2', 'category', 'company', 'location', 'note', 'isActive'];
    allowedFields.forEach((field) => {
      if (data[field] !== undefined) {
        supplier[field] = data[field];
      }
    });

    await supplier.save();

    await auditService.log({
      userId,
      action: 'UPDATE',
      entityType: 'Supplier',
      entityId: supplier._id,
      before,
      after: supplier.toObject(),
      req,
    });

    return supplier;
  },

  /**
   * Delete supplier (Admin only).
   */
  async delete(id, userId, req) {
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      throw new AppError('المورد غير موجود', 404, 'NOT_FOUND');
    }

    const before = supplier.toObject();
    await Supplier.findByIdAndDelete(id);

    await auditService.log({
      userId,
      action: 'DELETE',
      entityType: 'Supplier',
      entityId: id,
      before,
      req,
    });

    return { message: 'تم حذف المورد بنجاح' };
  },
};

module.exports = supplierService;
