const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { User } = require('../src/models/User');
const { Record } = require('../src/models/Record');

const MONGODB_TEST_URI = 'mongodb://localhost:27017/finance_test_dashboard';

let adminToken, analystToken, viewerToken;
let adminUser;

const registerAndLogin = async (name, email, role) => {
  const user = await User.create({ name, email, password: 'password123', role });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { user, token: res.body.token };
};

beforeAll(async () => {
  await mongoose.connect(MONGODB_TEST_URI);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Record.deleteMany({});
  ({ user: adminUser, token: adminToken } = await registerAndLogin('Admin', 'admin@test.com', 'admin'));
  ({ token: analystToken } = await registerAndLogin('Analyst', 'analyst@test.com', 'analyst'));
  ({ token: viewerToken } = await registerAndLogin('Viewer', 'viewer@test.com', 'viewer'));

  await Record.create([
    { amount: 5000, type: 'income', category: 'salary', date: new Date(), createdBy: adminUser._id },
    { amount: 200, type: 'expense', category: 'food', date: new Date(), createdBy: adminUser._id },
    { amount: 800, type: 'income', category: 'freelance', date: new Date(), createdBy: adminUser._id },
    { amount: 100, type: 'expense', category: 'transport', date: new Date(), createdBy: adminUser._id },
  ]);
});

// ── Dashboard ──────────────────────────────────────────────────────────────
describe('GET /api/dashboard/summary', () => {
  it('admin can access summary', async () => {
    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.summary.income).toBe(5800);
    expect(res.body.summary.expense).toBe(300);
    expect(res.body.summary.net).toBe(5500);
    expect(res.body.byCategory).toBeDefined();
    expect(res.body.recentActivity).toBeDefined();
  });

  it('analyst can access summary', async () => {
    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${analystToken}`);
    expect(res.status).toBe(200);
  });

  it('viewer cannot access summary', async () => {
    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/dashboard/trends', () => {
  it('returns monthly trends', async () => {
    const res = await request(app)
      .get('/api/dashboard/trends?period=monthly')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.period).toBe('monthly');
    expect(Array.isArray(res.body.trends)).toBe(true);
  });

  it('returns weekly trends', async () => {
    const res = await request(app)
      .get('/api/dashboard/trends?period=weekly')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.period).toBe('weekly');
  });

  it('rejects invalid period', async () => {
    const res = await request(app)
      .get('/api/dashboard/trends?period=daily')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(422);
  });
});

describe('GET /api/dashboard/category-breakdown', () => {
  it('returns category totals', async () => {
    const res = await request(app)
      .get('/api/dashboard/category-breakdown')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.breakdown)).toBe(true);
    expect(res.body.grandTotal).toBeDefined();
  });

  it('filters by type=income', async () => {
    const res = await request(app)
      .get('/api/dashboard/category-breakdown?type=income')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.breakdown.every(c => c.total > 0)).toBe(true);
  });
});

// ── User management ────────────────────────────────────────────────────────
describe('GET /api/users', () => {
  it('admin can list users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBe(3);
  });

  it('analyst cannot list users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${analystToken}`);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/users/:id/role', () => {
  it('admin can change a user role', async () => {
    const users = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);
    const viewer = users.body.users.find(u => u.role === 'viewer');

    const res = await request(app)
      .patch(`/api/users/${viewer._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'analyst' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('analyst');
  });

  it('admin cannot change their own role', async () => {
    const res = await request(app)
      .patch(`/api/users/${adminUser._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'viewer' });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/users/:id/status', () => {
  it('admin can deactivate a user', async () => {
    const users = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);
    const viewer = users.body.users.find(u => u.role === 'viewer');

    const res = await request(app)
      .patch(`/api/users/${viewer._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.user.isActive).toBe(false);
  });

  it('deactivated user cannot login', async () => {
    const users = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);
    const viewer = users.body.users.find(u => u.role === 'viewer');

    await request(app)
      .patch(`/api/users/${viewer._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'viewer@test.com', password: 'password123',
    });
    expect(loginRes.status).toBe(403);
  });
});
