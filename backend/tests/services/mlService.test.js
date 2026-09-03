/**
 * Unit tests: mlService fallback contract.
 * Points ML at a closed port so the real network-failure path executes.
 */
describe('mlService fallback', () => {
  let ml;
  beforeEach(() => {
    jest.resetModules();
    process.env.ML_SERVICE_URL = 'http://127.0.0.1:9';
    process.env.ML_SERVICE_TIMEOUT = '1000';
    ml = require('../../src/services/mlService');
  });
  afterEach(() => {
    delete process.env.ML_SERVICE_URL;
    delete process.env.ML_SERVICE_TIMEOUT;
  });

  test('checkHealth returns false when Python is down', async () => {
    await expect(ml.checkHealth()).resolves.toBe(false);
  }, 10000);

  test('predictRisk falls back with explicit source flag', async () => {
    const r = await ml.predictRisk({ amount: 5000, total_payments: 4, successful_payments: 3 });
    expect(r.source).toBe('fallback');
    expect(r.riskProbability).toBeGreaterThanOrEqual(0.1);
    expect(r.riskProbability).toBeLessThanOrEqual(0.95);
  }, 10000);

  test('diagnose falls back with explicit source flag', async () => {
    const r = await ml.diagnose({ failure_reason: 'bank_error', total_payments: 2, successful_payments: 2 });
    expect(r.source).toBe('fallback');
    expect(typeof r.diagnosis).toBe('string');
  }, 10000);

  test('getRecoveryProbabilities falls back with all six actions', async () => {
    const r = await ml.getRecoveryProbabilities(
      { successful_payments: 1, total_payments: 5 },
      { diagnosis: 'temporary_failure' },
    );
    for (const a of ['retry', 'reminder', 'payment_link', 'retry_later', 'escalate', 'stop']) {
      expect(r).toHaveProperty(a);
    }
    expect(r._source).toBe('fallback');
  }, 10000);

  test('batchPredict throws when Python is down (pinned inconsistency)', async () => {
    await expect(ml.batchPredict([])).rejects.toThrow();
  }, 10000);
});
