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
    expect(db.query.mock.calls[0][0]).toMatch(/JOIN payments p ON/i);
    expect(db.query.mock.calls[0][0]).toMatch(/payment_method/);
    expect(rows[0].payment_method).toBe('upi');
    expect(rows[1].payment_method).toBe('credit_card');
    expect(rows[1].payment_id).toBe('p2');
  });
});
