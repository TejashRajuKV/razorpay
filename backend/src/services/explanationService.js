function buildExplanation({ decision, diagnosis, customerProfile, timing, incentive, risk }) {
  const reasons = [];
  const amount = decision.expectedRecovery != null && decision.probability > 0
    ? Math.round((decision.expectedRecovery / decision.probability) * 100) / 100
    : null;
  reasons.push(`${decision.action} selected because it has the highest expected recovery (Rs.${decision.expectedRecovery}${amount != null ? ` of Rs.${amount}` : ''}) among safe actions.`);
  if (diagnosis && diagnosis.diagnosis) {
    reasons.push(`Diagnosis is ${diagnosis.diagnosis} (confidence ${diagnosis.confidence ?? 'n/a'}).`);
  }
  if (risk && risk.riskProbability != null) {
    reasons.push(`Revenue at risk with probability ${risk.riskProbability}.`);
  }
  if (customerProfile) {
    if (customerProfile.bestAction) {
      reasons.push(`Customer previously succeeded most with ${customerProfile.bestAction} (success rate ${customerProfile.successRate}).`);
    } else {
      reasons.push(`Customer history: ${customerProfile.successfulPayments}/${customerProfile.totalPayments} successful payments.`);
    }
  }
  if (decision.historicalAdjustment) {
    const dir = decision.historicalAdjustment > 0 ? 'raised' : 'lowered';
    reasons.push(`Historical outcomes ${dir} ${decision.action} probability by ${Math.abs(decision.historicalAdjustment)}.`);
  }
  if (timing) reasons.push(`Timing: ${timing.reason}`);
  if (incentive) reasons.push(`Incentive: ${incentive.reason}`);
  const blockedList = (decision.guardrails && decision.guardrails.blockedActions) || (decision.blocked ? [decision.blocked] : []);
  for (const b of blockedList) {
    reasons.push(`${b.action} was blocked: ${b.reason}.`);
  }
  const allowed = (decision.guardrails && decision.guardrails.considered
    ? decision.guardrails.considered.filter((e) => e.allowed).map((e) => e.action)
    : []).filter((a) => a !== decision.action);
  const alternatives = (decision.candidates || [])
    .filter((c) => c.action !== decision.action)
    .map((c) => ({
      action: c.action,
      probability: c.probability,
      expectedRecovery: c.expectedRecovery,
      note: allowed.includes(c.action)
        ? `${c.action} has lower expected recovery (Rs.${c.expectedRecovery}).`
        : `${c.action} blocked by guardrails.`
    }));
  return {
    action: decision.action,
    confidence: decision.confidence,
    probability: decision.probability,
    expectedRecovery: decision.expectedRecovery,
    timing: timing ? { recommendedTime: timing.recommendedTime, timingScore: timing.timingScore } : null,
    incentive: incentive || null,
    reasons,
    alternatives,
    safety: {
      allowed: decision.allowed !== false,
      blockedActions: blockedList,
      humanEscalation: Boolean(decision.guardrails && decision.guardrails.humanEscalation),
      reason: blockedList.length > 0 ? `${blockedList.length} action(s) blocked by guardrails.` : 'All evaluated actions allowed.'
    }
  };
}

module.exports = { buildExplanation };
