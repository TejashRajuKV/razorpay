/**
 * Unit tests for the Authoritative Policy Layer: evaluateActionPolicy
 */
jest.mock('../../src/services/simulatorService', () => ({
  executeAction: jest.fn(),
}));

const { isDbAvailable } = require('../helpers/dbAvailable');
const describeDb = isDbAvailable() ? describe : describe.skip;
const { initIsolatedDb, closeIsolatedDb } = require('../helpers/testDb');

if (!isDbAvailable()) {
  test('sqlite bindings unavailable — policy tests skipped', () => {
    console.warn('[tests] better-sqlite3 unavailable, skipping policy suite');
  });
}

describeDb('evaluateActionPolicy — Authoritative Policy Layer (sqlite)', () => {
  let db;
  let recoveryService;

  const CUSTOMER = {
    id: 'cust-p1', name: 'Policy Test', email: 'policy@test.com', phone: '+91-1111111111',
  };
  const PAYMENT = {
    id: 'pay-p1', customer_id: 'cust-p1', amount: 5000, currency: 'INR',
    status: 'failed', payment_method: 'upi', failure_reason: 'bank_error',
  };

  async function seedCase(overrides = {}) {
    const c = {
      id: 'case-p1', payment_id: 'pay-p1', customer_id: 'cust-p1',
      amount_at_risk: 5000, risk_probability: 0.8, diagnosis: 'temporary_failure',
      diagnosis_factors: '[]', priority_score: 0.8, status: 'open', recommended_action: null,
      ...overrides,
    };
    await db.query(
      'INSERT INTO recovery_cases ' +
       '(id, payment_id, customer_id, amount_at_risk, risk_probability, diagnosis, ' +
        'diagnosis_factors, priority_score, status, recommended_action) ' +
       'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [c.id, c.payment_id, c.customer_id, c.amount_at_risk, c.risk_probability,
       c.diagnosis, c.diagnosis_factors, c.priority_score, c.status, c.recommended_action]
    );
    return c;
  }

  async function seedAction(caseId, actionType = 'retry', cooldownUntil = null) {
    const id = 'act-p-' + Math.random().toString(36).slice(2);
    await db.query(
      'INSERT INTO recovery_actions (id, case_id, action_type, action_status, attempt_number, cooldown_until) ' +
       'VALUES (?, ?, ?, ?, 1, ?)',
      [id, caseId, actionType, 'success', cooldownUntil]
    );
  }

  beforeAll(() => {
    db = initIsolatedDb();
    recoveryService = require('../../src/services/recoveryService');
  });

  afterAll(async () => {
    await closeIsolatedDb();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await db.query('DELETE FROM recovery_actions');
    await db.query('DELETE FROM recovery_cases');
    await db.query('DELETE FROM payments');
    await db.query('DELETE FROM customers');
    await db.query(
      'INSERT INTO customers (id, name, email, phone) VALUES (?, ?, ?, ?)',
      [CUSTOMER.id, CUSTOMER.name, CUSTOMER.email, CUSTOMER.phone]
    );
    await db.query(
      'INSERT INTO payments (id, customer_id, amount, currency, status, payment_method, failure_reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [PAYMENT.id, PAYMENT.customer_id, PAYMENT.amount, PAYMENT.currency,
       PAYMENT.status, PAYMENT.payment_method, PAYMENT.failure_reason]
    );
  });

  test('evaluateActionPolicy is exported from recoveryService', () => {
    expect(typeof recoveryService.evaluateActionPolicy).toBe('function');
  });

  test('resolved case -> blocked for all actions', async () => {
    const c = await seedCase({ id: 'case-pol1', status: 'resolved' });
    const [row] = await db.query('SELECT * FROM recovery_cases WHERE id = ?', ['case-pol1']);
    for (const action of ['retry', 'reminder', 'payment_link', 'escalate']) {
      const result = await recoveryService.evaluateActionPolicy(row, action);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/resolved/i);
    }
  });

  test('stopped case -> blocked for all actions', async () => {
    await seedCase({ id: 'case-pol2', status: 'stopped' });
    const [row] = await db.query('SELECT * FROM recovery_cases WHERE id = ?', ['case-pol2']);
    const result = await recoveryService.evaluateActionPolicy(row, 'retry');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/stopped/i);
  });

  test('high-value + low-confidence -> humanEscalation = true, non-escalate blocked', async () => {
    await seedCase({ id: 'case-pol3', amount_at_risk: 90000, priority_score: 0.9 });
    const [row] = await db.query('SELECT * FROM recovery_cases WHERE id = ?', ['case-pol3']);

    const blocked = await recoveryService.evaluateActionPolicy(row, 'retry', { confidence: 0.1 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.humanEscalation).toBe(true);

    const escalateAllowed = await recoveryService.evaluateActionPolicy(row, 'escalate', { confidence: 0.1 });
    expect(escalateAllowed.allowed).toBe(true);
    expect(escalateAllowed.humanEscalation).toBe(true);
  });

  test('high priority_score alone does NOT imply high confidence', async () => {
    await seedCase({ id: 'case-pol3b', amount_at_risk: 90000, priority_score: 0.95 });
    const [row] = await db.query('SELECT * FROM recovery_cases WHERE id = ?', ['case-pol3b']);
    const blocked = await recoveryService.evaluateActionPolicy({ ...row, diagnosis_confidence: 0.1 }, 'retry');
    expect(blocked.allowed).toBe(false);
    const allowed = await recoveryService.evaluateActionPolicy(row, 'retry');
    expect(allowed.allowed).toBe(true);
  });

  test('max retry attempts -> retry blocked', async () => {
    await seedCase({ id: 'case-pol4' });
    for (let i = 0; i < 3; i++) await seedAction('case-pol4', 'retry');
    const [row] = await db.query('SELECT * FROM recovery_cases WHERE id = ?', ['case-pol4']);
    const result = await recoveryService.evaluateActionPolicy(row, 'retry');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/retry attempts/i);
  });

  test('cooldown active -> retry blocked', async () => {
    await seedCase({ id: 'case-pol5' });
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await seedAction('case-pol5', 'retry', future);
    const [row] = await db.query('SELECT * FROM recovery_cases WHERE id = ?', ['case-pol5']);
    const result = await recoveryService.evaluateActionPolicy(row, 'retry');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/cooldown/i);
  });

  test('max total attempts -> all actions blocked', async () => {
    await seedCase({ id: 'case-pol6' });
    for (let i = 0; i < 5; i++) await seedAction('case-pol6', 'reminder');
    const [row] = await db.query('SELECT * FROM recovery_cases WHERE id = ?', ['case-pol6']);
    const result = await recoveryService.evaluateActionPolicy(row, 'reminder');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/total recovery attempts/i);
  });

  test('valid open case -> allowed', async () => {
    await seedCase({ id: 'case-pol7' });
    const [row] = await db.query('SELECT * FROM recovery_cases WHERE id = ?', ['case-pol7']);
    const result = await recoveryService.evaluateActionPolicy(row, 'retry');
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeNull();
  });

  test('evaluateActionPolicy returns humanEscalation=false for normal case', async () => {
    await seedCase({ id: 'case-pol8', amount_at_risk: 5000, priority_score: 0.8 });
    const [row] = await db.query('SELECT * FROM recovery_cases WHERE id = ?', ['case-pol8']);
    const result = await recoveryService.evaluateActionPolicy(row, 'retry', { confidence: 0.85 });
    expect(result.humanEscalation).toBe(false);
  });
});
