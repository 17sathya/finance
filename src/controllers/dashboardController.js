const { Record } = require('../models/Record');

// GET /api/dashboard/summary
const getSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);

    const [totals, categoryTotals, recentRecords] = await Promise.all([
      // Total income, expenses, net balance
      Record.aggregate([
        { $match: { isDeleted: false, ...dateFilter } },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),

      // Breakdown by category
      Record.aggregate([
        { $match: { isDeleted: false, ...dateFilter } },
        {
          $group: {
            _id: { type: '$type', category: '$category' },
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]),

      // Recent 5 entries
      Record.find({ isDeleted: false })
        .sort({ date: -1 })
        .limit(5)
        .populate('createdBy', 'name'),
    ]);

    // Shape totals
    const summary = { income: 0, expense: 0, net: 0, incomeCount: 0, expenseCount: 0 };
    totals.forEach(({ _id, total, count }) => {
      if (_id === 'income') { summary.income = total; summary.incomeCount = count; }
      if (_id === 'expense') { summary.expense = total; summary.expenseCount = count; }
    });
    summary.net = summary.income - summary.expense;

    // Shape category breakdown
    const byCategory = {};
    categoryTotals.forEach(({ _id, total, count }) => {
      if (!byCategory[_id.category]) byCategory[_id.category] = {};
      byCategory[_id.category][_id.type] = { total, count };
    });

    res.json({
      success: true,
      summary,
      byCategory,
      recentActivity: recentRecords,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/dashboard/trends?period=monthly|weekly
const getTrends = async (req, res, next) => {
  try {
    const { period = 'monthly', startDate, endDate } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);

    const groupByDate =
      period === 'weekly'
        ? { year: { $isoWeekYear: '$date' }, week: { $isoWeek: '$date' } }
        : { year: { $year: '$date' }, month: { $month: '$date' } };

    const trends = await Record.aggregate([
      { $match: { isDeleted: false, ...dateFilter } },
      {
        $group: {
          _id: { ...groupByDate, type: '$type' },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1 } },
    ]);

    // Reshape into period-keyed map for easy frontend consumption
    const trendMap = {};
    trends.forEach(({ _id, total, count }) => {
      const key =
        period === 'weekly'
          ? `${_id.year}-W${String(_id.week).padStart(2, '0')}`
          : `${_id.year}-${String(_id.month).padStart(2, '0')}`;

      if (!trendMap[key]) trendMap[key] = { period: key, income: 0, expense: 0, net: 0 };
      trendMap[key][_id.type] = total;
    });

    // Calculate net per period
    const result = Object.values(trendMap).map((p) => ({
      ...p,
      net: p.income - p.expense,
    }));

    res.json({ success: true, period, trends: result });
  } catch (err) {
    next(err);
  }
};

// GET /api/dashboard/category-breakdown
const getCategoryBreakdown = async (req, res, next) => {
  try {
    const { type, startDate, endDate } = req.query;
    const match = { isDeleted: false, ...buildDateFilter(startDate, endDate) };
    if (type) match.type = type;

    const breakdown = await Record.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' },
        },
      },
      { $sort: { total: -1 } },
    ]);

    const grandTotal = breakdown.reduce((sum, c) => sum + c.total, 0);
    const result = breakdown.map((c) => ({
      category: c._id,
      total: c.total,
      count: c.count,
      avgAmount: Math.round(c.avgAmount * 100) / 100,
      percentage: grandTotal > 0 ? Math.round((c.total / grandTotal) * 10000) / 100 : 0,
    }));

    res.json({ success: true, breakdown: result, grandTotal });
  } catch (err) {
    next(err);
  }
};

// Helper
const buildDateFilter = (startDate, endDate) => {
  if (!startDate && !endDate) return {};
  const filter = { date: {} };
  if (startDate) filter.date.$gte = new Date(startDate);
  if (endDate) filter.date.$lte = new Date(endDate);
  return filter;
};

module.exports = { getSummary, getTrends, getCategoryBreakdown };
