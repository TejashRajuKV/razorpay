jest.mock('../../src/config/database', () => ({ query: jest.fn() }));
jest.mock('../../src/services/outcomeFeedbackService', () => ({
  getHistoricalAdjustment: jest.fn(async () => 0),
  getActionDiagnosisAdjustment: jest.fn(async () => ({ adjustment: 0, sampleCount: 0 })),
}));
jest.mock('../../src/services/simulatorService', () => ({ executeAction: jest.fn() }));

const db = require('../../src/config/database');
const recoveryService = require('../../src/services/recoveryService');
const { calculateRecoveryScore } = require('../../src/services/customerProfileService');

describe('sections 2-4 slice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockImplementation(async (sql) => {
      if (typeof sql === 'string' && sql.includes('SELECT action_type FROM recovery_actions')) return [];
      if (typeof sql === 'string' && sql.includes('COUNT(*)')) return [{ count: 0 }];
      return [];
    });
  });

  test('isQuietHours: 23:15 IST blocked, 10:00 IST allowed', () => {
    expect(recoveryService.isQuietHours(new Date('2026-09-05T17:45:00Z'))).toBe(true);
    expect(recoveryService.isQuietHours(new Date('2026-09-05T04:30:00Z'))).toBe(false);
  });

  test('quiet hours blocks reminder but not retry', async () => {
    const RealDate = Date;
    const quiet = new RealDate('2026-09-05T17:45:00Z');
    jest.spyOn(global, 'Date').mockImplementation((...a) => (a.length ? new RealDate(...a) : quiet));
    try {
      const base = { id: 'q1', status: 'open', amount_at_risk: 1000, diagnosis_confidence: 0.9 };
      const blocked = await recoveryService.checkStoppingRules(base, 'reminder');
      expect(blocked.allowed).toBe(false);
      expect(blocked.reason).toMatch(/QUIET_HOURS/);
      const ok = await recoveryService.checkStoppingRules(base, 'retry');
      expect(ok.allowed).toBe(true);
    } finally {
      global.Date.mockRestore();
    }
  });

  test('idempotencyKey deterministic 32-hex', () => {
    const a = recoveryService.idempotencyKey('c1', 'retry', 1);
    expect(a).toBe(recoveryService.idempotencyKey('c1', 'retry', 1));
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(recoveryService.idempotencyKey('c1', 'retry', 2));
  });

  test('fatigue penalizes repeated action; rejected explains why-not', async () => {
    db.query.mockImplementation(async (sql) => {
      if (typeof sql === 'string' && sql.includes('SELECT action_type FROM recovery_actions')) {
        return [{ action_type: 'retry' }, { action_type: 'retry' }];
      }
      if (typeof sql === 'string' && sql.includes('COUNT(*)')) return [{ count: 0 }];
      return [];
    });
    const c = { id: 'f1', status: 'open', amount_at_risk: 1000, diagnosis_confidence: 0.9, priority_score: 0.5, diagnosis: 'network_timeout' };
    const d = await recoveryService.decideBestSafeAction(
      c, { retry: 0.7, reminder: 0.69, escalate: 0.1 }, { confidence: 0.9, diagnosis: 'network_timeout' }
    );
    const retry = d.candidates.find((x) => x.action === 'retry');
    expect(retry.fatiguePenalty).toBe(0.6);
    expect(Array.isArray(d.rejected)).toBe(true);
    expect(d.rejected.length).toBeGreaterThan(0);
    expect(typeof d.rejected[0].whyNot).toBe('string');
  });

  test('calculateRecoveryScore tiers', () => {
    const high = calculateRecoveryScore({ payment_success_rate: 0.95, recovery_success_rate: 0.9, days_since_last_success: 1, avg_amount: 12000, total_payments: 30 });
    expect(high.tier).toBe('HIGH');
    const low = calculateRecoveryScore({ payment_success_rate: 0.1, recovery_success_rate: 0, days_since_last_success: 60, avg_amount: 500, total_payments: 1 });
    expect(low.tier).toBe('LOW');
  });
});
