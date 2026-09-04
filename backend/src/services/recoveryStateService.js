/**
 * Recovery State Builder
 *
 * Assembles the canonical current state of a recovery case from existing data:
 *   - recovery_cases  (case status, amounts, diagnosis)
 *   - payments        (payment method, failure reason)
 *   - customers       (via customerProfileService)
 *   - recovery_actions (history of attempts, outcomes, cooldowns)
 *
 * Deterministic and null-safe for all case lifecycle states.
 * IMPORTANT: This service only READS data. It never writes.
 */

const db = require('../config/database');
const customerProfileService = require('./customerProfileService');

const VALID_ACTIONS = ['retry', 'reminder', 'payment_link', 'retry_later', 'escalate', 'stop'];

/**
 * Build the current recovery state for a case.
 *
 * @param {string|Object} caseIdOrCase - Case ID string, or a pre-fetched case row object.
 * @returns {Promise<Object>} Canonical recovery state snapshot.
 */
async function buildRecoveryState(caseIdOrCase) {
  // 1. Resolve case row
  let recoveryCase;
  if (typeof caseIdOrCase === 'string') {
    const rows = await db.query(
      'SELECT rc.*, p.payment_method, p.failure_reason, p.status AS payment_status, ' +
      'c.name AS customer_name, c.email, c.phone ' +
      'FROM recovery_cases rc ' +
      'JOIN payments p ON rc.payment_id = p.id ' +
      'LEFT JOIN customers c ON rc.customer_id = c.id ' +
      'WHERE rc.id = ?',
      [caseIdOrCase]
    );
    if (rows.length === 0) throw new Error('Recovery case not found: ' + caseIdOrCase);
    recoveryCase = rows[0];
  } else {
    recoveryCase = caseIdOrCase || {};
  }

  const caseId = recoveryCase.id ?? null;
  const customerId = recoveryCase.customer_id ?? null;
  const paymentId = recoveryCase.payment_id ?? null;
  const amountAtRisk = parseFloat(recoveryCase.amount_at_risk ?? recoveryCase.amountAtRisk ?? 0) || 0;
  const recoveredAmount = parseFloat(recoveryCase.recovered_amount ?? recoveryCase.recoveredAmount ?? 0) || 0;
  const caseStatus = (recoveryCase.status || 'open').toLowerCase();
  const remainingAmountAtRisk = caseStatus === 'resolved' ? 0 : Math.max(0, amountAtRisk - recoveredAmount);

  // 2. Customer profile (advisory - never fails the build)
  let customerProfile = {
    totalPayments: 0, successfulPayments: 0, failedPayments: 0,
    successRate: 0, preferredPaymentMethod: null, customerSegment: 'standard',
  };
  if (customerId) {
    try {
      const profile = await customerProfileService.getCustomerRecoveryProfile(customerId);
      customerProfile = {
        totalPayments: profile.totalPayments ?? 0,
        successfulPayments: profile.successfulPayments ?? 0,
        failedPayments: profile.failedPayments ?? 0,
        successRate: profile.successRate ?? 0,
        preferredPaymentMethod: profile.preferredPaymentMethod ?? null,
        customerSegment: profile.customerSegment ?? 'standard',
      };
    } catch { /* advisory only */ }
  }

  // 3. Recovery action history
  let actionRows = [];
  if (caseId) {
    actionRows = await db.query(
      'SELECT action_type, action_status, attempt_number, recovery_amount, ' +
      'executed_at, created_at, cooldown_until ' +
      'FROM recovery_actions WHERE case_id = ? ORDER BY created_at ASC',
      [caseId]
    );
  }

  const previousActions = actionRows.map(r => r.action_type);
  const successfulActions = actionRows.filter(r => r.action_status === 'success').map(r => r.action_type);
  const failedActions = actionRows.filter(r => r.action_status === 'failed').map(r => r.action_type);
  const totalRecovered = actionRows.reduce((sum, r) => sum + (parseFloat(r.recovery_amount) || 0), 0);

  const recoveryHistory = {
    totalAttempts: actionRows.length,
    previousActions,
    successfulActions,
    failedActions,
    recoveredAmount: Math.round(totalRecovered * 100) / 100,
    remainingAmountAtRisk,
  };

  // 4. Last action details
  const lastActionRow = actionRows.length > 0 ? actionRows[actionRows.length - 1] : null;
  const lastAction = lastActionRow ? lastActionRow.action_type : null;
  const lastActionStatus = lastActionRow ? lastActionRow.action_status : null;
  const lastActionAt = lastActionRow ? (lastActionRow.executed_at || lastActionRow.created_at) : null;

  // Cooldown from last retry/retry_later action
  const lastRetryRow = [...actionRows].reverse().find(
    r => r.action_type === 'retry' || r.action_type === 'retry_later'
  );
  const cooldownUntil = (lastRetryRow && lastRetryRow.cooldown_until)
    ? new Date(lastRetryRow.cooldown_until).toISOString()
    : null;

  // 5. Available actions (policy layer enforces actual permission at execution time)
  const availableActions = (caseStatus === 'resolved' || caseStatus === 'stopped')
    ? []
    : [...VALID_ACTIONS];

  // 5b. Latest customer response / promise-to-pay (additive, advisory read —
  // the customer_responses table may not exist on older databases)
  let customerResponse = null;
  try {
    const respRows = await db.query(
      'SELECT intent, confidence, promised_at, promise_status, follow_up_required, created_at ' +
      'FROM customer_responses WHERE case_id = ? ORDER BY rowid DESC LIMIT 1',
      [caseId]
    );
    if (respRows.length > 0) {
      const r = respRows[0];
      const promiseRow = r.intent === 'promise_to_pay'
        ? r
        : (await db.query(
            "SELECT promised_at, promise_status, follow_up_required FROM customer_responses " +
            "WHERE case_id = ? AND intent = 'promise_to_pay' ORDER BY rowid DESC LIMIT 1",
            [caseId]
          ))[0];
      customerResponse = {
        lastIntent: r.intent,
        lastConfidence: parseFloat(r.confidence) || 0,
        lastResponseAt: r.created_at,
        promiseState: promiseRow ? promiseRow.promise_status : 'NONE',
        promisedAt: promiseRow && promiseRow.promised_at ? new Date(promiseRow.promised_at).toISOString() : null,
        followUpRequired: promiseRow ? !!promiseRow.follow_up_required : false,
      };
    }
  } catch { /* advisory — table may not exist yet */ }

  // 6. Assemble canonical state
  return {
    caseId,
    customerId,
    paymentId,
    amountAtRisk,
    remainingAmountAtRisk,
    caseStatus,
    riskProbability: parseFloat(recoveryCase.risk_probability ?? recoveryCase.riskProbability ?? 0) || 0,
    diagnosis: recoveryCase.diagnosis ?? null,
    paymentMethod: recoveryCase.payment_method || recoveryCase.paymentMethod || null,
    failureReason: recoveryCase.failure_reason || recoveryCase.failureReason || null,
    customerProfile,
    recoveryHistory,
    lastAction,
    lastActionStatus,
    lastActionAt,
    cooldownUntil,
    customerResponse,
    availableActions,
  };
}

module.exports = { buildRecoveryState };
