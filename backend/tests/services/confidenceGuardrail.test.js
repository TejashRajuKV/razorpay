jest.mock('../../src/config/database', () => ({ query: jest.fn(async () => []) }));
jest.mock('../../src/services/outcomeFeedbackService', () => ({ getHistoricalAdjustment: jest.fn(async () => 0) }));
jest.mock('../../src/services/simulatorService', () => ({ executeAction: jest.fn() }));
const recoveryService = require('../../src/services/recoveryService');

describe('confidence vs priority_score', () => {
  test('high-value + low genuine confidence blocks retry but allows escalate', async () => {
    const c = { id: 'x', status: 'open', amount_at_risk: 90000, diagnosis_confidence: 0.1, priority_score: 0.9 };
    const blocked = await recoveryService.checkStoppingRules(c, 'retry');
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toMatch(/escalation/i);
    const ok = await recoveryService.checkStoppingRules(c, 'escalate');
    expect(ok.allowed).toBe(true);
  });

  test('high priority alone does NOT mean high confidence (no genuine confidence => not blocked)', async () => {
    const c = { id: 'x', status: 'open', amount_at_risk: 90000, priority_score: 0.95 };
    const r = await recoveryService.checkStoppingRules(c, 'retry');
    expect(r.allowed).toBe(true);
  });

  test('normal confidence case not escalated; decision exposes confidence + priorityScore', async () => {
    const c = { id: 'x', status: 'open', amount_at_risk: 90000, priority_score: 0.9, diagnosis_confidence: 0.85 };
    const r = await recoveryService.checkStoppingRules(c, 'retry');
    expect(r.allowed).toBe(true);
    const d = await recoveryService.decideBestSafeAction(c, { retry: 0.7, escalate: 0.1 }, { confidence: 0.85, diagnosis: 'temporary_failure' });
    expect(d.confidence).toBeCloseTo(0.85);
    expect(d.priorityScore).toBeCloseTo(0.9);
    expect(d.action).toBe('retry');
    expect(d.probability).toBeDefined();
    expect(d.expectedRecovery).toBeDefined();
  });
});
