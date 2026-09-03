const db = require('../config/database');
const roiService = require('./roiService');
const channelService = require('./channelService');

async function getAdvancedAnalytics() {
  const totals = await db.query(
    `SELECT COUNT(*) AS cases,
       COUNT(CASE WHEN status = 'resolved' THEN 1 END) AS resolved,
       COUNT(CASE WHEN status = 'escalated' THEN 1 END) AS escalated,
       COALESCE(SUM(amount_at_risk), 0) AS at_risk,
       COALESCE(SUM(recovered_amount), 0) AS recovered,
       COALESCE(AVG(recovered_amount), 0) AS avg_recovered
     FROM recovery_cases`
  );
  const t = totals[0] || {};
  const attempts = await db.query(
    `SELECT COUNT(*) AS attempts,
       COUNT(CASE WHEN action_status = 'success' THEN 1 END) AS successes
     FROM recovery_actions`
  );
  const a = attempts[0] || {};
  const byAction = await db.query(
    `SELECT action_type, COUNT(*) AS attempts,
       COUNT(CASE WHEN action_status = 'success' THEN 1 END) AS successes,
       COALESCE(SUM(recovery_amount), 0) AS recovered
     FROM recovery_actions GROUP BY action_type ORDER BY recovered DESC`
  );
  const actionCounts = {};
  for (const row of byAction) actionCounts[row.action_type] = row.attempts;
  const blocked = await db.query(
    `SELECT COUNT(*) AS n FROM audit_logs WHERE event_type = 'safety_check_blocked'`
  );
  const byFailureReason = await db.query(
    `SELECT p.failure_reason, COUNT(*) AS cases,
       COALESCE(SUM(rc.amount_at_risk), 0) AS at_risk,
       COALESCE(SUM(rc.recovered_amount), 0) AS recovered
     FROM recovery_cases rc JOIN payments p ON rc.payment_id = p.id
     GROUP BY p.failure_reason ORDER BY at_risk DESC`
  );
  const byMethod = await db.query(
    `SELECT p.payment_method, COUNT(*) AS cases,
       COALESCE(SUM(rc.amount_at_risk), 0) AS at_risk,
       COALESCE(SUM(rc.recovered_amount), 0) AS recovered
     FROM recovery_cases rc JOIN payments p ON rc.payment_id = p.id
     GROUP BY p.payment_method ORDER BY at_risk DESC`
  );
  const bySegment = await db.query(
    `SELECT c.customer_segment, COUNT(*) AS cases,
       COALESCE(SUM(rc.amount_at_risk), 0) AS at_risk,
       COALESCE(SUM(rc.recovered_amount), 0) AS recovered
     FROM recovery_cases rc JOIN customers c ON rc.customer_id = c.id
     GROUP BY c.customer_segment ORDER BY at_risk DESC`
  );
  const byChannel = byAction.map((row) => ({
    channel: channelService.channelForAction(row.action_type),
    action_type: row.action_type,
    attempts: row.attempts,
    successes: row.successes,
    recovered: row.recovered
  }));
  const byHour = await db.query(
    `SELECT strftime('%H', executed_at) AS hour, COUNT(*) AS attempts,
       COUNT(CASE WHEN action_status = 'success' THEN 1 END) AS successes
     FROM recovery_actions WHERE executed_at IS NOT NULL
     GROUP BY hour ORDER BY hour`
  ).catch(() => []);
  let strategyRuns = [];
  try {
    const rows = await db.query(
      `SELECT event_data, created_at FROM audit_logs WHERE event_type = 'strategy_comparison_completed' ORDER BY created_at DESC LIMIT 5`
    );
    strategyRuns = rows.map((r) => {
      try {
        return { ...(typeof r.event_data === 'string' ? JSON.parse(r.event_data) : r.event_data), compared_at: r.created_at };
      } catch { return null; }
    }).filter(Boolean);
  } catch { strategyRuns = []; }

  const amountAtRisk = parseFloat(t.at_risk) || 0;
  const grossRecovered = parseFloat(t.recovered) || 0;
  const roi = roiService.calculateROI({
    grossRecovered,
    amountAtRisk,
    incentiveCost: 0,
    actionCounts,
    casesCount: t.cases || 0
  });
  let bestAction = null;
  if (byAction.length > 0) {
    bestAction = byAction.reduce((best, row) => (parseFloat(row.recovered) > parseFloat(best.recovered) ? row : best)).action_type;
  }
  let bestChannel = null;
  if (byChannel.length > 0) {
    bestChannel = byChannel.reduce((best, row) => (parseFloat(row.recovered) > parseFloat(best.recovered) ? row : best)).channel;
  }
  return {
    amountAtRisk,
    grossRecovered,
    incentiveCost: roi.incentiveCost,
    actionCost: roi.simulatedActionCost,
    actionCostSimulated: true,
    netRecovered: roi.netRecovered,
    recoveryRate: roi.recoveryRate,
    roi: roi.roi,
    averageRecoveredPerCase: Math.round((parseFloat(t.avg_recovered) || 0) * 100) / 100,
    totalAttempts: (a.attempts || 0),
    successfulRecoveries: (a.successes || 0),
    blockedActions: ((blocked[0] || {}).n || 0),
    humanEscalations: (t.escalated || 0),
    expectedRecoveryNote: 'Per-decision expected recovery is available on decision-preview; aggregate expectation is the sum of decided expected values.',
    bestAction,
    bestChannel,
    byFailureReason,
    byPaymentMethod: byMethod,
    byAction,
    byChannel,
    bySegment,
    timingPerformance: byHour,
    strategyPerformance: strategyRuns
  };
}

module.exports = { getAdvancedAnalytics };
