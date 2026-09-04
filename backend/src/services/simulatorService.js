/**
 * Payment and Recovery Simulator
 * Generates realistic synthetic payment outcomes for testing without external APIs
 * Simulates various failure modes and recovery success scenarios
 */

const { v4: uuidv4 } = require('uuid');

// Deterministic random number generator using a simple xorshift32
// Accepts an optional seed; if no seed provided, uses Math.random (non-deterministic)
function createRNG(seed) {
  let state = seed >>> 0;
  if (state === 0 || state === -1) state = 123456789; // reject invalid

  return {
    next: function () {
      // xorshift32
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 0x100000000; // [0, 1)
    },
    float: function () { return this.next(); },
    integer: function (max) { return Math.floor(this.next() * (max || 0)); }
  };
}

// Default RNG (non-deterministic, using Math.random)
const rng = createRNG(undefined);

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

// Customer segments
const CUSTOMER_SEGMENTS = ['new', 'standard', 'premium', 'reliable', 'high_value', 'enterprise'];

// Payment method distribution weights (must sum to ~1.0)
const PAYMENT_METHOD_WEIGHTS = {
  credit_card: 0.35,
  debit_card: 0.25,
  upi: 0.25,
  net_banking: 0.15
};

// Payment status distribution weights
const PAYMENT_STATUS_WEIGHTS = {
  successful: 0.70,
  failed: 0.25,
  abandoned: 0.05
};

// Failure reasons supported by the ML/recovery system
const FAILURE_REASONS = [
  'insufficient_funds',
  'card_expired',
  'transaction_timeout',
  'bank_error',
  'declined_by_bank',
  'invalid_upi_id',
  'card_limit_exceeded'
];

// Time-based modifiers (payments during business hours have slightly higher success)
const TIME_MODIFIERS = {
  business_hours: 1.1, // 9 AM - 6 PM
  evening: 0.95,       // 6 PM - 10 PM
  night: 0.85          // 10 PM - 9 AM
};

/**
 * Create a seeded RNG for deterministic data generation
 * @param {Number} seed - Optional seed value; uses Date.now() if not provided
 * @returns {Object} RNG with next()/float()/integer() methods
 */
function createSeededRNG(seed) {
  // Use a simple LCG (Linear Congruential Generator) for reproducibility
  // Constants from glibc's rand48
  let m = 0x100000000; // 2^32
  let a = 25214903917;
  let c = 11;
  let state = (seed || Date.now()) % m;

  return {
    next: function () {
      state = (a * state + c) % m;
      return state / m;
    },
    float: function () { return this.next(); },
    integer: function (max) { return Math.floor(this.next() * (max || 0)); }
  };
}

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
 * @param {Object} [options] - Generation options
 * @param {Number} [options.seed] - Seed for deterministic generation
 * @returns {Object} Generated payment events with customers
 */
function generateSyntheticPayments(count = 10000, options = {}) {
  const seed = options.seed || undefined;
  const rng = createSeededRNG(seed);

  const customers = generateSyntheticCustomers(1000, { seed });

  const payments = [];
  const customerIds = new Set(customers.map(c => c.id));

  // Pre-compute customer behavior profiles for consistency
  const customerProfiles = {};
  customers.forEach(c => {
    const historicalSuccessRate = c.successful_payments / Math.max(c.total_payments, 1);
    const isReliable = c.customer_segment === 'reliable';
    const isNew = c.customer_segment === 'new';
    const isHighValue = c.customer_segment === 'high_value' || c.customer_segment === 'enterprise';
    // Weight for this customer being the source of a payment
    customerProfiles[c.id] = {
      historicalSuccessRate,
      isReliable,
      isNew,
      isHighValue,
      totalRevenue: c.total_revenue
    };
  });

  const failureReasons = [
    'insufficient_funds',
    'card_expired',
    'transaction_timeout',
    'bank_error',
    'declined_by_bank',
    'invalid_upi_id',
    'card_limit_exceeded'
  ];

  // Payment method pool with weighted selection
  const paymentMethodPool = [];
  for (const method of Object.keys(PAYMENT_METHOD_WEIGHTS)) {
    const times = Math.floor(PAYMENT_METHOD_WEIGHTS[method] * count) + 1;
    for (let i = 0; i < times; i++) {
      paymentMethodPool.push(method);
    }
  }
  // Trim or pad to exactly count
  while (paymentMethodPool.length < count) paymentMethodPool.push('credit_card');
  while (paymentMethodPool.length > count) paymentMethodPool.pop();

  for (let i = 0; i < count; i++) {
    // Use deterministic RNG for customer selection
    const customerIdx = rng.integer(customers.length);
    const customer = customers[customerIdx];
    const profile = customerProfiles[customer.id];

    // Determine payment status using weighted random with customer influence
    // Reliable customers have higher success rate, new customers lower
    let baseSuccessWeight = PAYMENT_STATUS_WEIGHTS.successful;
    if (profile.isReliable) baseSuccessWeight *= 1.4; // +40% for reliable
    if (profile.isNew) baseSuccessWeight *= 0.7;     // -30% for new

    // Normalize weights
    const totalWeight = baseSuccessWeight + PAYMENT_STATUS_WEIGHTS.failed + PAYMENT_STATUS_WEIGHTS.abandoned;
    const sWeight = baseSuccessWeight / totalWeight;
    const fWeight = PAYMENT_STATUS_WEIGHTS.failed / totalWeight;
    const aWeight = PAYMENT_STATUS_WEIGHTS.abandoned / totalWeight;

    const statusRand = rng.float();
    let status;
    if (statusRand < sWeight) {
      status = 'success';
    } else if (statusRand < sWeight + fWeight) {
      status = 'failed';
    } else {
      status = 'abandoned';
    }

    // Determine amount based on customer segment
    let amount;
    if (profile.isHighValue) {
      // High-value: ₹50k-₹2L range
      amount = Math.floor(rng.integer(15000)) + 50000;
    } else if (profile.isReliable) {
      // Reliable: ₹10k-₹50k range
      amount = Math.floor(rng.integer(4000)) + 10000;
    } else {
      // Standard/new: ₹1k-₹50k range
      amount = Math.floor(rng.integer(5000)) + 1000;
    }

    // Payment method from pre-computed pool
    const methodIdx = i % paymentMethodPool.length;
    const paymentMethod = paymentMethodPool[methodIdx];

    // Failure reason only for failed payments
    let failureReason = null;
    if (status === 'failed') {
      // Weighted selection of failure reasons
      const reasonWeights = {
        insufficient_funds: 0.35,
        card_expired: 0.15,
        transaction_timeout: 0.20,
        bank_error: 0.10,
        declined_by_bank: 0.10,
        invalid_upi_id: 0.05,
        card_limit_exceeded: 0.05
      };
      const reasonTotal = Object.values(reasonWeights).reduce((a, b) => a + b, 0);
      const reasonRand = rng.float();
      let cumulative = 0;
      failureReason = 'insufficient_funds'; // default
      for (const [reason, weight] of Object.entries(reasonWeights)) {
        cumulative += weight / reasonTotal;
        if (reasonRand < cumulative) {
          failureReason = reason;
          break;
        }
      }
    }

    // Attempt number: new customers more likely to have multiple attempts; reliable fewer
    const attemptBase = profile.isReliable ? 1 : (profile.isNew ? 2 : 1);
    const attemptVariance = rng.integer(3); // 0, 1, or 2 additional attempts
    const attemptNumber = attemptBase + attemptVariance;

    // Gateway selection based on payment method
    const gateways = {
      credit_card: ['hdfc', 'icici', 'axis', 'sbi'],
      debit_card: ['icici', 'axis', 'sbi'],
      upi: ['razorpay', 'hdfc', 'sbi', 'axis'],
      net_banking: ['sbi', 'hdfc', 'axis', 'icici']
    };
    const gw = gateways[paymentMethod][rng.integer(gateways[paymentMethod].length)];

    payments.push({
      id: uuidv4(),
      customer_id: customer.id,
      amount,
      currency: 'INR',
      status,
      payment_method: paymentMethod,
      failure_reason: failureReason,
      attemptNumber,
      created_at: new Date(Date.now() - rng.integer(365) * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        attempt: attemptNumber,
        gateway: gw
      }
    });
  }

  return { customers, payments };
}

/**
 * Generate synthetic customer profiles
 * @param {Number} count - Number of customers to generate
 * @param {Object} [options] - Generation options
 * @param {Number} [options.seed] - Seed for deterministic generation
 * @returns {Array} Generated customer profiles
 */
function generateSyntheticCustomers(count = 1000, options = {}) {
  const seed = options.seed || undefined;
  const rng = createSeededRNG(seed);

  const firstNames = ['Rahul', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Ananya', 'Rohan', 'Divya', 'Arjun', 'Kavya'];
  const lastNames = ['Sharma', 'Patel', 'Kumar', 'Reddy', 'Singh', 'Das', 'Mehta', 'Nair', 'Verma', 'Iyer'];

  // Define segment distribution: new(20%), standard(50%), premium(20%), reliable(5%), high_value(3%), enterprise(2%)
  const segmentWeights = [0.20, 0.50, 0.20, 0.05, 0.03, 0.02];
  const segmentNames = ['new', 'standard', 'premium', 'reliable', 'high_value', 'enterprise'];

  // Pre-compute segment assignments using seeded RNG
  const segmentAssignments = [];
  for (let i = 0; i < count; i++) {
    const segRand = rng.float();
    let cumulative = 0;
    let assignedSeg = segmentNames[0];
    for (let si = 0; si < segmentNames.length; si++) {
      cumulative += segmentWeights[si];
      if (segRand < cumulative) {
        assignedSeg = segmentNames[si];
        break;
      }
    }
    segmentAssignments.push(assignedSeg);
  }

  const customers = [];
  for (let i = 0; i < count; i++) {
    const seg = segmentAssignments[i];
    const firstName = firstNames[rng.integer(firstNames.length)];
    const lastName = lastNames[rng.integer(lastNames.length)];
    const baseIndex = i; // for consistent naming

    // Customer characteristics by segment
    const segmentConfigs = {
      new: {
        totalPaymentsRange: [1, 8],
        successRateRange: [0.3, 0.5],
        revenueMultiplier: 1.0,
        riskRange: [0.5, 0.8]
      },
      standard: {
        totalPaymentsRange: [5, 25],
        successRateRange: [0.5, 0.7],
        revenueMultiplier: 1.5,
        riskRange: [0.3, 0.6]
      },
      premium: {
        totalPaymentsRange: [20, 50],
        successRateRange: [0.7, 0.9],
        revenueMultiplier: 3.0,
        riskRange: [0.1, 0.4]
      },
      reliable: {
        totalPaymentsRange: [30, 80],
        successRateRange: [0.85, 0.95],
        revenueMultiplier: 2.5,
        riskRange: [0.1, 0.3]
      },
      high_value: {
        totalPaymentsRange: [50, 150],
        successRateRange: [0.75, 0.9],
        revenueMultiplier: 5.0,
        riskRange: [0.05, 0.2]
      },
      enterprise: {
        totalPaymentsRange: [100, 300],
        successRateRange: [0.8, 0.95],
        revenueMultiplier: 10.0,
        riskRange: [0.02, 0.1]
      }
    };

    const cfg = segmentConfigs[seg] || segmentConfigs.standard;

    // Generate total payments within segment range
    const totalPayments = rng.integer(cfg.totalPaymentsRange[1] - cfg.totalPaymentsRange[0] + 1) + cfg.totalPaymentsRange[0];

    // Generate success rate within segment range
    const successRate = cfg.successRateRange[0] + rng.float() * (cfg.successRateRange[1] - cfg.successRateRange[0]);
    const successfulPayments = Math.floor(totalPayments * successRate);
    const failedPayments = totalPayments - successfulPayments;

    // Revenue: base per payment * segment multiplier
    const baseRevenuePerPayment = 3000 + rng.integer(7000);
    const totalRevenue = Math.round(successfulPayments * baseRevenuePerPayment * cfg.revenueMultiplier / 100) * 100;

    // Risk score: lower is better, varies by segment
    let riskScore = cfg.riskRange[0] + rng.float() * (cfg.riskRange[1] - cfg.riskRange[0]);
    riskScore = Math.min(1.0, parseFloat(riskScore.toFixed(4)));

    // Phone number
    const phoneNum = String(9876540000 + i).padStart(10, '0'); // +91- followed by 10 digits

    customers.push({
      id: uuidv4(),
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      phone: `+91-${phoneNum.slice(0, 5)}-${phoneNum.slice(5)}`,
      total_payments: totalPayments,
      successful_payments: successfulPayments,
      failed_payments: failedPayments,
      total_revenue: totalRevenue,
      risk_score: Number(riskScore.toFixed(4)),
      customer_segment: seg
    });
  }

  return customers;
}

/**
 * Weighted random selection
 */

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
  createSeededRNG,
  ACTION_SUCCESS_RATES
};
