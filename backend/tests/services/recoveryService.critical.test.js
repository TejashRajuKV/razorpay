/**
 * PHASE 1 critical tests: recoveryService (isolated temp SQLite).
 * Skips honestly where better-sqlite3 bindings cannot load.
 * - decideRecoveryAction (persistence + high-value escalation)
 * - checkStoppingRules: resolved / stopped / max-retry / max-total / cooldown / high-value+low-confidence
 * - executeRecoveryAction: invalid / blocked(+audit) / success / failure (simulator mocked)
 */
jest.mock('../../src/services/simulatorService', () => ({
  executeAction: jest.fn(),
}));

const { isDbAvailable } = require('../helpers/dbAvailable');
const describeDb = isDbAvailable() ? describe : describe.skip;
const { initIsolatedDb, closeIsolatedDb } = require('../helpers/testDb');

if (!isDbAvailable()) {
  test('sqlite bindings unavailable — db suites skipped (see TEST_PLAN §10)', () => {
    console.warn('[tests] better-sqlite3 unavailable, skipping db-backed suites');
  });
}

describeDb('recoveryService critical (sqlite)', () => {
  let db;
  let recoveryService;
  let simulatorService;

  const CUSTOMER = { id: 'cust-1', name: 'Test User', email: 't@example.com', phone: '+91-0000000001' };
  const PAYMENT = {
    id: 'pay-1', customer_id: 'cust-1', amount: 5000, currency: 'INR',
    status: 'failed', payment_method: 'upi', failure_reason: 'bank_error',
  };

  async function seedCase(overrides = {}) {
    const c = {
      id: 'case-1', payment_id: 'pay-1', customer_id: 'cust-1',
      amount_at_risk: 5000, risk_probability: 0.8, diagnosis: 'temporary_failure',
      diagnosis_factors: '[]', priority_score: 0.8, status: 'open', recommended_action: 'retry',
      ...overrides,
    };
    await db.query(
      `INSERT INTO recovery_cases (id, payment_id, customer_id, amount_at_risk, risk_probability, diagnosis, diagnosis_factors, priority_score, status, recommended_action)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.id, c.payment_id, c.customer_id, c.amount_at_risk, c.risk_probability, c.diagnosis,
        c.diagnosis_factors, c.priority_score, c.status, c.recommended_action],
    );
    return c;
  }

  async function seedAction(caseId, actionType = 'retry', cooldownUntil = null) {
    const id = `act-${Math.random().toString(36).slice(2)}`;
    await db.query(
      `INSERT INTO recovery_actions (id, case_id, action_type, action_status, attempt_number, cooldown_until)
       VALUES (?, ?, ?, 'success', 1, ?)`,
      [id, caseId, actionType, cooldownUntil],
    );
  }

  beforeAll(() => {
    db = initIsolatedDb();
    recoveryService = require('../../src/services/recoveryService');
    simulatorService = require('../../src/services/simulatorService');
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
    await db.query('INSERT INTO customers (id, name, email, phone) VALUES (?, ?, ?, ?)',
      [CUSTOMER.id, CUSTOMER.name, CUSTOMER.email, CUSTOMER.phone]);
    await db.query(
      'INSERT INTO payments (id, customer_id, amount, currency, status, payment_method, failure_reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [PAYMENT.id, PAYMENT.customer_id, PAYMENT.amount, PAYMENT.currency, PAYMENT.status, PAYMENT.payment_method, PAYMENT.failure_reason],
    );
  });

  describe('decideRecoveryAction', () => {
    test('picks highest-probability action and persists it', async () => {
      const c = await seedCase({ id: 'case-d1', priority_score: 0.9, amount_at_risk: 1000 });
      const action = await recoveryService.decideRecoveryAction(
        { ...c, amountAtRisk: 1000, priorityScore: 0.9 },
        { retry: 0.7, reminder: 0.2, payment_link: 0.3, retry_later: 0.1, escalate: 0.05, stop: 0 },
      );
      expect(action).toBe('retry');
      const rows = await db.query('SELECT recommended_action AS ra FROM recovery_cases WHERE id = ?', ['case-d1']);
      expect(rows[0].ra).toBe('retry');
    });

    test('high-value + low-confidence escalates (camelCase unit shape)', async () => {
      const c = await seedCase({ id: 'case-d2', amount_at_risk: 90000, priority_score: 0.1 });
      const action = await recoveryService.decideRecoveryAction(
        { ...c, amountAtRisk: 90000, priorityScore: 0.1 },
        { retry: 0.9, reminder: 0.1, payment_link: 0.1, retry_later: 0.1, escalate: 0.05, stop: 0 },
      );
      expect(action).toBe('escalate');
    });
  });

  describe('checkStoppingRules', () => {
    test('resolved case blocked', async () => {
      await seedCase({ id: 'case-s1', status: 'resolved' });
      const [row] = await db.query('SELECT * FROM recovery_cases WHERE id = ?', ['case-s1']);
      const r = await recoveryService.checkStoppingRules(row, 'retry');
      expect(r.allowed).toBe(false);
      expect(r.reason).toMatch(/resolved/i);
    });

    test('stopped case blocked', async () => {
      await seedCase({ id: 'case-s2', status: 'stopped' });
      const [row] = await db.query('SELECT * FROM recovery_cases WHERE id = ?', ['case-s2']);
      const r = await recoveryService.checkStoppingRules(row, 'retry');
      expect(r.allowed).toBe(false);
      expect(r.reason).toMatch(/stopped/i);
    });

    test('max retry attempts blocked', async () => {
      await seedCase({ id: 'case-s3' });
      for (let i = 0; i < 3; i++) await seedAction('case-s3', 'retry');
      const [row] = await db.query('SELECT * FROM recovery_cases WHERE id = ?', ['case-s3']);
      const r = await recoveryService.checkStoppingRules(row, 'retry');
      expect(r.allowed).toBe(false);
      expect(r.reason).toMatch(/retry attempts/i);
    });

    test('max total attempts blocked', async () => {
      await seedCase({ id: 'case-s4' });
      for (let i = 0; i < 5; i++) await seedAction('case-s4', 'reminder');
      const [row] = await db.query('SELECT * FROM recovery_cases WHERE id = ?', ['case-s4']);
      const r = await recoveryService.checkStoppingRules(row, 'reminder');
      expect(r.allowed).toBe(false);
      expect(r.reason).toMatch(/total recovery attempts/i);
    });

    test('cooldown blocked until expiry', async () => {
      await seedCase({ id: 'case-s5' });
      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await seedAction('case-s5', 'retry', future);
      const [row] = await db.query('SELECT * FROM recovery_cases WHERE id = ?', ['case-s5']);
      const r = await recoveryService.checkStoppingRules(row, 'retry');
      expect(r.allowed).toBe(false);
      expect(r.reason).toMatch(/cooldown/i);
    });

    test('high-value + low-confidence forces escalation', async () => {
      await seedCase({ id: 'case-s6', amount_at_risk: 90000, priority_score: 0.1 });
      const [row] = await db.query('SELECT * FROM recovery_cases WHERE id = ?', ['case-s6']);
      const blocked = await recoveryService.checkStoppingRules(row, 'retry');
      expect(blocked.allowed).toBe(false);
      expect(blocked.reason).toMatch(/escalation/i);
      const allowed = await recoveryService.checkStoppingRules(row, 'escalate');
      expect(allowed.allowed).toBe(true);
    });
  });

  describe('executeRecoveryAction', () => {
    test('invalid case throws', async () => {
      await expect(recoveryService.executeRecoveryAction('nope', 'retry')).rejects.toThrow(/not found/i);
    });

    test('blocked action returns blocked:true and audits', async () => {
      await seedCase({ id: 'case-e1', status: 'resolved' });
      const res = await recoveryService.executeRecoveryAction('case-e1', 'retry');
      expect(res.success).toBe(false);
      expect(res.blocked).toBe(true);
      expect(res.reason).toMatch(/resolved/i);
      const logs = await db.query(
        "SELECT * FROM audit_logs WHERE entity_id = ? AND event_type = 'safety_check_blocked'", ['case-e1']);
      expect(logs.length).toBe(1);
    });

    test('successful simulated recovery resolves case with real amount', async () => {
      await seedCase({ id: 'case-e2' });
      simulatorService.executeAction.mockResolvedValue({ success: true, message: 'ok', recoveredAmount: 5000 });
      const res = await recoveryService.executeRecoveryAction('case-e2', 'retry');
      expect(res.success).toBe(true);
      expect(res.recoveredAmount).toBe(5000);
      const [row] = await db.query('SELECT status, recovered_amount AS amt FROM recovery_cases WHERE id = ?', ['case-e2']);
      expect(row.status).toBe('resolved');
      expect(Number(row.amt)).toBe(5000);
    });

    test('failed simulated recovery keeps case open with zero amount', async () => {
      await seedCase({ id: 'case-e3' });
      simulatorService.executeAction.mockResolvedValue({ success: false, message: 'declined', recoveredAmount: 0 });
      const res = await recoveryService.executeRecoveryAction('case-e3', 'retry');
      expect(res.success).toBe(false);
      expect(res.recoveredAmount).toBe(0);
      const [row] = await db.query('SELECT status FROM recovery_cases WHERE id = ?', ['case-e3']);
      expect(row.status).toBe('open');
    });
  });
});
