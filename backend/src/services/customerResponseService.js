/**
 * Customer Response → Intent → Promise-to-Pay Service
 *
 * Deterministic (rule-based, no external AI) detection of customer intent from
 * free-text responses, plus a minimal promise-to-pay lifecycle:
 *   NONE → PROMISED → FULFILLED | MISSED | CANCELLED
 *
 * SAFETY: This service NEVER executes recovery actions. It only records
 * responses, intent, and promise state, and writes audit events.
 * evaluateActionPolicy() in recoveryService remains the FINAL authority for
 * any action execution; customer responses never bypass it.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const auditService = require('./auditService');

const INTENTS = [
  'promise_to_pay',
  'payment_link_request',
  'already_paid',
  'refusal',
  'human_help',
  'unclear',
];

const PROMISE_STATES = {
  NONE: 'NONE',
  PROMISED: 'PROMISED',
  FULFILLED: 'FULFILLED',
  MISSED: 'MISSED',
  CANCELLED: 'CANCELLED',
};

// Grace window after the promised time before a PROMISED promise becomes MISSED
const MISS_GRACE_MINUTES = 30;

// Deterministic confidences. Promise confidence is raised when an explicit
// date/time could be extracted.
const CONFIDENCE = {
  promise_to_pay: 0.78,
  promise_to_pay_with_date: 0.95,
  payment_link_request: 0.9,
  already_paid: 0.92,
  refusal: 0.9,
  human_help: 0.85,
  unclear: 0.3,
};

// Deterministic next step per intent (the step routes back through the
// EXISTING policy layer — never a direct execution).
const NEXT_STEPS = {
  promise_to_pay: 'follow_up_at_promised_time_then_existing_policy',
  payment_link_request: 'send_payment_link_via_existing_policy',
  already_paid: 'verify_payment_before_any_action',
  refusal: 're_run_existing_policy_soft_stop_or_escalate',
  human_help: 'escalate_to_human_agent',
  unclear: 'send_clarification_follow_up',
};

// --- Intent patterns (checked in priority order: first match wins) ---------
const ALREADY_PAID_PATTERNS = [
  /\balready\s+(?:paid|done|sent|transferred)\b/i,
  /\b(?:i\s+|i've\s+|ive\s+)?(?:have\s+|had\s+|just\s+)?paid\s+(?:it|already|u|the\s+(?:amount|bill|money|payment|emi))\b/i,
  /\b(?:i|ive|i've)\s+paid\b/i,
  /\bpayment\s+(?:is\s+)?done\b/i,
  /\bdone\s+(?:the\s+)?payment\b/i,
  /\bpaid\s+hoo?n\b/i,
  /\bpayment\s+(?:ho\s+gaya|kar\s+(?:diya|chuka))\b/i,
  /\b(?:pay|paise)\s+kar\s+diya\b/i,
  /\btransfer\s+kar\s+diya\b/i,
  /\bho\s+gaya\s+payment\b/i,
];

const LINK_PATTERN = /\b(?:link|resend)\b/i;

const PROMISE_PAY_VERBS = /\b(?:pay|paying|transfer|settle|clear|karunga|karungi|karenge|paunga|paay)\b/i;
const PROMISE_COMMITMENT = /\b(?:will|shall|going\s+to|promise|promised|pakka|definitely|surely|certainly|for\s+sure)\b/i;
const PROMISE_FUTURE_WORDS = /\b(?:tomorrow|tomrw|tmrw|kal|today|aaj|tonight|evening|morning|afternoon|night|shaam|subah|raat|eod|end\s+of\s+(?:the\s+)?day|next\s+week|day\s+after|monday|tuesday|wednesday|thursday|friday|saturday|sunday|later|soon|shortly)\b/i;

const REFUSAL_PATTERNS = [
  /\bcannot\s+pay\b/i,
  /\bcan'?t\s+pay\b/i,
  /\bwon'?t\s+pay\b/i,
  /\bwill\s+not\s+pay\b/i,
  /\bnot\s+going\s+to\s+pay\b/i,
  /\bnot\s+paying\b/i,
  /\brefuse\s+to\s+pay\b/i,
  /\b(?:want|need|demand(?:ing)?)\s+(?:a\s+)?refund\b/i,
  /\bcancel\s+(?:the\s+)?(?:order|payment|subscription|transaction)\b/i,
  /\bno\s+money\b/i,
  /\bdon'?t\s+have\s+(?:the\s+)?money\b/i,
  /\bnever\s+pay(?:ing)?\b/i,
  /\bnahi\s+(?:paunga|paayunga|pay\s+karunga|karunga|dunga)\b/i,
  /\bpay\s+nahi(?:n)?\b/i,
  /\bpaunga\s+nahi\b/i,
  /\bkarunga\s+nahi\b/i,
];

const HUMAN_HELP_PATTERNS = [
  /\b(?:call|contact)\s+me\b/i,
  /\b(?:speak|talk)\s+to\s+(?:a\s+)?(?:human|agent|person|someone|support|customer\s+care|representative)\b/i,
  /\bhuman\s+(?:help|agent|support|assistance)\b/i,
  /\bagent\s+se\s+baat\b/i,
  /\bhelp\s+me\b/i,
  /\bneed\s+(?:human|agent|support)\b/i,
];

/**
 * Extract a deterministic promised date/time from free text.
 * Returns a Date (local server time) or null when no date/time is present.
 *
 * Rules (deterministic):
 *   - "in N hours" → now + N hours
 *   - "in N days" / "next week" (+7) / "day after tomorrow" (+2) /
 *     "tomorrow|kal" (+1) / "today|aaj|tonight" (+0) / weekday → next occurrence
 *   - "morning|subah" → 09:00, "noon|midday" → 12:00, "afternoon" → 14:00,
 *     "evening|shaam" → 19:00, "night|raat|tonight" → 21:00, "eod" → 18:00
 *   - day without time → 12:00; time without day → today
 */
function extractWhen(message, now = new Date()) {
  const m = String(message || '').toLowerCase();

  const inHours = m.match(/\bin\s+(\d{1,2})\s+hours?\b/);
  if (inHours) return new Date(now.getTime() + parseInt(inHours[1], 10) * 3600e3);

  let day = null;
  const inDays = m.match(/\bin\s+(\d{1,2})\s+days?\b/);
  if (inDays) {
    day = parseInt(inDays[1], 10);
  } else if (/\bday\s+after\s+(?:tomorrow|tmrw|kal)\b/.test(m)) {
    day = 2;
  } else if (/\b(?:tomorrow|tomrw|tmrw|kal)\b/.test(m)) {
    day = 1;
  } else if (/\b(?:today|aaj|tonight)\b/.test(m)) {
    day = 0;
  } else if (/\bnext\s+week\b/.test(m)) {
    day = 7;
  } else {
    const wd = m.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    if (wd) {
      const names = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      const target = names[wd[1]];
      day = ((target - now.getDay()) + 7) % 7 || 7; // strictly next occurrence
    }
  }

  let hour = null;
  if (/\b(?:morning|subah)\b/.test(m)) hour = 9;
  else if (/\b(?:noon|midday)\b/.test(m)) hour = 12;
  else if (/\b(?:afternoon|dopahar)\b/.test(m)) hour = 14;
  else if (/\b(?:evening|shaam)\b/.test(m)) hour = 19;
  else if (/\b(?:tonight|night|raat)\b/.test(m)) hour = 21;
  else if (/\b(?:eod|end\s+of\s+(?:the\s+)?day)\b/.test(m)) hour = 18;

  if (day === null && hour === null) return null;
  if (day === null) day = 0;
  if (hour === null) hour = 12;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, hour, 0, 0, 0);
}

/**
 * Deterministic intent detection for a customer response.
 * @param {String} message - Raw customer message
 * @param {Date} [now] - Reference time for promise extraction (tests)
 * @returns {{ intent: String, confidence: Number, promisedAt: Date|null, followUpRequired: Boolean }}
 */
function detectIntent(message, now = new Date()) {
  const text = String(message || '');

  // 1. already_paid (checked first — "already paid yesterday" is not a promise)
  if (ALREADY_PAID_PATTERNS.some((re) => re.test(text))) {
    return { intent: 'already_paid', confidence: CONFIDENCE.already_paid, promisedAt: null, followUpRequired: false };
  }

  // 2. payment_link_request (explicit ask for the mechanism)
  if (LINK_PATTERN.test(text)) {
    return { intent: 'payment_link_request', confidence: CONFIDENCE.payment_link_request, promisedAt: null, followUpRequired: true };
  }

  // 3. promise_to_pay (pay verb + future time word or explicit commitment)
  if (
    (PROMISE_PAY_VERBS.test(text) && PROMISE_FUTURE_WORDS.test(text)) ||
    (PROMISE_PAY_VERBS.test(text) && PROMISE_COMMITMENT.test(text))
  ) {
    const promisedAt = extractWhen(text, now);
    return {
      intent: 'promise_to_pay',
      confidence: promisedAt ? CONFIDENCE.promise_to_pay_with_date : CONFIDENCE.promise_to_pay,
      promisedAt,
      followUpRequired: true,
    };
  }

  // 4. refusal
  if (REFUSAL_PATTERNS.some((re) => re.test(text))) {
    return { intent: 'refusal', confidence: CONFIDENCE.refusal, promisedAt: null, followUpRequired: false };
  }

  // 5. human_help
  if (HUMAN_HELP_PATTERNS.some((re) => re.test(text))) {
    return { intent: 'human_help', confidence: CONFIDENCE.human_help, promisedAt: null, followUpRequired: false };
  }

  // 6. unclear (fallback)
  return { intent: 'unclear', confidence: CONFIDENCE.unclear, promisedAt: null, followUpRequired: true };
}

// Idempotent table creation so older dev databases gain the table on first use
// (never a reset — additive only).
let schemaReady = null;
async function ensureTable() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.query(`CREATE TABLE IF NOT EXISTS customer_responses (
        id VARCHAR(36) PRIMARY KEY,
        case_id VARCHAR(36) NOT NULL,
        message TEXT,
        intent VARCHAR(50) NOT NULL,
        confidence DECIMAL(5, 4) DEFAULT 0.0000,
        promised_at TIMESTAMP,
        promise_status VARCHAR(20) DEFAULT 'NONE',
        follow_up_required INT DEFAULT 0,
        follow_up_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (case_id) REFERENCES recovery_cases(id) ON DELETE CASCADE
      )`);
      await db.query('CREATE INDEX IF NOT EXISTS idx_customer_responses_case ON customer_responses(case_id)');
    })().catch((err) => { schemaReady = null; throw err; });
  }
  await schemaReady;
}

/**
 * Record a customer response: detect intent, persist, audit, and return the
 * analysis. Returns null when the case does not exist (caller maps to 404).
 */
async function recordCustomerResponse(caseId, message, meta = {}) {
  if (!caseId) return null;
  if (!message || typeof message !== 'string' || !message.trim()) {
    const err = new Error('message is required');
    err.statusCode = 400;
    throw err;
  }
  await ensureTable();

  const cases = await db.query('SELECT id, status FROM recovery_cases WHERE id = ?', [caseId]);
  if (cases.length === 0) return null;

  // Settle any earlier due promise first so state reflects reality
  try { await settleDuePromises(caseId); } catch { /* advisory */ }

  const trimmed = message.trim();
  const detection = detectIntent(trimmed);
  const caseStatus = (cases[0].status || 'open').toLowerCase();
  const caseClosed = caseStatus === 'resolved' || caseStatus === 'stopped';

  let promiseState = PROMISE_STATES.NONE;
  let followUpRequired = detection.followUpRequired;
  let followUpAt = detection.promisedAt;
  if (detection.intent === 'promise_to_pay') {
    if (caseClosed) {
      // Case already closed (resolved/stopped) — a new promise is moot
      promiseState = PROMISE_STATES.CANCELLED;
      followUpRequired = false;
      followUpAt = null;
    } else {
      promiseState = PROMISE_STATES.PROMISED;
    }
  }

  const id = uuidv4();
  await db.query(
    'INSERT INTO customer_responses ' +
    '(id, case_id, message, intent, confidence, promised_at, promise_status, follow_up_required, follow_up_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id, caseId, trimmed, detection.intent, detection.confidence,
      detection.promisedAt ? detection.promisedAt.toISOString() : null,
      promiseState,
      followUpRequired ? 1 : 0,
      followUpAt ? followUpAt.toISOString() : null,
    ]
  );

  // Audit — only events that actually occurred
  const actor = meta.userOrSystem || 'system';
  await auditService.logEvent({
    entityType: 'case',
    entityId: caseId,
    eventType: 'customer_response_received',
    eventData: {
      intent: detection.intent,
      confidence: detection.confidence,
      promise_status: promiseState,
      message_length: trimmed.length,
    },
    userOrSystem: actor,
  });
  if (promiseState === PROMISE_STATES.PROMISED) {
    await auditService.logEvent({
      entityType: 'case',
      entityId: caseId,
      eventType: 'promise_to_pay_recorded',
      eventData: {
        promised_at: detection.promisedAt.toISOString(),
        response_id: id,
        follow_up_required: true,
      },
      newState: { promise_status: PROMISE_STATES.PROMISED },
      userOrSystem: actor,
    });
  }

  return {
    responseId: id,
    caseId,
    intent: detection.intent,
    confidence: detection.confidence,
    promiseState,
    promisedAt: detection.promisedAt ? detection.promisedAt.toISOString() : null,
    followUpRequired,
    followUpAt: followUpAt ? followUpAt.toISOString() : null,
    nextStep: caseClosed && detection.intent === 'promise_to_pay'
      ? 'case_closed_no_follow_up'
      : NEXT_STEPS[detection.intent],
  };
}

/**
 * Lazy settlement: the latest PROMISED promise becomes
 *   - FULFILLED when the case is already resolved (payment recovered), or
 *   - MISSED when promised_at + grace has passed without payment.
 * Returns the settlement info or null when nothing settled.
 */
async function settleDuePromises(caseId, now = new Date()) {
  if (!caseId) return null;
  await ensureTable();

  const rows = await db.query(
    "SELECT id, promised_at FROM customer_responses " +
    "WHERE case_id = ? AND intent = 'promise_to_pay' AND promise_status = 'PROMISED' " +
    'ORDER BY rowid DESC LIMIT 1',
    [caseId]
  );
  if (rows.length === 0) return null;
  const row = rows[0];

  const caseRows = await db.query('SELECT status FROM recovery_cases WHERE id = ?', [caseId]);
  const status = (caseRows[0] && caseRows[0].status || '').toLowerCase();
  if (status === 'resolved') {
    return markPromiseFulfilled(caseId);
  }

  const promisedAt = row.promised_at ? new Date(row.promised_at) : null;
  const due = promisedAt && now.getTime() >= promisedAt.getTime() + MISS_GRACE_MINUTES * 60e3;
  if (!due) return null;

  await db.query(
    "UPDATE customer_responses SET promise_status = 'MISSED', follow_up_required = 1 WHERE id = ?",
    [row.id]
  );
  await auditService.logEvent({
    entityType: 'case',
    entityId: caseId,
    eventType: 'promise_to_pay_missed',
    eventData: { promised_at: row.promised_at, response_id: row.id },
    newState: { promise_status: PROMISE_STATES.MISSED },
  });
  return {
    promiseState: PROMISE_STATES.MISSED,
    previousStatus: PROMISE_STATES.PROMISED,
    promisedAt: row.promised_at,
    followUpRequired: true,
  };
}

/**
 * Mark the latest PROMISED promise FULFILLED (called when payment is actually
 * recovered). Returns null (and writes nothing) when no active promise exists.
 */
async function markPromiseFulfilled(caseId, recoveredAmount = null) {
  if (!caseId) return null;
  await ensureTable();

  const rows = await db.query(
    "SELECT id, promised_at FROM customer_responses " +
    "WHERE case_id = ? AND intent = 'promise_to_pay' AND promise_status = 'PROMISED' " +
    'ORDER BY rowid DESC LIMIT 1',
    [caseId]
  );
  if (rows.length === 0) return null;

  await db.query(
    "UPDATE customer_responses SET promise_status = 'FULFILLED', follow_up_required = 0 WHERE id = ?",
    [rows[0].id]
  );
  await auditService.logEvent({
    entityType: 'case',
    entityId: caseId,
    eventType: 'promise_to_pay_fulfilled',
    eventData: { promised_at: rows[0].promised_at, response_id: rows[0].id, recovered_amount: recoveredAmount },
    newState: { promise_status: PROMISE_STATES.FULFILLED },
  });
  return { promiseState: PROMISE_STATES.FULFILLED, promisedAt: rows[0].promised_at };
}

/**
 * Advisory summary of the latest response + promise for state exposure.
 * Read-only; never throws for missing table/case (returns null).
 */
async function getPromiseInfo(caseId) {
  try {
    await ensureTable();
    const latest = await db.query(
      'SELECT intent, confidence, promised_at, promise_status, follow_up_required, created_at ' +
      'FROM customer_responses WHERE case_id = ? ORDER BY rowid DESC LIMIT 1',
      [caseId]
    );
    if (latest.length === 0) return null;
    const r = latest[0];
    let promiseRow = r.intent === 'promise_to_pay'
      ? r
      : (await db.query(
          "SELECT promised_at, promise_status, follow_up_required FROM customer_responses " +
          "WHERE case_id = ? AND intent = 'promise_to_pay' ORDER BY rowid DESC LIMIT 1",
          [caseId]
        ))[0];
    return {
      lastIntent: r.intent,
      lastConfidence: parseFloat(r.confidence) || 0,
      lastResponseAt: r.created_at,
      promiseState: promiseRow ? promiseRow.promise_status : PROMISE_STATES.NONE,
      promisedAt: promiseRow && promiseRow.promised_at ? new Date(promiseRow.promised_at).toISOString() : null,
      followUpRequired: promiseRow ? !!promiseRow.follow_up_required : false,
    };
  } catch {
    return null;
  }
}

module.exports = {
  INTENTS,
  PROMISE_STATES,
  MISS_GRACE_MINUTES,
  detectIntent,
  extractWhen,
  recordCustomerResponse,
  settleDuePromises,
  markPromiseFulfilled,
  getPromiseInfo,
};
