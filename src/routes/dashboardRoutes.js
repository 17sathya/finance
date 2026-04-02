const router = require('express').Router();
const { query } = require('express-validator');
const { getSummary, getTrends, getCategoryBreakdown } = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errorHandler');
const { ROLES } = require('../models/User');

// Dashboard is accessible to analysts and admins (not viewers)
router.use(authenticate, authorize(ROLES.ANALYST, ROLES.ADMIN));

const dateValidators = [
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid ISO date.'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid ISO date.'),
];

router.get('/summary', dateValidators, validateRequest, getSummary);

router.get(
  '/trends',
  [
    ...dateValidators,
    query('period').optional().isIn(['monthly', 'weekly']).withMessage('period must be monthly or weekly.'),
  ],
  validateRequest,
  getTrends
);

router.get(
  '/category-breakdown',
  [
    ...dateValidators,
    query('type').optional().isIn(['income', 'expense']).withMessage('type must be income or expense.'),
  ],
  validateRequest,
  getCategoryBreakdown
);

module.exports = router;
