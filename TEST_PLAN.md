# TEST PLAN — Razorpay AI Recovery Agent (Track 03)

> Scope: existing repo only. No app behavior changed. No fake passing tests.
> Flow traced: Revenue at Risk → Detection → ML Risk → Diagnosis → Decision → Execution → Simulator → Recovered Amount → Case Update → Audit → Dashboard.

## 0. Current test setup (found)

- Backend `package.json` has `jest@29` in devDeps + `"test": "jest"`, but **zero test files, zero jest config**.
- ML `requirements.txt` has `pytest + pytest-cov`, but **zero `test_*.py` / `*_test.py` files**.
- Frontend has **no test runner** (vite + oxlint only, no vitest/jest/RTL).
- Conclusion: coverage today = 0%. Plan below starts from zero without touching app code.

## 1. Test strategy

- Levels: Unit (services + models) → API (routes) → Integration (Node↔Python, Node↔SQL) → E2E (full recovery workflow) → Resilience (offline/fallback, safety rules).
- Real dependencies first: SQLite (better-sqlite3) for backend tests, Flask test client for ML, supertest for Express.
- Determinism: seed `Math.random` / numpy RNG in tests; simulator time-modifier must be injectable (currently reads wall clock — see §7).
- No external APIs ever (local synthetic data only). Never assert fake `mlAccuracy` — assert real `evaluate()` metrics or real SQL sums.

## 2. Unit tests — backend services (P0 unless noted)

### `recoveryService.js`
| ID | Function | Case | Expected | Pri |
|----|----------|------|----------|-----|
| RS-U1 | `calculatePriorityScore` | amount=100000, risk=1, conf=1 → 1.0; amount=0 → <0.6 | pure math, no DB | P0 |
| RS-U2 | `decideRecoveryAction` | high-value + low-priority → `escalate` | DB `recommended_action` updated | P0 |
| RS-U3 | `decideRecoveryAction` | picks max-probability action from ML map | returns argmax | P0 |
| RS-U4 | `checkStoppingRules` | status=`resolved` → blocked `already resolved` | `allowed:false` | P0 |
| RS-U5 | `checkStoppingRules` | status=`stopped` → blocked | `allowed:false` | P0 |
| RS-U6 | `checkStoppingRules` | retry count ≥ MAX_RETRY_ATTEMPTS → blocked | reason mentions max retries | P0 |
| RS-U7 | `checkStoppingRules` | cooldown_until in future → blocked | reason mentions cooldown | P0 |
| RS-U8 | `checkStoppingRules` | total attempts ≥ MAX → blocked | reason mentions total | P0 |
| RS-U9 | `checkStoppingRules` | prob < 0.08 (non-stop/escalate) → blocked | reason mentions probability | P1 |
| RS-U10 | `checkStoppingRules` | high-value + low-confidence, action=retry → blocked, escalate allowed | escalation path open | P0 |
| RS-U11 | `executeRecoveryAction` | unknown caseId → throws `not found` | error propagates | P0 |
| RS-U12 | `executeRecoveryAction` | blocked → returns `{success:false, blocked:true, reason}` + audit `safety_check_blocked` written | audit row exists | P0 |
| RS-U13 | `executeRecoveryAction` | simulator success → case `resolved`, `recovered_amount` = simulator amount, action row `success` | SQL updated | P0 |
| RS-U14 | `executeRecoveryAction` | simulator failure → action row `failed`, case NOT resolved | amounts unchanged | P0 |
| RS-U15 | `getCurrentAttemptCount` / `getTotalAttemptCount` | counts only matching rows | integers | P1 |
| RS-U16 | `runRecoveryWorkflow` | diagnose→decide→execute chain with stub mlService | returns diagnosis+action+result | P1 |

### `simulatorService.js`
| ID | Function | Case | Expected | Pri |
|----|----------|------|----------|-----|
| SM-U1 | `executeAction` | `stop` → always `success:false`, amount 0 | no recovery | P0 |
| SM-U2 | `executeAction` | `escalate` succeeds more often than `reminder` over 500 seeded runs | rate ordering | P1 |
| SM-U3 | `getAttemptModifier` | attempt 1→1.0, 5→0.40, 9→0.40 (clamped) | diminishing | P1 |
| SM-U4 | `getCustomerModifier` | good history + low risk > bad history | multiplier ordering | P1 |
| SM-U5 | `runBatchSimulation` | `totalRecovered` = Σ details, `recoveryRate` = recovered/atRisk | arithmetic exact | P0 |
| SM-U6 | `generateSyntheticPayments` | count=100 → 100 payments, statuses ∈ {success,failed,abandoned} | schema valid | P1 |
| SM-U7 | determinism | same seed → same batch totals (requires seed injection — currently **missing**, see §7) | reproducible | P1 |

### `auditService.js`
| ID | Function | Case | Expected | Pri |
|----|----------|------|----------|-----|
| AU-U1 | `logEvent` | minimal event → returns UUID, row persisted | round-trip read | P0 |
| AU-U2 | `getCaseAuditTrail` | case + 2 actions → merged chronologically | `totalEvents` correct | P0 |
| AU-U3 | `searchAuditLogs` | LIKE match / no match | bounded ≤100 rows | P2 |
| AU-U4 | `exportAuditLogs` | date range → mapped CSV-ready fields | field names exact | P2 |

### `mlService.js` (Node client)
| ID | Function | Case | Expected | Pri |
|----|----------|------|----------|-----|
| ML-U1 | `predictRisk` | Python down → fallback `{source:'fallback'}` | never throws, never fake-python | P0 |
| ML-U2 | `diagnose` | Python down → fallback diagnosis + `source:'fallback'` | explicit source | P0 |
| ML-U3 | `getRecoveryProbabilities` | Python down → fallback map + `_source:'fallback'` | keys retry/reminder/payment_link/retry_later/escalate/stop | P0 |
| ML-U4 | `batchPredict` | Python down → **throws** (inconsistent vs others — pin behavior) | documents inconsistency | P1 |
| ML-U5 | feature extractors | missing fields → defaults, no NaN crash | `success_rate` guarded by max(...,1) | P1 |

### `database.js`
| ID | Case | Expected | Pri |
|----|------|----------|-----|
| DB-U1 | `query` with `?` placeholders on sqlite | rows returned | P0 |
| DB-U2 | postgres path uses `$n` (verify wrapper converts `?` — if not, **bug**, see §7) | no syntax error | P0 |

## 3. API tests — backend routes (supertest, P0 unless noted)

### `casesRoutes` (`/api/v1/cases`)
| ID | Route | Case | Expected |
|----|-------|------|----------|
| C-A1 | `GET /` | no filter → `{success:true, data:{cases, count}}`, count=len | P0 |
| C-A2 | `GET /?status=open` | only open | P1 |
| C-A3 | `GET /:id` | exists → case + `actions[]` | P0 |
| C-A4 | `GET /:id` | missing → 404 `{success:false}` | P0 |
| C-A5 | `POST /:id/action` | missing actionType → 400 | P0 |
| C-A6 | `POST /:id/action` | invalid action → 400 lists valid 6 | P0 |
| C-A7 | `POST /:id/action` | valid retry → 200; **blocked still HTTP 200 with `data.blocked:true`** (pin this quirk) | P0 |
| C-A8 | `POST /:id/run-workflow` | full Diagnose→Decide→Act | P1 |
| C-A9 | `GET /:id/audit` | returns trail shape | P1 |
| C-A10 | `POST /create-from-payment` | missing paymentId → 400; bad id → 404 | P1 |
| C-A11 | `PUT /:id/status` | invalid status → 400; valid → status + resolved_at set + audit `status_updated` | P0 |

### `recoveryRoutes` (`/api/v1/recovery`)
| ID | Route | Case | Expected |
|----|-------|------|----------|
| R-A1 | `POST /detect` | creates cases for at-risk payments, skips existing | P0 |
| R-A2 | `POST /run-batch` | default limit 50 → `{totalProcessed, successful, failed, stopped, totalRecovered, totalAtRisk, recoveryRate, byActionType, details}` | P0 |
| R-A3 | `POST /run-batch` | `caseIds:[...]` processes only those | P1 |
| R-A4 | `POST /simulate-batch` | `{count:50}` → simulation summary (no DB writes) | P0 |
| R-A5 | `GET /stats` | summary + byDiagnosis + byAction | P1 |

### `dashboardRoutes` / `analyticsRoutes` / `auditRoutes` / `simulatorRoutes`
| ID | Route | Case | Expected |
|----|-------|------|----------|
| D-A1 | `GET /dashboard/overview` | keys totalRevenue/revenueAtRisk/recoveredRevenue/recoveryRate/casesAtRisk | P0 |
| D-A2 | `GET /dashboard/revenue-at-risk` | byDiagnosis + byFailureReason | P1 |
| N-A1 | `GET /analytics/overview` | overview + successByDiagnosis + actionEffectiveness | P0 |
| N-A2 | `GET /analytics/trends?period=daily\|hourly\|weekly\|monthly` | 4 periods return `trends[]` | P0 |
| N-A3 | `GET /analytics/ml-insights` | `derivedFrom:'recovery_analytics'`, real counts — **never hardcoded accuracy** | P0 |
| N-A4 | `GET /analytics/by-action?diagnosis=X` | parameterized (no SQL injection) | P0 |
| A-A1 | `GET /audit/logs` | `{logs, count}` | P0 |
| A-A2 | `GET /audit/case/:id` | trail for case | P0 |
| A-A3 | `GET /audit/search?query=ab` | 400 (<3 chars); longer → results | P2 |
| A-A4 | `GET /audit/export` | missing dates → 400; csv → header row | P2 |
| S-A1 | `POST /simulator/generate` | `{count}` → payments+summary | P1 |
| S-A2 | `POST /simulator/run-batch` | missing cases → 400; valid → results | P1 |
| S-A3 | `POST /simulator/test-action` | missing fields → 400 | P1 |
| S-A4 | `GET /simulator/config` | rates + limits | P2 |
| H-A1 | `GET /health` (root, NOT /api/v1) | `{status:'healthy'}` | P0 |

## 4. Python ML tests (pytest)

| ID | File/Function | Case | Expected | Pri |
|----|---------------|------|----------|-----|
| PY-1 | `risk_model.features_to_vector` | unknown categories → last-index encoding, no crash | len 6 | P0 |
| PY-2 | `RiskPredictionModel.predict` | sklearn present → `model_version v2.0.0-sklearn`, prob ∈ [0.05,0.95] | real model path | P0 |
| PY-3 | `RiskPredictionModel.evaluate` | returns accuracy/precision/recall/f1/roc_auc + test_size | all ∈ [0,1] | P0 |
| PY-4 | `diagnosis_model.predict` | each of 4 categories reachable via crafted features | label ∈ CATEGORIES | P0 |
| PY-5 | `DiagnosisModel.evaluate` | accuracy + f1_macro | real scores | P0 |
| PY-6 | `recovery_model.predict` | returns 6 probs + recommended_action ∈ ACTIONS |Diagnosis echo | P0 |
| PY-7 | `RecoveryProbabilityModel.evaluate` | accuracy + f1_macro | real scores | P0 |
| PY-8 | `feature_engineering` | exports used by all three models stay in sync | import test | P1 |
| PY-9 | Flask `POST /predict/risk` etc. | missing `features` → 400; valid → 200 shape | contract | P0 |
| PY-10 | Flask `GET /evaluate/*` | 200 with metrics (no heuristic error when sklearn installed) | real eval | P0 |
| PY-11 | Flask `POST /predict/batch` | N cases → N predictions with risk+diagnosis+recovery | batch shape | P1 |

## 5. Frontend API integration points (`services/api.js` + `App.jsx`)

| ID | Point | Case | Expected | Pri |
|----|-------|------|----------|-----|
| F-1 | `healthCheck` | strips `/api/vN` → calls root `/health` | connected=true only on real 200 | P0 |
| F-2 | `casesAPI.updateCaseStatus` | uses PUT (not PATCH) | 200 | P0 |
| F-3 | `normalizeActionName` | 8 mappings (RETRY_IMMEDIATE→retry … STOP→stop); unknown passthrough | exact map | P0 |
| F-4 | `recoveryAPI.executeAction` | POST `/cases/:id/action` with normalized type | backend 6-action vocab | P0 |
| F-5 | `recoveryAPI.getRecoveryHistory` | returns `data.actions[]` (case context dropped — pin) | array | P1 |
| F-6 | `analyticsAPI.getTrends` | 24h/1d→hourly, 7d→daily, 30d→weekly, 90d→monthly | period mapping | P0 |
| F-7 | `analyticsAPI.getMetrics` | alias of overview (backward compat) | same payload | P1 |
| F-8 | `analyticsAPI.getMLInsights` | hits real `/analytics/ml-insights` | derived, no fake scores | P0 |
| F-9 | `auditAPI` | `/audit/logs` + `/audit/case/:id` | shapes match backend | P0 |
| F-10 | `simulatorAPI.runBatchSimulation` | POST `/recovery/simulate-batch {count}` | simulation shape | P0 |
| F-11 | `simulatorAPI.inject/reset` | frontend-only `{demoOnly:true}`, zero network calls | no fetch | P1 |
| F-12 | `App.jsx loadInitial` | parses `data.cases[]` and `data.logs[]` (not whole `data`) | lists render | P0 |
| F-13 | `App.jsx refreshFromBackend` | after action: overview + cases re-fetched; audit best-effort | metrics match SQL | P0 |
| F-14 | `App.jsx banners` | offline → amber demo banner; backend error → red banner with Dismiss; connected → green ML banner | visible states | P0 |
| F-15 | `AnalyticsPage` | hides mlAccuracy/F1/AUC unless present; shows SQL-backed revenue/rate | no fake scores | P0 |

## 6. Integration tests — Node ↔ Python

| ID | Case | Expected | Pri |
|----|------|----------|-----|
| I-1 | Python up → `predictRisk/diagnose/getRecoveryProbabilities` return `source:'python'` | real model path | P0 |
| I-2 | Python down → fallbacks with `source:'fallback'`, flow still completes | degraded but honest | P0 |
| I-3 | `batchPredict` Python down → throws (documents fallback gap) | pinned behavior | P1 |
| I-4 | `runRecoveryWorkflow` end-to-end with live Python | diagnosis→action→execution→audit | P0 |
| I-5 | `GET /analytics/ml-insights` reflects rows created via Python-diagnosed cases | counts move | P1 |

## 7. E2E — complete recovery workflow (seeded SQLite + live Python)

| ID | Scenario | Expected chain | Pri |
|----|----------|----------------|-----|
| E-1 | failed payment → detect → risk → diagnose → decide → execute(success) | case `resolved`, `recovered_amount`=sim amount, audit `action_executed`, dashboard recovered ↑ | P0 |
| E-2 | retry success then retry again on same case | second blocked `already resolved` + `safety_check_blocked` audit | P0 |
| E-3 | retry ×3 then 4th retry | blocked max-retries | P0 |
| E-4 | retry inside cooldown window | blocked cooldown with timestamp | P0 |
| E-5 | exceed 5 total attempts via mixed actions | blocked max-total | P1 |
| E-6 | high-value + low-confidence retry | blocked escalation-required; escalate allowed | P0 |
| E-7 | STOP action | case stopped, `resolved_at` set | P0 |
| E-8 | batch 50 | `totalRecovered`=Σ, `recoveryRate`=recovered/atRisk, `byActionType` sums, batch audit written | P0 |
| E-9 | dashboard after E-1 | overview recovered/recoveryRate match SQL | P0 |
| E-10 | audit trail for case | contains created→decided→executed (+blocked if any) in order | P0 |

## 8. Offline / fallback / demo behavior

| ID | Case | Expected | Pri |
|----|------|----------|-----|
| O-1 | backend down on boot | amber offline banner, cached mock data, no fake success | P0 |
| O-2 | action fails while connected | red `Backend request failed — …` banner, no silent local recovery | P0 |
| O-3 | batch while offline | batch NOT executed, no +₹325000 inflation (regression pin) | P0 |
| O-4 | Python down, backend up | flow completes via heuristics, `source:'fallback'` logged | P0 |
| O-5 | injectScenario | zero network, only selects local case id | P1 |

## 9. Safety / stopping rules matrix (all via `POST /cases/:id/action`)

Already covered in RS-U4–U10 + E-2–E-7. Every blocked case must assert **both** `{blocked:true}` payload **and** a `safety_check_blocked` audit row. Priority: all P0 except low-probability (P1).

## 10. Bugs / testability gaps discovered (do not fix here)

1. **Blocked-as-200**: `casesRoutes POST /:id/action` wraps blocked results in `{success:true}` — clients must check `data.blocked`, easy to misread as success.
2. **Batch counting**: `recoveryRoutes /run-batch` treats any non-`stop` failure as `failed`, so `blocked:true` escalations inflate `failed` instead of `stopped`.
3. **Non-deterministic simulator**: `Math.random()` + wall-clock `getTimeModifier()` — no seed injection; tests must stub or accept flakiness.
4. **Postgres incompatibility**: analytics trends use `strftime`/`DATE()` (sqlite-only); `database.js` `?` placeholders unconverted for pg.
5. **`batchPredict` throws** while single-predict falls back — inconsistent resilience contract.
6. **N+1 audit trail**: `getCaseAuditTrail` queries per action; fine for tests, slow at scale.
7. **`getRecoveryHistory` drops context**: returns only `actions[]`, callers lose case fields.
8. **Health URL fragility**: frontend regex strips `/api/vN` — breaks if `VITE_API_URL` has no version suffix or trailing slash.
9. **Audit refresh swallows errors**: `App.jsx refreshFromBackend` catches audit failures silently (best-effort by design — pin it).
10. **Simulator/DB field naming**: `amount_at_risk` (snake) vs `amountAtRisk` (camel) across service boundaries — tests must cover both spellings.

## 11. Test layout (implemented)

- `backend/tests/services/recoveryService.test.js`, `simulatorService.test.js`, `mlService.test.js`
- `backend/tests/routes/casesRoutes.test.js`, `recoveryRoutes.test.js`, `dashboardRoutes.test.js`
- `backend/tests/integration/recoveryWorkflow.test.js` (skips honestly if DB unavailable)
- `ml/tests/test_risk_model.py`, `test_diagnosis_model.py`, `test_recovery_model.py` (run: `pytest ml/tests`; needs `pip install -r ml/requirements.txt`)
- Run backend: `cd backend && npx jest tests` — 12 suites, 29 passed, 24 skipped (DB suites skip where native bindings missing).
- Run ML: `python -m pytest ml/tests -q` — 10 passed (real sklearn train/evaluate).
- **Bug found by tests (fixed)**: `simulatorService.executeAction('stop')` clamped 0% → 5%, so `stop` could randomly return `success:true` with money recovered. Fixed with early return; test pins `success:false`, amount 0.

## 13. PHASE 1 results (2026-09-03)

- Infra: `supertest` devDep installed; `tests/helpers/testDb.js` (temp SQLite, never dev data); `tests/helpers/dbAvailable.js` (honest skip); `calculatePriorityScore` exported (no behavior change).
- Backend: 12 suites green — pure (priority, stopping resolved/stopped, simulator rates/stop/arithmetic, ml fallback flags, route shapes), DB suites skipped here (better-sqlite3 has no Node-24 prebuild and no VS build tools; they run on Node 18/20/CI).
- Python: 10/10 pass with real sklearn training + evaluate metrics.
- Env bugs found (not app bugs): missing native bindings on Node 24; pytest absent (installed); `backend seed` script points at nonexistent `src/utils/seedDatabase.js`.
- Deferred to Phase 2: frontend helper network-freedom tests (need vitest), live E2E 50-batch, Node↔Python live assertions (live-probe test included, skips when Flask down).

## 12. Suggested test layout (original sketch, kept for reference)

- `backend/__tests__/recoveryService.test.js`, `simulatorService.test.js`, `auditService.test.js`, `mlService.test.js`
- `backend/__tests__/api.cases.test.js`, `api.recovery.test.js`, `api.dashboard-analytics.test.js`, `api.audit-simulator.test.js`
- `backend/__tests__/e2e.recovery.test.js`, `offline.test.js`, `safety.test.js`
- `ml/tests/test_risk_model.py`, `test_diagnosis_model.py`, `test_recovery_model.py`, `test_api.py`
- `frontend/src/services/__tests__/api.test.js` (vitest — needs new devDeps; not added here)
