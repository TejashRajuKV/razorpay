jest.mock('../../src/config/database', () => ({ query: jest.fn() }));
jest.mock('../../src/services/auditService', () => ({ logEvent: jest.fn(async () => ({})) }));
jest.mock('../../src/services/simulatorService', () => ({ executeAction: jest.fn() }));
jest.mock('../../src/services/outcomeFeedbackService', () => ({ recordOutcome: jest.fn(async () => ({})) }));
jest.mock('../../src/services/customerResponseService', () => ({ markPromiseFulfilled: jest.fn(async () => ({})) }));

const db = require('../../src/config/database');
const simulatorService = require('../../src/services/simulatorService');
const customerResponseService = require('../../src/services/customerResponseService');
const recoveryService = require('../../src/services/recoveryService');

describe('promise-to-pay lifecycle wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('FROM recovery_cases rc')) return [{ id: 'c1', customer_id: 'cu1', amount_at_risk: 1000, status: 'open' }];
      if (sql.includes('COUNT(*)')) return [{ count: 0 }];
      return [];
    });
  });

  test('successful recovery fulfills promise', async () => {
    simulatorService.executeAction.mockResolvedValue({ success: true, message: 'ok', recoveredAmount: 1000 });
    const res = await recoveryService.executeRecoveryAction('c1', 'retry');
    expect(res.success).toBe(true);
    expect(customerResponseService.markPromiseFulfilled).toHaveBeenCalledWith('c1', 1000);
  });

  test('failed recovery does NOT fulfill promise', async () => {
    simulatorService.executeAction.mockResolvedValue({ success: false, message: 'no', recoveredAmount: 0 });
    const res = await recoveryService.executeRecoveryAction('c1', 'retry');
    expect(res.success).toBe(false);
    expect(customerResponseService.markPromiseFulfilled).not.toHaveBeenCalled();
  });
});
