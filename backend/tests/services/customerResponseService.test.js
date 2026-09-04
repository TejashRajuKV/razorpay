/**
 * Tests for customerResponseService:
 * intent detection (all 6), promise date extraction, state updates,
 * audit events, promise lifecycle (FULFILLED / MISSED / CANCELLED),
 * and the guardrail invariant: customer responses never execute actions.
 */
const { isDbAvailable } = require('../helpers/dbAvailable');
const describeDb = isDbAvailable() ? describe : describe.skip;
const { initIsolatedDb, closeIsolatedDb } = require('../helpers/testDb');

if (!isDbAvailable()) {
  test('sqlite bindings unavailable — customerResponseService tests skipped', () => {
    console.warn('[tests] better-sqlite3 unavailable, skipping db-backed suites');
  });
}

describeDb('customerResponseService (sqlite)', () => {
  let db;
  let svc;
  let recoveryService;
  let auditService;
  let recoveryStateService;

  async function seedCase(id = 'case-cr1', status = 'open') {
    await db.query('INSERT INTO customers (id, name, email) VALUES (?, ?, ?)', [`c-${id}`, 'CR User', `${id}@x.com`]);
    await db.query(
      'INSERT INTO payments (id, customer_id, amount, status, payment_method, failure_reason) VALUES (?, ?, ?, ?, ?, ?)',
      [`p-${id}`, `c-${id}`, 5000, 'failed', 'upi', 'bank_error']
    );
    await db.query(
      `INSERT INTO recovery_cases (id, payment_id, customer_id, amount_at_risk, risk_probability,
        diagnosis, diagnosis_factors, priority_score, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, `p-${id}`, `c-${id}`, 5000, 0.7, 'temporary_failure', '[]', 0.7, status]
    );
  }

  async function auditEvents(caseId, eventType) {
    const logs = await auditService.getEntityLogs('case', caseId, { eventType });
    return logs;
  }

  beforeAll(() => {
    db = initIsolatedDb();
    svc = require('../../src/services/customerResponseService');
    recoveryService = require('../../src/services/recoveryService');
    auditService = require('../../src/services/auditService');
    recoveryStateService = require('../../src/services/recoveryStateService');
  });

  afterAll(async () => {
    await closeIsolatedDb();
  });

  beforeEach(async () => {
    await db.query('DELETE FROM audit_logs');
    await db.query('DELETE FROM customer_responses');
    await db.query('DELETE FROM recovery_actions');
    await db.query('DELETE FROM recovery_cases');
    await db.query('DELETE FROM payments');
    await db.query('DELETE FROM customers');
  });

  describe('detectIntent — all 6 intents', () => {
    const now = new Date(2026, 8, 4, 10, 0, 0); // Fri Sep 4 2026 10:00 local

    test('promise_to_pay with date: "I will pay tomorrow morning"', () => {
      const r = svc.detectIntent('I will pay tomorrow morning', now);
      expect(r.intent).toBe('promise_to_pay');
      expect(r.confidence).toBeGreaterThanOrEqual(0.9);
      expect(r.promisedAt).toEqual(new Date(2026, 8, 5, 9, 0, 0));
      expect(r.followUpRequired).toBe(true);
    });

    test('payment_link_request', () => {
      const r = svc.detectIntent('Please send me the payment link again', now);
      expect(r.intent).toBe('payment_link_request');
      expect(r.followUpRequired).toBe(true);
      expect(r.promisedAt).toBeNull();
    });

    test('already_paid (wins over promise words)', () => {
      const r = svc.detectIntent('I already paid the amount yesterday', now);
      expect(r.intent).toBe('already_paid');
      expect(r.followUpRequired).toBe(false);
    });

    test('refusal', () => {
      const r = svc.detectIntent('I cannot pay this, I want a refund', now);
      expect(r.intent).toBe('refusal');
      expect(r.followUpRequired).toBe(false);
    });

    test('human_help', () => {
      const r = svc.detectIntent('Please call me, I want to talk to a support agent', now);
      expect(r.intent).toBe('human_help');
    });

    test('unclear fallback', () => {
      const r = svc.detectIntent('hmm ok maybe whatever', now);
      expect(r.intent).toBe('unclear');
      expect(r.confidence).toBeLessThan(0.5);
      expect(r.followUpRequired).toBe(true);
    });
  });

  describe('promise date extraction (deterministic)', () => {
    const now = new Date(2026, 8, 4, 10, 0, 0); // Friday

    test('tomorrow + morning → 09:00', () => {
      expect(svc.extractWhen('I will pay tomorrow morning', now)).toEqual(new Date(2026, 8, 5, 9, 0, 0));
    });

    test('tomorrow without time → midday default', () => {
      expect(svc.extractWhen('will pay tomorrow', now)).toEqual(new Date(2026, 8, 5, 12, 0, 0));
    });

    test('tonight → 21:00 today', () => {
      expect(svc.extractWhen('paying tonight for sure', now)).toEqual(new Date(2026, 8, 4, 21, 0, 0));
    });

    test('evening without day → today evening', () => {
      expect(svc.extractWhen('will pay in the evening', now)).toEqual(new Date(2026, 8, 4, 19, 0, 0));
    });

    test('weekday → next occurrence strictly after today', () => {
      expect(svc.extractWhen('I will pay by Monday', now)).toEqual(new Date(2026, 8, 7, 12, 0, 0));
    });

    test('in 2 days → +2 days midday', () => {
      expect(svc.extractWhen('will pay in 2 days', now)).toEqual(new Date(2026, 8, 6, 12, 0, 0));
    });

    test('in 6 hours → relative time', () => {
      expect(svc.extractWhen('will pay in 6 hours', now)).toEqual(new Date(2026, 8, 4, 16, 0, 0));
    });

    test('no date/time → null (generic promise)', () => {
      expect(svc.extractWhen('I will definitely pay', now)).toBeNull();
    });
  });

  describe('recordCustomerResponse — state + audit', () => {
    test('records promise_to_pay as PROMISED with follow-up, writes audit events', async () => {
      await seedCase();
      const result = await svc.recordCustomerResponse('case-cr1', 'I will pay tomorrow morning');

      expect(result.intent).toBe('promise_to_pay');
      expect(result.promiseState).toBe('PROMISED');
      expect(result.promisedAt).toBeTruthy();
      expect(result.followUpRequired).toBe(true);
      expect(result.nextStep).toBe('follow_up_at_promised_time_then_existing_policy');

      const rows = await db.query('SELECT * FROM customer_responses WHERE case_id = ?', ['case-cr1']);
      expect(rows.length).toBe(1);
      expect(rows[0].promise_status).toBe('PROMISED');
      expect(rows[0].promised_at).toBe(result.promisedAt);

      expect((await auditEvents('case-cr1', 'customer_response_received')).length).toBe(1);
      expect((await auditEvents('case-cr1', 'promise_to_pay_recorded')).length).toBe(1);
    });

    test('non-promise response records only customer_response_received', async () => {
      await seedCase();
      const result = await svc.recordCustomerResponse('case-cr1', 'ok fine whatever');
      expect(result.intent).toBe('unclear');
      expect(result.promiseState).toBe('NONE');
      expect((await auditEvents('case-cr1', 'customer_response_received')).length).toBe(1);
      expect((await auditEvents('case-cr1', 'promise_to_pay_recorded')).length).toBe(0);
    });

    test('returns null for unknown case (404 mapping)', async () => {
      expect(await svc.recordCustomerResponse('no-such-case', 'I will pay tomorrow')).toBeNull();
    });

    test('rejects empty message', async () => {
      await expect(svc.recordCustomerResponse('case-cr1', '   ')).rejects.toThrow(/message is required/i);
    });

    test('promise on resolved case is CANCELLED (no follow-up)', async () => {
      await seedCase('case-cr-res', 'resolved');
      const result = await svc.recordCustomerResponse('case-cr-res', 'I will pay tomorrow morning');
      expect(result.promiseState).toBe('CANCELLED');
      expect(result.followUpRequired).toBe(false);
      expect(result.nextStep).toBe('case_closed_no_follow_up');
      expect((await auditEvents('case-cr-res', 'promise_to_pay_recorded')).length).toBe(0);
    });
  });

  describe('promise lifecycle — FULFILLED', () => {
    test('markPromiseFulfilled transitions PROMISED → FULFILLED + audit; no-op when none active', async () => {
      await seedCase();
      await svc.recordCustomerResponse('case-cr1', 'I will pay tomorrow morning');

      const res = await svc.markPromiseFulfilled('case-cr1', 5000);
      expect(res.promiseState).toBe('FULFILLED');

      const rows = await db.query('SELECT promise_status, follow_up_required FROM customer_responses WHERE case_id = ?', ['case-cr1']);
      expect(rows[0].promise_status).toBe('FULFILLED');
      expect(rows[0].follow_up_required).toBe(0);
      expect((await auditEvents('case-cr1', 'promise_to_pay_fulfilled')).length).toBe(1);

      // Second call: nothing active → null and NO extra audit event
      expect(await svc.markPromiseFulfilled('case-cr1', 5000)).toBeNull();
      expect((await auditEvents('case-cr1', 'promise_to_pay_fulfilled')).length).toBe(1);
    });

    test('settleDuePromises resolves to FULFILLED when case already recovered', async () => {
      await seedCase();
      await svc.recordCustomerResponse('case-cr1', 'I will pay tomorrow morning');
      await db.query("UPDATE recovery_cases SET status = 'resolved', recovered_amount = 5000 WHERE id = 'case-cr1'");

      const res = await svc.settleDuePromises('case-cr1');
      expect(res.promiseState).toBe('FULFILLED');
      expect((await auditEvents('case-cr1', 'promise_to_pay_fulfilled')).length).toBe(1);
    });
  });

  describe('promise lifecycle — MISSED (follow-up)', () => {
    test('promise past due + grace → MISSED + audit + follow-up flag', async () => {
      await seedCase();
      const result = await svc.recordCustomerResponse('case-cr1', 'I will pay tomorrow morning');
      // Force the promise 2 hours into the past (beyond 30-min grace)
      const past = new Date(Date.now() - 2 * 3600e3).toISOString();
      await db.query('UPDATE customer_responses SET promised_at = ? WHERE case_id = ?', [past, 'case-cr1']);

      const res = await svc.settleDuePromises('case-cr1');
      expect(res.promiseState).toBe('MISSED');
      const rows = await db.query('SELECT promise_status, follow_up_required FROM customer_responses WHERE case_id = ?', ['case-cr1']);
      expect(rows[0].promise_status).toBe('MISSED');
      expect(rows[0].follow_up_required).toBe(1);
      expect((await auditEvents('case-cr1', 'promise_to_pay_missed')).length).toBe(1);

      // Repeated settle is a no-op (no duplicate audit)
      expect(await svc.settleDuePromises('case-cr1')).toBeNull();
      expect((await auditEvents('case-cr1', 'promise_to_pay_missed')).length).toBe(1);
    });

    test('promise not yet due stays PROMISED', async () => {
      await seedCase();
      await svc.recordCustomerResponse('case-cr1', 'I will pay tomorrow morning');
      // promised_at is ~tomorrow → not due
      expect(await svc.settleDuePromises('case-cr1')).toBeNull();
      const rows = await db.query('SELECT promise_status FROM customer_responses WHERE case_id = ?', ['case-cr1']);
      expect(rows[0].promise_status).toBe('PROMISED');
      expect((await auditEvents('case-cr1', 'promise_to_pay_missed')).length).toBe(0);
    });
  });

  describe('state exposure via recoveryStateService (additive)', () => {
    test('buildRecoveryState exposes customerResponse with promise state', async () => {
      await seedCase();
      await svc.recordCustomerResponse('case-cr1', 'I will pay tomorrow morning');

      const state = await recoveryStateService.buildRecoveryState('case-cr1');
      expect(state.customerResponse).not.toBeNull();
      expect(state.customerResponse.lastIntent).toBe('promise_to_pay');
      expect(state.customerResponse.promiseState).toBe('PROMISED');
      expect(state.customerResponse.followUpRequired).toBe(true);
    });

    test('no responses → customerResponse null, state otherwise unchanged', async () => {
      await seedCase();
      const state = await recoveryStateService.buildRecoveryState('case-cr1');
      expect(state.customerResponse).toBeNull();
      expect(state.availableActions).toContain('retry');
    });
  });

  describe('guardrails — responses never execute actions', () => {
    test('recording a response creates NO recovery_actions rows', async () => {
      await seedCase();
      await svc.recordCustomerResponse('case-cr1', 'I will pay tomorrow morning');
      await svc.recordCustomerResponse('case-cr1', 'send me the link');

      const actions = await db.query('SELECT * FROM recovery_actions WHERE case_id = ?', ['case-cr1']);
      expect(actions.length).toBe(0);
    });

    test('evaluateActionPolicy remains the final authority (resolved case blocked)', async () => {
      await seedCase('case-cr-done', 'resolved');
      await svc.recordCustomerResponse('case-cr-done', 'I will pay tomorrow morning');

      const caseRow = (await db.query('SELECT * FROM recovery_cases WHERE id = ?', ['case-cr-done']))[0];
      const verdict = await recoveryService.evaluateActionPolicy(caseRow, 'retry');
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toMatch(/resolved/i);
    });

    test('open case with recorded promise still passes through unchanged policy checks', async () => {
      await seedCase();
      await svc.recordCustomerResponse('case-cr1', 'I will pay tomorrow morning');
      const caseRow = (await db.query('SELECT * FROM recovery_cases WHERE id = ?', ['case-cr1']))[0];
      const verdict = await recoveryService.evaluateActionPolicy(caseRow, 'retry');
      expect(verdict.allowed).toBe(true); // policy unchanged by promise state
    });
  });
});
