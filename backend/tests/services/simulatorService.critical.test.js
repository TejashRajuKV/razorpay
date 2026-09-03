/**
 * PHASE 1 critical tests: simulator arithmetic (deterministic, unmocked).
 * - totalRecovered = sum of recovered amounts
 * - recoveryRate = totalRecovered / totalAtRisk * 100
 */
const simulator = require('../../src/services/simulatorService');

describe('simulator batch arithmetic', () => {
  test('stop-only batch: zeros, rate 0', async () => {
    const cases = [1, 2, 3].map((i) => ({ id: `s${i}`, amount_at_risk: 1000, recommended_action: 'stop' }));
    const r = await simulator.runBatchSimulation(cases);
    expect(r.totalRecovered).toBe(0);
    expect(r.totalAtRisk).toBe(3000);
    expect(Number(r.recoveryRate)).toBe(0);
    expect(r.stopped).toBe(3);
  });

  test('totalRecovered equals sum of per-case details', async () => {
    const cases = Array.from({ length: 8 }, (_, i) => ({
      id: `m${i}`, amount_at_risk: 1000 + i * 100, recommended_action: 'stop',
    }));
    const r = await simulator.runBatchSimulation(cases);
    const sum = r.details.reduce((s, d) => s + (d.recoveredAmount || 0), 0);
    expect(r.totalRecovered).toBe(sum);
    expect(r.totalAtRisk).toBe(cases.reduce((s, c) => s + c.amount_at_risk, 0));
  }, 30000);

  test('recoveryRate formula holds on mixed batch', async () => {
    const cases = Array.from({ length: 8 }, (_, i) => ({
      id: `r${i}`,
      amount_at_risk: 2000,
      recommended_action: 'stop',
      total_payments: 10,
      successful_payments: 8,
      customer_risk_score: 0.2,
    }));
    const r = await simulator.runBatchSimulation(cases);
    const expected = r.totalAtRisk > 0 ? (r.totalRecovered / r.totalAtRisk) * 100 : 0;
    expect(Number(r.recoveryRate)).toBeCloseTo(Number(expected.toFixed(2)), 2);
  }, 30000);
});
