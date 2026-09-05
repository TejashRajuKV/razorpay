/**
 * Demo scenario → real backend case resolver (frontend-only helper).
 * Scenario buttons select an existing loaded case matching the scenario's
 * intent using real backend fields. Returns null when no case matches —
 * callers must not fall back to hardcoded or invalid IDs.
 */

const methodOf = (c) => String(c?.payment?.method || c?.payment_method || '').toLowerCase();
const amountOf = (c) => Number(c?.payment?.amount ?? c?.amount_at_risk ?? 0) || 0;
const riskOf = (c) => Number(c?.risk_probability ?? c?.riskProbability ?? 0) || 0;
const statusOf = (c) => String(c?.payment_status || c?.status || '').toLowerCase();

function maxBy(list, fn) {
  let best = null;
  let bestVal = -Infinity;
  for (const item of list) {
    const v = fn(item);
    if (v > bestVal) {
      bestVal = v;
      best = item;
    }
  }
  return best;
}

// Closest amount to target within a candidate pool (labels promise an amount band)
function closestAmount(pool, target) {
  if (pool.length === 0) return null;
  const failed = pool.filter((c) => statusOf(c) === 'failed' || statusOf(c) === 'abandoned');
  const ranked = (failed.length > 0 ? failed : pool).sort(
    (a, b) => Math.abs(amountOf(a) - target) - Math.abs(amountOf(b) - target)
  );
  return ranked[0] || null;
}

export function resolveScenarioCase(scenarioKey, cases = []) {
  if (!Array.isArray(cases) || cases.length === 0) return null;
  switch (scenarioKey) {
    case 'RAHUL_UPI':
      return closestAmount(cases.filter((c) => methodOf(c).includes('upi')), 25000);
    case 'PRIYA_CARD':
      return closestAmount(cases.filter((c) => methodOf(c).includes('card')), 4800);
    case 'VIKRAM_ENTERPRISE':
      return closestAmount(cases, 145000);
    case 'KUNAL_RISK': {
      const ranked = [...cases].sort((a, b) => (riskOf(b) - riskOf(a)) || (amountOf(b) - amountOf(a)));
      return ranked[0] || null;
    }
    default:
      return null;
  }
}
