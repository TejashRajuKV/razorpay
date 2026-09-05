const db = require('../config/database');

const LARGE_VALUE_THRESHOLD = parseFloat(process.env.HIGH_VALUE_THRESHOLD) || 50000;

async function getLeakageAlerts() {
  const payments = await db.query('SELECT COUNT(*) AS n FROM payments');
  const cases = await db.query('SELECT COUNT(*) AS n FROM recovery_cases');
  if ((payments[0] || {}).n === 0 && (cases[0] || {}).n === 0) {
    return { status: 'insufficient_data', alerts: [], reason: 'No payments or recovery cases recorded yet.' };
  }
  const alerts = [];

  const failed = await db.query(
    `SELECT COUNT(*) AS recent,
       (SELECT COUNT(*) FROM payments WHERE status = 'failed' AND created_at < datetime('now', '-1 day')) AS older
     FROM payments WHERE status = 'failed' AND created_at >= datetime('now', '-1 day')`
  );
  const recentFailed = (failed[0] || {}).recent || 0;
  const olderFailed = (failed[0] || {}).older || 0;
  if (recentFailed >= 5 && recentFailed >= olderFailed * 0.5 + 3) {
    let spikeIds = [];
    try {
      const rows = await db.query(
        `SELECT rc.id FROM recovery_cases rc JOIN payments p ON rc.payment_id = p.id
         WHERE p.status = 'failed' AND p.created_at >= datetime('now', '-1 day') LIMIT 50`
      );
      spikeIds = rows.map((r) => r.id);
    } catch { /* ids are advisory */ }
    alerts.push({
      severity: 'high',
      title: 'Spike in failed payments',
      description: `${recentFailed} failed payments in the last 24 hours.`,
      amountAtRisk: 0,
      affectedCases: recentFailed,
      mainCause: 'failed_payment_spike',
      recommendedAction: 'Run batch detection and prioritize retry/payment_link recovery.',
      caseIds: spikeIds
    });
  }

  const atRisk = await db.query(
    `SELECT COALESCE(SUM(amount_at_risk), 0) AS total, COUNT(*) AS n
     FROM recovery_cases WHERE status IN ('open', 'in_progress')`
  );
  const openAtRisk = parseFloat((atRisk[0] || {}).total) || 0;
  const openCount = (atRisk[0] || {}).n || 0;
  if (openAtRisk >= 100000) {
    let exposureIds = [];
    try {
      const rows = await db.query(
        `SELECT id FROM recovery_cases WHERE status IN ('open', 'in_progress') LIMIT 50`
      );
      exposureIds = rows.map((r) => r.id);
    } catch { /* ids are advisory */ }
    alerts.push({
      severity: openAtRisk >= 500000 ? 'critical' : 'high',
      title: 'Unusually high amount at risk',
      description: `Rs.${openAtRisk.toLocaleString('en-IN')} across ${openCount} open recovery cases.`,
      amountAtRisk: openAtRisk,
      affectedCases: openCount,
      mainCause: 'high_open_exposure',
      recommendedAction: 'Run batch recovery on highest priority cases first.',
      caseIds: exposureIds
    });
  }

  const rate = await db.query(
    `SELECT COUNT(*) AS total, COUNT(CASE WHEN status = 'resolved' THEN 1 END) AS resolved,
       COALESCE(SUM(recovered_amount), 0) AS recovered
     FROM recovery_cases`
  );
  const total = (rate[0] || {}).total || 0;
  const resolved = (rate[0] || {}).resolved || 0;
  if (total >= 10 && resolved / total < 0.2) {
    let unresolvedIds = [];
    try {
      const rows = await db.query(
        `SELECT id FROM recovery_cases WHERE status NOT IN ('resolved', 'stopped') LIMIT 50`
      );
      unresolvedIds = rows.map((r) => r.id);
    } catch { /* ids are advisory */ }
    alerts.push({
      severity: 'medium',
      title: 'Recovery rate dropping',
      description: `Only ${resolved}/${total} cases resolved (${Math.round((resolved / total) * 100)}%).`,
      amountAtRisk: openAtRisk,
      affectedCases: total - resolved,
      mainCause: 'low_resolution_rate',
      recommendedAction: 'Compare strategies and review guardrail-blocked actions.',
      caseIds: unresolvedIds
    });
  }

  const reasons = await db.query(
    `SELECT p.failure_reason, COUNT(*) AS n, COALESCE(SUM(rc.amount_at_risk), 0) AS at_risk
     FROM recovery_cases rc JOIN payments p ON rc.payment_id = p.id
     WHERE p.failure_reason IS NOT NULL GROUP BY p.failure_reason ORDER BY n DESC LIMIT 3`
  );
  if (reasons.length > 0) {
    const top = reasons[0];
    const topShare = total > 0 ? top.n / total : 0;
    if (top.n >= 5 && topShare >= 0.4) {
      let reasonIds = [];
      try {
        const rows = await db.query(
          `SELECT rc.id FROM recovery_cases rc JOIN payments p ON rc.payment_id = p.id
           WHERE p.failure_reason = ? LIMIT 50`,
          [top.failure_reason]
        );
        reasonIds = rows.map((r) => r.id);
      } catch { /* ids are advisory */ }
      alerts.push({
        severity: 'medium',
        title: `Failure reason concentration: ${top.failure_reason}`,
        description: `${top.n}/${total} cases (${Math.round(topShare * 100)}%) fail due to ${top.failure_reason}.`,
        amountAtRisk: parseFloat(top.at_risk) || 0,
        affectedCases: top.n,
        mainCause: top.failure_reason,
        recommendedAction: top.failure_reason === 'insufficient_funds'
          ? 'Shift these cases to scheduled retry and reminders.'
          : 'Route these cases to payment_link recovery.',
        caseIds: reasonIds
      });
    }
  }

  const large = await db.query(
    `SELECT COUNT(*) AS n, COALESCE(SUM(amount_at_risk), 0) AS total
     FROM recovery_cases WHERE status IN ('open', 'in_progress') AND amount_at_risk > ?`,
    [LARGE_VALUE_THRESHOLD]
  );
  if (((large[0] || {}).n || 0) > 0) {
    let largeIds = [];
    try {
      const rows = await db.query(
        `SELECT id FROM recovery_cases
         WHERE status IN ('open', 'in_progress') AND amount_at_risk > ? LIMIT 50`,
        [LARGE_VALUE_THRESHOLD]
      );
      largeIds = rows.map((r) => r.id);
    } catch { /* ids are advisory */ }
    alerts.push({
      severity: 'high',
      title: 'Large-value payments at risk',
      description: `${large[0].n} open case(s) above Rs.${LARGE_VALUE_THRESHOLD.toLocaleString('en-IN')} totaling Rs.${parseFloat(large[0].total).toLocaleString('en-IN')}.`,
      amountAtRisk: parseFloat(large[0].total) || 0,
      affectedCases: large[0].n,
      mainCause: 'large_value_exposure',
      recommendedAction: 'Escalate to human review per high-value guardrail.',
      caseIds: largeIds
    });
  }

  return { status: alerts.length > 0 ? 'ok' : 'no_alerts', alerts };
}

module.exports = { getLeakageAlerts };
