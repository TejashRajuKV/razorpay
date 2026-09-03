/**
 * Integration: workflow pieces against an ISOLATED temp DB (never dev data).
 * Skips honestly where better-sqlite3 bindings cannot load.
 * Full live E2E (seed → 50-batch → dashboard) is Phase 2.
 */
const { isDbAvailable } = require('../helpers/dbAvailable');
const describeDb = isDbAvailable() ? describe : describe.skip;
const { initIsolatedDb, closeIsolatedDb } = require('../helpers/testDb');

if (!isDbAvailable()) {
  test('sqlite bindings unavailable — integration tests skipped', () => {
    console.warn('[tests] better-sqlite3 unavailable, skipping integration tests');
  });
}

describeDb('recovery workflow (integration)', () => {
  let db;

  beforeAll(() => {
    db = initIsolatedDb();
  });

  afterAll(async () => {
    await closeIsolatedDb();
  });

  test('detect query runs without throwing on empty DB', async () => {
    const recoveryService = require('../../src/services/recoveryService');
    const rows = await recoveryService.detectRevenueAtRisk();
    expect(Array.isArray(rows)).toBe(true);
  });

  test('seeded failed payment is detected as revenue at risk', async () => {
    await db.query("INSERT INTO customers (id, name, email) VALUES ('c-i1', 'Int User', 'i1@x.com')");
    await db.query(
      "INSERT INTO payments (id, customer_id, amount, status, payment_method, failure_reason) VALUES ('p-i1', 'c-i1', 3000, 'failed', 'upi', 'bank_error')",
    );
    const recoveryService = require('../../src/services/recoveryService');
    const rows = await recoveryService.detectRevenueAtRisk();
    expect(rows.some((r) => r.payment_id === 'p-i1')).toBe(true);
  });
});
