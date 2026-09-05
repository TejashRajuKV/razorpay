jest.mock('../../src/services/recoveryService', () => ({
  checkStoppingRules: jest.fn(async () => ({ allowed: true })),
  buildRecoveryPlan: jest.fn((d) => [
    { step: 1, action: 'retry', wait_min: 5, reason: 't' },
    { step: 2, action: 'reminder', wait_min: 60, reason: 't' },
    { step: 3, action: 'escalate', wait_min: 0, reason: 't' },
  ]),
}));
jest.mock('../../src/services/simulatorService', () => ({
  executeAction: jest.fn(async () => ({ success: true, message: 'ok', recoveredAmount: 1000 })),
  ACTION_SUCCESS_RATES: {},
}));
jest.mock('../../src/services/incentiveService', () => ({
  recommendIncentive: jest.fn(() => ({ incentiveAmount: 0 })),
}));

const svc = require('../../src/services/strategySimulatorService');

const CASES = [
  { id: 's1', amount_at_risk: 5000, diagnosis: 'network_timeout' },
  { id: 's2', amount_at_risk: 8000, diagnosis: 'abandoned' },
];

describe('strategy baselines', () => {
  test('NO_ACTION recovers nothing on the same batch', async () => {
    const r = await svc.runStrategy(CASES, []);
    expect(r.recovered).toBe(0);
    expect(r.successful).toBe(0);
    expect(r.cases).toBe(2);
  });

  test('compareWithBaselines includes dumb baselines plus engineered strategies', async () => {
    const c = await svc.compareWithBaselines(CASES);
    for (const k of ['NO_ACTION', 'FIXED_RETRY', 'RULE_BASELINE', 'A', 'B', 'C']) {
      expect(c.strategies[k]).toBeDefined();
    }
    expect(c.casesEvaluated).toBe(2);
    expect(typeof c.winner).toBe('string');
  });
});
