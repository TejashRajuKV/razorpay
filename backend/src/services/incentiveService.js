function maxIncentiveAmount() {
  return parseFloat(process.env.MAX_INCENTIVE_AMOUNT) || 500;
}

function recommendIncentive({ amount = 0, probability = 0, diagnosis = 'unknown' } = {}) {
  const cap = maxIncentiveAmount();
  const expectedRecoveryWithout = Math.round(probability * amount * 100) / 100;
  const tiers = [
    { tier: 'small_incentive', incentiveAmount: Math.min(Math.round(amount * 0.02 * 100) / 100, cap), lift: 0.08 },
    { tier: 'medium_incentive', incentiveAmount: Math.min(Math.round(amount * 0.05 * 100) / 100, cap), lift: 0.15 }
  ];
  let best = {
    recommendedIncentive: 'no_incentive',
    incentiveAmount: 0,
    expectedRecoveryWithout,
    expectedRecoveryWith: expectedRecoveryWithout,
    expectedNetRecovery: expectedRecoveryWithout,
    reason: `no incentive recommended for Rs.${amount} (diagnosis: ${diagnosis}); incentive cost exceeds expected gain within Rs.${cap} cap.`
  };
  for (const t of tiers) {
    const lifted = Math.min(0.95, probability + t.lift);
    const expectedWith = Math.round(lifted * amount * 100) / 100;
    const net = Math.round((expectedWith - t.incentiveAmount) * 100) / 100;
    if (t.incentiveAmount <= cap && net > best.expectedNetRecovery) {
      best = {
        recommendedIncentive: t.tier,
        incentiveAmount: t.incentiveAmount,
        expectedRecoveryWithout,
        expectedRecoveryWith: expectedWith,
        expectedNetRecovery: net,
        reason: `${t.tier} of Rs.${t.incentiveAmount} recommended (p ${probability} -> ${lifted}, net Rs.${net} vs Rs.${expectedRecoveryWithout} without incentive).`
      };
    }
  }
  return best;
}

module.exports = { recommendIncentive, maxIncentiveAmount };
