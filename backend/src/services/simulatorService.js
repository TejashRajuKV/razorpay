/**
 * Payment and Recovery Simulator
 * Generates realistic synthetic payment outcomes for testing without external APIs
 * Simulates various failure modes and recovery success scenarios
 */

const { v4: uuidv4 } = require('uuid');

// Simulated success rates by action type and failure reason
const ACTION_SUCCESS_RATES = {
  retry: {
    insufficient_funds: 0.65,
    card_expired: 0.10,
    transaction_timeout: 0.75,
    bank_error: 0.55,
    declined_by_bank: 0.45,
    invalid_upi_id: 0.20,
    card_limit_exceeded: 0.50,
    default: 0.50
  },
  reminder: {
    default: 0.35
  },
  payment_link: {
    default: 0.45
  },
  retry_later: {
    default: 0.40
  },
  escalate: {
    default: 0.70 // Human intervention has higher success but costs more
  },
  stop: {
    default: 0.0
  }
};

// Time-based modifiers (payments during business hours have slightly higher success)
const TIME_MODIFIERS = {
  business_hours: 1.1, // 9 AM - 6 PM
  evening: 0.95,       // 6 PM - 10 PM
  night: 0.85          // 10 PM - 9 AM
};

/**
 * Execute a simulated recovery action
 * @param {String} actionType - Type of action (retry, reminder, payment_link, etc.)
 * @param {Object} recoveryCase - Recovery case data
 * @returns {Promise<Object>} Simulation result with success status and recovered amount
 */
async function executeAction(actionType, recoveryCase) {
  // Simulate processing delay
  await delay(100 + Math.random() * 200);

  // 'stop' means halt recovery — it must never report success or recovered money.
  if (actionType === 'stop') {
    return {
      success: false,
      message: generateResultMessage('stop', false, recoveryCase),
      recoveredAmount: 0,
      simulationDetails: { baseSuccessRate: 0, finalProbability: 0, stopped: true },
    };
  }

  const baseSuccessRate = getBaseSuccessRate(actionType, recoveryCase.failureReason);
  const customerModifier = getCustomerModifier(recoveryCase);
  const timeModifier = getTimeModifier();
  const attemptModifier = getAttemptModifier(recoveryCase.attemptNumber || 1);
  
  // Calculate final success probability
  let successProbability = baseSuccessRate * customerModifier * timeModifier * attemptModifier;
  successProbability = Math.max(0.05, Math.min(0.95, successProbability)); // Clamp between 5% and 95%
  
  // Determine outcome
  const randomValue = Math.random();
  const success = randomValue < successProbability;
  
  // Generate result message
  const message = generateResultMessage(actionType, success, recoveryCase);
  
  return {
    success,
    message,
    recoveredAmount: success ? recoveryCase.amount_at_risk : 0,
    simulationDetails: {
      baseSuccessRate,
      customerModifier,
      timeModifier,
      attemptModifier,
      finalProbability: successProbability,
      randomValue
    }
  };
}

/**
 * Get base success rate for an action type and failure reason
 */
function getBaseSuccessRate(actionType, failureReason) {
  const actionRates = ACTION_SUCCESS_RATES[actionType] || ACTION_SUCCESS_RATES.stop;
  return actionRates[failureReason] || actionRates.default || 0.3;
}

/**
 * Customer-specific modifier based on payment history
 */
function getCustomerModifier(recoveryCase) {
  const { 
    total_payments = 1, 
    successful_payments = 0, 
    customer_risk_score = 0.5 
  } = recoveryCase;
  
  // Historical success rate
  const historicalSuccessRate = successful_payments / Math.max(total_payments, 1);
  
  // Good history increases success probability
  const historyModifier = 0.8 + (historicalSuccessRate * 0.4); // 0.8 to 1.2
  
  // Risk score modifier (lower risk = better)
  const riskModifier = 1.2 - (customer_risk_score * 0.4); // 0.8 to 1.2
  
  return historyModifier * riskModifier;
}

/**
 * Time-based modifier for realism
 */
function getTimeModifier() {
  const currentHour = new Date().getHours();
  
  if (currentHour >= 9 && currentHour < 18) {
    return TIME_MODIFIERS.business_hours;
  } else if (currentHour >= 18 && currentHour < 22) {
    return TIME_MODIFIERS.evening;
  } else {
    return TIME_MODIFIERS.night;
  }
}

/**
 * Attempt number modifier (later attempts have lower success probability)
 */
function getAttemptModifier(attemptNumber) {
  // Each subsequent attempt has diminishing returns
  const modifiers = [1.0, 0.85, 0.70, 0.55, 0.40];
  return modifiers[Math.min(attemptNumber - 1, modifiers.length - 1)];
}

/**
 * Generate realistic result message
 */
function generateResultMessage(actionType, success, recoveryCase) {
  const messages = {
    retry: {
      success: [
        'Payment succeeded on retry',
        'Retry successful - funds captured',
        'Payment processed successfully after retry'
      ],
      failed: [
        'Retry failed: insufficient funds',
        'Retry unsuccessful - same error',
        'Payment declined again on retry'
      ]
    },
    reminder: {
      success: [
        'Customer responded to reminder and completed payment',
        'Reminder effective - payment received'
      ],
      failed: [
        'Reminder sent but no response',
        'Customer did not act on reminder'
      ]
    },
    payment_link: {
      success: [
        'Customer used payment link successfully',
        'Payment link converted - payment received'
      ],
      failed: [
        'Payment link expired without use',
        'Customer clicked but did not complete payment'
      ]
    },
    retry_later: {
      success: [
        'Delayed retry successful',
        'Payment succeeded after cooldown period'
      ],
      failed: [
        'Delayed retry still failed',
        'Issue persists after waiting period'
      ]
    },
    escalate: {
      success: [
        'Human intervention successful - payment arranged',
        'Customer support resolved the issue'
      ],
      failed: [
        'Even human escalation could not recover payment',
        'Customer unreachable or unwilling to pay'
      ]
    },
    stop: {
      success: [],
      failed: [
        'Recovery stopped - no further action taken',
        'Case closed per stopping rules'
      ]
    }
  };
  
  const category = messages[actionType] || messages.stop;
  const options = success ? category.success : category.failed;
  
  if (!options || options.length === 0) {
    return success ? 'Action completed successfully' : 'Action did not result in recovery';
  }
  
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Generate synthetic payment events for testing
 * @param {Number} count - Number of payments to generate
 * @returns {Array} Generated payment events
 */
function generateSyntheticPayments(count = 100) {
  const customers = generateSyntheticCustomers(20);
  const payments = [];
  
  const statuses = ['success', 'failed', 'abandoned'];
  const statusWeights = [0.70, 0.25, 0.05];
  const failureReasons = [
    'insufficient_funds',
    'card_expired',
    'transaction_timeout',
    'bank_error',
    'declined_by_bank',
    'invalid_upi_id',
    'card_limit_exceeded'
  ];
  const paymentMethods = ['credit_card', 'debit_card', 'upi', 'net_banking'];
  
  for (let i = 0; i < count; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const status = weightedRandom(statuses, statusWeights);
    const amount = Math.floor(Math.random() * 50000) + 1000;
    
    payments.push({
      id: uuidv4(),
      customer_id: customer.id,
      amount,
      currency: 'INR',
      status,
      payment_method: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
      failure_reason: status === 'failed' ? failureReasons[Math.floor(Math.random() * failureReasons.length)] : null,
      created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        attempt: Math.floor(Math.random() * 3) + 1,
        gateway: ['hdfc', 'icici', 'razorpay', 'sbi'][Math.floor(Math.random() * 4)]
      }
    });
  }
  
  return { customers, payments };
}

/**
 * Generate synthetic customer profiles
 */
function generateSyntheticCustomers(count = 20) {
  const firstNames = ['Rahul', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Ananya', 'Rohan', 'Divya', 'Arjun', 'Kavya'];
  const lastNames = ['Sharma', 'Patel', 'Kumar', 'Reddy', 'Singh', 'Das', 'Mehta', 'Nair', 'Verma', 'Iyer'];
  
  const customers = [];
  for (let i = 0; i < count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const totalPayments = Math.floor(Math.random() * 30) + 1;
    const successfulPayments = Math.floor(totalPayments * (0.6 + Math.random() * 0.35));
    
    customers.push({
      id: uuidv4(),
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      phone: `+91-987654${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`,
      total_payments: totalPayments,
      successful_payments: successfulPayments,
      failed_payments: totalPayments - successfulPayments,
      total_revenue: successfulPayments * (Math.floor(Math.random() * 10000) + 5000),
      risk_score: Math.random() * 0.7,
      customer_segment: ['new', 'standard', 'premium'][Math.floor(Math.random() * 3)]
    });
  }
  
  return customers;
}

/**
 * Weighted random selection
 */
function weightedRandom(options, weights) {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < options.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return options[i];
    }
  }
  
  return options[options.length - 1];
}

/**
 * Utility delay function
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run batch simulation for performance testing
 * @param {Array} cases - Recovery cases to simulate
 * @returns {Promise<Object>} Batch results summary
 */
async function runBatchSimulation(cases) {
  const results = {
    totalCases: cases.length,
    successful: 0,
    failed: 0,
    stopped: 0,
    totalRecovered: 0,
    totalAtRisk: 0,
    byActionType: {},
    details: []
  };
  
  for (const testCase of cases) {
    const actionType = testCase.recommended_action || 'retry';
    const result = await executeAction(actionType, testCase);
    
    results.totalAtRisk += testCase.amount_at_risk || 0;
    
    if (result.success) {
      results.successful++;
      results.totalRecovered += result.recoveredAmount || 0;
    } else if (actionType === 'stop') {
      results.stopped++;
    } else {
      results.failed++;
    }
    
    // Aggregate by action type
    if (!results.byActionType[actionType]) {
      results.byActionType[actionType] = { total: 0, successful: 0, recovered: 0 };
    }
    results.byActionType[actionType].total++;
    if (result.success) {
      results.byActionType[actionType].successful++;
      results.byActionType[actionType].recovered += result.recoveredAmount || 0;
    }
    
    results.details.push({
      caseId: testCase.id,
      actionType,
      success: result.success,
      recoveredAmount: result.recoveredAmount || 0
    });
  }
  
  results.recoveryRate = results.totalAtRisk > 0 
    ? (results.totalRecovered / results.totalAtRisk * 100).toFixed(2)
    : 0;
  
  return results;
}

module.exports = {
  executeAction,
  generateSyntheticPayments,
  generateSyntheticCustomers,
  runBatchSimulation,
  ACTION_SUCCESS_RATES
};
