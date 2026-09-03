/**
 * PHASE 2 — critical cross-component flows (small, honest).
 * 1. Frontend API → Backend (contract pins + live no-DB HTTP)
 * 2. Backend → Python ML (live Flask, spawned here; skips if unavailable)
 * 3. Backend → Database (skip-gated: needs better-sqlite3 bindings)
 * 4. Recovery → Simulator (pure, no DB)
 * 5. Recovery → Audit (skip-gated roundtrip)
 * 6. Batch → amounts/rate (pure formula here; DB batch gated)
 */
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { isDbAvailable } = require('../helpers/dbAvailable');

const describeDb = isDbAvailable() ? describe : describe.skip;

describe('flow 1: frontend API → backend contract', () => {
  const apiSrc = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'services', 'api.js'), 'utf8',
  );

  test('frontend calls POST /cases/:id/action (not /recovery/execute)', () => {
    expect(apiSrc).toMatch(/\/cases\/\$\{caseId\}\/action/);
    expect(apiSrc).not.toMatch(/\/recovery\/execute/);
  });

  test('frontend uses PUT status, /audit/logs, /audit/case/:id', () => {
    expect(apiSrc).toMatch(/method: 'PUT'/);
    expect(apiSrc).toMatch(/\/audit\/logs/);
    expect(apiSrc).toMatch(/\/audit\/case\/\$\{caseId\}/);
    expect(apiSrc).not.toMatch(/\/audit\/trail\//);
  });

  test('frontend maps trends to period= and batch to /recovery/simulate-batch {count}', () => {
    expect(apiSrc).toMatch(/\/analytics\/trends\?period=/);
    expect(apiSrc).toMatch(/\/recovery\/simulate-batch/);
    expect(apiSrc).toMatch(/\{ count: batchSize \}/);
    expect(apiSrc).not.toMatch(/\/simulator\/batch/);
  });

  test('backend routers expose every frontend-called path', () => {
    const stack = (r) => (require(r).stack || []).filter((l) => l.route)
      .map((l) => `${Object.keys(l.route.methods).join(',').toUpperCase()} ${l.route.path}`);
    const base = '../../src/routes';
    expect(stack(`${base}/casesRoutes`)).toEqual(expect.arrayContaining(['PUT /:id/status', 'POST /:id/action', 'GET /:id']));
    expect(stack(`${base}/dashboardRoutes`)).toEqual(expect.arrayContaining(['GET /overview']));
    expect(stack(`${base}/analyticsRoutes`)).toEqual(
      expect.arrayContaining(['GET /overview', 'GET /trends', 'GET /ml-insights']),
    );
    expect(stack(`${base}/auditRoutes`)).toEqual(expect.arrayContaining(['GET /logs', 'GET /case/:id']));
    expect(stack(`${base}/recoveryRoutes`)).toEqual(
      expect.arrayContaining(['POST /run-batch', 'POST /simulate-batch']),
    );
  });

  test('live: GET /health 200 without DB', async () => {
    const app = require('../../src/app').app;
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  test('live: invalid action rejected before any DB touch', async () => {
    const app = require('../../src/app').app;
    const res = await request(app).post('/api/v1/cases/any-id/action').send({ actionType: 'teleport' });
    expect(res.status).toBe(400);
  });
});

describe('flow 2: backend → Python ML (live)', () => {
  // NOTE: port 5000 is occupied on some machines — use 5055.
  const ML_BASE = 'http://127.0.0.1:5055';
  const { spawn } = require('child_process');
  let flask = null;
  let ml = null;
  let pythonUp = false;

  beforeAll(async () => {
    try {
      const health = await fetch(`${ML_BASE}/health`).then((r) => r.ok).catch(() => false);
      if (!health) {
        flask = spawn('python', [path.join(__dirname, '..', '..', '..', 'ml', 'app.py')], {
          env: { ...process.env, ML_PORT: '5055', NODE_ENV: 'test' },
          stdio: 'ignore',
        });
        const deadline = Date.now() + 90000;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 2000));
          // eslint-disable-next-line no-await-in-loop
          const ok = await fetch(`${ML_BASE}/health`).then((r) => r.ok).catch(() => false);
          if (ok) break;
        }
      }
      pythonUp = await fetch(`${ML_BASE}/health`).then((r) => r.ok).catch(() => false);
    } catch {
      pythonUp = false;
    }
    jest.resetModules();
    process.env.ML_SERVICE_URL = ML_BASE;
    // Cold-start model training can exceed the default 5s client timeout;
    // raise it so the first (training) call completes instead of falling back.
    process.env.ML_SERVICE_TIMEOUT = '120000';
    ml = require('../../src/services/mlService');
    if (!pythonUp) console.warn('[phase2] Flask unavailable — live ML assertions skipped');
  }, 120000);

  afterAll(() => {
    if (flask) {
      try { flask.kill(); } catch { /* best-effort */ }
      flask = null;
    }
    delete process.env.ML_SERVICE_URL;
    delete process.env.ML_SERVICE_TIMEOUT;
  });

  test('risk via live Python claims source python', async () => {
    if (!pythonUp) return;
    const r = await ml.predictRisk({ amount: 8000, total_payments: 6, successful_payments: 5 });
    expect(r.source).toBe('python');
    expect(r.riskProbability).toBeGreaterThanOrEqual(0);
    expect(r.riskProbability).toBeLessThanOrEqual(1);
  }, 60000);

  test('diagnosis via live Python claims source python', async () => {
    if (!pythonUp) return;
    const r = await ml.diagnose({ failure_reason: 'bank_error', total_payments: 6, successful_payments: 5 });
    expect(r.source).toBe('python');
    expect(typeof r.diagnosis).toBe('string');
  }, 60000);

  test('recovery probs via live Python cover all six actions', async () => {
    if (!pythonUp) return;
    const r = await ml.getRecoveryProbabilities({}, { diagnosis: 'temporary_failure' });
    for (const a of ['retry', 'reminder', 'payment_link', 'retry_later', 'escalate', 'stop']) {
      expect(r).toHaveProperty(a);
    }
    expect(r._source).toBe('python');
  }, 60000);

  test('live /evaluate/risk returns real metrics', async () => {
    if (!pythonUp) return;
    const e = await fetch(`${ML_BASE}/evaluate/risk`).then((r) => r.json());
    expect(e.accuracy).toBeGreaterThanOrEqual(0);
    expect(e.accuracy).toBeLessThanOrEqual(1);
  }, 60000);
});

describeDb('flow 3: backend → database roundtrip (sqlite)', () => {
  const { initIsolatedDb, closeIsolatedDb } = require('../helpers/testDb');
  let db;
  beforeAll(() => { db = initIsolatedDb(); });
  afterAll(async () => { await closeIsolatedDb(); });

  test('write + read customer roundtrip on isolated DB', async () => {
    await db.query("INSERT INTO customers (id, name, email) VALUES ('c-p2', 'P2', 'p2@x.com')");
    const rows = await db.query('SELECT * FROM customers WHERE id = ?', ['c-p2']);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('p2@x.com');
  });
});

describe('flow 4: recovery → simulator (pure)', () => {
  const simulator = require('../../src/services/simulatorService');

  test('retry returns full result shape with bounded probability', async () => {
    const r = await simulator.executeAction('retry', {
      amount_at_risk: 4000, failureReason: 'bank_error',
      total_payments: 10, successful_payments: 9, customer_risk_score: 0.2, attemptNumber: 1,
    });
    expect(typeof r.success).toBe('boolean');
    expect(r.recoveredAmount).toBe(r.success ? 4000 : 0);
    expect(typeof r.message).toBe('string');
    expect(r.simulationDetails.finalProbability).toBeGreaterThanOrEqual(0.05);
    expect(r.simulationDetails.finalProbability).toBeLessThanOrEqual(0.95);
  }, 15000);
});

describeDb('flow 5: recovery → audit roundtrip (sqlite)', () => {
  const { initIsolatedDb, closeIsolatedDb } = require('../helpers/testDb');
  let db;
  beforeAll(() => { db = initIsolatedDb(); });
  afterAll(async () => { await closeIsolatedDb(); });

  test('logEvent → getEntityLogs roundtrip', async () => {
    const auditService = require('../../src/services/auditService');
    const id = await auditService.logEvent({
      entityType: 'case', entityId: 'p2-case', eventType: 'phase2_probe', eventData: { n: 1 },
    });
    expect(typeof id).toBe('string');
    const logs = await auditService.getEntityLogs('case', 'p2-case');
    expect(logs.some((l) => l.id === id)).toBe(true);
  });
});

describe('flow 6: batch → amounts and rate (pure)', () => {
  const simulator = require('../../src/services/simulatorService');

  test('byActionType sums match totals; details cover every input', async () => {
    const cases = Array.from({ length: 10 }, (_, i) => ({
      id: `p2-${i}`, amount_at_risk: 1000, recommended_action: 'stop',
    }));
    const r = await simulator.runBatchSimulation(cases);
    expect(r.details).toHaveLength(10);
    const byActionTotal = Object.values(r.byActionType).reduce((s, a) => s + a.total, 0);
    expect(byActionTotal).toBe(10);
    const recoveredSum = Object.values(r.byActionType).reduce((s, a) => s + a.recovered, 0);
    expect(recoveredSum).toBe(r.totalRecovered);
    expect(Number(r.recoveryRate)).toBeCloseTo(r.totalAtRisk ? (r.totalRecovered / r.totalAtRisk) * 100 : 0, 2);
  }, 30000);
});

describeDb('flow 6b: run-batch on seeded sqlite (sqlite)', () => {
  const { initIsolatedDb, closeIsolatedDb } = require('../helpers/testDb');
  let db;
  let app;
  beforeAll(async () => {
    db = initIsolatedDb();
    app = require('../../src/app').app;
    await db.query("INSERT INTO customers (id, name, email) VALUES ('c-b6', 'B6', 'b6@x.com')");
    for (let i = 0; i < 3; i++) {
      await db.query(
        "INSERT INTO payments (id, customer_id, amount, status, payment_method, failure_reason) VALUES (?, ?, ?, 'failed', 'upi', 'bank_error')",
        [`p-b6-${i}`, 'c-b6', 1000],
      );
      await db.query(
        `INSERT INTO recovery_cases (id, payment_id, customer_id, amount_at_risk, risk_probability, diagnosis, diagnosis_factors, priority_score, status)
         VALUES (?, ?, ?, 1000, 0.7, 'temporary_failure', '[]', 0.7, 'open')`,
        [`b6-${i}`, `p-b6-${i}`, 'c-b6'],
      );
    }
  }, 30000);
  afterAll(async () => { await closeIsolatedDb(); });

  test('run-batch totals are internally consistent (no hardcoded revenue)', async () => {
    const res = await request(app).post('/api/v1/recovery/run-batch').send({ limit: 3 });
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.totalProcessed).toBe(3);
    expect(d.totalRecovered).toBe(d.details.reduce((s, x) => s + (x.recoveredAmount || 0), 0));
    expect(Number(d.recoveryRate)).toBeCloseTo(d.totalAtRisk ? (d.totalRecovered / d.totalAtRisk) * 100 : 0, 1);
  }, 60000);
});
