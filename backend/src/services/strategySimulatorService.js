const recoveryService = require('./recoveryService');
const simulatorService = require('./simulatorService');
const incentiveService = require('./incentiveService');
const roiService = require('./roiService');

const DEFAULT_STRATEGIES = {
  A: ['retry', 'retry_later', 'payment_link'],
  B: ['payment_link', 'reminder', 'retry_later'],
  C: ['reminder', 'payment_link', 'escalate']
};

const VALID_ACTIONS = ['retry', 'reminder', 'payment_link', 'retry_later', 'escalate', 'stop'];

function baseRate(action, failureReason) {
  const rates = simulatorService.ACTION_SUCCESS_RATES[action] || {};
  return rates[failureReason] ?? rates.default ?? 0.3;
}

async function runCaseSequence(testCase, sequence) {
  const amount = parseFloat(testCase.amount_at_risk ?? testCase.amountAtRisk ?? 0) || 0;
  const reason = testCase.failure_reason ?? testCase.failureReason ?? 'unknown';
  const out = {
    amount, recovered: 0, success: false, expected: 0,
    incentiveCost: 0, blocked: 0, actionCounts: {}
  };
  let firstAttempted = false;
  for (const action of sequence) {
    const check = await recoveryService.checkStoppingRules(
      { ...testCase, status: testCase.status || 'open', amount_at_risk: amount },
      action
    );
    if (!check.allowed) {
      out.blocked += 1;
      continue;
    }
    if (!firstAttempted) {
      out.expected = Math.round(baseRate(action, reason) * amount * 100) / 100;
      firstAttempted = true;
    }
    out.actionCounts[action] = (out.actionCounts[action] || 0) + 1;
    const outcome = await simulatorService.executeAction(action, { ...testCase, amount_at_risk: amount, failureReason: reason });
    if (outcome.success) {
      out.success = true;
      out.recovered = outcome.recoveredAmount || 0;
      const incentive = incentiveService.recommendIncentive({
        amount,
        probability: baseRate(action, reason),
        diagnosis: testCase.diagnosis || 'unknown'
      });
      out.incentiveCost += incentive.incentiveAmount;
      break;
    }
  }
  return out;
}

async function runStrategy(cases, sequence) {
  const result = {
    sequence,
    cases: cases.length,
    amountAtRisk: 0,
    recovered: 0,
    expectedRecovery: 0,
    successful: 0,
    failed: 0,
    blocked: 0,
    incentiveCost: 0,
    actionCounts: {},
    details: []
  };
  if (!sequence || sequence.length === 0) {
    return finishStrategyResult(result);
  }
  for (const testCase of cases) {
    const r = await runCaseSequence(testCase, sequence);
    result.amountAtRisk += r.amount;
    result.expectedRecovery += r.expected;
    result.recovered += r.recovered;
    result.blocked += r.blocked;
    result.incentiveCost += r.incentiveCost;
    if (r.success) result.successful += 1;
    else result.failed += 1;
    for (const [action, n] of Object.entries(r.actionCounts)) {
      result.actionCounts[action] = (result.actionCounts[action] || 0) + n;
    }
    result.details.push({ caseId: testCase.id, success: r.success, recoveredAmount: r.recovered, expectedRecovery: r.expected });
  }
  return finishStrategyResult(result);
}

function finishStrategyResult(result) {
  result.amountAtRisk = Math.round(result.amountAtRisk * 100) / 100;
  result.recovered = Math.round(result.recovered * 100) / 100;
  result.expectedRecovery = Math.round(result.expectedRecovery * 100) / 100;
  result.recoveryRate = result.amountAtRisk > 0 ? Math.round((result.recovered / result.amountAtRisk) * 10000) / 10000 : 0;
  result.roi = roiService.calculateROI({
    grossRecovered: result.recovered,
    amountAtRisk: result.amountAtRisk,
    incentiveCost: result.incentiveCost,
    actionCounts: result.actionCounts,
    casesCount: result.cases
  });
  result.netRecovered = result.roi.netRecovered;
  return result;
}

// Rule baseline: one diagnosis-driven action per case (plan primary), no sequencing.
async function runRuleBaseline(cases) {
  const result = {
    sequence: ['rule:plan-primary'],
    cases: cases.length,
    amountAtRisk: 0,
    recovered: 0,
    expectedRecovery: 0,
    successful: 0,
    failed: 0,
    blocked: 0,
    incentiveCost: 0,
    actionCounts: {},
    details: []
  };
  for (const testCase of cases) {
    const plan = recoveryService.buildRecoveryPlan(testCase.diagnosis || 'unknown');
    const r = await runCaseSequence(testCase, [plan[0].action]);
    result.amountAtRisk += r.amount;
    result.expectedRecovery += r.expected;
    result.recovered += r.recovered;
    result.blocked += r.blocked;
    result.incentiveCost += r.incentiveCost;
    if (r.success) result.successful += 1;
    else result.failed += 1;
    for (const [action, n] of Object.entries(r.actionCounts)) {
      result.actionCounts[action] = (result.actionCounts[action] || 0) + n;
    }
    result.details.push({ caseId: testCase.id, success: r.success, recoveredAmount: r.recovered, expectedRecovery: r.expected });
  }
  return finishStrategyResult(result);
}

async function compareStrategies(cases, strategies = DEFAULT_STRATEGIES) {
  const comparison = {};
  for (const [name, sequence] of Object.entries(strategies)) {
    const invalid = (sequence || []).filter((a) => !VALID_ACTIONS.includes(a));
    if ((sequence || []).length === 0 || invalid.length > 0) {
      throw new Error(`Strategy ${name} invalid: must be a non-empty sequence of ${VALID_ACTIONS.join(', ')}`);
    }
    comparison[name] = await runStrategy(cases, sequence);
  }
  let winner = null;
  for (const name of Object.keys(comparison)) {
    if (!winner || comparison[name].netRecovered > comparison[winner].netRecovered) winner = name;
  }
  return { strategies: comparison, winner, casesEvaluated: cases.length };
}

// Engineered sequences plus dumb baselines on the same input batch.
async function compareWithBaselines(cases) {
  const baselines = {
    NO_ACTION: await runStrategy(cases, []),
    FIXED_RETRY: await runStrategy(cases, ['retry', 'retry', 'retry']),
    RULE_BASELINE: await runRuleBaseline(cases),
  };
  const engineered = await compareStrategies(cases, DEFAULT_STRATEGIES);
  const strategies = { ...baselines, ...engineered.strategies };
  let winner = null;
  for (const name of Object.keys(strategies)) {
    if (!winner || strategies[name].netRecovered > strategies[winner].netRecovered) winner = name;
  }
  return { strategies, winner, casesEvaluated: cases.length };
}

module.exports = { compareStrategies, compareWithBaselines, runStrategy, runRuleBaseline, DEFAULT_STRATEGIES, VALID_ACTIONS };
