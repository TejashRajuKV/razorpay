/**
 * Simulator Routes - Synthetic data generation and testing
 * POST /api/v1/simulator/generate - Generate synthetic payments
 * POST /api/v1/simulator/seed-db - Seed database with test data
 * GET /api/v1/simulator/config - Get simulator configuration
 */

const express = require('express');
const router = express.Router();
const simulatorService = require('../services/simulatorService');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate synthetic payment data
 * POST /api/v1/simulator/generate
 * Body: { count?: number, includeCustomers?: boolean }
 */
router.post('/generate', async (req, res, next) => {
  try {
    const { count = 50, includeCustomers = true } = req.body;
    
    const syntheticData = simulatorService.generateSyntheticPayments(count);
    
    res.json({
      success: true,
      data: {
        customers: includeCustomers ? syntheticData.customers : [],
        payments: syntheticData.payments,
        summary: {
          totalPayments: syntheticData.payments.length,
          totalCustomers: syntheticData.customers.length,
          byStatus: syntheticData.payments.reduce((acc, p) => {
            acc[p.status] = (acc[p.status] || 0) + 1;
            return acc;
          }, {}),
          totalAmount: syntheticData.payments.reduce((sum, p) => sum + p.amount, 0)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Seed database with synthetic test data
 * POST /api/v1/simulator/seed-db
 * Body: { customerCount?: number, paymentCount?: number }
 */
router.post('/seed-db', async (req, res, next) => {
  try {
    const { customerCount = 20, paymentCount = 100 } = req.body;
    
    // Generate synthetic data
    const syntheticData = simulatorService.generateSyntheticPayments(paymentCount);
    const customers = syntheticData.customers.slice(0, customerCount);
    
    // Use transaction for atomic insert
    await db.transaction(async (client) => {
      // Insert customers
      const customerQuery = `
        INSERT OR REPLACE INTO customers 
        (id, name, email, phone, total_payments, successful_payments, failed_payments, 
         total_revenue, risk_score, customer_segment)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      for (const customer of customers) {
        if (db.config.type === 'postgres') {
          await client.query(customerQuery, [
            customer.id, customer.name, customer.email, customer.phone,
            customer.total_payments, customer.successful_payments, customer.failed_payments,
            customer.total_revenue, customer.risk_score, customer.customer_segment
          ]);
        } else {
          client.prepare(customerQuery).run(
            customer.id, customer.name, customer.email, customer.phone,
            customer.total_payments, customer.successful_payments, customer.failed_payments,
            customer.total_revenue, customer.risk_score, customer.customer_segment
          );
        }
      }
      
      // Insert payments (only for existing customers)
      const customerIds = new Set(customers.map(c => c.id));
      const validPayments = syntheticData.payments.filter(p => customerIds.has(p.customer_id));
      
      const paymentQuery = `
        INSERT INTO payments 
        (id, customer_id, amount, currency, status, payment_method, failure_reason, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      for (const payment of validPayments) {
        if (db.config.type === 'postgres') {
          await client.query(paymentQuery, [
            payment.id, payment.customer_id, payment.amount, payment.currency,
            payment.status, payment.payment_method, payment.failure_reason,
            JSON.stringify(payment.metadata)
          ]);
        } else {
          client.prepare(paymentQuery).run(
            payment.id, payment.customer_id, payment.amount, payment.currency,
            payment.status, payment.payment_method, payment.failure_reason,
            JSON.stringify(payment.metadata)
          );
        }
      }
    });
    
    res.json({
      success: true,
      data: {
        customersInserted: customers.length,
        paymentsInserted: validPayments.length,
        message: 'Database seeded successfully'
      }
    });
  } catch (error) {
    console.error('[Simulator] Seed error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Run batch simulation without persisting to database
 * POST /api/v1/simulator/run-batch
 * Body: { cases: Array }
 */
router.post('/run-batch', async (req, res, next) => {
  try {
    const { cases } = req.body;
    
    if (!cases || !Array.isArray(cases)) {
      return res.status(400).json({
        success: false,
        error: 'cases array is required'
      });
    }
    
    const results = await simulatorService.runBatchSimulation(cases);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Test single action outcome
 * POST /api/v1/simulator/test-action
 * Body: { actionType, caseData }
 */
router.post('/test-action', async (req, res, next) => {
  try {
    const { actionType, caseData } = req.body;
    
    if (!actionType || !caseData) {
      return res.status(400).json({
        success: false,
        error: 'actionType and caseData are required'
      });
    }
    
    const result = await simulatorService.executeAction(actionType, caseData);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get simulator configuration and success rates
 */
router.get('/config', async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        actionSuccessRates: simulatorService.ACTION_SUCCESS_RATES,
        configuration: {
          maxRetryAttempts: process.env.MAX_RETRY_ATTEMPTS || 3,
          retryCooldownMinutes: process.env.RETRY_COOLDOWN_MINUTES || 60,
          highValueThreshold: process.env.HIGH_VALUE_THRESHOLD || 50000
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
