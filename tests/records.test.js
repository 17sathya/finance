const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { User } = require('../src/models/User');
const { Record } = require('../src/models/Record');

const MONGODB_TEST_URI = 'mongodb://localhost:27017/finance_test_records';

let adminToken, analystToken, viewerToken;
let adminUser, analystUser, viewerUser;

const registerAndLogin = async (name, email, role) => {
  const user = await User.create({ name, email, password: 'password123', role });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { user, token: res.body.token };
};

const sampleRecord = {
  amount: 1500,
  type: 'income',
  category: 'salary',
  date: '2024-03-15',
  notes: 'March salary',
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
  ({ user: analystUser, token: analystToken } = await registerAndLogin('Analyst', 'analyst@test.com', 'analyst'));
  ({ user: viewerUser, token: viewerToken } = await registerAndLogin('Viewer', 'viewer@test.com', 'viewer'));
});

describe('POST /api/records', () => {
  it('admin can create a record', async () => {
    const res = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(sampleRecord);
    expect(res.status).toBe(201);
    expect(res.body.record.amount).toBe(1500);
    expect(res.body.record.type).toBe('income');
  });

  it('analyst can create a record', async () => {
    const res = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${analystToken}`)
      .send(sampleRecord);
    expect(res.status).toBe(201);
  });

  it('viewer cannot create a record', async () => {
    const res = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send(sampleRecord);
    expect(res.status).toBe(403);
  });

  it('rejects negative amount', async () => {
    const res = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...sampleRecord, amount: -100 });
    expect(res.status).toBe(422);
  });

  it('rejects invalid type', async () => {
    const res = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...sampleRecord, type: 'invalid' });
    expect(res.status).toBe(422);
  });

  it('rejects invalid category', async () => {
    const res = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...sampleRecord, category: 'not-a-category' });
    expect(res.status).toBe(422);
  });
});

describe('GET /api/records', () => {
  beforeEach(async () => {
    await Record.create([
      { ...sampleRecord, date: new Date('2024-01-10'), amount: 1000, createdBy: adminUser._id },
      { ...sampleRecord, date: new Date('2024-02-10'), amount: 2000, type: 'expense', category: 'food', createdBy: adminUser._id },
      { ...sampleRecord, date: new Date('2024-03-10'), amount: 3000, createdBy: analystUser._id },
    ]);
  });

  it('viewer can list records', async () => {
    const res = await request(app)
      .get('/api/records')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.records.length).toBe(3);
  });

  it('filters by type', async () => {
    const res = await request(app)
      .get('/api/records?type=expense')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.records.every(r => r.type === 'expense')).toBe(true);
  });

  it('filters by date range', async () => {
    const res = await request(app)
      .get('/api/records?startDate=2024-02-01&endDate=2024-02-28')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.records.length).toBe(1);
  });

  it('paginates results', async () => {
    const res = await request(app)
      .get('/api/records?page=1&limit=2')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.records.length).toBe(2);
    expect(res.body.pages).toBe(2);
  });

  it('unauthenticated request is rejected', async () => {
    const res = await request(app).get('/api/records');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/records/:id', () => {
  let recordId;
  beforeEach(async () => {
    const record = await Record.create({ ...sampleRecord, createdBy: adminUser._id });
    recordId = record._id.toString();
  });

  it('admin can update a record', async () => {
    const res = await request(app)
      .patch(`/api/records/${recordId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 9999 });
    expect(res.status).toBe(200);
    expect(res.body.record.amount).toBe(9999);
  });

  it('viewer cannot update a record', async () => {
    const res = await request(app)
      .patch(`/api/records/${recordId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ amount: 9999 });
    expect(res.status).toBe(403);
  });

  it('returns 404 for unknown id', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .patch(`/api/records/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 100 });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/records/:id', () => {
  let recordId;
  beforeEach(async () => {
    const record = await Record.create({ ...sampleRecord, createdBy: adminUser._id });
    recordId = record._id.toString();
  });

  it('admin can soft-delete a record', async () => {
    const res = await request(app)
      .delete(`/api/records/${recordId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    // Record should no longer appear in list
    const listRes = await request(app)
      .get('/api/records')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body.records.find(r => r._id === recordId)).toBeUndefined();
  });

  it('analyst cannot delete a record', async () => {
    const res = await request(app)
      .delete(`/api/records/${recordId}`)
      .set('Authorization', `Bearer ${analystToken}`);
    expect(res.status).toBe(403);
  });
});
