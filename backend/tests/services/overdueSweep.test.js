jest.mock('../../src/config/database', () => ({ query: jest.fn() }));
jest.mock('../../src/services/auditService', () => ({ logEvent: jest.fn(async () => 'a1') }));
const db = require('../../src/config/database');
const svc = require('../../src/services/customerResponseService');

const PAST = new Date(Date.now() - 48 * 3600e3).toISOString();

describe('settleAllDuePromises sweep', () => {
  beforeEach(() => jest.clearAllMocks());

  test('overdue PROMISED across cases becomes MISSED without reading records', async () => {
    db.query.mockImplementation(async (sql, params) => {
      if (typeof sql === 'string' && sql.includes('DISTINCT case_id')) {
        return [{ case_id: 'c1' }, { case_id: 'c2' }];
      }
      if (typeof sql === 'string' && sql.includes("promise_status = 'PROMISED'")) {
        return [{ id: 'r1', promised_at: PAST }];
      }
      if (typeof sql === 'string' && sql.includes('FROM recovery_cases')) {
        return [{ status: 'open' }];
      }
      return [];
    });
    const res = await svc.settleAllDuePromises();
    expect(res.settled).toBe(2);
    expect(res.missed).toBe(2);
    const updates = db.query.mock.calls.filter((c) => String(c[0]).includes("promise_status = 'MISSED'"));
    expect(updates.length).toBe(2);
  });

  test('sweep never throws on DB failure', async () => {
    db.query.mockRejectedValueOnce(new Error('no db'));
    const res = await svc.settleAllDuePromises();
    expect(res).toEqual({ settled: 0, missed: 0 });
  });
});
