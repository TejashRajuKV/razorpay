const CHANNELS = ['payment_link', 'whatsapp', 'email', 'sms', 'human_review'];

const ACTION_CHANNEL = {
  payment_link: 'payment_link',
  reminder: 'email',
  retry: 'sms',
  retry_later: 'sms',
  escalate: 'human_review',
  stop: 'email'
};

function recommendChannel(caseData = {}, decision = {}, customerProfile = {}) {
  const action = decision.action || caseData.recommended_action || 'retry';
  const failureReason = caseData.failure_reason || 'unknown';
  const amount = parseFloat(caseData.amount_at_risk ?? caseData.amountAtRisk ?? 0) || 0;
  let channel = ACTION_CHANNEL[action] || 'email';
  const signals = [`selected action ${action}`];
  if (customerProfile.bestAction && ACTION_CHANNEL[customerProfile.bestAction]) {
    const historic = ACTION_CHANNEL[customerProfile.bestAction];
    if (historic !== channel && (customerProfile.byAction || {})[customerProfile.bestAction]) {
      const stats = customerProfile.byAction[customerProfile.bestAction];
      if (stats.attempts >= 2 && stats.successes / stats.attempts >= 0.5) {
        channel = historic;
        signals.push(`customer previously succeeded via ${historic}`);
      }
    }
  }
  if (action === 'escalate' || (decision.guardrails && decision.guardrails.humanEscalation)) {
    channel = 'human_review';
    signals.push('human escalation required');
  } else if (failureReason === 'card_expired' || failureReason === 'invalid_upi_id') {
    channel = 'payment_link';
    signals.push(`failure reason ${failureReason} needs new payment details`);
  } else if (amount > 50000) {
    channel = 'whatsapp';
    signals.push('high-value case suits direct whatsapp follow-up');
  } else if (failureReason === 'insufficient_funds' && action === 'reminder') {
    channel = 'whatsapp';
    signals.push('gentle nudge suits whatsapp');
  }
  const confidence = customerProfile.bestAction ? 0.75 : 0.6;
  return {
    channel,
    confidence,
    reason: `${channel} recommended based on ${signals.join(', ')}. Simulated only — no real message is sent and channel never bypasses safety rules.`
  };
}

function channelForAction(action) {
  return ACTION_CHANNEL[action] || 'email';
}

module.exports = { recommendChannel, channelForAction, CHANNELS };
