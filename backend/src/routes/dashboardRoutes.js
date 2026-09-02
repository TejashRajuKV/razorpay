/**
 * Dashboard Routes - Revenue overview and key metrics
 * GET /api/v1/dashboard/overview - Main dashboard metrics
 * GET /api/v1/dashboard/revenue-at-risk - Revenue at risk breakdown
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * Get dashboard overview with key metrics
 */
router.get('/overview', async (req, res, next) => {
  try {
    // Total revenue (successful payments)
    const totalRevenueQuery = `
      SELECT COALESCE(SUM(amount), 0) as total_revenue, COUNT(*) as payment_count
      FROM payments WHERE status = 'success'
    `;
    const totalRevenue = await db.query(totalRevenueQuery);
    
    // Revenue at risk (failed/abandoned payments without active recovery)
    const revenueAtRiskQuery = `
      SELECT COALESCE(SUM(p.amount), 0) as amount_at_risk, COUNT(*) as case_count
      FROM payments p
      WHERE p.status IN ('failed', 'abandoned')
      AND NOT EXISTS (
        SELECT 1 FROM recovery_cases rc 
        WHERE rc.payment_id = p.id AND rc.status IN ('resolved', 'stopped')
      )
    `;
    const revenueAtRisk = await db.query(revenueAtRiskQuery);
    
    // Recovered revenue
    const recoveredQuery = `
      SELECT COALESCE(SUM(recovered_amount), 0) as recovered_revenue,
             COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_cases
      FROM recovery_cases
    `;
    const recovered = await db.query(recoveredQuery);
    
    // Active cases by status
    const activeCasesQuery = `
      SELECT status, COUNT(*) as count, COALESCE(SUM(amount_at_risk), 0) as amount
      FROM recovery_cases
      WHERE status NOT IN ('resolved', 'stopped')
      GROUP BY status
    `;
    const activeCases = await db.query(activeCasesQuery);
    
    // Recent activity (last 7 days)
    const recentActivityQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as cases_created,
        COALESCE(SUM(CASE WHEN status = 'resolved' THEN recovered_amount ELSE 0 END), 0) as daily_recovered
      FROM recovery_cases
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;
    const recentActivity = await db.query(recentActivityQuery);
    
    res.json({
      success: true,
      data: {
        totalRevenue: parseFloat(totalRevenue[0].total_revenue),
        totalPayments: totalRevenue[0].payment_count,
        revenueAtRisk: parseFloat(revenueAtRisk[0].amount_at_risk),
        casesAtRisk: revenueAtRisk[0].case_count,
        recoveredRevenue: parseFloat(recovered[0].recovered_revenue),
        resolvedCases: recovered[0].resolved_cases,
        recoveryRate: revenueAtRisk[0].amount_at_risk > 0 
          ? ((parseFloat(recovered[0].recovered_revenue) / parseFloat(revenueAtRisk[0].amount_at_risk)) * 100).toFixed(2)
          : 0,
        activeCases: activeCases.reduce((acc, row) => {
          acc[row.status] = { count: row.count, amount: row.amount };
          return acc;
        }, {}),
        recentActivity
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get revenue at risk breakdown by category
 */
router.get('/revenue-at-risk', async (req, res, next) => {
  try {
    const breakdownQuery = `
      SELECT 
        rc.diagnosis,
        COUNT(*) as case_count,
        COALESCE(SUM(rc.amount_at_risk), 0) as total_amount,
        AVG(rc.risk_probability) as avg_risk,
        AVG(rc.priority_score) as avg_priority
      FROM recovery_cases rc
      WHERE rc.status NOT IN ('resolved', 'stopped')
      GROUP BY rc.diagnosis
      ORDER BY total_amount DESC
    `;
    
    const breakdown = await db.query(breakdownQuery);
    
    // By failure reason
    const byFailureReasonQuery = `
      SELECT 
        p.failure_reason,
        COUNT(*) as case_count,
        COALESCE(SUM(rc.amount_at_risk), 0) as total_amount
      FROM recovery_cases rc
      JOIN payments p ON rc.payment_id = p.id
      WHERE rc.status NOT IN ('resolved', 'stopped')
      GROUP BY p.failure_reason
      ORDER BY total_amount DESC
    `;
    
    const byFailureReason = await db.query(byFailureReasonQuery);
    
    res.json({
      success: true,
      data: {
        byDiagnosis: breakdown,
        byFailureReason
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get customer segment analysis
 */
router.get('/customer-segments', async (req, res, next) => {
  try {
    const query = `
      SELECT 
        c.customer_segment,
        COUNT(DISTINCT c.id) as customer_count,
        COALESCE(SUM(rc.amount_at_risk), 0) as revenue_at_risk,
        COALESCE(SUM(rc.recovered_amount), 0) as recovered,
        AVG(rc.risk_probability) as avg_risk
      FROM customers c
      LEFT JOIN recovery_cases rc ON c.id = rc.customer_id
      GROUP BY c.customer_segment
      ORDER BY revenue_at_risk DESC
    `;
    
    const segments = await db.query(query);
    
    res.json({
      success: true,
      data: { segments }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
