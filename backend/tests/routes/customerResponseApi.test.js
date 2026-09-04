/**
 * API tests for POST /api/v1/cases/:id/customer-response (supertest, isolated DB):
 * contract shape, validation, 404, state exposure via GET /cases/:id,
 * and the guardrail invariant (no actions executed by customer responses).
 */
const request = require('supertest');
const { isDbAvailable } = require('../helpers/dbAvailable');
const describeDb = isDbAvailable() ? describe : describe.skip;
const { initIsolatedDb, closeIsolatedDb } = require('../helpers/testDb');

if (!isDbAvailable()) {
  test('sqlite bindings unavailable — customer-response API tests skipped', () => {
    console.warn('[tests] better-sqlite3 unavailable, skipping db-backed suites');
  });
}

describeDb('POST /api/v1/cases/:id/customer-response (sqlite)', () => {
  let app;
  let db;

  async function seedCase(id = 'api-cr-1', status = 'open') {
    await db.query('INSERT INTO customers (id, name, email) VALUES (?, ?, ?)', [`c-${id}`, 'API CR User', `${id}@x.com`]);
    await db.query(
      'INSERT INTO payments (id, customer_id, amount, status, payment_method, failure_reason) VALUES (?, ?, ?, ?, ?, ?)',
      [`p-${id}`, `c-${id}`, 3000, 'failed', 'upi', 'bank_error']
    );
    await db.query(
      `INSERT INTO recovery_cases (id, payment_id, customer_id, amount_at_risk, risk_probability,
        diagnosis, diagnosis_factors, priority_score, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, `p-${id}`, `c-${id}`, 3000, 0.7, 'temporary_failure', '[]', 0.7, status]
    );
  }

  beforeAll(async () => {
    db = initIsolatedDb();
    app = require('../../src/app').app;
  }, 30000);

  afterAll(async () => {
    await closeIsolatedDb();
  });

  beforeEach(async () => {
    await db.query('DELETE FROM audit_logs');
    await db.query('DELETE FROM customer_responses');
    await db.query('DELETE FROM recovery_actions');
    await db.query('DELETE FROM recovery_cases');
    await db.query('DELETE FROM payments');
    await db.query('DELETE FROM customers');
    await seedCase();
  });

  test('missing message → 400', async () => {
    const res = await request(app).post('/api/v1/cases/api-cr-1/customer-response').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/message/i);
  });

  test('unknown case → 404', async () => {
    const res = await request(app)
      .post('/api/v1/cases/no-such-case/customer-response')
      .send({ message: 'I will pay tomorrow' });
    expect(res.status).toBe(404);
  });

  test('promise message → contract shape with PROMISED state + audit + state exposure', async () => {
    const res = await request(app)
      .post('/api/v1/cases/api-cr-1/customer-response')
      .send({ message: 'I will pay tomorrow morning' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const d = res.body.data;
    expect(d.intent).toBe('promise_to_pay');
    expect(typeof d.confidence).toBe('number');
    expect(d.promiseState).toBe('PROMISED');
    expect(d.promisedAt).toBeTruthy();
    expect(d.followUpRequired).toBe(true);
    expect(typeof d.nextStep).toBe('string');
    expect(new Date(d.promisedAt).getTime()).toBeGreaterThan(Date.now());

    // Audit events recorded
    const events = await db.query(
      "SELECT event_type FROM audit_logs WHERE entity_type = 'case' AND entity_id = 'api-cr-1'"
    );
    const types = events.map((e) => e.event_type);
    expect(types).toContain('customer_response_received');
    expect(types).toContain('promise_to_pay_recorded');

    // Exposed through existing case detail response (recoveryState)
    const detail = await request(app).get('/api/v1/cases/api-cr-1');
    expect(detail.status).toBe(200);
    expect(detail.body.data.recoveryState.customerResponse.promiseState).toBe('PROMISED');
    expect(detail.body.data.recoveryState.customerResponse.lastIntent).toBe('promise_to_pay');
  });

  test('response flow never executes a recovery action (guardrails intact)', async () => {
    await request(app)
      .post('/api/v1/cases/api-cr-1/customer-response')
      .send({ message: 'I will pay tomorrow morning' });

    const actions = await db.query('SELECT * FROM recovery_actions WHERE case_id = ?', ['api-cr-1']);
    expect(actions.length).toBe(0);

    // Policy still the final authority on the same case
    const actionRes = await request(app).post('/api/v1/cases/api-cr-1/action').send({ actionType: 'escalate' });
    expect(actionRes.status).toBe(200);
    expect(actionRes.body.success).toBe(true);
  });

  test('non-promise intent returns NONE promise state and no promise audit', async () => {
    const res = await request(app)
      .post('/api/v1/cases/api-cr-1/customer-response')
      .send({ message: 'ok sure whatever' });

    expect(res.status).toBe(200);
    expect(res.body.data.intent).toBe('unclear');
    expect(res.body.data.promiseState).toBe('NONE');
    expect(res.body.data.promisedAt).toBeNull();

    const events = await db.query(
      "SELECT event_type FROM audit_logs WHERE entity_type = 'case' AND entity_id = 'api-cr-1'"
    );
    expect(events.map((e) => e.event_type)).not.toContain('promise_to_pay_recorded');
  });
});
