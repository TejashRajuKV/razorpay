/**
 * Unit tests: recoveryService safety rules + config.
 * No DB needed for resolved/stopped paths (blocked before any query).
 */
const recoveryService = require('../../src/services/recoveryService');

describe('recoveryService', () => {
  test('exports expected functions', () => {
    for (const fn of [
      'detectRevenueAtRisk', 'createRecoveryCase', 'decideRecoveryAction',
      'executeRecoveryAction', 'getRecoveryCase', 'getRecoveryCases',
      'runRecoveryWorkflow', 'checkStoppingRules',
    ]) {
      expect(typeof recoveryService[fn]).toBe('function');
    }
  });

  test('CONFIG has sane safety bounds', () => {
    const { CONFIG } = recoveryService;
    expect(CONFIG.MAX_RETRY_ATTEMPTS).toBeGreaterThanOrEqual(1);
    expect(CONFIG.MAX_RECOVERY_ATTEMPTS).toBeGreaterThanOrEqual(CONFIG.MAX_RETRY_ATTEMPTS);
    expect(CONFIG.RETRY_COOLDOWN_MINUTES).toBeGreaterThan(0);
    expect(CONFIG.HIGH_VALUE_THRESHOLD).toBeGreaterThan(0);
  });

  test('checkStoppingRules blocks already-resolved cases without DB', async () => {
    const res = await recoveryService.checkStoppingRules({ id: 'x', status: 'resolved' }, 'retry');
    expect(res.allowed).toBe(false);
    expect(res.reason).toMatch(/resolved/i);
  });

  test('checkStoppingRules blocks already-stopped cases without DB', async () => {
    const res = await recoveryService.checkStoppingRules({ id: 'x', status: 'stopped' }, 'retry');
    expect(res.allowed).toBe(false);
    expect(res.reason).toMatch(/stopped/i);
  });

  test('calculatePriorityScore: max inputs → 1.0', () => {
    expect(recoveryService.calculatePriorityScore(100000, 1, 1)).toBeCloseTo(1.0);
  });

  test('calculatePriorityScore: zero inputs → 0', () => {
    expect(recoveryService.calculatePriorityScore(0, 0, 0)).toBeCloseTo(0);
  });

  test('calculatePriorityScore: amount capped at 100000 normalization', () => {
    expect(recoveryService.calculatePriorityScore(500000, 0, 0))
      .toBeCloseTo(recoveryService.calculatePriorityScore(100000, 0, 0));
  });
});
