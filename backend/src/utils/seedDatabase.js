#!/usr/bin/env node
/**
 * Deterministic demo-data seeder.
 *
 * Rebuilds the SQLite database with a synthetic demo merchant dataset:
 *   - ~1,000 customers across the existing customer_segment values
 *   - ~10,000 payments with realistic statuses, methods and failure reasons
 *   - a manageable set of pre-created recovery cases (the rest stay detectable
 *     through POST /api/v1/recovery/detect at runtime)
 *
 * This is SYNTHETIC demo merchant data — not real Razorpay production data.
 *
 * Determinism: the same SEED_VALUE always produces the same logical dataset
 * (same ids, counts and distributions). Override with SEED_VALUE=<n>.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');

const dbPathRaw = process.env.DB_PATH || path.join(__dirname, '../../data/revenue_recovery.db');
// Relative DB_PATH is resolved against the backend root (matches config/database.js usage)
const dbPath = path.isAbsolute(dbPathRaw) ? dbPathRaw : path.join(__dirname, '../..', dbPathRaw);

// Backup existing database before deletion (if it exists)
if (fs.existsSync(dbPath)) {
  const backupPath = dbPath + '.backup.' + Date.now();
  try {
    // Copy main database file
    fs.copyFileSync(dbPath, backupPath);
    console.log('[Seed] Backup created:', backupPath);
    
    // Also backup WAL files if they exist
    for (const suffix of ['-wal', '-shm']) {
      const sourceFile = dbPath + suffix;
      const backupFile = backupPath + suffix;
      if (fs.existsSync(sourceFile)) {
        fs.copyFileSync(sourceFile, backupFile);
        console.log('[Seed] Backup created:', backupFile);
      }
    }
  } catch (error) {
    console.error('[Seed] Warning: Failed to create backup:', error.message);
    console.log('[Seed] Proceeding with deletion without backup...');
  }
}

// Remove existing database (and WAL sidecars) to ensure a clean rebuild
for (const suffix of ['', '-wal', '-shm']) {
  const file = dbPath + suffix;
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log('[Seed] Removed existing file:', file);
  }
}
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const Database = require('better-sqlite3');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const schema = fs.readFileSync(path.join(__dirname, '../../../database/schema.sql'), 'utf8');
db.exec(schema);

const simulatorService = require('../services/simulatorService');
const mlService = require('../services/mlService');
const recoveryService = require('../services/recoveryService');

const seedValue = process.env.SEED_VALUE || 424242;
const CUSTOMER_COUNT = parseInt(process.env.SEED_CUSTOMERS) || 1000;
const PAYMENT_COUNT = parseInt(process.env.SEED_PAYMENTS) || 10000;
const SEED_CASE_TARGET = parseInt(process.env.SEED_CASES) || 150;

console.log(`[Seed] Using seed: ${seedValue} (deterministic — same seed, same dataset)`);
const startedAt = Date.now();

const { customers, payments } = simulatorService.generateSyntheticPayments(PAYMENT_COUNT, {
  seed: seedValue,
  customerCount: CUSTOMER_COUNT
});

const insertCustomer = db.prepare(`
  INSERT INTO customers
  (id, name, email, phone, created_at, updated_at, total_payments, successful_payments,
   failed_payments, total_revenue, risk_score, last_payment_date, customer_segment)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertPayment = db.prepare(`
  INSERT INTO payments
  (id, customer_id, amount, currency, status, payment_method, failure_reason,
   created_at, updated_at, metadata)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// --- Create a manageable set of recovery cases for the demo ---
// Selection: sort at-risk payments by amount desc and take an evenly strided sample
// so seeded cases span small and large amounts. The remaining failed/abandoned
// payments are left undetected on purpose, so runtime detection still has work.
const rng = simulatorService.createSeededRNG(seedValue + '-cases');
const atRisk = payments
  .filter((p) => p.status === 'failed' || p.status === 'abandoned')
  .sort((a, b) => b.amount - a.amount || (a.id < b.id ? -1 : 1));
const stride = Math.max(1, Math.floor(atRisk.length / SEED_CASE_TARGET));

const NOW = Date.now();
const customerById = new Map(customers.map((c) => [c.id, c]));
const insertCase = db.prepare(`
  INSERT INTO recovery_cases
  (id, payment_id, customer_id, amount_at_risk, risk_probability, diagnosis,
   diagnosis_factors, priority_score, status, recommended_action, created_at, updated_at,
   resolved_at, recovered_amount)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertAction = db.prepare(`
  INSERT INTO recovery_actions
  (id, case_id, action_type, action_status, attempt_number, executed_at, result_message,
   recovery_amount, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertAudit = db.prepare(`
  INSERT INTO audit_logs
  (id, entity_type, entity_id, event_type, event_data, new_state, user_or_system, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

let caseSeq = 0;
let resolvedCount = 0;
const seedMany = db.transaction(() => {
  for (const customer of customers) {
    insertCustomer.run(
      customer.id, customer.name, customer.email, customer.phone,
      customer.created_at, customer.updated_at,
      customer.total_payments, customer.successful_payments, customer.failed_payments,
      customer.total_revenue, customer.risk_score, customer.last_payment_date,
      customer.customer_segment
    );
  }

  for (const p of payments) {
    insertPayment.run(
      p.id, p.customer_id, p.amount, p.currency, p.status, p.payment_method,
      p.failure_reason, p.created_at, p.created_at, JSON.stringify(p.metadata)
    );
  }

  for (let i = 0; i < atRisk.length && caseSeq < SEED_CASE_TARGET; i += stride) {
    const payment = atRisk[i];
    const customer = customerById.get(payment.customer_id);
    const caseData = {
      failure_reason: payment.failure_reason,
      payment_method: payment.payment_method,
      status: payment.status,
      total_payments: customer.total_payments,
      successful_payments: customer.successful_payments
    };

    // Same offline diagnosis/risk logic the app falls back to when the ML
    // service is unavailable — keeps seeded cases consistent with runtime ones.
    const diagnosis = mlService.getFallbackDiagnosis(caseData);
    const risk = mlService.getFallbackRiskPrediction(caseData);
    const priorityScore = recoveryService.calculatePriorityScore(
      payment.amount, risk.riskProbability, diagnosis.confidence
    );

    // Deterministic status mix: mostly open, some resolved/in_progress/stopped/escalated
    caseSeq += 1;
    let status = 'open';
    if (caseSeq % 9 === 0) status = 'in_progress';
    else if (caseSeq % 7 === 0) status = 'resolved';
    else if (caseSeq % 17 === 0) status = 'stopped';
    else if (caseSeq % 23 === 0) status = 'escalated';

    // Probabilities for the recommended action (offline fallback model)
    const probs = mlService.getFallbackRecoveryProbabilities(caseData, diagnosis);
    let recommendedAction = Object.entries(probs)
      .filter(([action]) => action !== 'stop')
      .sort((a, b) => b[1] - a[1])[0][0];
    if (status === 'stopped') recommendedAction = 'stop';
    if (status === 'escalated') recommendedAction = 'escalate';

    const createdAt = new Date(Math.min(
      new Date(payment.created_at).getTime() + (1 + rng.integer(48)) * 3600 * 1000,
      NOW - 6 * 3600 * 1000
    ));
    const caseId = `case_${String(caseSeq).padStart(5, '0')}`;
    let resolvedAt = null;
    let recoveredAmount = 0;
    if (status === 'resolved') {
      resolvedAt = new Date(Math.min(
        createdAt.getTime() + (1 + rng.integer(5)) * 24 * 3600 * 1000,
        NOW - 3600 * 1000
      ));
      recoveredAmount = payment.amount;
      resolvedCount += 1;
    }

    insertCase.run(
      caseId, payment.id, customer.id, payment.amount, risk.riskProbability,
      diagnosis.diagnosis, JSON.stringify(diagnosis.factors), priorityScore,
      status, recommendedAction, createdAt.toISOString(), createdAt.toISOString(),
      resolvedAt ? resolvedAt.toISOString() : null, recoveredAmount
    );

    insertAudit.run(
      `audit_case_${String(caseSeq).padStart(5, '0')}`, 'case', caseId, 'case_created',
      JSON.stringify({ payment_id: payment.id, amount: payment.amount, customer_id: customer.id }),
      JSON.stringify({ status: 'open' }), 'seed', createdAt.toISOString()
    );

    if (status === 'resolved') {
      const actionType = recommendedAction === 'stop' ? 'retry' : recommendedAction;
      insertAction.run(
        `act_${String(caseSeq).padStart(5, '0')}`, caseId, actionType, 'success', 1,
        resolvedAt.toISOString(), 'Payment recovered (seeded demo outcome)', recoveredAmount,
        createdAt.toISOString()
      );
      insertAudit.run(
        `audit_res_${String(caseSeq).padStart(5, '0')}`, 'case', caseId, 'case_resolved',
        JSON.stringify({ recovered_amount: recoveredAmount }),
        JSON.stringify({ status: 'resolved' }), 'seed', resolvedAt.toISOString()
      );
    } else if (status === 'in_progress' || status === 'escalated') {
      insertAction.run(
        `act_${String(caseSeq).padStart(5, '0')}`, caseId, recommendedAction, 'executed', 1,
        createdAt.toISOString(),
        status === 'escalated' ? 'Escalated to human review' : 'Action executed, awaiting result', 0,
        createdAt.toISOString()
      );
    }
  }
});
seedMany();

db.pragma('foreign_keys = ON');

// --- Validation report (source of truth = the database, not the in-memory arrays) ---
const count = (sql) => db.prepare(sql).get().c;
const report = {
  customers: count('SELECT COUNT(*) AS c FROM customers'),
  payments: count('SELECT COUNT(*) AS c FROM payments'),
  successful: count("SELECT COUNT(*) AS c FROM payments WHERE status = 'success'"),
  failed: count("SELECT COUNT(*) AS c FROM payments WHERE status = 'failed'"),
  abandoned: count("SELECT COUNT(*) AS c FROM payments WHERE status = 'abandoned'"),
  highValue: count('SELECT COUNT(*) AS c FROM payments WHERE amount >= 50000'),
  uniqueFailureReasons: count('SELECT COUNT(DISTINCT failure_reason) AS c FROM payments WHERE failure_reason IS NOT NULL'),
  recoveryCases: count('SELECT COUNT(*) AS c FROM recovery_cases')
};

const groupCount = (sql) => {
  const rows = db.prepare(sql).all();
  return rows.map((r) => `${r.k}: ${r.c}`).join(', ');
};

console.log('[Seed] Database seeded:', dbPath);
console.log('[Seed] This is synthetic demo merchant data — not real Razorpay production data.');
console.log('[Seed] --------------------------------------------');
console.log(`[Seed] Customers: ${report.customers}`);
console.log(`[Seed] Payments: ${report.payments}`);
console.log(`[Seed] Successful payments: ${report.successful}`);
console.log(`[Seed] Failed payments: ${report.failed}`);
console.log(`[Seed] Abandoned payments: ${report.abandoned}`);
console.log(`[Seed] High-value payments (>= Rs.50,000): ${report.highValue}`);
console.log(`[Seed] Unique failure reasons: ${report.uniqueFailureReasons}`);
console.log('[Seed] Payment methods: ' + groupCount('SELECT payment_method AS k, COUNT(*) AS c FROM payments GROUP BY payment_method ORDER BY c DESC'));
console.log('[Seed] Failure reasons: ' + groupCount('SELECT failure_reason AS k, COUNT(*) AS c FROM payments WHERE failure_reason IS NOT NULL GROUP BY failure_reason ORDER BY c DESC'));
console.log('[Seed] Customer segments: ' + groupCount('SELECT customer_segment AS k, COUNT(*) AS c FROM customers GROUP BY customer_segment ORDER BY c DESC'));
console.log('[Seed] Recovery cases: ' + groupCount('SELECT status AS k, COUNT(*) AS c FROM recovery_cases GROUP BY status ORDER BY c DESC') + ` (total ${report.recoveryCases})`);
console.log('[Seed] --------------------------------------------');
console.log(`[Seed] Completed in ${Date.now() - startedAt}ms`);

db.close();
