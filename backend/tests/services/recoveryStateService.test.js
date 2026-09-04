/**
 * Unit tests for recoveryStateService.buildRecoveryState
 */
const { isDbAvailable } = require('../helpers/dbAvailable');
const describeDb = isDbAvailable() ? describe : describe.skip;
const { initIsolatedDb, closeIsolatedDb } = require('../helpers/testDb');

if (!isDbAvailable()) {
  test('sqlite bindings unavailable — recoveryStateService tests skipped', () => {
    console.warn('[tests] better-sqlite3 unavailable, skipping db-backed suites');
  });
}

describeDb('recoveryStateService.buildRecoveryState (sqlite)', () => {
  let db;
  let recoveryStateService;

  const CUSTOMER = {
    id: 'cust-rs1', name: 'State Test User', email: 'state@example.com', phone: '+91-9999999999',
    total_payments: 10, successful_payments: 8, failed_payments: 2,
  };
  const PAYMENT = {
    id: 'pay-rs1', customer_id: 'cust-rs1', amount: 48650, currency: 'INR',
    status: 'failed', payment_method: 'upi', failure_reason: 'bank_error',
  };

  async function seedCase(overrides = {}) {
    const c = {
      id: 'case-rs1', payment_id: 'pay-rs1', customer_id: 'cust-rs1',
      amount_at_risk: 48650, recovered_amount: 0, risk_probability: 0.75,
      diagnosis: 'temporary_failure', diagnosis_factors: '[]',
      priority_score: 0.75, status: 'open', recommended_action: null,
      ...overrides,
    };
    await db.query(
      'INSERT INTO recovery_cases ' +
       '(id, payment_id, customer_id, amount_at_risk, recovered_amount, risk_probability, ' +
        'diagnosis, diagnosis_factors, priority_score, status, recommended_action) ' +
       'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [c.id, c.payment_id, c.customer_id, c.amount_at_risk, c.recovered_amount,
       c.risk_probability, c.diagnosis, c.diagnosis_factors, c.priority_score,
       c.status, c.recommended_action]
    );
    return c;
  }

  async function seedAction(caseId, actionType, actionStatus, recoveryAmount = 0, cooldownUntil = null) {
    const id = 'act-rs-' + Math.random().toString(36).slice(2);
    await db.query(
      'INSERT INTO recovery_actions ' +
       '(id, case_id, action_type, action_status, attempt_number, recovery_amount, cooldown_until) ' +
       'VALUES (?, ?, ?, ?, 1, ?, ?)',
      [id, caseId, actionType, actionStatus, recoveryAmount, cooldownUntil]
    );
    return id;
  }

  beforeAll(() => {
    db = initIsolatedDb();
    recoveryStateService = require('../../src/services/recoveryStateService');
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

  test('TEST A - new case: state has empty history and full amountAtRisk remaining', async () => {
    await seedCase();
    const state = await recoveryStateService.buildRecoveryState('case-rs1');

    expect(state.caseId).toBe('case-rs1');
    expect(state.customerId).toBe('cust-rs1');
    expect(state.paymentId).toBe('pay-rs1');
    expect(state.amountAtRisk).toBe(48650);
    expect(state.remainingAmountAtRisk).toBe(48650);
    expect(state.caseStatus).toBe('open');
    expect(state.diagnosis).toBe('temporary_failure');
    expect(state.paymentMethod).toBe('upi');
    expect(state.failureReason).toBe('bank_error');

    expect(state.recoveryHistory.totalAttempts).toBe(0);
    expect(state.recoveryHistory.previousActions).toEqual([]);
    expect(state.recoveryHistory.successfulActions).toEqual([]);
    expect(state.recoveryHistory.failedActions).toEqual([]);

    expect(state.lastAction).toBeNull();
    expect(state.lastActionStatus).toBeNull();
    expect(state.cooldownUntil).toBeNull();

    expect(state.availableActions.length).toBeGreaterThan(0);
    expect(state.availableActions).toContain('retry');
  });

  test('TEST B - previous failed actions visible in state', async () => {
    await seedCase();
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await seedAction('case-rs1', 'retry', 'failed', 0, future);
    await seedAction('case-rs1', 'reminder', 'failed', 0);

    const state = await recoveryStateService.buildRecoveryState('case-rs1');

    expect(state.recoveryHistory.totalAttempts).toBe(2);
    expect(state.recoveryHistory.previousActions).toEqual(['retry', 'reminder']);
    expect(state.recoveryHistory.failedActions).toEqual(['retry', 'reminder']);
    expect(state.recoveryHistory.successfulActions).toEqual([]);
    expect(state.lastAction).toBe('reminder');
    expect(state.lastActionStatus).toBe('failed');
    expect(state.cooldownUntil).not.toBeNull();
  });

  test('TEST C - resolved case: remainingAmountAtRisk = 0, no available actions', async () => {
    await seedCase({ status: 'resolved', recovered_amount: 48650 });
    await seedAction('case-rs1', 'retry', 'success', 48650);

    const state = await recoveryStateService.buildRecoveryState('case-rs1');

    expect(state.caseStatus).toBe('resolved');
    expect(state.remainingAmountAtRisk).toBe(0);
    expect(state.availableActions).toEqual([]);
    expect(state.recoveryHistory.successfulActions).toContain('retry');
  });

  test('TEST D - stopped case: no available actions', async () => {
    await seedCase({ status: 'stopped' });

    const state = await recoveryStateService.buildRecoveryState('case-rs1');

    expect(state.caseStatus).toBe('stopped');
    expect(state.availableActions).toEqual([]);
  });

  test('TEST E - throws on unknown case ID', async () => {
    await expect(recoveryStateService.buildRecoveryState('nonexistent-case')).rejects.toThrow(/not found/i);
  });

  test('TEST F - accepts pre-fetched case object', async () => {
    const seedData = await seedCase();
    const fakeRow = {
      id: seedData.id,
      customer_id: seedData.customer_id,
      payment_id: seedData.payment_id,
      amount_at_risk: seedData.amount_at_risk,
      recovered_amount: 0,
      status: seedData.status,
      risk_probability: seedData.risk_probability,
      diagnosis: seedData.diagnosis,
      payment_method: 'card',
      failure_reason: 'insufficient_funds',
    };
    const state = await recoveryStateService.buildRecoveryState(fakeRow);
    expect(state.amountAtRisk).toBe(48650);
    expect(state.paymentMethod).toBe('card');
  });

  test('TEST G - customerProfile defaults gracefully when customer missing', async () => {
    await db.query('DELETE FROM customers');
    await db.query('INSERT INTO customers (id, name, email, phone) VALUES (?, ?, ?, ?)',
      ['orphan-cust', 'Orphan', 'o@x.com', '+91-0000000000']);
    await db.query(
      'INSERT INTO payments (id, customer_id, amount, currency, status, payment_method, failure_reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['pay-orphan', 'orphan-cust', 1000, 'INR', 'failed', 'upi', 'bank_error']
    );
    await db.query(
      'INSERT INTO recovery_cases ' +
       '(id, payment_id, customer_id, amount_at_risk, recovered_amount, risk_probability, ' +
        'diagnosis, diagnosis_factors, priority_score, status, recommended_action) ' +
       'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['case-orphan', 'pay-orphan', 'orphan-cust', 1000, 0, 0.5, 'temporary_failure', '[]', 0.5, 'open', null]
    );
    // NOTE: better-sqlite3 enforces FKs (ON DELETE CASCADE), so the customer
    // delete is wrapped with FK enforcement off to keep the orphaned case +
    // payment rows that this scenario exercises.
    await db.query('PRAGMA foreign_keys = OFF');
    await db.query('DELETE FROM customers WHERE id = ?', ['orphan-cust']);
    await db.query('PRAGMA foreign_keys = ON');
    const state = await recoveryStateService.buildRecoveryState('case-orphan');
    expect(state.customerProfile.successRate).toBe(0);
    expect(state.customerProfile.customerSegment).toBe('standard');
  });
});
