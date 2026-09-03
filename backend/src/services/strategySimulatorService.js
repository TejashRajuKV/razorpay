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
  for (const testCase of cases) {
    const amount = parseFloat(testCase.amount_at_risk ?? testCase.amountAtRisk ?? 0) || 0;
    const reason = testCase.failure_reason ?? testCase.failureReason ?? 'unknown';
    result.amountAtRisk += amount;
    let recovered = 0;
    let success = false;
    let expected = 0;
    let firstAttempted = false;
    for (const action of sequence) {
      const check = await recoveryService.checkStoppingRules(
        { ...testCase, status: testCase.status || 'open', amount_at_risk: amount },
        action
      );
      if (!check.allowed) {
        result.blocked += 1;
        continue;
      }
      if (!firstAttempted) {
        expected = Math.round(baseRate(action, reason) * amount * 100) / 100;
        result.expectedRecovery += expected;
        firstAttempted = true;
      }
      result.actionCounts[action] = (result.actionCounts[action] || 0) + 1;
      const outcome = await simulatorService.executeAction(action, { ...testCase, amount_at_risk: amount, failureReason: reason });
      if (outcome.success) {
        success = true;
        recovered = outcome.recoveredAmount || 0;
        const incentive = incentiveService.recommendIncentive({
          amount,
          probability: baseRate(action, reason),
          diagnosis: testCase.diagnosis || 'unknown'
        });
        result.incentiveCost += incentive.incentiveAmount;
        break;
      }
    }
    result.recovered += recovered;
    if (success) result.successful += 1;
    else result.failed += 1;
    result.details.push({ caseId: testCase.id, success, recoveredAmount: recovered, expectedRecovery: expected });
  }
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

module.exports = { compareStrategies, runStrategy, DEFAULT_STRATEGIES, VALID_ACTIONS };
