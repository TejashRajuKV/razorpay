/**
 * Analytics Routes - Recovery performance and metrics
 * GET /api/v1/analytics/overview - Recovery analytics overview
 * GET /api/v1/analytics/by-action - Performance by action type
 * GET /api/v1/analytics/trends - Recovery trends over time
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * Get analytics overview
 */
router.get('/overview', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const params = [];
    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = `WHERE created_at BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }
    
    // Overall recovery metrics
    const overviewQuery = `
      SELECT 
        COUNT(*) as total_cases,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
        COUNT(CASE WHEN status = 'stopped' THEN 1 END) as stopped_count,
        COUNT(CASE WHEN status = 'escalated' THEN 1 END) as escalated_count,
        COALESCE(SUM(amount_at_risk), 0) as total_at_risk,
        COALESCE(SUM(recovered_amount), 0) as total_recovered,
        AVG(risk_probability) as avg_risk_probability,
        AVG(priority_score) as avg_priority_score
      FROM recovery_cases
      ${dateFilter}
    `;
    
    const overview = await db.query(overviewQuery, params);

    // Success rate by diagnosis
    const successByDiagnosisQuery = `
      SELECT
        diagnosis,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
        ROUND(100.0 * COUNT(CASE WHEN status = 'resolved' THEN 1 END) / COUNT(*), 2) as success_rate,
        COALESCE(SUM(recovered_amount), 0) as recovered_amount
      FROM recovery_cases
      ${dateFilter}
      GROUP BY diagnosis
      ORDER BY total DESC
    `;

    const successByDiagnosis = await db.query(successByDiagnosisQuery, params);

    // Action effectiveness
    const actionDateFilter = dateFilter.replace('created_at', 'ra.created_at');
    const actionEffectivenessQuery = `
      SELECT
        ra.action_type,
        COUNT(*) as attempts,
        COUNT(CASE WHEN ra.action_status = 'success' THEN 1 END) as successes,
        ROUND(100.0 * COUNT(CASE WHEN ra.action_status = 'success' THEN 1 END) / COUNT(*), 2) as success_rate,
        COALESCE(SUM(ra.recovery_amount), 0) as recovered_amount,
        AVG(ra.recovery_amount) as avg_recovery_amount
      FROM recovery_actions ra
      ${actionDateFilter}
      GROUP BY ra.action_type
      ORDER BY attempts DESC
    `;

    const actionEffectiveness = await db.query(actionEffectivenessQuery, params);
    
    res.json({
      success: true,
      data: {
        overview: overview[0],
        successByDiagnosis,
        actionEffectiveness
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get performance metrics by action type
 */
router.get('/by-action', async (req, res, next) => {
  try {
    const { diagnosis } = req.query;
    const qParams = [];
    let diagnosisFilter = '';
    if (diagnosis) {
      diagnosisFilter = `AND rc.diagnosis = ?`;
      qParams.push(diagnosis);
    }

    const query = `
      SELECT
        ra.action_type,
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN ra.action_status = 'success' THEN 1 END) as successful,
        COUNT(CASE WHEN ra.action_status = 'failed' THEN 1 END) as failed,
        ROUND(100.0 * COUNT(CASE WHEN ra.action_status = 'success' THEN 1 END) / COUNT(*), 2) as success_rate,
        COALESCE(SUM(ra.recovery_amount), 0) as total_recovered,
        AVG(ra.recovery_amount) as avg_recovery,
        MIN(ra.recovery_amount) as min_recovery,
        MAX(ra.recovery_amount) as max_recovery
      FROM recovery_actions ra
      JOIN recovery_cases rc ON ra.case_id = rc.id
      WHERE 1=1 ${diagnosisFilter}
      GROUP BY ra.action_type
      ORDER BY total_recovered DESC
    `;

    const results = await db.query(query, qParams);
    
    res.json({
      success: true,
      data: {
        byAction: results
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get recovery trends over time
 */
router.get('/trends', async (req, res, next) => {
  try {
    const { period = 'daily' } = req.query;
    
    let dateFormat;
    switch (period) {
      case 'hourly':
        dateFormat = "strftime('%Y-%m-%d %H:00', created_at)";
        break;
      case 'weekly':
        dateFormat = "strftime('%Y-W%W', created_at)";
        break;
      case 'monthly':
        dateFormat = "strftime('%Y-%m', created_at)";
        break;
      default:
        dateFormat = "DATE(created_at)";
    }
    
    const trendsQuery = `
      SELECT 
        ${dateFormat} as period,
        COUNT(*) as cases_created,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as cases_resolved,
        COALESCE(SUM(amount_at_risk), 0) as amount_at_risk,
        COALESCE(SUM(recovered_amount), 0) as amount_recovered,
        ROUND(100.0 * COUNT(CASE WHEN status = 'resolved' THEN 1 END) / COUNT(*), 2) as success_rate
      FROM recovery_cases
      GROUP BY ${dateFormat}
      ORDER BY period DESC
      LIMIT 30
    `;
    
    const trends = await db.query(trendsQuery);
    
    res.json({
      success: true,
      data: {
        period,
        trends
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get failure reason analysis
 */
router.get('/failure-reasons', async (req, res, next) => {
  try {
    const query = `
      SELECT 
        p.failure_reason,
        COUNT(DISTINCT rc.id) as case_count,
        COALESCE(SUM(rc.amount_at_risk), 0) as total_at_risk,
        COALESCE(SUM(rc.recovered_amount), 0) as total_recovered,
        ROUND(100.0 * COUNT(CASE WHEN rc.status = 'resolved' THEN 1 END) / COUNT(DISTINCT rc.id), 2) as recovery_rate,
        AVG(rc.risk_probability) as avg_risk,
        AVG(rc.priority_score) as avg_priority
      FROM recovery_cases rc
      JOIN payments p ON rc.payment_id = p.id
      WHERE p.failure_reason IS NOT NULL
      GROUP BY p.failure_reason
      ORDER BY case_count DESC
    `;
    
    const results = await db.query(query);
    
    res.json({
      success: true,
      data: {
        byFailureReason: results
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get ML insights derived from REAL recovery analytics (no fake accuracy).
 * Returns diagnosis distribution, action effectiveness, and confidence stats
 * computed from SQL — never hardcoded model scores.
 */
router.get('/ml-insights', async (req, res, next) => {
  try {
    const byDiagnosis = await db.query(`
      SELECT diagnosis, COUNT(*) as count,
        COUNT(CASE WHEN status='resolved' THEN 1 END) as resolved,
        COALESCE(SUM(recovered_amount),0) as recovered
      FROM recovery_cases GROUP BY diagnosis ORDER BY count DESC
    `);
    const byAction = await db.query(`
      SELECT action_type, COUNT(*) as attempts,
        COUNT(CASE WHEN action_status='success' THEN 1 END) as successes,
        COALESCE(SUM(recovery_amount),0) as recovered
      FROM recovery_actions GROUP BY action_type ORDER BY attempts DESC
    `);
    const mlPreds = await db.query(`
      SELECT model_type, COUNT(*) as predictions,
        AVG(confidence) as avg_confidence
      FROM ml_predictions GROUP BY model_type
    `).catch(() => []);
    res.json({
      success: true,
      data: {
        derivedFrom: 'recovery_analytics',
        note: 'Insights computed from actual recovery_cases/recovery_actions; not synthetic model scores.',
        byDiagnosis, byAction, mlPredictions: mlPreds
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get customer segment performance
 */
router.get('/customer-segments', async (req, res, next) => {
  try {
    const query = `
      SELECT 
        c.customer_segment,
        COUNT(DISTINCT rc.id) as cases,
        COALESCE(SUM(rc.recovered_amount), 0) as recovered,
        COALESCE(SUM(rc.amount_at_risk), 0) as at_risk,
        ROUND(100.0 * COUNT(CASE WHEN rc.status = 'resolved' THEN 1 END) / COUNT(DISTINCT rc.id), 2) as success_rate,
        AVG(c.risk_score) as avg_customer_risk
      FROM recovery_cases rc
      JOIN customers c ON rc.customer_id = c.id
      GROUP BY c.customer_segment
      ORDER BY recovered DESC
    `;
    
    const results = await db.query(query);
    
    res.json({
      success: true,
      data: {
        bySegment: results
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
