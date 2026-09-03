/**
 * Recovery Routes - Automated recovery workflow endpoints
 * POST /api/v1/recovery/detect - Detect revenue at risk
 * POST /api/v1/recovery/run-batch - Run batch recovery workflow
 * GET /api/v1/recovery/status/:id - Get recovery execution status
 */

const express = require('express');
const router = express.Router();
const recoveryService = require('../services/recoveryService');
const mlService = require('../services/mlService');
const simulatorService = require('../services/simulatorService');
const auditService = require('../services/auditService');
const strategySimulatorService = require('../services/strategySimulatorService');
const roiService = require('../services/roiService');
const leakageService = require('../services/leakageService');

/**
 * Detect revenue at risk and create recovery cases
 * POST /api/v1/recovery/detect
 */
router.post('/detect', async (req, res, next) => {
  try {
    const atRiskPayments = await recoveryService.detectRevenueAtRisk();
    const createdCases = [];
    
    for (const payment of atRiskPayments) {
      try {
        // Get ML predictions
        const riskAssessment = await mlService.predictRisk(payment);
        const diagnosis = await mlService.diagnose(payment);
        
        // Create recovery case
        const newCase = await recoveryService.createRecoveryCase(
          payment,
          diagnosis,
          riskAssessment
        );
        
        createdCases.push(newCase);
      } catch (error) {
        console.error(`[Recovery] Failed to create case for payment ${payment.payment_id}:`, error);
      }
    }
    
    // Log audit event
    if (createdCases.length > 0) {
      await auditService.logEvent({
        entityType: 'case',
        entityId: 'batch_detect',
        eventType: 'batch_detection_completed',
        eventData: {
          payments_analyzed: atRiskPayments.length,
          cases_created: createdCases.length
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        paymentsAnalyzed: atRiskPayments.length,
        casesCreated: createdCases.length,
        cases: createdCases
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Run batch recovery workflow on multiple cases
 * POST /api/v1/recovery/run-batch
 * Body: { caseIds?: string[], limit?: number, autoDetect?: boolean }
 */
router.post('/run-batch', async (req, res, next) => {
  try {
    const { caseIds, limit = 50, autoDetect = false } = req.body;
    
    let casesToProcess = [];
    
    if (caseIds && caseIds.length > 0) {
      // Process specific cases
      for (const caseId of caseIds) {
        const caseData = await recoveryService.getRecoveryCase(caseId);
        if (caseData) {
          casesToProcess.push(caseData);
        }
      }
    } else if (autoDetect) {
      // Auto-detect and process
      const atRiskPayments = await recoveryService.detectRevenueAtRisk();
      
      for (const payment of atRiskPayments.slice(0, limit)) {
        const riskAssessment = await mlService.predictRisk(payment);
        const diagnosis = await mlService.diagnose(payment);
        
        const newCase = await recoveryService.createRecoveryCase(
          payment,
          diagnosis,
          riskAssessment
        );
        casesToProcess.push(newCase);
      }
    } else {
      // Get open cases from database
      const db = require('../config/database');
      const query = `
        SELECT rc.*, p.failure_reason, p.payment_method, c.total_payments, 
               c.successful_payments, c.risk_score as customer_risk_score
        FROM recovery_cases rc
        JOIN payments p ON rc.payment_id = p.id
        JOIN customers c ON rc.customer_id = c.id
        WHERE rc.status IN ('open', 'in_progress')
        ORDER BY rc.priority_score DESC
        LIMIT ?
      `;
      casesToProcess = await db.query(query, [limit]);
    }
    
    // Process cases with concurrency control
    const results = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      stopped: 0,
      blocked: 0,
      totalRecovered: 0,
      totalAtRisk: 0,
      byActionType: {},
      details: []
    };
    
    for (const testCase of casesToProcess) {
      results.totalProcessed++;
      results.totalAtRisk += parseFloat(testCase.amount_at_risk || 0);
      
      try {
        // Get recommended action
        const diagnosis = await mlService.diagnose(testCase);
        const recoveryProbs = await mlService.getRecoveryProbabilities(testCase, diagnosis);
        const recommendedAction = await recoveryService.decideRecoveryAction(testCase, recoveryProbs);
        
        // Execute action
        const actionResult = await recoveryService.executeRecoveryAction(testCase.id, recommendedAction);
        
        if (actionResult.success) {
          results.successful++;
          results.totalRecovered += actionResult.recoveredAmount || 0;
        } else if (actionResult.blocked) {
          results.blocked++;
        } else if (recommendedAction === 'stop') {
          results.stopped++;
        } else {
          results.failed++;
        }
        
        // Aggregate by action type
        if (!results.byActionType[recommendedAction]) {
          results.byActionType[recommendedAction] = { total: 0, successful: 0, recovered: 0 };
        }
        results.byActionType[recommendedAction].total++;
        if (actionResult.success) {
          results.byActionType[recommendedAction].successful++;
          results.byActionType[recommendedAction].recovered += actionResult.recoveredAmount || 0;
        }
        
        results.details.push({
          caseId: testCase.id,
          actionType: recommendedAction,
          success: actionResult.success,
          recoveredAmount: actionResult.recoveredAmount || 0,
          message: actionResult.message
        });
      } catch (error) {
        console.error(`[Recovery] Failed to process case ${testCase.id}:`, error);
        results.failed++;
        results.details.push({
          caseId: testCase.id,
          error: error.message
        });
      }
    }
    
    results.recoveryRate = results.totalAtRisk > 0 
      ? ((results.totalRecovered / results.totalAtRisk) * 100).toFixed(2)
      : 0;
    
    // Log batch execution
    await auditService.logEvent({
      entityType: 'case',
      entityId: 'batch_recovery',
      eventType: 'batch_recovery_completed',
      eventData: {
        totalProcessed: results.totalProcessed,
        successful: results.successful,
        failed: results.failed,
        blocked: results.blocked,
        totalRecovered: results.totalRecovered
      }
    });
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Run simulation on synthetic data
 * POST /api/v1/recovery/simulate-batch
 * Body: { count?: number }
 */
router.post('/simulate-batch', async (req, res, next) => {
  try {
    const { count = 100 } = req.body;
    
    // Generate synthetic test cases
    const syntheticData = simulatorService.generateSyntheticPayments(count);
    
    // Convert to recovery case format
    const testCases = syntheticData.payments
      .filter(p => p.status === 'failed')
      .map((payment, index) => ({
        id: `sim_case_${index}`,
        payment_id: payment.id,
        customer_id: payment.customer_id,
        amount_at_risk: payment.amount,
        failure_reason: payment.failure_reason,
        payment_method: payment.payment_method,
        total_payments: 10,
        successful_payments: 7,
        customer_risk_score: 0.3,
        recommended_action: 'retry'
      }));
    
    // Run batch simulation
    const simulationResults = await simulatorService.runBatchSimulation(testCases);
    
    res.json({
      success: true,
      data: simulationResults
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get recovery statistics
 * GET /api/v1/recovery/stats
 */
router.get('/stats', async (req, res, next) => {
  try {
    const db = require('../config/database');
    
    const statsQuery = `
      SELECT 
        COUNT(*) as total_cases,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
        COUNT(CASE WHEN status = 'stopped' THEN 1 END) as stopped,
        COUNT(CASE WHEN status = 'escalated' THEN 1 END) as escalated,
        COUNT(CASE WHEN status IN ('open', 'in_progress') THEN 1 END) as active,
        COALESCE(SUM(recovered_amount), 0) as total_recovered,
        COALESCE(SUM(amount_at_risk), 0) as total_at_risk
      FROM recovery_cases
    `;
    
    const stats = await db.query(statsQuery);
    
    const byDiagnosisQuery = `
      SELECT 
        diagnosis,
        COUNT(*) as count,
        COALESCE(SUM(recovered_amount), 0) as recovered,
        AVG(CASE WHEN status = 'resolved' THEN 1.0 ELSE 0.0 END) as success_rate
      FROM recovery_cases
      GROUP BY diagnosis
    `;
    
    const byDiagnosis = await db.query(byDiagnosisQuery);
    
    const byActionQuery = `
      SELECT 
        ra.action_type,
        COUNT(*) as attempts,
        COUNT(CASE WHEN ra.action_status = 'success' THEN 1 END) as successes,
        COALESCE(SUM(ra.recovery_amount), 0) as recovered
      FROM recovery_actions ra
      GROUP BY ra.action_type
    `;
    
    const byAction = await db.query(byActionQuery);
    
    res.json({
      success: true,
      data: {
        summary: stats[0],
        byDiagnosis,
        byAction
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Compare recovery strategies on the same batch of cases (simulated, no real payments)
 * POST /api/v1/recovery/strategy-comparison
 * Body: { strategies?: {A: [...], B: [...]}, caseIds?: string[], limit?: number, count?: number }
 */
router.post('/strategy-comparison', async (req, res, next) => {
  try {
    const { strategies, caseIds, limit = 20, count = 20 } = req.body;
    const db = require('../config/database');
    let cases = [];
    if (caseIds && caseIds.length > 0) {
      for (const caseId of caseIds) {
        const caseData = await recoveryService.getRecoveryCase(caseId);
        if (caseData) cases.push(caseData);
      }
    } else {
      cases = await db.query(
        `SELECT rc.*, p.failure_reason, p.payment_method
         FROM recovery_cases rc JOIN payments p ON rc.payment_id = p.id
         WHERE rc.status IN ('open', 'in_progress')
         ORDER BY rc.priority_score DESC LIMIT ?`,
        [limit]
      );
    }
    if (cases.length === 0) {
      const synthetic = simulatorService.generateSyntheticPayments(count);
      cases = synthetic.payments
        .filter((p) => p.status === 'failed')
        .map((payment, index) => ({
          id: `strategy_case_${index}`,
          status: 'open',
          amount_at_risk: payment.amount,
          failure_reason: payment.failure_reason,
          payment_method: payment.payment_method,
          diagnosis: 'temporary_failure'
        }));
    }
    const comparison = await strategySimulatorService.compareStrategies(
      cases,
      strategies || undefined
    );
    await auditService.logEvent({
      entityType: 'case',
      entityId: 'strategy_comparison',
      eventType: 'strategy_comparison_completed',
      eventData: { strategies: Object.keys(comparison.strategies), winner: comparison.winner, cases: comparison.casesEvaluated }
    });
    res.json({ success: true, data: comparison });
  } catch (error) {
    next(error);
  }
});

/**
 * Recovery ROI from recorded outcomes (simulated action costs labeled as such)
 * GET /api/v1/recovery/roi
 */
router.get('/roi', async (req, res, next) => {
  try {
    const db = require('../config/database');
    const totals = await db.query(
      `SELECT COALESCE(SUM(amount_at_risk), 0) AS at_risk,
              COALESCE(SUM(recovered_amount), 0) AS recovered,
              COUNT(*) AS cases FROM recovery_cases`
    );
    const actions = await db.query(
      `SELECT action_type, COUNT(*) AS n FROM recovery_actions GROUP BY action_type`
    );
    const actionCounts = {};
    for (const row of actions) actionCounts[row.action_type] = row.n;
    const roi = roiService.calculateROI({
      grossRecovered: parseFloat(totals[0].recovered) || 0,
      amountAtRisk: parseFloat(totals[0].at_risk) || 0,
      incentiveCost: 0,
      actionCounts,
      casesCount: totals[0].cases
    });
    res.json({ success: true, data: { ...roi, incentiveNote: 'Recorded incentive spend is not yet persisted; incentiveCost reflects passed spend only.' } });
  } catch (error) {
    next(error);
  }
});

/**
 * Revenue leakage alerts from actual payment/recovery data
 * GET /api/v1/recovery/alerts
 */
router.get('/alerts', async (req, res, next) => {
  try {
    const result = await leakageService.getLeakageAlerts();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
