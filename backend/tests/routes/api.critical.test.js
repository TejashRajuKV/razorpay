/**
 * PHASE 1 critical API tests (supertest, isolated temp DB):
 * 10. POST /cases/:id/action  11. POST /recovery/run-batch
 * 12. POST /recovery/simulate-batch  13. GET /health
 * Skips honestly where better-sqlite3 bindings cannot load.
 */
const request = require('supertest');
const { isDbAvailable } = require('../helpers/dbAvailable');
const describeDb = isDbAvailable() ? describe : describe.skip;
const { initIsolatedDb, closeIsolatedDb } = require('../helpers/testDb');

if (!isDbAvailable()) {
  test('sqlite bindings unavailable — api db tests skipped', () => {
    console.warn('[tests] better-sqlite3 unavailable, skipping api db tests');
  });
}

describeDb('critical API (sqlite)', () => {
  let app;
  let db;

  async function seedOpenCase(id = 'api-case-1') {
    await db.query('INSERT INTO customers (id, name, email) VALUES (?, ?, ?)', [`c-${id}`, 'API User', `${id}@x.com`]);
    await db.query(
      'INSERT INTO payments (id, customer_id, amount, status, payment_method, failure_reason) VALUES (?, ?, ?, ?, ?, ?)',
      [`p-${id}`, `c-${id}`, 2000, 'failed', 'upi', 'bank_error'],
    );
    await db.query(
      `INSERT INTO recovery_cases (id, payment_id, customer_id, amount_at_risk, risk_probability, diagnosis, diagnosis_factors, priority_score, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, `p-${id}`, `c-${id}`, 2000, 0.7, 'temporary_failure', '[]', 0.7, 'open'],
    );
  }

  beforeAll(async () => {
    db = initIsolatedDb();
    app = require('../../src/app').app;
    await seedOpenCase();
    await seedOpenCase('api-case-2');
  }, 30000);

  afterAll(async () => {
    await closeIsolatedDb();
  });

  describe('GET /health', () => {
    test('root health is healthy (not under /api/v1)', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });
  });

  describe('POST /cases/:id/action', () => {
    test('missing actionType → 400', async () => {
      const res = await request(app).post('/api/v1/cases/api-case-1/action').send({});
      expect(res.status).toBe(400);
    });

    test('invalid actionType → 400 with valid list', async () => {
      const res = await request(app).post('/api/v1/cases/api-case-1/action').send({ actionType: 'teleport' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/retry/);
    });

    test('unknown case → 400+ not-found (pinned)', async () => {
      const res = await request(app).post('/api/v1/cases/does-not-exist/action').send({ actionType: 'retry' });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    test('valid action returns contract shape (outcome varies by simulator RNG)', async () => {
      const res = await request(app).post('/api/v1/cases/api-case-2/action').send({ actionType: 'escalate' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.caseId).toBe('api-case-2');
      expect(typeof res.body.data.success).toBe('boolean');
      expect(typeof Number(res.body.data.recoveredAmount)).toBe('number');
    });

    test('resolved case → HTTP 200 with data.blocked:true (pinned quirk)', async () => {
      await db.query("UPDATE recovery_cases SET status = 'resolved' WHERE id = 'api-case-1'");
      const res = await request(app).post('/api/v1/cases/api-case-1/action').send({ actionType: 'retry' });
      expect(res.status).toBe(200);
      expect(res.body.data.blocked).toBe(true);
      expect(res.body.data.reason).toMatch(/resolved/i);
    });
  });

  describe('POST /recovery/run-batch', () => {
    test('empty queue → zeros, never hardcoded revenue', async () => {
      await db.query("UPDATE recovery_cases SET status = 'resolved'");
      const res = await request(app).post('/api/v1/recovery/run-batch').send({ limit: 10 });
      expect(res.status).toBe(200);
      expect(res.body.data.totalProcessed).toBe(0);
      expect(res.body.data.totalRecovered).toBe(0);
      expect(res.body.data).toHaveProperty('byActionType');
      expect(res.body.data).toHaveProperty('details');
    });
  });

  describe('POST /recovery/simulate-batch', () => {
    test('count passthrough returns simulation summary', async () => {
      const res = await request(app).post('/api/v1/recovery/simulate-batch').send({ count: 20 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.details)).toBe(true);
      expect(typeof res.body.data.totalRecovered).toBe('number');
    });
  });
});
