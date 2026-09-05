jest.mock('../../src/config/database', () => ({ query: jest.fn() }));
const db = require('../../src/config/database');
const recoveryService = require('../../src/services/recoveryService');

describe('case list payment data', () => {
  beforeEach(() => jest.clearAllMocks());

  test('list query joins payments and returns actual method', async () => {
    db.query.mockResolvedValueOnce([
      { id: 'c1', payment_method: 'upi', payment_status: 'failed', failure_reason: 'bank_error', payment_amount: 100, payment_id: 'p1' },
      { id: 'c2', payment_method: 'credit_card', payment_status: 'failed', failure_reason: 'declined_by_bank', payment_amount: 200, payment_id: 'p2' },
    ]);
    const rows = await recoveryService.getRecoveryCases({});
    const sql = db.query.mock.calls[0][0];
    expect(sql).toMatch(/LEFT JOIN payments p ON/i);
    expect(sql).toMatch(/payment_method/);
    expect(sql).toMatch(/payment_status/);
    expect(sql).toMatch(/failure_reason/);
    expect(sql).toMatch(/payment_amount/);
    expect(rows[0].payment_method).toBe('upi');
    expect(rows[0].payment_status).toBe('failed');
    expect(rows[0].failure_reason).toBe('bank_error');
    expect(Number(rows[0].payment_amount)).toBe(100);
    expect(rows[1].payment_method).toBe('credit_card');
    expect(rows[1].failure_reason).toBe('declined_by_bank');
    expect(Number(rows[1].payment_amount)).toBe(200);
    expect(rows[1].payment_id).toBe('p2');
  });
});
