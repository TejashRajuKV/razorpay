jest.mock('../../src/config/database', () => ({ query: jest.fn() }));
jest.mock('../../src/services/auditService', () => ({ logEvent: jest.fn(async () => 'a1') }));
jest.mock('../../src/services/simulatorService', () => ({ executeAction: jest.fn() }));
jest.mock('../../src/services/outcomeFeedbackService', () => ({
  recordOutcome: jest.fn(async () => ({})),
  getHistoricalAdjustment: jest.fn(async () => 0),
  getActionDiagnosisAdjustment: jest.fn(async () => ({ adjustment: 0, sampleCount: 0 })),
}));
jest.mock('../../src/services/customerResponseService', () => ({ markPromiseFulfilled: jest.fn(async () => ({})) }));

const db = require('../../src/config/database');
const simulatorService = require('../../src/services/simulatorService');
const recoveryService = require('../../src/services/recoveryService');

const CASE_ROW = { id: 'stop-1', customer_id: 'cu1', amount_at_risk: 1000, status: 'open', diagnosis: 'network_timeout' };

function mockDb({ stopped }) {
  db.query.mockImplementation(async (sql) => {
    if (typeof sql === 'string' && sql.includes("FROM system_config")) {
      return stopped ? [{ value: 'true' }] : [];
    }
    if (typeof sql === 'string' && sql.includes('FROM recovery_cases rc')) return [CASE_ROW];
    if (typeof sql === 'string' && sql.includes('COUNT(*)')) return [{ count: 0 }];
    return [];
  });
}

describe('global STOP enforcement', () => {
  beforeEach(() => jest.clearAllMocks());

  test('executeRecoveryAction blocked while stop active, simulator never called', async () => {
    mockDb({ stopped: true });
    const res = await recoveryService.executeRecoveryAction('stop-1', 'retry');
    expect(res.blocked).toBe(true);
    expect(res.reason).toBe('GLOBAL_STOP_ACTIVE');
    expect(simulatorService.executeAction).not.toHaveBeenCalled();
  });

  test('release re-enables execution (run-workflow and run-batch funnel here)', async () => {
    mockDb({ stopped: false });
    simulatorService.executeAction.mockResolvedValue({ success: true, message: 'ok', recoveredAmount: 1000 });
    const res = await recoveryService.executeRecoveryAction('stop-1', 'retry');
    expect(res.success).toBe(true);
    expect(simulatorService.executeAction).toHaveBeenCalledTimes(1);
  });
});
