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
    predictProductMatch: '/predict/product-match',
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
    return response.status === 200;
  } catch (error) {
    console.warn('[ML Service] Health check failed:', error.message);
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
    
    return {
      riskProbability: response.data.risk_probability,
      confidence: response.data.confidence,
      modelVersion: response.data.model_version,
      factors: response.data.factors || []
    };
  } catch (error) {
    console.warn('[ML Service] Risk prediction failed, using fallback:', error.message);
    return getFallbackRiskPrediction(paymentData);
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
    
    return {
      diagnosis: response.data.diagnosis,
      confidence: response.data.confidence,
      modelVersion: response.data.model_version,
      factors: response.data.factors || [],
      alternativeDiagnoses: response.data.alternatives || []
    };
  } catch (error) {
    console.warn('[ML Service] Diagnosis failed, using fallback:', error.message);
    return getFallbackDiagnosis(caseData);
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
    
    return response.data.probabilities;
  } catch (error) {
    console.warn('[ML Service] Recovery probability prediction failed, using fallback:', error.message);
    return getFallbackRecoveryProbabilities(caseData, diagnosis);
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
 * Predict product match probability for a customer and product category
 * @param {Object} customerData - Customer data including inactive_days and preferred_categories
 * @param {String} productCategory - Category of the new product
 * @returns {Promise<Object>} Match probability prediction
 */
async function predictProductMatch(customerData, productCategory) {
  try {
    const response = await axios.post(
      `${ML_CONFIG.baseUrl}${ML_CONFIG.endpoints.predictProductMatch}`,
      { 
        customer: customerData,
        product_category: productCategory
      },
      { timeout: ML_CONFIG.timeout }
    );
    
    return {
      matchProbability: response.data.match_probability,
      modelVersion: response.data.model_version
    };
  } catch (error) {
    console.warn('[ML Service] Product match prediction failed, using fallback:', error.message);
    
    // Fallback heuristic
    const inactive = parseInt(customerData.inactive_days) || 0;
    let match = 0.0;
    try {
      const cats = JSON.parse(customerData.preferred_categories || '[]');
      match = cats.includes(productCategory) ? 1.0 : 0.0;
    } catch (e) {}
    
    const prob = Math.max(0.01, (0.7 ? match : 0.1) - Math.min(inactive / 100.0, 0.5));
    
    return {
      matchProbability: prob,
      modelVersion: 'fallback-v1.1'
    };
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
    customer_success_rate: paymentData.successful_payments / Math.max(paymentData.total_payments, 1),
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
    attempt_count: caseData.attempt_number || 1,
    customer_history_length: caseData.total_payments || 0,
    customer_success_rate: caseData.successful_payments / Math.max(caseData.total_payments, 1),
    amount_relative_to_average: caseData.amount_at_risk / 10000, // Normalize
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
  
  let diagnosis = 'temporary_failure';
  let confidence = 0.6;
  
  if (failure_reason === 'invalid_upi_id' || failure_reason === 'card_expired') {
    diagnosis = 'data_issue';
    confidence = 0.75;
  } else if (successRate < 0.5 && total_payments > 3) {
    diagnosis = 'repeated_failure';
    confidence = 0.7;
  } else if (caseData.status === 'abandoned') {
    diagnosis = 'abandonment';
    confidence = 0.8;
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
  
  // Adjust based on diagnosis
  switch (diagnosis.diagnosis) {
    case 'temporary_failure':
      baseProbabilities.retry = 0.60;
      baseProbabilities.retry_later = 0.35;
      break;
    case 'repeated_failure':
      baseProbabilities.escalate = 0.40;
      baseProbabilities.payment_link = 0.35;
      baseProbabilities.retry = 0.20;
      break;
    case 'data_issue':
      baseProbabilities.payment_link = 0.50;
      baseProbabilities.reminder = 0.35;
      break;
    case 'abandonment':
      baseProbabilities.reminder = 0.40;
      baseProbabilities.payment_link = 0.45;
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
  predictProductMatch,
  batchPredict,
  ML_CONFIG
};
