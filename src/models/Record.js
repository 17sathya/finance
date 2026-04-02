const mongoose = require('mongoose');

const TYPES = { INCOME: 'income', EXPENSE: 'expense' };

const CATEGORIES = [
  'salary', 'freelance', 'investment', 'rental',
  'food', 'transport', 'utilities', 'healthcare',
  'entertainment', 'education', 'shopping', 'other',
];

const recordSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    type: {
      type: String,
      enum: Object.values(TYPES),
      required: [true, 'Type is required (income or expense)'],
    },
    category: {
      type: String,
      enum: CATEGORIES,
      required: [true, 'Category is required'],
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false, // soft delete flag
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Exclude soft-deleted records from all queries by default
recordSchema.pre(/^find/, function (next) {
  if (!this.getOptions().includeDeleted) {
    this.where({ isDeleted: false });
  }
  next();
});

const Record = mongoose.model('Record', recordSchema);

module.exports = { Record, TYPES, CATEGORIES };
