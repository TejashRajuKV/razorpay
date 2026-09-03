const TIMING_SLOTS = ['now', 'in_1_hour', 'in_6_hours', 'tomorrow_morning', 'tomorrow_evening'];

const REASON_TIMING = {
  insufficient_funds: { tomorrow_morning: 0.25, tomorrow_evening: 0.10, now: -0.15 },
  transaction_timeout: { in_1_hour: 0.20, now: 0.10 },
  bank_error: { in_1_hour: 0.20, now: 0.10 },
  declined_by_bank: { in_6_hours: 0.15, tomorrow_morning: 0.10 },
  card_limit_exceeded: { in_6_hours: 0.15, tomorrow_morning: 0.10 },
  card_expired: { now: 0.20 },
  invalid_upi_id: { now: 0.20 }
};

function currentHour() {
  return new Date().getHours();
}

function recommendTiming(caseData = {}, diagnosisInfo = {}) {
  const failureReason = caseData.failure_reason || 'unknown';
  const attempts = parseInt(caseData.attempt_number ?? caseData.previous_attempts ?? 0) || 0;
  const successRate = parseFloat(caseData.customer_success_rate ?? 0.7);
  const hour = currentHour();
  const scores = { now: 0.50, in_1_hour: 0.50, in_6_hours: 0.50, tomorrow_morning: 0.50, tomorrow_evening: 0.50 };
  const signals = [];
  const lifts = REASON_TIMING[failureReason];
  if (lifts) {
    for (const [slot, lift] of Object.entries(lifts)) scores[slot] += lift;
    signals.push(`failure reason ${failureReason}`);
  }
  if (attempts >= 2) {
    scores.now -= 0.10;
    scores.in_6_hours += 0.10;
    scores.tomorrow_morning += 0.10;
    signals.push(`${attempts} previous attempts`);
  }
  if (hour >= 22 || hour < 8) {
    scores.now -= 0.20;
    scores.tomorrow_morning += 0.25;
    signals.push('night hours');
  } else if (hour >= 9 && hour < 18) {
    scores.now += 0.10;
    signals.push('business hours');
  }
  if (successRate > 0.8) {
    scores.now += 0.05;
    signals.push('strong customer history');
  }
  for (const slot of TIMING_SLOTS) {
    scores[slot] = Math.max(0.05, Math.min(0.95, Math.round(scores[slot] * 10000) / 10000));
  }
  let recommendedTime = 'now';
  for (const slot of TIMING_SLOTS) {
    if (scores[slot] > scores[recommendedTime]) recommendedTime = slot;
  }
  const detail = signals.length > 0 ? ` based on ${signals.join(', ')}` : ' with default scheduling';
  return {
    recommendedTime,
    timingScore: scores[recommendedTime],
    reason: `${recommendedTime} recommended${detail} (diagnosis: ${diagnosisInfo.diagnosis || caseData.diagnosis || 'unknown'}).`
  };
}

module.exports = { recommendTiming, TIMING_SLOTS };
