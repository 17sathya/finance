const { User, ROLES } = require('../models/User');
const { createError } = require('../middleware/errorHandler');

// GET /api/users  — list all users (admin)
const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, isActive } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(filter).skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      users,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/:id
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw createError('User not found.', 404);
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/users/:id/role  — change role (admin)
const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!Object.values(ROLES).includes(role)) {
      throw createError(`Invalid role. Must be one of: ${Object.values(ROLES).join(', ')}.`);
    }

    // Prevent admin from changing their own role
    if (req.params.id === req.user._id.toString()) {
      throw createError('You cannot change your own role.', 403);
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    );
    if (!user) throw createError('User not found.', 404);

    res.json({ success: true, message: 'Role updated.', user });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/users/:id/status  — activate/deactivate (admin)
const updateUserStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      throw createError('isActive must be a boolean.');
    }

    if (req.params.id === req.user._id.toString()) {
      throw createError('You cannot deactivate yourself.', 403);
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    );
    if (!user) throw createError('User not found.', 404);

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'}.`,
      user,
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/users/:id  — hard delete (admin)
const deleteUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      throw createError('You cannot delete yourself.', 403);
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) throw createError('User not found.', 404);

    res.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllUsers, getUserById, updateUserRole, updateUserStatus, deleteUser };
