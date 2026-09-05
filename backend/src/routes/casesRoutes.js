/**
 * Recovery Cases Routes
 * GET /api/v1/cases - List all recovery cases
 * GET /api/v1/cases/:id - Get specific case details
 * POST /api/v1/cases/:id/action - Execute recovery action
 * GET /api/v1/cases/:id/audit - Get case audit trail
 */

const express = require('express');
const router = express.Router();
const recoveryService = require('../services/recoveryService');
const auditService = require('../services/auditService');
const mlService = require('../services/mlService');
const customerProfileService = require('../services/customerProfileService');
const timingService = require('../services/timingService');
const incentiveService = require('../services/incentiveService');
const explanationService = require('../services/explanationService');
const channelService = require('../services/channelService');
const messageService = require('../services/messageService');

/**
 * Get customer-level recovery profile
 * GET /api/v1/cases/customer/:customerId/recovery-profile
 */
router.get('/customer/:customerId/recovery-profile', async (req, res, next) => {
  try {
    const profile = await customerProfileService.getCustomerRecoveryProfile(req.params.customerId);
    res.json({ success: true, data: profile });
  } catch (error) {
    if (/not found/i.test(error.message)) {
      return res.status(404).json({ success: false, error: error.message });
    }
    next(error);
  }
});

/**
 * Preview timing + incentive recommendation for a case (no execution)
 * GET /api/v1/cases/:id/decision-preview
 */
router.get('/:id/decision-preview', async (req, res, next) => {
  try {
    const caseData = await recoveryService.getRecoveryCase(req.params.id);
    if (!caseData) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }
    const diagnosis = await mlService.diagnose(caseData);
    const recoveryProbs = await mlService.getRecoveryProbabilities(caseData, diagnosis);
    const decision = await recoveryService.decideBestSafeAction(caseData, recoveryProbs, diagnosis);
    const timing = timingService.recommendTiming(caseData, diagnosis);
    const incentive = incentiveService.recommendIncentive({
      amount: parseFloat(caseData.amount_at_risk) || 0,
      probability: decision.probability,
      diagnosis: diagnosis.diagnosis
    });
    let customerProfile = null;
    try {
      if (caseData.customer_id) {
        customerProfile = await customerProfileService.getCustomerRecoveryProfile(caseData.customer_id);
      }
    } catch { /* advisory only */ }
    const risk = { riskProbability: parseFloat(caseData.risk_probability) || 0 };
    const explanation = explanationService.buildExplanation({ decision, diagnosis, customerProfile, timing, incentive, risk });
    const channel = channelService.recommendChannel(caseData, decision, customerProfile || {});
    const message = messageService.generateMessage({
      customerName: caseData.customer_name || 'Customer',
      amount: parseFloat(caseData.amount_at_risk) || 0,
      channel: channel.channel,
      action: decision.action,
      failureReason: caseData.failure_reason,
      language: req.query.language || 'hinglish'
    });
    const recoveryPlan = recoveryService.buildRecoveryPlan(diagnosis?.diagnosis || caseData.diagnosis);
    res.json({ success: true, data: { diagnosis, decision, timing, incentive, customerProfile, risk, explanation, channel, message, recoveryPlan } });
  } catch (error) {
    next(error);
  }
});

/**
 * Recommended recovery channel for a case (simulated, never sends)
 * GET /api/v1/cases/:id/recovery-channel
 */
router.get('/:id/recovery-channel', async (req, res, next) => {
  try {
    const caseData = await recoveryService.getRecoveryCase(req.params.id);
    if (!caseData) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }
    const diagnosis = await mlService.diagnose(caseData);
    const recoveryProbs = await mlService.getRecoveryProbabilities(caseData, diagnosis);
    const decision = await recoveryService.decideBestSafeAction(caseData, recoveryProbs, diagnosis);
    let customerProfile = null;
    try {
      if (caseData.customer_id) {
        customerProfile = await customerProfileService.getCustomerRecoveryProfile(caseData.customer_id);
      }
    } catch { /* advisory only */ }
    const channel = channelService.recommendChannel(caseData, decision, customerProfile || {});
    res.json({ success: true, data: { ...channel, action: decision.action } });
  } catch (error) {
    next(error);
  }
});

/**
 * Recovery message for a case in English or Hinglish (simulated, never sent)
 * GET /api/v1/cases/:id/recovery-message?language=hinglish|en
 */
router.get('/:id/recovery-message', async (req, res, next) => {
  try {
    const caseData = await recoveryService.getRecoveryCase(req.params.id);
    if (!caseData) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }
    const diagnosis = await mlService.diagnose(caseData);
    const recoveryProbs = await mlService.getRecoveryProbabilities(caseData, diagnosis);
    const decision = await recoveryService.decideBestSafeAction(caseData, recoveryProbs, diagnosis);
    const channel = channelService.recommendChannel(caseData, decision, {});
    const message = messageService.generateMessage({
      customerName: caseData.customer_name || 'Customer',
      amount: parseFloat(caseData.amount_at_risk) || 0,
      channel: channel.channel,
      action: decision.action,
      failureReason: caseData.failure_reason,
      language: req.query.language || 'hinglish'
    });
    res.json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
});

/**
 * List all recovery cases with optional filtering
 * Query params: status, diagnosis, limit, offset
 */
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      diagnosis: req.query.diagnosis
    };
    
    const cases = await recoveryService.getRecoveryCases(filters);
    
    res.json({
      success: true,
      data: {
        cases,
        count: cases.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Record a customer response for a case (deterministic intent, no LLM)
 * POST /api/v1/cases/:id/customer-response  Body: { message }
 */
router.post('/:id/customer-response', async (req, res, next) => {
  try {
    const { message } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'message is required' });
    }
    const customerResponseService = require('../services/customerResponseService');
    const result = await customerResponseService.recordCustomerResponse(req.params.id, message);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, error: error.message });
    }
    next(error);
  }
});

/**
 * Get specific recovery case by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const caseData = await recoveryService.getRecoveryCase(req.params.id);

    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Get actions for this case
    const db = require('../config/database');
    const actionsQuery = `
      SELECT * FROM recovery_actions
      WHERE case_id = ?
      ORDER BY created_at DESC
    `;
    const actions = await db.query(actionsQuery, [req.params.id]);

    let customerResponse = null;
    try {
      const customerResponseService = require('../services/customerResponseService');
      await customerResponseService.settleDuePromises(req.params.id);
      customerResponse = await customerResponseService.getPromiseInfo(req.params.id);
    } catch { /* advisory only */ }

    res.json({
      success: true,
      data: {
        ...caseData,
        actions,
        recoveryState: { customerResponse }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Execute a recovery action on a case
 * POST /api/v1/cases/:id/action
 * Body: { actionType: 'retry' | 'reminder' | 'payment_link' | 'escalate' | 'stop' }
 */
router.post('/:id/action', async (req, res, next) => {
  try {
    const { actionType } = req.body;
    
    if (!actionType) {
      return res.status(400).json({
        success: false,
        error: 'actionType is required'
      });
    }
    
    const validActions = ['retry', 'reminder', 'payment_link', 'retry_later', 'escalate', 'stop'];
    if (!validActions.includes(actionType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid action type. Must be one of: ${validActions.join(', ')}`
      });
    }
    
    const result = await recoveryService.executeRecoveryAction(req.params.id, actionType);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Run complete AI recovery workflow on a case
 * POST /api/v1/cases/:id/run-workflow
 * This triggers: Diagnose → Decide → Act
 */
router.post('/:id/run-workflow', async (req, res, next) => {
  try {
    const result = await recoveryService.runRecoveryWorkflow(
      req.params.id,
      mlService
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get audit trail for a specific case
 */
router.get('/:id/audit', async (req, res, next) => {
  try {
    const auditTrail = await auditService.getCaseAuditTrail(req.params.id);
    
    res.json({
      success: true,
      data: auditTrail
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create a new recovery case from a payment
 * POST /api/v1/cases/create-from-payment
 * Body: { paymentId }
 */
router.post('/create-from-payment', async (req, res, next) => {
  try {
    const { paymentId } = req.body;
    
    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: 'paymentId is required'
      });
    }
    
    const db = require('../config/database');
    
    // Get payment details
    const paymentQuery = `
      SELECT p.*, c.name as customer_name, c.email, c.total_payments, 
             c.successful_payments, c.failed_payments, c.risk_score as customer_risk_score
      FROM payments p
      JOIN customers c ON p.customer_id = c.id
      WHERE p.id = ?
    `;
    const payments = await db.query(paymentQuery, [paymentId]);
    
    if (payments.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }
    
    const payment = payments[0];
    
    // Get ML predictions
    const riskAssessment = await mlService.predictRisk(payment);
    const diagnosis = await mlService.diagnose(payment);
    
    // Create recovery case
    const newCase = await recoveryService.createRecoveryCase(
      {
        payment_id: payment.id,
        customer_id: payment.customer_id,
        amount: payment.amount,
        customer_name: payment.customer_name,
        email: payment.email
      },
      diagnosis,
      riskAssessment
    );
    
    res.status(201).json({
      success: true,
      data: newCase
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update case status manually
 * PUT /api/v1/cases/:id/status
 * Body: { status: 'open' | 'in_progress' | 'resolved' | 'stopped' | 'escalated' }
 * 
 * NOTE: This endpoint intentionally bypasses the global STOP safety check.
 * It is designed as a human override capability for manual case management.
 * This allows operators to manually update case status even when global
 * recovery operations are halted via the emergency STOP mechanism.
 */
router.put('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['open', 'in_progress', 'resolved', 'stopped', 'escalated'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }
    
    const db = require('../config/database');
    const updateQuery = `
      UPDATE recovery_cases 
      SET status = ?, updated_at = CURRENT_TIMESTAMP,
          resolved_at = CASE WHEN ? IN ('resolved', 'stopped') THEN CURRENT_TIMESTAMP ELSE resolved_at END
      WHERE id = ?
    `;
    
    await db.query(updateQuery, [status, status, req.params.id]);
    
    // Log audit event
    await auditService.logEvent({
      entityType: 'case',
      entityId: req.params.id,
      eventType: 'status_updated',
      eventData: { new_status: status },
      userOrSystem: req.headers['x-user-id'] || 'api_user'
    });
    
    res.json({
      success: true,
      message: 'Case status updated'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
