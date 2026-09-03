import React, { useState } from 'react';
import {
  ArrowLeft,
  User,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  ShieldCheck,
  ShieldAlert,
  Play,
  Bot,
  ChevronRight,
  TrendingUp,
  BarChart2,
  FileText,
  XCircle,
  Activity,
  Layers,
  PhoneCall,
} from 'lucide-react';

/**
 * CaseDetails — Full drill-down view for a single recovery case.
 *
 * Displays:
 *   1. Customer profile header
 *   2. Payment / event card
 *   3. AI diagnosis with SHAP-style factor bars
 *   4. Recovery decision with alternative actions
 *   5. Safety / guardrail status
 *   6. Case history timeline
 *   7. Execute action CTA
 *
 * Props:
 *   activeCase        — The full case object from INITIAL_CASES
 *   onBack            — () => void  — returns to case list
 *   onExecuteRecovery — (caseId, actionType) => result
 */
export default function CaseDetails({ activeCase, onBack, onExecuteRecovery }) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);

  if (!activeCase) {
    return (
      <div className="case-detail-empty">
        <Bot size={40} opacity={0.3} />
        <p>Select a case from the list to view details.</p>
      </div>
    );
  }

  const { customer, payment, diagnosis, decision, guardrails, history, status, recoveredAmount } = activeCase;

  const formatINR = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Status → colour mapping.
  const statusMeta = {
    DETECTED:         { color: '#F59E0B', label: 'Detected',         icon: AlertTriangle },
    ACTION_SCHEDULED: { color: '#0066FF', label: 'Action Scheduled', icon: Clock },
    RECOVERED:        { color: '#10B981', label: 'Recovered',        icon: CheckCircle2 },
    STOPPED:          { color: '#EF4444', label: 'Stopped',          icon: XCircle },
    ESCALATED:        { color: '#8B5CF6', label: 'Escalated',        icon: PhoneCall },
  };
  const sm = statusMeta[status] || statusMeta['DETECTED'];
  const StatusIcon = sm.icon;

  // Execute the recommended action.
  const handleExecute = async () => {
    setIsExecuting(true);
    setExecutionResult(null);
    await new Promise(r => setTimeout(r, 1200));
    const result = onExecuteRecovery(activeCase.id, decision.recommendedAction);
    setIsExecuting(false);
    setExecutionResult(result);
  };

  const canExecute = !['RECOVERED', 'STOPPED'].includes(status) && !isExecuting;

  return (
    <div className="cd-root">

      {/* ── Back nav ── */}
      <button className="cd-back-btn" onClick={onBack}>
        <ArrowLeft size={16} />
        <span>Back to cases</span>
      </button>

      {/* ── Case ID + Status banner ── */}
      <div className="cd-banner porcelain-card">
        <div className="cd-banner-left">
          <span className="cd-case-id">{activeCase.id}</span>
          <span className="cd-status-pill" style={{ background: `${sm.color}18`, color: sm.color, border: `1px solid ${sm.color}30` }}>
            <StatusIcon size={13} />
            {sm.label}
          </span>
        </div>
        <div className="cd-banner-right">
          <span className="cd-amount-at-risk">
            <span className="cd-aar-label">Amount at risk</span>
            <span className="cd-aar-val">{formatINR(payment.amount)}</span>
          </span>
        </div>
      </div>

      <div className="cd-grid">
        {/* ── LEFT COLUMN ── */}
        <div className="cd-left">

          {/* 1. Customer profile */}
          <section className="cd-card">
            <div className="cd-card-header">
              <User size={16} />
              <span>Customer Profile</span>
            </div>
            <div className="cd-customer-grid">
              <div>
                <span className="cd-label">Name</span>
                <span className="cd-val">{customer.name}</span>
              </div>
              <div>
                <span className="cd-label">Tier</span>
                <span className="cd-val tier-badge" style={{ color: '#FF6A00' }}>{customer.tier}</span>
              </div>
              <div>
                <span className="cd-label">Lifetime Value</span>
                <span className="cd-val emerald">{formatINR(customer.lifetimeValue)}</span>
              </div>
              <div>
                <span className="cd-label">Success Rate</span>
                <span className="cd-val">{(customer.historicalSuccessRate * 100).toFixed(0)}%</span>
              </div>
              <div>
                <span className="cd-label">Email</span>
                <span className="cd-val muted">{customer.email}</span>
              </div>
              <div>
                <span className="cd-label">Account Age</span>
                <span className="cd-val">{customer.accountAgeMonths} months</span>
              </div>
            </div>
          </section>

          {/* 2. Payment event */}
          <section className="cd-card">
            <div className="cd-card-header">
              <CreditCard size={16} />
              <span>Payment / Event</span>
            </div>
            <div className="cd-customer-grid">
              <div>
                <span className="cd-label">Amount</span>
                <span className="cd-val">{formatINR(payment.amount)}</span>
              </div>
              <div>
                <span className="cd-label">Method</span>
                <span className="cd-val">{payment.method}</span>
              </div>
              <div>
                <span className="cd-label">Error Code</span>
                <span className="cd-val mono muted">{payment.rawErrorCode}</span>
              </div>
              <div>
                <span className="cd-label">Category</span>
                <span className="cd-val">{payment.errorCategory}</span>
              </div>
              <div>
                <span className="cd-label">Bank</span>
                <span className="cd-val">{payment.bank}</span>
              </div>
              <div>
                <span className="cd-label">Time</span>
                <span className="cd-val">{formatTime(payment.timestamp)}</span>
              </div>
            </div>
          </section>

          {/* 3. Case history timeline */}
          <section className="cd-card">
            <div className="cd-card-header">
              <Activity size={16} />
              <span>Case History</span>
            </div>
            <div className="cd-timeline">
              {history.map((ev, i) => (
                <div className="cd-timeline-row" key={i}>
                  <div className="cd-tl-dot" />
                  <div className="cd-tl-content">
                    <span className="cd-tl-actor">{ev.actor}</span>
                    <span className="cd-tl-event">{ev.event}</span>
                    <span className="cd-tl-time">{formatTime(ev.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="cd-right">

          {/* 4. AI Diagnosis */}
          <section className="cd-card cd-diagnosis-card">
            <div className="cd-card-header">
              <Bot size={16} />
              <span>AI Diagnosis</span>
              <span className="cd-conf-pill">{(diagnosis.confidence * 100).toFixed(0)}% confidence</span>
            </div>
            <div className="cd-diag-cause">{diagnosis.friendlyName}</div>
            <p className="cd-diag-desc">{diagnosis.description}</p>
            <div className="cd-factors">
              {diagnosis.factors.map((f, i) => (
                <div className="cd-factor-row" key={i}>
                  <span className={`cd-factor-impact ${f.type}`}>{f.impact}</span>
                  <span className="cd-factor-name">{f.name}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 5. Recovery Decision */}
          <section className="cd-card cd-decision-card">
            <div className="cd-card-header">
              <Zap size={16} />
              <span>AI Recovery Decision</span>
            </div>

            {/* Primary recommendation */}
            <div className="cd-rec-primary">
              <div className="cd-rec-action-label">{decision.actionLabel}</div>
              <div className="cd-rec-metrics">
                <div className="cd-rec-metric">
                  <span className="cd-label">Recovery Probability</span>
                  <span className="cd-val emerald">{(decision.recoveryProbability * 100).toFixed(0)}%</span>
                </div>
                <div className="cd-rec-metric">
                  <span className="cd-label">Expected Value</span>
                  <span className="cd-val">{formatINR(decision.expectedRecoveryValue)}</span>
                </div>
                <div className="cd-rec-metric">
                  <span className="cd-label">Intervention Cost</span>
                  <span className="cd-val muted">₹{decision.interventionCost}</span>
                </div>
              </div>
            </div>

            {/* Alternative actions */}
            {decision.alternativeActions?.length > 0 && (
              <div className="cd-alternatives">
                <div className="cd-alt-label">Alternative actions</div>
                {decision.alternativeActions.map((alt, i) => (
                  <div className="cd-alt-row" key={i}>
                    <ChevronRight size={13} opacity={0.5} />
                    <span className="cd-alt-name">{alt.label}</span>
                    <span className="cd-alt-prob">{(alt.prob * 100).toFixed(0)}%</span>
                    <span className="cd-alt-val">{formatINR(alt.expValue)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 6. Safety Guardrails */}
          <section className="cd-card">
            <div className="cd-card-header">
              {guardrails.stoppingRuleHit
                ? <ShieldAlert size={16} color="#EF4444" />
                : <ShieldCheck size={16} color="#10B981" />}
              <span>Safety Guardrails</span>
              <span
                className="cd-guard-status-pill"
                style={{ color: guardrails.stoppingRuleHit ? '#EF4444' : '#10B981' }}
              >
                {guardrails.status}
              </span>
            </div>
            <div className="cd-guard-grid">
              <div className="cd-guard-row">
                <span>Retries used / max</span>
                <span>{guardrails.retriesUsed} / {guardrails.maxRetriesAllowed}</span>
              </div>
              <div className="cd-guard-row">
                <span>Touchpoints used / max</span>
                <span>{guardrails.touchpointsUsed} / {guardrails.maxTouchpoints}</span>
              </div>
              <div className="cd-guard-row">
                <span>Cooldown satisfied</span>
                <span>{guardrails.isCooldownSatisfied ? '✓ Yes' : '✗ No'}</span>
              </div>
              <div className="cd-guard-row">
                <span>High-value escalation</span>
                <span>{guardrails.isHighValueEscalationRequired ? '⚠ Required' : '✓ Not required'}</span>
              </div>
              {guardrails.stoppingRuleHit && (
                <div className="cd-guard-row stopping-hit">
                  <span>Stopping rule</span>
                  <span>{guardrails.stoppingRuleHit}</span>
                </div>
              )}
            </div>
          </section>

          {/* 7. Execute / Recovery Result */}
          <section className="cd-card cd-execute-card">
            {status === 'RECOVERED' ? (
              <div className="cd-recovered-result">
                <CheckCircle2 size={28} color="#10B981" />
                <div className="cd-rec-headline">Revenue Recovered</div>
                <div className="cd-rec-amount">{formatINR(recoveredAmount)}</div>
                <div className="cd-rec-note">Case resolved. Audit event recorded.</div>
              </div>
            ) : status === 'STOPPED' ? (
              <div className="cd-stopped-result">
                <XCircle size={28} color="#EF4444" />
                <div className="cd-rec-headline">Recovery Halted</div>
                <div className="cd-rec-note">Stopping rule applied. No further actions.</div>
              </div>
            ) : (
              <>
                {executionResult && (
                  <div className={`cd-exec-result ${executionResult.recovered ? 'success' : 'fail'}`}>
                    {executionResult.recovered
                      ? `✓ Recovered ${formatINR(executionResult.amount)}`
                      : `⚠ ${executionResult.reason || 'Action executed — no recovery.'}`}
                  </div>
                )}
                <button
                  id={`execute-btn-${activeCase.id}`}
                  className="btn btn-primary cd-exec-btn"
                  onClick={handleExecute}
                  disabled={!canExecute}
                >
                  {isExecuting ? (
                    <>
                      <div className="cd-spinner" />
                      <span>Executing bounded action…</span>
                    </>
                  ) : (
                    <>
                      <Play size={15} />
                      <span>Execute: {decision.actionLabel}</span>
                    </>
                  )}
                </button>
                <p className="cd-exec-note">
                  All actions are bounded by safety guardrails above.
                  Every execution is recorded in the audit trail.
                </p>
              </>
            )}
          </section>
        </div>
      </div>

      {/* ── Scoped styles ── */}
      <style>{`
        .cd-root {
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .cd-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: transparent;
          border: none;
          font-family: var(--font-display);
          font-size: 13.5px;
          font-weight: 600;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 4px 0;
          transition: color var(--transition-fast);
        }
        .cd-back-btn:hover { color: var(--accent-orange); }

        /* Banner */
        .cd-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          gap: 20px;
        }
        .cd-banner-left { display: flex; align-items: center; gap: 12px; }
        .cd-case-id {
          font-family: var(--font-mono);
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .cd-status-pill {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .cd-banner-right {}
        .cd-amount-at-risk { display: flex; flex-direction: column; align-items: flex-end; }
        .cd-aar-label { font-size: 11px; color: var(--text-muted); font-weight: 600; }
        .cd-aar-val { font-family: var(--font-display); font-size: 22px; font-weight: 800; color: var(--accent-coral); }

        /* Two-column grid */
        .cd-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          align-items: start;
        }
        .cd-left, .cd-right { display: flex; flex-direction: column; gap: 16px; }

        /* Shared card */
        .cd-card {
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
          padding: 20px;
          box-shadow: var(--shadow-sm);
        }
        .cd-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 16px;
        }
        .cd-conf-pill {
          margin-left: auto;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 999px;
          background: var(--razorpay-blue-light);
          color: var(--razorpay-blue);
        }

        /* Customer / payment grid */
        .cd-customer-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px 20px;
        }
        .cd-customer-grid > div { display: flex; flex-direction: column; gap: 2px; }
        .cd-label { font-size: 11px; color: var(--text-muted); font-weight: 600; }
        .cd-val { font-size: 13.5px; font-weight: 600; color: var(--text-primary); }
        .cd-val.emerald { color: var(--accent-emerald); }
        .cd-val.muted { color: var(--text-secondary); }
        .cd-val.mono { font-family: var(--font-mono); font-size: 11.5px; word-break: break-all; }

        /* Diagnosis */
        .cd-diag-cause {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 8px;
        }
        .cd-diag-desc {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.6;
          margin: 0 0 16px;
        }
        .cd-factors { display: flex; flex-direction: column; gap: 8px; }
        .cd-factor-row {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12.5px;
        }
        .cd-factor-impact {
          min-width: 52px;
          font-weight: 800;
          font-family: var(--font-mono);
          font-size: 11.5px;
        }
        .cd-factor-impact.positive { color: var(--accent-emerald); }
        .cd-factor-impact.negative { color: var(--accent-coral); }
        .cd-factor-impact.neutral  { color: var(--accent-amber); }
        .cd-factor-name { color: var(--text-secondary); }

        /* Decision */
        .cd-rec-primary {
          background: var(--bg-card-subtle);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 16px;
          margin-bottom: 16px;
        }
        .cd-rec-action-label {
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 700;
          color: var(--accent-orange);
          margin-bottom: 12px;
        }
        .cd-rec-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .cd-rec-metric { display: flex; flex-direction: column; gap: 2px; }
        .cd-alternatives { display: flex; flex-direction: column; gap: 6px; }
        .cd-alt-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }
        .cd-alt-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12.5px;
          color: var(--text-secondary);
          padding: 6px 0;
          border-bottom: 1px solid var(--border-subtle);
        }
        .cd-alt-row:last-child { border-bottom: none; }
        .cd-alt-name { flex: 1; }
        .cd-alt-prob { font-weight: 700; color: var(--razorpay-blue); min-width: 38px; text-align: right; }
        .cd-alt-val { font-weight: 700; color: var(--text-primary); min-width: 72px; text-align: right; }

        /* Guardrails */
        .cd-guard-status-pill { margin-left: auto; font-size: 11px; font-weight: 700; }
        .cd-guard-grid { display: flex; flex-direction: column; gap: 8px; }
        .cd-guard-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12.5px;
          padding: 6px 0;
          border-bottom: 1px solid var(--border-subtle);
          color: var(--text-secondary);
        }
        .cd-guard-row:last-child { border-bottom: none; }
        .cd-guard-row span:last-child { font-weight: 600; color: var(--text-primary); }
        .cd-guard-row.stopping-hit span:last-child { color: var(--accent-coral); }

        /* Execute */
        .cd-execute-card { text-align: center; }
        .cd-exec-btn {
          width: 100%;
          justify-content: center;
          padding: 14px 24px;
          font-size: 14.5px;
          gap: 10px;
          margin-bottom: 12px;
        }
        .cd-exec-note { font-size: 11.5px; color: var(--text-muted); line-height: 1.5; }
        .cd-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .cd-exec-result {
          font-size: 13px;
          font-weight: 600;
          padding: 10px 16px;
          border-radius: var(--radius-md);
          margin-bottom: 12px;
          text-align: left;
        }
        .cd-exec-result.success { background: var(--accent-emerald-light); color: var(--accent-emerald-dark); }
        .cd-exec-result.fail { background: var(--accent-coral-light); color: var(--accent-coral); }

        /* Recovery confirmed state */
        .cd-recovered-result, .cd-stopped-result {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 12px 0;
        }
        .cd-rec-headline {
          font-family: var(--font-display);
          font-size: 17px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .cd-rec-amount {
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 800;
          color: var(--accent-emerald);
        }
        .cd-rec-note { font-size: 12px; color: var(--text-muted); }

        /* Empty state */
        .cd-detail-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 60px 20px;
          color: var(--text-muted);
        }

        /* Responsive */
        @media (max-width: 900px) {
          .cd-grid { grid-template-columns: 1fr; }
          .cd-customer-grid { grid-template-columns: 1fr; }
          .cd-rec-metrics { grid-template-columns: 1fr 1fr; }
        }

        /* Timeline */
        .cd-timeline { display: flex; flex-direction: column; gap: 0; }
        .cd-timeline-row {
          display: flex;
          gap: 14px;
          padding: 10px 0;
          border-bottom: 1px solid var(--border-subtle);
        }
        .cd-timeline-row:last-child { border-bottom: none; }
        .cd-tl-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: var(--accent-orange);
          margin-top: 5px;
          flex-shrink: 0;
        }
        .cd-tl-content { display: flex; flex-direction: column; gap: 2px; }
        .cd-tl-actor { font-size: 10.5px; font-weight: 700; color: var(--accent-orange); text-transform: uppercase; letter-spacing: 0.05em; }
        .cd-tl-event { font-size: 12.5px; color: var(--text-primary); line-height: 1.4; }
        .cd-tl-time { font-family: var(--font-mono); font-size: 10.5px; color: var(--text-muted); }
      `}</style>
    </div>
  );
}
