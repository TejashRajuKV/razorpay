const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const OUTCOME_TYPE = 'recovery_outcome';
const MODEL_VERSION = 'feedback-v1.0';
const MIN_EVIDENCE = 2;
const MAX_ADJUSTMENT = 0.10;

async function recordOutcome({ caseId, customerId, action, predictedProbability = 0, amountAtRisk = 0, expectedRecovery = 0, actualRecovered = 0, success = false }) {
  const insertQuery = `
    INSERT INTO ml_predictions
    (id, case_id, prediction_type, model_version, input_features, prediction_result, confidence_score)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  await db.query(insertQuery, [
    uuidv4(),
    caseId,
    OUTCOME_TYPE,
    MODEL_VERSION,
    JSON.stringify({ customer_id: customerId, action }),
    JSON.stringify({
      action,
      predicted_probability: predictedProbability,
      amount_at_risk: amountAtRisk,
      expected_recovery: expectedRecovery,
      actual_recovered: actualRecovered,
      success
    }),
    Math.max(0, Math.min(1, predictedProbability))
  ]);
}

async function getHistoricalAdjustment(customerId, action) {
  if (!customerId || !action) return 0;
  try {
    const rows = await db.query(
      `SELECT prediction_result FROM ml_predictions
       WHERE prediction_type = ? AND json_extract(input_features, '$.customer_id') = ?
       AND json_extract(input_features, '$.action') = ?`,
      [OUTCOME_TYPE, customerId, action]
    );
    if (rows.length < MIN_EVIDENCE) return 0;
    let wins = 0;
    for (const row of rows) {
      try {
        const result = typeof row.prediction_result === 'string' ? JSON.parse(row.prediction_result) : row.prediction_result;
        if (result && result.success) wins += 1;
      } catch { /* skip malformed rows */ }
    }
    const smoothed = (wins + 2) / (rows.length + 4);
    const adjustment = smoothed - 0.5;
    return Math.max(-MAX_ADJUSTMENT, Math.min(MAX_ADJUSTMENT, Math.round(adjustment * 10000) / 10000));
  } catch {
    return 0;
  }
}

module.exports = { recordOutcome, getHistoricalAdjustment, OUTCOME_TYPE, MAX_ADJUSTMENT };
