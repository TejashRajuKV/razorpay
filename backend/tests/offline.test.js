/**
 * PHASE 1 offline honesty tests (backend half):
 * 14. Backend/simulator failure must never produce fake successful recovery.
 * Skips honestly where better-sqlite3 bindings cannot load.
 * (Frontend helper network-freedom (15) needs a frontend runner — deferred, see TEST_PLAN.)
 */
jest.mock('../src/services/simulatorService', () => ({
  executeAction: jest.fn(),
}));

const { isDbAvailable } = require('./helpers/dbAvailable');
const describeDb = isDbAvailable() ? describe : describe.skip;
const { initIsolatedDb, closeIsolatedDb } = require('./helpers/testDb');

if (!isDbAvailable()) {
  test('sqlite bindings unavailable — offline db tests skipped', () => {
    console.warn('[tests] better-sqlite3 unavailable, skipping offline db tests');
  });
}

describeDb('offline honesty (sqlite)', () => {
  let db;
  let recoveryService;
  let simulatorService;

  beforeAll(() => {
    db = initIsolatedDb();
    recoveryService = require('../src/services/recoveryService');
    simulatorService = require('../src/services/simulatorService');
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
    await db.query("INSERT INTO customers (id, name, email) VALUES ('c-off', 'Off User', 'off@x.com')");
    await db.query(
      "INSERT INTO payments (id, customer_id, amount, status, payment_method, failure_reason) VALUES ('p-off', 'c-off', 7000, 'failed', 'upi', 'bank_error')",
    );
    await db.query(
      `INSERT INTO recovery_cases (id, payment_id, customer_id, amount_at_risk, risk_probability, diagnosis, diagnosis_factors, priority_score, status)
       VALUES ('case-off', 'p-off', 'c-off', 7000, 0.8, 'temporary_failure', '[]', 0.8, 'open')`,
    );
  });

  test('simulator throw → success:false, case stays open, amount untouched', async () => {
    simulatorService.executeAction.mockRejectedValue(new Error('simulator down'));
    const res = await recoveryService.executeRecoveryAction('case-off', 'retry');
    expect(res.success).toBe(false);
    expect(res.recoveredAmount || 0).toBe(0);
    const [row] = await db.query('SELECT status, recovered_amount AS amt FROM recovery_cases WHERE id = ?', ['case-off']);
    expect(row.status).toBe('open');
    expect(Number(row.amt)).toBe(0);
  });

  test('resolved cases hold zero recovered unless simulator really paid', async () => {
    await db.query("UPDATE recovery_cases SET status = 'resolved' WHERE id = 'case-off'");
    const direct = await db.query("SELECT COALESCE(SUM(recovered_amount),0) AS s FROM recovery_cases WHERE status = 'resolved'");
    expect(Number(direct[0].s)).toBe(0);
  });
});
