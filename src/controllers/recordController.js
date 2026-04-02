const { Record, CATEGORIES, TYPES } = require('../models/Record');
const { createError } = require('../middleware/errorHandler');

// GET /api/records
const getRecords = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      category,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      search,
      sortBy = 'date',
      order = 'desc',
    } = req.query;

    const filter = {};

    if (type) filter.type = type;
    if (category) filter.category = category;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = Number(minAmount);
      if (maxAmount) filter.amount.$lte = Number(maxAmount);
    }
    if (search) {
      filter.notes = { $regex: search, $options: 'i' };
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    const skip = (Number(page) - 1) * Number(limit);

    const [records, total] = await Promise.all([
      Record.find(filter)
        .populate('createdBy', 'name email')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(Number(limit)),
      Record.countDocuments(filter),
    ]);

    res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      records,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/records/:id
const getRecordById = async (req, res, next) => {
  try {
    const record = await Record.findById(req.params.id).populate('createdBy', 'name email');
    if (!record) throw createError('Record not found.', 404);
    res.json({ success: true, record });
  } catch (err) {
    next(err);
  }
};

// POST /api/records
const createRecord = async (req, res, next) => {
  try {
    const { amount, type, category, date, notes } = req.body;
    const record = await Record.create({
      amount,
      type,
      category,
      date: date || new Date(),
      notes,
      createdBy: req.user._id,
    });
    await record.populate('createdBy', 'name email');
    res.status(201).json({ success: true, record });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/records/:id
const updateRecord = async (req, res, next) => {
  try {
    const allowedFields = ['amount', 'type', 'category', 'date', 'notes'];
    const updates = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const record = await Record.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate('createdBy', 'name email');

    if (!record) throw createError('Record not found.', 404);
    res.json({ success: true, record });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/records/:id  — soft delete
const deleteRecord = async (req, res, next) => {
  try {
    const record = await Record.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );
    if (!record) throw createError('Record not found.', 404);
    res.json({ success: true, message: 'Record deleted.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getRecords, getRecordById, createRecord, updateRecord, deleteRecord };
