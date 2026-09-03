const SIMULATED_ACTION_COSTS = {
  retry: 5,
  retry_later: 5,
  reminder: 2,
  payment_link: 3,
  escalate: 50,
  stop: 0
};

function actionCost(actionType, counts) {
  const unit = SIMULATED_ACTION_COSTS[actionType] ?? 5;
  return unit * (counts || 0);
}

function calculateROI({ grossRecovered = 0, amountAtRisk = 0, incentiveCost = 0, actionCounts = {}, casesCount = 0 }) {
  const counts = actionCounts || {};
  let simulatedActionCost = 0;
  for (const [action, n] of Object.entries(counts)) {
    simulatedActionCost += actionCost(action, n);
  }
  simulatedActionCost = Math.round(simulatedActionCost * 100) / 100;
  const totalCost = Math.round((incentiveCost + simulatedActionCost) * 100) / 100;
  const netRecovered = Math.round((grossRecovered - totalCost) * 100) / 100;
  return {
    grossRecovered: Math.round(grossRecovered * 100) / 100,
    amountAtRisk: Math.round(amountAtRisk * 100) / 100,
    incentiveCost: Math.round(incentiveCost * 100) / 100,
    simulatedActionCost,
    simulated: true,
    totalCost,
    netRecovered,
    roi: totalCost > 0 ? Math.round((netRecovered / totalCost) * 10000) / 10000 : null,
    recoveryRate: amountAtRisk > 0 ? Math.round((grossRecovered / amountAtRisk) * 10000) / 10000 : 0,
    costPerRecoveredRupee: grossRecovered > 0 ? Math.round((totalCost / grossRecovered) * 10000) / 10000 : null,
    costPerCase: casesCount > 0 ? Math.round((totalCost / casesCount) * 100) / 100 : null
  };
}

module.exports = { calculateROI, actionCost, SIMULATED_ACTION_COSTS };
