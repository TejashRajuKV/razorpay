/**
 * Unit tests: simulatorService (deterministic parts + stop-action contract).
 */
const simulator = require('../../src/services/simulatorService');

describe('simulatorService', () => {
  test('ACTION_SUCCESS_RATES covers all backend actions', () => {
    for (const a of ['retry', 'reminder', 'payment_link', 'retry_later', 'escalate', 'stop']) {
      expect(simulator.ACTION_SUCCESS_RATES).toHaveProperty(a);
    }
  });

  test('generateSyntheticPayments returns requested count with valid statuses', () => {
    const { payments } = simulator.generateSyntheticPayments(50);
    expect(payments).toHaveLength(50);
    for (const p of payments) {
      expect(['success', 'failed', 'abandoned']).toContain(p.status);
      expect(p.amount).toBeGreaterThan(0);
    }
  });

  test('executeAction(stop) never recovers', async () => {
    const res = await simulator.executeAction('stop', { amount_at_risk: 10000 });
    expect(res.success).toBe(false);
    expect(res.recoveredAmount).toBe(0);
  });

  test('runBatchSimulation arithmetic is exact on stop-only batch', async () => {
    const cases = [1, 2, 3].map((i) => ({ id: `c${i}`, amount_at_risk: 1000, recommended_action: 'stop' }));
    const r = await simulator.runBatchSimulation(cases);
    expect(r.totalCases).toBe(3);
    expect(r.stopped).toBe(3);
    expect(r.totalRecovered).toBe(0);
    expect(r.totalAtRisk).toBe(3000);
  });
});
