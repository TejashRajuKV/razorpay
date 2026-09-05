jest.mock('../../src/config/database', () => ({ query: jest.fn() }));
const db = require('../../src/config/database');
const recoveryService = require('../../src/services/recoveryService');

describe('case list payment data', () => {
  beforeEach(() => jest.clearAllMocks());

  test('list query joins payments and returns actual method', async () => {
    db.query.mockResolvedValueOnce([
      { id: 'c1', payment_method: 'upi', payment_status: 'failed', failure_reason: 'bank_error', payment_amount: 100, payment_id: 'p1', payment_date: '2026-09-01T10:00:00.000Z' },
      { id: 'c2', payment_method: 'credit_card', payment_status: 'failed', failure_reason: 'declined_by_bank', payment_amount: 200, payment_id: 'p2', payment_date: '2026-09-02T10:00:00.000Z' },
      { id: 'c3', payment_method: 'debit_card', payment_status: 'abandoned', failure_reason: null, payment_amount: 300, payment_id: 'p3', payment_date: '2026-09-03T10:00:00.000Z' },
      { id: 'c4', payment_method: 'net_banking', payment_status: 'failed', failure_reason: 'transaction_timeout', payment_amount: 400, payment_id: 'p4', payment_date: '2026-09-04T10:00:00.000Z' },
      { id: 'c5', payment_method: null, payment_status: null, failure_reason: null, payment_amount: null, payment_id: null, payment_date: null },
    ]);
    const rows = await recoveryService.getRecoveryCases({});
    const sql = db.query.mock.calls[0][0];
    expect(sql).toMatch(/LEFT JOIN payments p ON/i);
    expect(sql).toMatch(/payment_method/);
    expect(sql).toMatch(/payment_status/);
    expect(sql).toMatch(/failure_reason/);
    expect(sql).toMatch(/payment_amount/);
    expect(sql).toMatch(/payment_date/);
    const methods = rows.slice(0, 4).map((r) => r.payment_method);
    expect(methods).toEqual(['upi', 'credit_card', 'debit_card', 'net_banking']);
    expect(rows[0].payment_status).toBe('failed');
    expect(rows[0].failure_reason).toBe('bank_error');
    expect(Number(rows[0].payment_amount)).toBe(100);
    expect(rows[0].payment_date).toBe('2026-09-01T10:00:00.000Z');
    expect(rows[1].payment_method).toBe('credit_card');
    expect(rows[1].failure_reason).toBe('declined_by_bank');
    expect(Number(rows[1].payment_amount)).toBe(200);
    expect(rows[1].payment_id).toBe('p2');
    expect(rows[2].payment_method).toBe('debit_card');
    expect(rows[2].payment_status).toBe('abandoned');
    expect(rows[3].payment_method).toBe('net_banking');
    expect(rows[3].failure_reason).toBe('transaction_timeout');
    expect(rows[4].payment_method).toBeNull();
  });
});
