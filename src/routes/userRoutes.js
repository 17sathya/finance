const router = require('express').Router();
const { body, param } = require('express-validator');
const {
  getAllUsers,
  getUserById,
  updateUserRole,
  updateUserStatus,
  deleteUser,
} = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errorHandler');
const { ROLES } = require('../models/User');

// All user management routes require authentication
router.use(authenticate);

router.get('/', authorize(ROLES.ADMIN), getAllUsers);

router.get(
  '/:id',
  authorize(ROLES.ADMIN),
  param('id').isMongoId().withMessage('Invalid user ID.'),
  validateRequest,
  getUserById
);

router.patch(
  '/:id/role',
  authorize(ROLES.ADMIN),
  [
    param('id').isMongoId().withMessage('Invalid user ID.'),
    body('role')
      .isIn(Object.values(ROLES))
      .withMessage(`Role must be one of: ${Object.values(ROLES).join(', ')}.`),
  ],
  validateRequest,
  updateUserRole
);

router.patch(
  '/:id/status',
  authorize(ROLES.ADMIN),
  [
    param('id').isMongoId().withMessage('Invalid user ID.'),
    body('isActive').isBoolean().withMessage('isActive must be true or false.'),
  ],
  validateRequest,
  updateUserStatus
);

router.delete(
  '/:id',
  authorize(ROLES.ADMIN),
  param('id').isMongoId().withMessage('Invalid user ID.'),
  validateRequest,
  deleteUser
);

module.exports = router;
