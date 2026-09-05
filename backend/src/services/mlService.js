/**
 * ML Service Client - Communicates with Python ML backend
 * Handles risk prediction, diagnosis, and recovery probability scoring
 * Includes fallback logic for when ML service is unavailable
 */

const axios = require('axios');

const ML_CONFIG = {
  baseUrl: process.env.ML_SERVICE_URL || 'http://localhost:5000',
  timeout: parseInt(process.env.ML_SERVICE_TIMEOUT) || 5000,
  endpoints: {
    health: '/health',
    predictRisk: '/predict/risk',
    predictDiagnosis: '/predict/diagnosis',
    predictRecovery: '/predict/recovery',
    batchPredict: '/predict/batch'
  }
};

/**
 * Check if ML service is healthy
 * @returns {Promise<Boolean>} Service health status
 */
async function checkHealth() {
  try {
    const response = await axios.get(`${ML_CONFIG.baseUrl}${ML_CONFIG.endpoints.health}`, {
      timeout: 2000
    });
    const ok = response.status === 200;
    console.log(ok ? '[ML] Python service connected' : '[ML] Python service unhealthy');
    return ok;
  } catch (error) {
    console.warn('[ML] Python service unreachable, fallback mode:', error.message);
    return false;
  }
}

/**
 * Predict revenue risk probability for a payment/case
 * @param {Object} paymentData - Payment and customer data
 * @returns {Promise<Object>} Risk prediction with probability and confidence
 */
async function predictRisk(paymentData) {
  try {
    const response = await axios.post(
      `${ML_CONFIG.baseUrl}${ML_CONFIG.endpoints.predictRisk}`,
      { features: extractRiskFeatures(paymentData) },
      { timeout: ML_CONFIG.timeout }
    );

    console.log('[ML] Risk prediction completed (python)');
    return {
      riskProbability: response.data.risk_probability,
      confidence: response.data.confidence,
      modelVersion: response.data.model_version,
      factors: response.data.factors || [],
      source: 'python'
    };
  } catch (error) {
    console.warn('[ML] Risk prediction fallback (python unavailable):', error.message);
    return { ...getFallbackRiskPrediction(paymentData), source: 'fallback' };
  }
}

/**
 * Diagnose the root cause of a payment failure
 * @param {Object} caseData - Recovery case data
 * @returns {Promise<Object>} Diagnosis with category and confidence
 */
async function diagnose(caseData) {
  try {
    const response = await axios.post(
      `${ML_CONFIG.baseUrl}${ML_CONFIG.endpoints.predictDiagnosis}`,
      { features: extractDiagnosisFeatures(caseData) },
      { timeout: ML_CONFIG.timeout }
    );

    console.log('[ML] Diagnosis completed (python)');
    return {
      diagnosis: response.data.diagnosis,
      confidence: response.data.confidence,
      modelVersion: response.data.model_version,
      factors: response.data.factors || [],
      alternativeDiagnoses: response.data.alternatives || [],
      source: 'python'
    };
  } catch (error) {
    console.warn('[ML] Diagnosis fallback (python unavailable):', error.message);
    return { ...getFallbackDiagnosis(caseData), source: 'fallback' };
  }
}

/**
 * Get recovery probability scores for different actions
 * @param {Object} caseData - Recovery case data
 * @param {Object} diagnosis - Diagnosis result
 * @returns {Promise<Object>} Recovery probabilities by action type
 */
async function getRecoveryProbabilities(caseData, diagnosis) {
  try {
    const response = await axios.post(
      `${ML_CONFIG.baseUrl}${ML_CONFIG.endpoints.predictRecovery}`,
      {
        case_features: extractRecoveryFeatures(caseData),
        diagnosis: diagnosis.diagnosis
      },
      { timeout: ML_CONFIG.timeout }
    );

    console.log('[ML] Recovery probability completed (python)');
    return { ...response.data.probabilities, _source: 'python' };
  } catch (error) {
    console.warn('[ML] Recovery probability fallback (python unavailable):', error.message);
    return { ...getFallbackRecoveryProbabilities(caseData, diagnosis), _source: 'fallback' };
  }
}

/**
 * Run batch predictions for multiple cases
 * @param {Array} cases - Array of case data
 * @returns {Promise<Array>} Batch prediction results
 */
async function batchPredict(cases) {
  try {
    const response = await axios.post(
      `${ML_CONFIG.baseUrl}${ML_CONFIG.endpoints.batchPredict}`,
      { cases: cases.map(extractBatchFeatures) },
      { timeout: ML_CONFIG.timeout * cases.length / 10 } // Scale timeout with batch size
    );
    
    return response.data.predictions;
  } catch (error) {
    console.error('[ML Service] Batch prediction failed:', error.message);
    throw error;
  }
}

/**
 * Extract features for risk prediction
 */
function extractRiskFeatures(paymentData) {
  return {
    amount: paymentData.amount || 0,
    payment_method: paymentData.payment_method || 'unknown',
    failure_reason: paymentData.failure_reason || 'unknown',
    customer_total_payments: paymentData.total_payments || 0,
    customer_success_rate: (paymentData.successful_payments || 0) / Math.max(paymentData.total_payments || 0, 1),
    customer_risk_score: paymentData.customer_risk_score || 0.5,
    time_since_last_payment: getTimeSinceLastPayment(paymentData.last_payment_date),
    hour_of_day: new Date().getHours(),
    day_of_week: new Date().getDay()
  };
}

/**
 * Extract features for diagnosis
 */
function extractDiagnosisFeatures(caseData) {
  return {
    failure_reason: caseData.failure_reason || 'unknown',
    payment_method: caseData.payment_method || 'unknown',
    payment_status: caseData.payment_status
      || (caseData.status === 'abandoned' ? 'abandoned' : 'failed'),
    attempt_count: caseData.attempt_number || 1,
    customer_history_length: caseData.total_payments || 0,
    customer_success_rate: (caseData.successful_payments || 0) / Math.max(caseData.total_payments || 0, 1),
    amount_relative_to_average: (caseData.amount_at_risk || caseData.amountAtRisk || 0) / 10000, // Normalize
    days_since_failure: getDaysSince(caseData.created_at)
  };
}

/**
 * Extract features for recovery probability
 */
function extractRecoveryFeatures(caseData) {
  return {
    ...extractDiagnosisFeatures(caseData),
    diagnosis_confidence: caseData.diagnosis_confidence || 0.8,
    previous_recovery_attempts: caseData.previous_attempts || 0,
    customer_segment: caseData.customer_segment || 'standard'
  };
}

/**
 * Extract features for batch processing
 */
function extractBatchFeatures(caseData) {
  return {
    risk_features: extractRiskFeatures(caseData),
    diagnosis_features: extractDiagnosisFeatures(caseData),
    recovery_features: extractRecoveryFeatures(caseData)
  };
}

/**
 * Fallback risk prediction when ML service is unavailable
 * Uses simple heuristic rules
 */
function getFallbackRiskPrediction(paymentData) {
  const successRate = paymentData.successful_payments / Math.max(paymentData.total_payments, 1);
  const baseRisk = 1 - successRate;
  
  // Adjust based on failure reason
  const reasonModifiers = {
    'insufficient_funds': 0.1,
    'card_expired': 0.3,
    'transaction_timeout': -0.1,
    'bank_error': 0.0,
    'declined_by_bank': 0.2,
    'invalid_upi_id': 0.4
  };
  
  const reasonModifier = reasonModifiers[paymentData.failure_reason] || 0;
  const riskProbability = Math.max(0.1, Math.min(0.95, baseRisk + reasonModifier));
  
  return {
    riskProbability,
    confidence: 0.65, // Lower confidence for fallback
    modelVersion: 'fallback-v1.0',
    factors: ['historical_success_rate', 'failure_reason']
  };
}

/**
 * Fallback diagnosis when ML service is unavailable
 */
function getFallbackDiagnosis(caseData) {
  const { failure_reason, total_payments = 1, successful_payments = 0 } = caseData;
  const successRate = successful_payments / total_payments;
  const paymentStatus = caseData.payment_status || caseData.status;

  let diagnosis = 'network_timeout';
  let confidence = 0.6;

  if (failure_reason === 'card_expired') {
    diagnosis = 'card_expired';
    confidence = 0.85;
  } else if (failure_reason === 'invalid_upi_id') {
    diagnosis = 'upi_pin_error';
    confidence = 0.8;
  } else if (failure_reason === 'insufficient_funds' || failure_reason === 'card_limit_exceeded') {
    diagnosis = 'insufficient_funds';
    confidence = 0.75;
  } else if (failure_reason === 'declined_by_bank') {
    diagnosis = 'bank_decline';
    confidence = 0.7;
  } else if (paymentStatus === 'abandoned') {
    diagnosis = 'abandoned';
    confidence = 0.8;
  } else if (successRate < 0.5 && total_payments > 3) {
    diagnosis = 'bank_decline';
    confidence = 0.7;
  }
  
  return {
    diagnosis,
    confidence,
    modelVersion: 'fallback-v1.0',
    factors: ['failure_reason', 'customer_history', 'payment_status'],
    alternativeDiagnoses: []
  };
}

/**
 * Fallback recovery probabilities when ML service is unavailable
 */
function getFallbackRecoveryProbabilities(caseData, diagnosis) {
  const baseProbabilities = {
    retry: 0.40,
    reminder: 0.25,
    payment_link: 0.30,
    retry_later: 0.20,
    escalate: 0.15,
    stop: 0.05
  };
  
  // Adjust based on diagnosis (7 India-specific categories; legacy labels fall through to base)
  switch (diagnosis.diagnosis) {
    case 'network_timeout':
    case 'temporary_failure':
      baseProbabilities.retry = 0.60;
      baseProbabilities.retry_later = 0.35;
      break;
    case 'insufficient_funds':
      baseProbabilities.reminder = 0.45;
      baseProbabilities.retry_later = 0.35;
      baseProbabilities.retry = 0.25;
      break;
    case 'card_expired':
    case 'data_issue':
      baseProbabilities.payment_link = 0.50;
      baseProbabilities.reminder = 0.35;
      break;
    case 'upi_pin_error':
      baseProbabilities.reminder = 0.45;
      baseProbabilities.retry = 0.30;
      break;
    case 'bank_decline':
    case 'repeated_failure':
      baseProbabilities.escalate = 0.40;
      baseProbabilities.retry_later = 0.35;
      baseProbabilities.retry = 0.20;
      break;
    case 'abandoned':
    case 'abandonment':
      baseProbabilities.reminder = 0.40;
      baseProbabilities.payment_link = 0.45;
      break;
    case 'data_error':
      baseProbabilities.escalate = 0.50;
      baseProbabilities.retry = 0.10;
      break;
  }
  
  // Adjust based on customer history
  const successRate = caseData.successful_payments / Math.max(caseData.total_payments, 1);
  if (successRate > 0.8) {
    // Good customer - boost all probabilities slightly
    Object.keys(baseProbabilities).forEach(key => {
      baseProbabilities[key] = Math.min(0.9, baseProbabilities[key] * 1.15);
    });
  }
  
  return baseProbabilities;
}

/**
 * Utility: Calculate time since last payment in hours
 */
function getTimeSinceLastPayment(lastPaymentDate) {
  if (!lastPaymentDate) return 720; // Default to 30 days
  const diff = Date.now() - new Date(lastPaymentDate).getTime();
  return diff / (1000 * 60 * 60); // Hours
}

/**
 * Utility: Calculate days since a date
 */
function getDaysSince(dateString) {
  if (!dateString) return 0;
  const diff = Date.now() - new Date(dateString).getTime();
  return diff / (1000 * 60 * 60 * 24); // Days
}

module.exports = {
  checkHealth,
  predictRisk,
  diagnose,
  getRecoveryProbabilities,
  batchPredict,
  getFallbackRiskPrediction,
  getFallbackDiagnosis,
  getFallbackRecoveryProbabilities,
  ML_CONFIG
};
