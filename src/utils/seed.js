require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('../models/User');
const { Record, CATEGORIES, TYPES } = require('../models/Record');
const connectDB = require('../config/db');

const randomBetween = (min, max) => Math.round((Math.random() * (max - min) + min) * 100) / 100;

const randomDate = (monthsAgo) => {
  const d = new Date();
  d.setMonth(d.getMonth() - Math.floor(Math.random() * monthsAgo));
  d.setDate(Math.floor(Math.random() * 28) + 1);
  return d;
};

const seed = async () => {
  await connectDB();
  console.log('🌱 Seeding database...');

  await User.deleteMany({});
  await Record.deleteMany({});

  // Create users
  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@finance.dev',
    password: 'password123',
    role: 'admin',
  });

  const analyst = await User.create({
    name: 'Analyst User',
    email: 'analyst@finance.dev',
    password: 'password123',
    role: 'analyst',
  });

  await User.create({
    name: 'Viewer User',
    email: 'viewer@finance.dev',
    password: 'password123',
    role: 'viewer',
  });

  // Create 60 sample records
  const creators = [admin._id, analyst._id];
  const incomeCategories = ['salary', 'freelance', 'investment', 'rental'];
  const expenseCategories = ['food', 'transport', 'utilities', 'healthcare', 'entertainment', 'shopping'];

  const records = [];
  for (let i = 0; i < 60; i++) {
    const isIncome = Math.random() > 0.45;
    const categories = isIncome ? incomeCategories : expenseCategories;
    records.push({
      amount: isIncome ? randomBetween(500, 8000) : randomBetween(50, 1500),
      type: isIncome ? TYPES.INCOME : TYPES.EXPENSE,
      category: categories[Math.floor(Math.random() * categories.length)],
      date: randomDate(6),
      notes: isIncome ? 'Received payment' : 'Regular expense',
      createdBy: creators[Math.floor(Math.random() * creators.length)],
    });
  }

  await Record.insertMany(records);

  console.log('✅ Seeded:');
  console.log('   admin@finance.dev  / password123 (admin)');
  console.log('   analyst@finance.dev / password123 (analyst)');
  console.log('   viewer@finance.dev  / password123 (viewer)');
  console.log(`   ${records.length} financial records`);

  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
