/**
 * Recovery Service - Core business logic for revenue recovery workflow
 * Implements the Detect → Diagnose → Decide → Act → Observe loop
 * Enforces safety bounds and stopping rules
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const auditService = require('./auditService');
const simulatorService = require('./simulatorService');

// Configuration constants for safety bounds
const CONFIG = {
  MAX_RETRY_ATTEMPTS: parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3,
  RETRY_COOLDOWN_MINUTES: parseInt(process.env.RETRY_COOLDOWN_MINUTES) || 60,
  MAX_RECOVERY_ATTEMPTS: parseInt(process.env.MAX_RECOVERY_ATTEMPTS) || 5,
  HIGH_VALUE_THRESHOLD: parseFloat(process.env.HIGH_VALUE_THRESHOLD) || 50000,
  LOW_CONFIDENCE_THRESHOLD: parseFloat(process.env.LOW_CONFIDENCE_THRESHOLD) || 0.40
};

/**
 * Detect revenue at risk by identifying failed/abandoned payments
 * @returns {Promise<Array>} List of potential recovery cases
 */
async function detectRevenueAtRisk() {
  const query = `
    SELECT 
      p.id as payment_id,
      p.customer_id,
      p.amount,
      p.status,
      p.failure_reason,
      p.created_at,
      c.name as customer_name,
      c.email,
      c.total_payments,
      c.successful_payments,
      c.failed_payments,
      c.risk_score as customer_risk_score
    FROM payments p
    JOIN customers c ON p.customer_id = c.id
    WHERE p.status IN ('failed', 'abandoned')
    AND NOT EXISTS (
      SELECT 1 FROM recovery_cases rc 
      WHERE rc.payment_id = p.id AND rc.status NOT IN ('stopped', 'resolved')
    )
    ORDER BY p.amount DESC, p.created_at ASC
  `;
  
  return await db.query(query);
}

/**
 * Create a recovery case from a detected payment issue
 * @param {Object} payment - Payment data
 * @param {Object} diagnosis - AI diagnosis result
 * @param {Object} riskAssessment - Risk probability assessment
 * @returns {Promise<Object>} Created recovery case
 */
async function createRecoveryCase(payment, diagnosis, riskAssessment) {
  const caseId = uuidv4();
  const priorityScore = calculatePriorityScore(
    payment.amount,
    riskAssessment.riskProbability,
    diagnosis.confidence
  );
  
  const insertQuery = `
    INSERT INTO recovery_cases 
    (id, payment_id, customer_id, amount_at_risk, risk_probability, 
     diagnosis, diagnosis_factors, priority_score, status, recommended_action)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  await db.query(insertQuery, [
    caseId,
    payment.payment_id,
    payment.customer_id,
    payment.amount,
    riskAssessment.riskProbability,
    diagnosis.diagnosis,
    JSON.stringify(diagnosis.factors),
    priorityScore,
    'open',
    null // Will be set after decision
  ]);
  
  // Audit log for case creation
  await auditService.logEvent({
    entityType: 'case',
    entityId: caseId,
    eventType: 'case_created',
    eventData: {
      payment_id: payment.payment_id,
      amount: payment.amount,
      customer_id: payment.customer_id
    },
    newState: { status: 'open' }
  });
  
  return {
    id: caseId,
    ...payment,
    amountAtRisk: payment.amount,
    riskProbability: riskAssessment.riskProbability,
    diagnosis: diagnosis.diagnosis,
    diagnosisFactors: diagnosis.factors,
    priorityScore,
    status: 'open'
  };
}

/**
 * Calculate priority score based on amount, risk, and confidence
 * Higher score = higher priority for recovery action
 */
function calculatePriorityScore(amount, riskProbability, confidence) {
  const amountWeight = 0.4;
  const riskWeight = 0.4;
  const confidenceWeight = 0.2;
  
  // Normalize amount (assume max 100000 for normalization)
  const normalizedAmount = Math.min(amount / 100000, 1);
  
  return (
    normalizedAmount * amountWeight +
    riskProbability * riskWeight +
    confidence * confidenceWeight
  );
}

/**
 * Decide the best recovery action based on diagnosis and models
 * @param {Object} recoveryCase - Recovery case data
 * @param {Object} recoveryProbabilities - ML model recovery probabilities
 * @returns {Promise<String>} Recommended action type
 */
async function decideRecoveryAction(recoveryCase, recoveryProbabilities) {
  const { diagnosis, amountAtRisk, priorityScore } = recoveryCase;
  
  // Safety check: High-value + low-confidence requires human escalation
  if (amountAtRisk > CONFIG.HIGH_VALUE_THRESHOLD && 
      priorityScore < CONFIG.LOW_CONFIDENCE_THRESHOLD) {
    return 'escalate';
  }
  
  // Select action with highest recovery probability
  let bestAction = 'stop';
  let highestProbability = 0;
  
  const actionProbabilities = recoveryProbabilities || {
    retry: 0.3,
    reminder: 0.2,
    payment_link: 0.25,
    retry_later: 0.15,
    escalate: 0.1,
    stop: 0.0
  };
  
  for (const [action, probability] of Object.entries(actionProbabilities)) {
    if (probability > highestProbability) {
      highestProbability = probability;
      bestAction = action;
    }
  }
  
  // Update case with recommended action
  const updateQuery = `
    UPDATE recovery_cases 
    SET recommended_action = ? 
    WHERE id = ?
  `;
  await db.query(updateQuery, [bestAction, recoveryCase.id]);
  
  return bestAction;
}

/**
 * Execute a bounded recovery action with safety checks
 * @param {String} caseId - Recovery case ID
 * @param {String} actionType - Type of action to execute
 * @returns {Promise<Object>} Action execution result
 */
async function executeRecoveryAction(caseId, actionType) {
  // Fetch case details
  const caseQuery = `
    SELECT rc.*, p.payment_method, p.failure_reason, c.email, c.phone
    FROM recovery_cases rc
    JOIN payments p ON rc.payment_id = p.id
    JOIN customers c ON rc.customer_id = c.id
    WHERE rc.id = ?
  `;
  const cases = await db.query(caseQuery, [caseId]);
  
  if (cases.length === 0) {
    throw new Error(`Recovery case not found: ${caseId}`);
  }
  
  const recoveryCase = cases[0];
  
  // Check stopping rules (backend-enforced, always audited)
  const stopCheck = await checkStoppingRules(recoveryCase, actionType);
  if (!stopCheck.allowed) {
    await auditService.logEvent({
      entityType: 'action',
      entityId: caseId,
      eventType: 'safety_check_blocked',
      eventData: { action_type: actionType, case_id: caseId, reason: stopCheck.reason },
      newState: { status: 'blocked' }
    });
    return {
      success: false,
      blocked: true,
      reason: stopCheck.reason,
      action: actionType,
      caseId
    };
  }
  
  // Create action record
  const actionId = uuidv4();
  const attemptNumber = await getCurrentAttemptCount(caseId);
  
  const insertActionQuery = `
    INSERT INTO recovery_actions 
    (id, case_id, action_type, action_status, attempt_number, cooldown_until)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  
  const cooldownUntil = new Date();
  cooldownUntil.setMinutes(cooldownUntil.getMinutes() + CONFIG.RETRY_COOLDOWN_MINUTES);
  
  await db.query(insertActionQuery, [
    actionId,
    caseId,
    actionType,
    'executed',
    attemptNumber + 1,
    cooldownUntil.toISOString()
  ]);
  
  // Execute action through simulator
  let result;
  try {
    result = await simulatorService.executeAction(actionType, recoveryCase);
    
    // Update action status based on result
    const updateActionQuery = `
      UPDATE recovery_actions 
      SET action_status = ?, result_message = ?, recovery_amount = ?, executed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await db.query(updateActionQuery, [
      result.success ? 'success' : 'failed',
      result.message,
      result.recoveredAmount || 0,
      actionId
    ]);
    
    // Update case status if successful
    if (result.success) {
      await updateCaseStatus(caseId, 'resolved', result.recoveredAmount);
    }
    
    // Audit log
    await auditService.logEvent({
      entityType: 'action',
      entityId: actionId,
      eventType: 'action_executed',
      eventData: {
        action_type: actionType,
        attempt: attemptNumber + 1,
        case_id: caseId
      },
      newState: { status: result.success ? 'success' : 'failed' }
    });
    
    return {
      success: result.success,
      actionId,
      actionType,
      caseId,
      message: result.message,
      recoveredAmount: result.recoveredAmount || 0
    };
  } catch (error) {
    console.error('[RecoveryService] Action execution failed:', error);
    
    await db.query(
      'UPDATE recovery_actions SET action_status = ?, result_message = ? WHERE id = ?',
      ['failed', error.message, actionId]
    );
    
    return {
      success: false,
      actionId,
      actionType,
      caseId,
      message: error.message
    };
  }
}

/**
 * Check stopping rules before executing an action (backend-enforced).
 */
async function checkStoppingRules(recoveryCase, actionType) {
  const status = (recoveryCase.status || '').toLowerCase();
  if (status === 'resolved') {
    return { allowed: false, reason: 'Case already resolved — no further actions allowed' };
  }
  if (status === 'stopped') {
    return { allowed: false, reason: 'Case already stopped — no further actions allowed' };
  }
  // Low recovery probability guard
  const prob = parseFloat(recoveryCase.recovery_probability ?? recoveryCase.priority_score ?? 1);
  if (!Number.isNaN(prob) && prob < 0.08 && actionType !== 'stop' && actionType !== 'escalate') {
    return { allowed: false, reason: `Recovery probability too low (${prob.toFixed(2)}) — stopping` };
  }
  // High-value + low-confidence escalation
  const amount = parseFloat(recoveryCase.amount_at_risk ?? recoveryCase.amountAtRisk ?? 0);
  const conf = parseFloat(recoveryCase.priority_score ?? 1);
  if (amount > CONFIG.HIGH_VALUE_THRESHOLD && conf < CONFIG.LOW_CONFIDENCE_THRESHOLD && actionType !== 'escalate' && actionType !== 'stop') {
    return { allowed: false, reason: `High-value (₹${amount}) + low-confidence — human escalation required` };
  }
  // Check maximum retry attempts
  if (actionType === 'retry' || actionType === 'retry_later') {
    const retryCount = await getCurrentAttemptCount(recoveryCase.id);
    if (retryCount >= CONFIG.MAX_RETRY_ATTEMPTS) {
      return {
        allowed: false,
        reason: `Maximum retry attempts (${CONFIG.MAX_RETRY_ATTEMPTS}) reached`
      };
    }

    // Check cooldown period
    const lastActionQuery = `
      SELECT executed_at, cooldown_until
      FROM recovery_actions
      WHERE case_id = ? AND action_type IN ('retry','retry_later')
      ORDER BY created_at DESC LIMIT 1
    `;
    const lastActions = await db.query(lastActionQuery, [recoveryCase.id]);

    if (lastActions.length > 0 && lastActions[0].cooldown_until) {
      const cooldownTime = new Date(lastActions[0].cooldown_until);
      if (new Date() < cooldownTime) {
        return {
          allowed: false,
          reason: `Cooldown period active until ${cooldownTime.toISOString()}`
        };
      }
    }
  }

  // Check total recovery attempts
  const totalAttempts = await getTotalAttemptCount(recoveryCase.id);
  if (totalAttempts >= CONFIG.MAX_RECOVERY_ATTEMPTS) {
    return {
      allowed: false,
      reason: `Maximum total recovery attempts (${CONFIG.MAX_RECOVERY_ATTEMPTS}) reached`
    };
  }

  return { allowed: true };
}

/**
 * Get current attempt count for a specific action type
 */
async function getCurrentAttemptCount(caseId) {
  const query = `
    SELECT COUNT(*) as count 
    FROM recovery_actions 
    WHERE case_id = ? AND action_type = 'retry'
  `;
  const result = await db.query(query, [caseId]);
  return result[0]?.count || 0;
}

/**
 * Get total attempt count across all action types
 */
async function getTotalAttemptCount(caseId) {
  const query = `
    SELECT COUNT(*) as count 
    FROM recovery_actions 
    WHERE case_id = ?
  `;
  const result = await db.query(query, [caseId]);
  return result[0]?.count || 0;
}

/**
 * Update recovery case status
 */
async function updateCaseStatus(caseId, status, recoveredAmount = 0) {
  const updateQuery = `
    UPDATE recovery_cases 
    SET status = ?, 
        recovered_amount = ?,
        resolved_at = CASE WHEN ? IN ('resolved', 'stopped') THEN CURRENT_TIMESTAMP ELSE resolved_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  await db.query(updateQuery, [status, recoveredAmount, status, caseId]);
}

/**
 * Get recovery case by ID
 */
async function getRecoveryCase(caseId) {
  const query = `
    SELECT rc.*, p.payment_method, p.failure_reason, c.name as customer_name, c.email, c.phone
    FROM recovery_cases rc
    JOIN payments p ON rc.payment_id = p.id
    JOIN customers c ON rc.customer_id = c.id
    WHERE rc.id = ?
  `;
  const results = await db.query(query, [caseId]);
  return results[0] || null;
}

/**
 * Get all recovery cases with filtering
 */
async function getRecoveryCases(filters = {}) {
  let whereClauses = [];
  let params = [];
  
  if (filters.status) {
    whereClauses.push('rc.status = ?');
    params.push(filters.status);
  }
  
  if (filters.diagnosis) {
    whereClauses.push('rc.diagnosis = ?');
    params.push(filters.diagnosis);
  }
  
  const whereClause = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
  
  const query = `
    SELECT rc.*, c.name as customer_name, c.email
    FROM recovery_cases rc
    JOIN customers c ON rc.customer_id = c.id
    ${whereClause}
    ORDER BY rc.priority_score DESC, rc.created_at ASC
  `;
  
  return await db.query(query, params);
}

/**
 * Run the complete recovery workflow for a single case
 * Integrates with ML service for diagnosis and probability scoring
 */
async function runRecoveryWorkflow(caseId, mlService) {
  try {
    const recoveryCase = await getRecoveryCase(caseId);
    if (!recoveryCase) {
      throw new Error(`Case not found: ${caseId}`);
    }
    
    // Step 1: Get diagnosis from ML service
    const diagnosis = await mlService.diagnose(recoveryCase);
    
    // Step 2: Get recovery probabilities from ML service
    const recoveryProbabilities = await mlService.getRecoveryProbabilities(recoveryCase, diagnosis);
    
    // Step 3: Decide best action
    const recommendedAction = await decideRecoveryAction(recoveryCase, recoveryProbabilities);
    
    // Step 4: Execute action
    const result = await executeRecoveryAction(caseId, recommendedAction);
    
    return {
      success: true,
      caseId,
      diagnosis,
      recommendedAction,
      executionResult: result
    };
  } catch (error) {
    console.error('[RecoveryService] Workflow failed:', error);
    throw error;
  }
}

module.exports = {
  detectRevenueAtRisk,
  createRecoveryCase,
  decideRecoveryAction,
  executeRecoveryAction,
  getRecoveryCase,
  getRecoveryCases,
  runRecoveryWorkflow,
  checkStoppingRules,
  CONFIG
};
