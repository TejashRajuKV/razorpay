/**
 * Risk Service — Customer and Payment Risk Scoring
 *
 * Responsible for:
 *   1. Prioritising open recovery cases by expected business impact.
 *   2. Assigning risk tiers (HIGH / MEDIUM / LOW) to customers.
 *   3. Computing a composite priority score used for case ordering.
 *
 * Intentionally keeps scoring logic here (not in the ML service) because
 * these rules are deterministic business policy, not learned predictions.
 * The ML service supplies raw risk_probability; this service translates it
 * into actionable priority tiers with hard business constraints.
 */

const db = require('../config/database');

// Thresholds that determine autonomous vs. human escalation behaviour.
const RISK_THRESHOLDS = {
  HIGH:   0.70,   // risk_probability >= 0.70 → HIGH tier
  MEDIUM: 0.40,   // 0.40 <= risk_probability < 0.70 → MEDIUM tier
                  // < 0.40 → LOW tier
};

// Amount above which a case must be reviewed by a human regardless of ML score.
const HIGH_VALUE_ESCALATION_AMOUNT = parseFloat(process.env.HIGH_VALUE_THRESHOLD) || 50000;


/**
 * Classify a risk probability into a labelled tier.
 * @param {number} probability - Float in [0, 1]
 * @returns {'HIGH' | 'MEDIUM' | 'LOW'}
 */
function classifyRiskTier(probability) {
  if (probability >= RISK_THRESHOLDS.HIGH)   return 'HIGH';
  if (probability >= RISK_THRESHOLDS.MEDIUM) return 'MEDIUM';
  return 'LOW';
}


/**
 * Compute a deterministic priority score for case ordering.
 *
 * Formula (all terms normalised to [0, 1]):
 *   priority = 0.45 × amount_norm + 0.35 × risk_prob + 0.20 × confidence
 *
 * The weights prioritise high-value, high-risk cases while still giving
 * meaningful weight to model confidence.
 *
 * @param {number} amountAtRisk
 * @param {number} riskProbability
 * @param {number} confidence
 * @returns {number} Priority score in [0, 1]
 */
function computePriorityScore(amountAtRisk, riskProbability, confidence) {
  // Normalise amount against a practical ceiling (₹1 lakh).
  const amountNorm = Math.min(amountAtRisk / 100_000, 1.0);

  return (
    amountNorm      * 0.45 +
    riskProbability * 0.35 +
    confidence      * 0.20
  );
}


/**
 * Check whether a case should be immediately escalated to human review,
 * bypassing all automated actions.
 *
 * Escalation conditions:
 *   - Amount exceeds the merchant's autonomous-action ceiling, OR
 *   - Risk tier is HIGH but ML confidence is low (uncertain prediction on large stake).
 *
 * @param {number} amountAtRisk
 * @param {number} riskProbability
 * @param {number} confidence
 * @returns {{ escalate: boolean, reason: string | null }}
 */
function shouldEscalateToHuman(amountAtRisk, riskProbability, confidence) {
  if (amountAtRisk >= HIGH_VALUE_ESCALATION_AMOUNT) {
    return {
      escalate: true,
      reason: `Amount ₹${amountAtRisk.toLocaleString('en-IN')} exceeds autonomous-action ceiling of ₹${HIGH_VALUE_ESCALATION_AMOUNT.toLocaleString('en-IN')}.`,
    };
  }

  const tier = classifyRiskTier(riskProbability);
  if (tier === 'HIGH' && confidence < 0.50) {
    return {
      escalate: true,
      reason: `High-risk case (${(riskProbability * 100).toFixed(0)}%) with low model confidence (${(confidence * 100).toFixed(0)}%). Human review required.`,
    };
  }

  return { escalate: false, reason: null };
}


/**
 * Fetch the highest-priority open cases, enriched with risk tier and escalation flag.
 * Used by the dashboard and batch-recovery runner to select which cases to act on next.
 *
 * @param {number} [limit=50] - Maximum cases to return
 * @returns {Promise<Array>} Enriched case records
 */
async function getPrioritisedOpenCases(limit = 50) {
  const query = `
    SELECT
      rc.id,
      rc.payment_id,
      rc.customer_id,
      rc.amount_at_risk,
      rc.risk_probability,
      rc.diagnosis,
      rc.priority_score,
      rc.status,
      rc.recommended_action,
      rc.created_at,
      c.name  AS customer_name,
      c.email AS customer_email,
      c.customer_segment,
      p.failure_reason,
      p.payment_method
    FROM recovery_cases rc
    JOIN customers  c ON rc.customer_id = c.id
    JOIN payments   p ON rc.payment_id  = p.id
    WHERE rc.status IN ('open', 'in_progress')
    ORDER BY rc.priority_score DESC, rc.created_at ASC
    LIMIT ?
  `;

  const cases = await db.query(query, [limit]);

  // Attach risk tier and escalation guidance to each case.
  return cases.map(c => ({
    ...c,
    riskTier: classifyRiskTier(c.risk_probability),
    escalationRequired: shouldEscalateToHuman(
      c.amount_at_risk,
      c.risk_probability,
      0.80  // Default confidence when not stored; ML call provides real value.
    ).escalate,
  }));
}


/**
 * Compute aggregate risk metrics across all open cases.
 * Consumed by the dashboard overview endpoint.
 *
 * @returns {Promise<Object>} Summary stats
 */
async function getPortfolioRiskSummary() {
  const query = `
    SELECT
      COUNT(*)                                                              AS total_open_cases,
      COALESCE(SUM(amount_at_risk), 0)                                     AS total_at_risk,
      COALESCE(AVG(risk_probability), 0)                                   AS avg_risk_prob,
      COUNT(CASE WHEN risk_probability >= ? THEN 1 END)                    AS high_risk_cases,
      COUNT(CASE WHEN risk_probability >= ? AND risk_probability < ? THEN 1 END) AS medium_risk_cases,
      COUNT(CASE WHEN risk_probability < ? THEN 1 END)                     AS low_risk_cases
    FROM recovery_cases
    WHERE status IN ('open', 'in_progress')
  `;

  const [row] = await db.query(query, [
    RISK_THRESHOLDS.HIGH,
    RISK_THRESHOLDS.MEDIUM,
    RISK_THRESHOLDS.HIGH,
    RISK_THRESHOLDS.MEDIUM,
  ]);

  return {
    totalOpenCases:   row.total_open_cases,
    totalAtRisk:      parseFloat(row.total_at_risk),
    avgRiskProb:      parseFloat(row.avg_risk_prob).toFixed(4),
    highRiskCases:    row.high_risk_cases,
    mediumRiskCases:  row.medium_risk_cases,
    lowRiskCases:     row.low_risk_cases,
  };
}


module.exports = {
  classifyRiskTier,
  computePriorityScore,
  shouldEscalateToHuman,
  getPrioritisedOpenCases,
  getPortfolioRiskSummary,
  RISK_THRESHOLDS,
  HIGH_VALUE_ESCALATION_AMOUNT,
};
