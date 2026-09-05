const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const OUTCOME_TYPE = 'recovery_outcome';
const MODEL_VERSION = 'feedback-v1.0';
const MIN_EVIDENCE = 2;
const MAX_ADJUSTMENT = 0.10;

async function recordOutcome({ caseId, customerId, action, diagnosis = null, predictedProbability = 0, amountAtRisk = 0, expectedRecovery = 0, actualRecovered = 0, success = false }) {
  let diagnosisCategory = diagnosis || null;
  if (!diagnosisCategory && caseId) {
    try {
      const rows = await db.query('SELECT diagnosis FROM recovery_cases WHERE id = ?', [caseId]);
      diagnosisCategory = rows[0]?.diagnosis || null;
    } catch { /* diagnosis stays null */ }
  }
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
    JSON.stringify({ customer_id: customerId, action, diagnosis: diagnosisCategory }),
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
  if (action && diagnosisCategory) {
    await refreshActionDiagnosisAdjustment(action, diagnosisCategory);
  }
}

async function refreshActionDiagnosisAdjustment(action, diagnosisCategory) {
  try {
    const rows = await db.query(
      `SELECT prediction_result FROM ml_predictions
       WHERE prediction_type = ? AND json_extract(input_features, '$.action') = ?
       AND json_extract(input_features, '$.diagnosis') = ?`,
      [OUTCOME_TYPE, action, diagnosisCategory]
    );
    if (rows.length < MIN_EVIDENCE) return;
    let wins = 0;
    for (const row of rows) {
      try {
        const result = typeof row.prediction_result === 'string' ? JSON.parse(row.prediction_result) : row.prediction_result;
        if (result && result.success) wins += 1;
      } catch { /* skip malformed rows */ }
    }
    const smoothed = (wins + 2) / (rows.length + 4);
    const adjustment = Math.max(-MAX_ADJUSTMENT, Math.min(MAX_ADJUSTMENT, Math.round((smoothed - 0.5) * 10000) / 10000));
    await db.query(
      `INSERT INTO action_probability_adjustments (action, diagnosis_category, adjustment, sample_count, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(action, diagnosis_category) DO UPDATE SET
         adjustment = excluded.adjustment, sample_count = excluded.sample_count, updated_at = CURRENT_TIMESTAMP`,
      [action, diagnosisCategory, adjustment, rows.length]
    );
  } catch { /* feedback must never break execution */ }
}

async function getActionDiagnosisAdjustment(action, diagnosisCategory) {
  if (!action || !diagnosisCategory) return { adjustment: 0, sampleCount: 0 };
  try {
    const rows = await db.query(
      `SELECT adjustment, sample_count FROM action_probability_adjustments WHERE action = ? AND diagnosis_category = ?`,
      [action, diagnosisCategory]
    );
    if (rows.length === 0 || rows[0].sample_count < MIN_EVIDENCE) return { adjustment: 0, sampleCount: 0 };
    return { adjustment: parseFloat(rows[0].adjustment) || 0, sampleCount: rows[0].sample_count };
  } catch {
    return { adjustment: 0, sampleCount: 0 };
  }
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

module.exports = { recordOutcome, getHistoricalAdjustment, getActionDiagnosisAdjustment, refreshActionDiagnosisAdjustment, OUTCOME_TYPE, MAX_ADJUSTMENT };
