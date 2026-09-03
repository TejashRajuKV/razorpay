/**
 * PHASE 1: ML source-flag contract against a LIVE Python service.
 * Skips honestly when Python is not running (CI without ML).
 * Run Python first: `python ml/app.py` (port 5000).
 */
describe('mlService live-python contract', () => {
  let ml;
  let pythonUp = false;

  beforeAll(async () => {
    jest.resetModules();
    delete process.env.ML_SERVICE_URL;
    ml = require('../../src/services/mlService');
    try {
      pythonUp = await ml.checkHealth();
    } catch {
      pythonUp = false;
    }
    if (!pythonUp) console.warn('[live] Python ML down — live assertions skipped');
  }, 15000);

  test('python available → risk source is "python"', async () => {
    if (!pythonUp) return;
    const r = await ml.predictRisk({ amount: 5000, total_payments: 5, successful_payments: 4 });
    expect(r.source).toBe('python');
  }, 15000);

  test('python available → diagnosis source is "python"', async () => {
    if (!pythonUp) return;
    const r = await ml.diagnose({ failure_reason: 'bank_error' });
    expect(r.source).toBe('python');
  }, 15000);

  test('fallback never claims source "python"', async () => {
    jest.resetModules();
    process.env.ML_SERVICE_URL = 'http://127.0.0.1:9';
    process.env.ML_SERVICE_TIMEOUT = '1000';
    const fallbackMl = require('../../src/services/mlService');
    const [risk, diag, probs] = await Promise.all([
      fallbackMl.predictRisk({ amount: 1, total_payments: 1, successful_payments: 1 }),
      fallbackMl.diagnose({ failure_reason: 'x' }),
      fallbackMl.getRecoveryProbabilities({}, { diagnosis: 'temporary_failure' }),
    ]);
    expect(risk.source).not.toBe('python');
    expect(diag.source).not.toBe('python');
    expect(probs._source).not.toBe('python');
    delete process.env.ML_SERVICE_URL;
    delete process.env.ML_SERVICE_TIMEOUT;
  }, 15000);
});
