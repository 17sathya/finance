const router = require('express').Router();
const { body, param, query } = require('express-validator');
const {
  getRecords,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord,
} = require('../controllers/recordController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errorHandler');
const { ROLES } = require('../models/User');
const { TYPES, CATEGORIES } = require('../models/Record');

router.use(authenticate);

// Viewers, analysts, and admins can read records
router.get(
  '/',
  authorize(ROLES.VIEWER, ROLES.ANALYST, ROLES.ADMIN),
  [
    query('type').optional().isIn(Object.values(TYPES)),
    query('category').optional().isIn(CATEGORIES),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('minAmount').optional().isFloat({ min: 0 }),
    query('maxAmount').optional().isFloat({ min: 0 }),
  ],
  validateRequest,
  getRecords
);

router.get(
  '/:id',
  authorize(ROLES.VIEWER, ROLES.ANALYST, ROLES.ADMIN),
  param('id').isMongoId(),
  validateRequest,
  getRecordById
);

// Only admin and analyst can create/update records
router.post(
  '/',
  authorize(ROLES.ANALYST, ROLES.ADMIN),
  [
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0.'),
    body('type')
      .isIn(Object.values(TYPES))
      .withMessage(`Type must be one of: ${Object.values(TYPES).join(', ')}.`),
    body('category')
      .isIn(CATEGORIES)
      .withMessage(`Category must be one of: ${CATEGORIES.join(', ')}.`),
    body('date').optional().isISO8601().withMessage('Date must be a valid ISO date.'),
    body('notes').optional().isLength({ max: 500 }),
  ],
  validateRequest,
  createRecord
);

router.patch(
  '/:id',
  authorize(ROLES.ANALYST, ROLES.ADMIN),
  [
    param('id').isMongoId(),
    body('amount').optional().isFloat({ min: 0.01 }),
    body('type').optional().isIn(Object.values(TYPES)),
    body('category').optional().isIn(CATEGORIES),
    body('date').optional().isISO8601(),
    body('notes').optional().isLength({ max: 500 }),
  ],
  validateRequest,
  updateRecord
);

// Only admin can delete
router.delete(
  '/:id',
  authorize(ROLES.ADMIN),
  param('id').isMongoId(),
  validateRequest,
  deleteRecord
);

module.exports = router;
