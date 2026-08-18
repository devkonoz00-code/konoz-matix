/**
 * Stock service.
 * Derives current stock/location and financial figures dynamically from confirmed movement lines.
 * NEVER stores or mutates a stock balance directly.
 */
const Movement = require('../models/Movement');
const MovementLine = require('../models/MovementLine');
const Item = require('../models/Item');
const mongoose = require('mongoose');

const stockService = {
  /**
   * Get current stock of an item at a specific location.
   * Stock = SUM(qty received at location) - SUM(qty sent from location)
   */
  async getStockAtLocation(itemId, locationKind, locationId) {
    if (!itemId || !locationKind || !locationId) return 0;

    const itemObjectId = new mongoose.Types.ObjectId(itemId.toString());
    const locationObjectId = new mongoose.Types.ObjectId(locationId.toString());

    const inbound = await MovementLine.aggregate([
      {
        $lookup: {
          from: 'movements',
          localField: 'movementId',
          foreignField: '_id',
          as: 'movement',
        },
      },
      { $unwind: '$movement' },
      {
        $match: {
          'itemId': itemObjectId,
          'movement.status': 'CONFIRMED',
          'movement.toLocation.kind': locationKind,
          'movement.toLocation.id': locationObjectId,
        },
      },
      { $group: { _id: null, total: { $sum: '$quantity' } } },
    ]);

    const outbound = await MovementLine.aggregate([
      {
        $lookup: {
          from: 'movements',
          localField: 'movementId',
          foreignField: '_id',
          as: 'movement',
        },
      },
      { $unwind: '$movement' },
      {
        $match: {
          'itemId': itemObjectId,
          'movement.status': 'CONFIRMED',
          'movement.fromLocation.kind': locationKind,
          'movement.fromLocation.id': locationObjectId,
        },
      },
      { $group: { _id: null, total: { $sum: '$quantity' } } },
    ]);

    const totalIn = inbound[0]?.total || 0;
    const totalOut = outbound[0]?.total || 0;
    const balance = totalIn - totalOut;
    return balance > 0 ? balance : 0;
  },

  /**
   * Get all stock positions for an item across all locations.
   * Returns array of { locationKind, locationId, quantity }.
   */
  async getItemLocations(itemId) {
    if (!itemId) return [];
    const itemObjectId = new mongoose.Types.ObjectId(itemId.toString());

    const pipeline = [
      {
        $lookup: {
          from: 'movements',
          localField: 'movementId',
          foreignField: '_id',
          as: 'movement',
        },
      },
      { $unwind: '$movement' },
      { $match: { 'itemId': itemObjectId, 'movement.status': 'CONFIRMED' } },
      {
        $facet: {
          inbound: [
            { $match: { 'movement.toLocation': { $ne: null } } },
            {
              $group: {
                _id: { kind: '$movement.toLocation.kind', id: '$movement.toLocation.id' },
                total: { $sum: '$quantity' },
              },
            },
          ],
          outbound: [
            { $match: { 'movement.fromLocation': { $ne: null } } },
            {
              $group: {
                _id: { kind: '$movement.fromLocation.kind', id: '$movement.fromLocation.id' },
                total: { $sum: '$quantity' },
              },
            },
          ],
        },
      },
    ];

    const [result] = await MovementLine.aggregate(pipeline);
    const balanceMap = {};

    (result.inbound || []).forEach(r => {
      if (r._id && r._id.kind && r._id.id) {
        const key = `${r._id.kind}:${r._id.id}`;
        balanceMap[key] = (balanceMap[key] || 0) + r.total;
      }
    });

    (result.outbound || []).forEach(r => {
      if (r._id && r._id.kind && r._id.id) {
        const key = `${r._id.kind}:${r._id.id}`;
        balanceMap[key] = (balanceMap[key] || 0) - r.total;
      }
    });

    return Object.entries(balanceMap)
      .filter(([, qty]) => qty > 0)
      .map(([key, quantity]) => {
        const [kind, id] = key.split(':');
        return { locationKind: kind, locationId: id, quantity };
      });
  },

  /**
   * Get all items and their quantities at a specific location.
   */
  async getLocationInventory(locationKind, locationId) {
    if (!locationId) return [];
    const locationObjectId = new mongoose.Types.ObjectId(locationId.toString());

    const inbound = await MovementLine.aggregate([
      {
        $lookup: {
          from: 'movements',
          localField: 'movementId',
          foreignField: '_id',
          as: 'movement',
        },
      },
      { $unwind: '$movement' },
      {
        $match: {
          'movement.status': 'CONFIRMED',
          'movement.toLocation.kind': locationKind,
          'movement.toLocation.id': locationObjectId,
        },
      },
      {
        $group: {
          _id: '$itemId',
          totalIn: { $sum: '$quantity' },
          totalValue: { $sum: '$totalCost' },
        },
      },
    ]);

    const outbound = await MovementLine.aggregate([
      {
        $lookup: {
          from: 'movements',
          localField: 'movementId',
          foreignField: '_id',
          as: 'movement',
        },
      },
      { $unwind: '$movement' },
      {
        $match: {
          'movement.status': 'CONFIRMED',
          'movement.fromLocation.kind': locationKind,
          'movement.fromLocation.id': locationObjectId,
        },
      },
      {
        $group: {
          _id: '$itemId',
          totalOut: { $sum: '$quantity' },
          totalValueOut: { $sum: '$totalCost' },
        },
      },
    ]);

    const outMap = {};
    outbound.forEach(o => {
      outMap[o._id.toString()] = { qty: o.totalOut, value: o.totalValueOut };
    });

    return inbound
      .map(i => {
        const out = outMap[i._id.toString()] || { qty: 0, value: 0 };
        const quantity = i.totalIn - out.qty;
        const value = i.totalValue - out.value;
        return {
          itemId: i._id,
          quantity: quantity > 0 ? quantity : 0,
          value: value > 0 ? value : 0,
        };
      })
      .filter(i => i.quantity > 0);
  },

  /**
   * Get total material value currently at a location (Current Value).
   */
  async getLocationValue(locationKind, locationId) {
    const inventory = await this.getLocationInventory(locationKind, locationId);
    return inventory.reduce((sum, i) => sum + (i.value || 0), 0);
  },

  /**
   * Get Current Value for a project (materials currently held).
   */
  async getProjectCurrentValue(projectId) {
    return this.getLocationValue('PROJECT', projectId);
  },

  /**
   * Get Total Consumption for a project (§9):
   * Cumulative value of everything ever issued or transferred INTO that project,
   * regardless of later returns or transfers out (sum of totalCost for all inbound confirmed lines).
   */
  async getProjectTotalConsumption(projectId) {
    if (!projectId) return 0;
    const projectObjectId = new mongoose.Types.ObjectId(projectId.toString());

    const result = await MovementLine.aggregate([
      {
        $lookup: {
          from: 'movements',
          localField: 'movementId',
          foreignField: '_id',
          as: 'movement',
        },
      },
      { $unwind: '$movement' },
      {
        $match: {
          'movement.status': 'CONFIRMED',
          'movement.toLocation.kind': 'PROJECT',
          'movement.toLocation.id': projectObjectId,
        },
      },
      {
        $group: {
          _id: null,
          totalConsumption: { $sum: '$totalCost' },
        },
      },
    ]);

    return result[0]?.totalConsumption || 0;
  },

  /**
   * Get movement history for an item.
   */
  async getItemHistory(itemId) {
    const lines = await MovementLine.find({ itemId })
      .populate({
        path: 'movementId',
        populate: [
          { path: 'createdBy', select: 'fullName email' },
          { path: 'approvedBy', select: 'fullName email' },
          { path: 'receivedBy', select: 'fullName email' },
          { path: 'companyDocumentId', select: 'documentNumber documentType' },
        ],
      });

    const validLines = lines.filter(l => l.movementId);
    validLines.sort((a, b) => new Date(b.movementId.createdAt) - new Date(a.movementId.createdAt));

    return validLines.map(line => ({
      movementId: line.movementId._id,
      movementNumber: line.movementId.movementNumber,
      type: line.movementId.type,
      status: line.movementId.status,
      fromLocation: line.movementId.fromLocation,
      toLocation: line.movementId.toLocation,
      companyDocument: line.movementId.companyDocumentId,
      quantity: line.quantity,
      unitCostSnapshot: line.unitCostSnapshot,
      totalCost: line.totalCost,
      createdBy: line.movementId.createdBy,
      approvedBy: line.movementId.approvedBy,
      receivedBy: line.movementId.receivedBy,
      date: line.movementId.createdAt,
      note: line.note || line.movementId.note,
    }));
  },
};

module.exports = stockService;

