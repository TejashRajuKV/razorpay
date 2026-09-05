const db = require('../config/database');

async function getCustomerRecoveryProfile(customerId) {
  const customers = await db.query('SELECT * FROM customers WHERE id = ?', [customerId]);
  if (customers.length === 0) throw new Error(`Customer not found: ${customerId}`);
  const customer = customers[0];

  const payments = await db.query(
    'SELECT status, amount, payment_method, created_at FROM payments WHERE customer_id = ?',
    [customerId]
  );
  const cases = await db.query(
    'SELECT id, amount_at_risk, recovered_amount, status, recommended_action FROM recovery_cases WHERE customer_id = ?',
    [customerId]
  );
  const caseIds = cases.map((c) => c.id);
  let actions = [];
  if (caseIds.length > 0) {
    const placeholders = caseIds.map(() => '?').join(',');
    actions = await db.query(
      `SELECT ra.action_type, ra.action_status, ra.recovery_amount, rc.customer_id
       FROM recovery_actions ra JOIN recovery_cases rc ON ra.case_id = rc.id
       WHERE rc.customer_id = ?`,
      [customerId]
    );
  }

  const totalPayments = customer.total_payments ?? payments.length;
  const successfulPayments = customer.successful_payments ?? payments.filter((p) => p.status === 'success').length;
  const failedPayments = customer.failed_payments ?? payments.filter((p) => p.status === 'failed').length;
  const successRate = totalPayments > 0 ? successfulPayments / totalPayments : 0;
  const totalAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const recoveredAmount = cases.reduce((sum, c) => sum + (parseFloat(c.recovered_amount) || 0), 0);

  const byAction = {};
  for (const a of actions) {
    const entry = (byAction[a.action_type] = byAction[a.action_type] || { attempts: 0, successes: 0, recovered: 0 });
    entry.attempts += 1;
    if (a.action_status === 'success') {
      entry.successes += 1;
      entry.recovered += parseFloat(a.recovery_amount) || 0;
    }
  }
  let bestAction = null;
  let bestRate = -1;
  for (const [action, stats] of Object.entries(byAction)) {
    const rate = stats.attempts > 0 ? stats.successes / stats.attempts : 0;
    if (rate > bestRate) {
      bestRate = rate;
      bestAction = action;
    }
  }

  const methodCounts = {};
  for (const p of payments) {
    if (p.payment_method) methodCounts[p.payment_method] = (methodCounts[p.payment_method] || 0) + 1;
  }
  let preferredPaymentMethod = null;
  let methodMax = 0;
  for (const [method, count] of Object.entries(methodCounts)) {
    if (count > methodMax) {
      methodMax = count;
      preferredPaymentMethod = method;
    }
  }

  const resolvedCases = cases.filter((c) => c.status === 'resolved').length;
  const recoverySuccessRate = cases.length > 0 ? resolvedCases / cases.length : 0;
  let daysSinceLastSuccess = null;
  const successDates = payments
    .filter((p) => p.status === 'success' && p.created_at)
    .map((p) => new Date(p.created_at).getTime());
  if (successDates.length > 0) {
    daysSinceLastSuccess = Math.max(0, (Date.now() - Math.max(...successDates)) / 86400000);
  }
  const recoveryScore = calculateRecoveryScore({
    payment_success_rate: successRate,
    recovery_success_rate: recoverySuccessRate,
    days_since_last_success: daysSinceLastSuccess,
    avg_amount: totalPayments > 0 ? totalAmount / totalPayments : 0,
    total_payments: totalPayments
  });

  return {
    customerId,
    totalPayments,
    successfulPayments,
    failedPayments,
    successRate: Math.round(successRate * 10000) / 10000,
    totalAmount: Math.round(totalAmount * 100) / 100,
    recoveredAmount: Math.round(recoveredAmount * 100) / 100,
    recoveryAttempts: actions.length,
    openCases: cases.filter((c) => ['open', 'in_progress'].includes(c.status)).length,
    byAction,
    bestAction,
    preferredPaymentMethod,
    customerSegment: customer.customer_segment || 'standard',
    recoveryScore: recoveryScore.recovery_score,
    recoveryTier: recoveryScore.tier
  };
}

/**
 * Customer Recovery Score (0–100): weighted blend of payment success (35%),
 * recovery history (25%), recency (20%), amount tier (10%), tenure (10%).
 */
function calculateRecoveryScore(customer = {}) {
  const s1 = (customer.payment_success_rate || 0) * 100;
  const s2 = (customer.recovery_success_rate || 0) * 100;
  const s3 = customer.days_since_last_success == null
    ? 50
    : Math.max(0, 100 - customer.days_since_last_success * 2);
  const avg = customer.avg_amount || 0;
  const s4 = avg > 10000 ? 80 : avg > 5000 ? 60 : 40;
  const s5 = Math.min(100, (customer.total_payments || 0) * 5);
  const score = Math.round(0.35 * s1 + 0.25 * s2 + 0.20 * s3 + 0.10 * s4 + 0.10 * s5);
  return { recovery_score: score, tier: score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW' };
}

module.exports = { getCustomerRecoveryProfile, calculateRecoveryScore };
