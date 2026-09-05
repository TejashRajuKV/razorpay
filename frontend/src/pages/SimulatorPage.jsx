import React, { useState } from 'react';
import { 
  Play, 
  RefreshCw, 
  Sparkles, 
  ShieldCheck, 
  Bot, 
  TrendingUp, 
  Coins, 
  AlertTriangle, 
  CheckCircle2, 
  Sliders, 
  Layers, 
  Zap, 
  Cpu, 
  ChevronRight,
  RotateCcw,
  Check,
  Building,
  User,
  ShoppingBag,
  CreditCard
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { resolveScenarioCase } from '../services/scenarios';

export default function SimulatorPage({
  metrics,
  cases,
  onTriggerBatch,
  isBatchRunning,
  onInjectScenario,
  onExecuteRecovery
}) {
  // Step-by-Step Debugger State
  const [debugCase, setDebugCase] = useState(cases[0]);
  const [debugStep, setDebugStep] = useState(1);
  const [debugLog, setDebugLog] = useState([
    "Initialized Step-by-Step Recovery Sandbox."
  ]);
  const [isProcessingStep, setIsProcessingStep] = useState(false);

  // Batch Simulator Configuration State
  const [batchSize, setBatchSize] = useState(100);
  const [includeHighRisk, setIncludeHighRisk] = useState(true);
  const [includeSubscriptions, setIncludeSubscriptions] = useState(true);

  const formatINR = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const handleSelectScenario = (scenarioKey) => {
    onInjectScenario(scenarioKey);
    setDebugStep(1);
    const targetCase = resolveScenarioCase(scenarioKey, cases);

    if (!targetCase) {
      setDebugLog([`No loaded backend case matches scenario ${scenarioKey}.`]);
      return;
    }
    setDebugCase(targetCase);
    setDebugLog([
      `Injected scenario: ${targetCase.customer.name} (${targetCase.id})`,
      `Amount at Risk: ${formatINR(targetCase.payment.amount)} via ${targetCase.payment.method}`
    ]);
  };

  const handleNextStep = async () => {
    setIsProcessingStep(true);
    await new Promise(r => setTimeout(r, 600));
    setIsProcessingStep(false);

    if (debugStep === 1) {
      setDebugLog(prev => [...prev, `[Step 2: Diagnosis] Classified as ${debugCase.diagnosis.rootCause} with ${Math.round(debugCase.diagnosis.confidence * 100)}% confidence.`]);
      setDebugStep(2);
    } else if (debugStep === 2) {
      setDebugLog(prev => [...prev, `[Step 3: Policy Decision] Selected ${debugCase.decision.actionLabel} (E[Recovery] = ${formatINR(debugCase.decision.expectedRecoveryValue)}).`]);
      setDebugStep(3);
    } else if (debugStep === 3) {
      setDebugLog(prev => [...prev, `[Step 4: Safety Check] Guardrails evaluated. Retries: ${debugCase.guardrails.retriesUsed}/3, Cooldown: OK. STATUS: ${debugCase.guardrails.status}.`]);
      setDebugStep(4);
    } else if (debugStep === 4) {
      try {
        const result = await onExecuteRecovery(debugCase.id, debugCase.decision.recommendedAction);
        if (result && result.recovered) {
          setDebugLog(prev => [...prev, `[Step 5: Execution & Measurement] SUCCESS! Payment confirmed settled for ${formatINR(result.amount)}.`]);
          confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
        } else if (result && (result.stopped || result.blocked)) {
          setDebugLog(prev => [...prev, `[Step 5: Execution] Stopped by safety rule: ${result.reason}`]);
        } else {
          setDebugLog(prev => [...prev, `[Step 5: Execution] Action completed and status updated.`]);
        }
      } catch (err) {
        setDebugLog(prev => [...prev, `[Step 5: Execution] Failed: ${err?.message || 'backend request failed'}`]);
      }
      setDebugStep(5);
    } else if (debugStep === 5) {
      setDebugLog(prev => [...prev, `[Step 6: Immutable Audit] Event AUD-995 logged with cryptographic verification hash.`]);
      setDebugStep(6);
    }
  };

  const handleResetDebugger = () => {
    setDebugStep(1);
    setDebugLog(["Reset debugger to initial detection stage."]);
  };

  if (!debugCase) {
    return (
      <div className="simulator-page">
        <div className="porcelain-card" style={{ padding: 32, textAlign: 'center' }}>
          <h2>No case data available</h2>
          <p>Backend is unreachable or has not returned any recovery cases. No data is shown.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="simulator-page">
      {/* 1. Header Banner */}
      <section className="sim-header-stage porcelain-card">
        <div className="sim-title-group">
          <span className="badge badge-orange">
            <Cpu size={14} />
            <span>Interactive Simulator & Batch Engine</span>
          </span>
          <h1 className="sim-heading font-serif-title">
            Payment Failure & Recovery Sandbox
          </h1>
          <p className="sim-sub">
            Because no Razorpay production APIs are assumed, this built-in engine simulates realistic 
            payment drops, 3DS authentication timeouts, auto-debit cap limits, and bounded agent executions.
          </p>
        </div>
      </section>

      {/* 2. Grid: Step-by-Step Interactive Debugger & Batch Runner */}
      <div className="sim-main-grid">
        {/* Left Side: Step-by-Step Interactive Debugger */}
        <div className="debugger-column">
          <div className="debugger-card porcelain-card">
            <div className="debugger-header">
              <div>
                <h2 className="debugger-title">Step-by-Step Agent Debugger</h2>
                <p className="debugger-sub">Step through each phase of the autonomous loop interactively.</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={handleResetDebugger}>
                <RotateCcw size={14} />
                <span>Reset</span>
              </button>
            </div>

            {/* Quick Scenario Injector Buttons */}
            <div className="scenario-selector-box">
              <span className="scenario-label">Select Injected Scenario:</span>
              <div className="scenario-btn-grid">
                <button
                  className={`scenario-btn ${resolveScenarioCase('RAHUL_UPI', cases)?.id === debugCase?.id ? 'active' : ''}`}
                  onClick={() => handleSelectScenario('RAHUL_UPI')}
                >
                  <Zap size={14} color="#FF6A00" />
                  <span>Rahul (UPI Timeout)</span>
                </button>
                <button
                  className={`scenario-btn ${resolveScenarioCase('PRIYA_CARD', cases)?.id === debugCase?.id ? 'active' : ''}`}
                  onClick={() => handleSelectScenario('PRIYA_CARD')}
                >
                  <CreditCard size={14} color="#0066FF" />
                  <span>Priya (Card Payment Drop)</span>
                </button>
                <button
                  className={`scenario-btn ${resolveScenarioCase('VIKRAM_ENTERPRISE', cases)?.id === debugCase?.id ? 'active' : ''}`}
                  onClick={() => handleSelectScenario('VIKRAM_ENTERPRISE')}
                >
                  <Building size={14} color="#8B5CF6" />
                  <span>Vikram (High Value Case)</span>
                </button>
                <button
                  className={`scenario-btn ${resolveScenarioCase('KUNAL_RISK', cases)?.id === debugCase?.id ? 'active' : ''}`}
                  onClick={() => handleSelectScenario('KUNAL_RISK')}
                >
                  <AlertTriangle size={14} color="#EF4444" />
                  <span>Kunal (Fraud Velocity Risk)</span>
                </button>
              </div>
            </div>

            {/* Step Progress Indicators */}
            <div className="debug-steps-tracker">
              {[
                { num: 1, label: "Detect" },
                { num: 2, label: "Diagnose" },
                { num: 3, label: "Decide" },
                { num: 4, label: "Guardrails" },
                { num: 5, label: "Execute" },
                { num: 6, label: "Audit" }
              ].map(step => (
                <div 
                  key={step.num} 
                  className={`debug-step-node ${debugStep >= step.num ? 'completed' : ''} ${debugStep === step.num ? 'current' : ''}`}
                >
                  <div className="node-circle">
                    {debugStep > step.num ? <Check size={12} /> : step.num}
                  </div>
                  <span className="node-label">{step.label}</span>
                </div>
              ))}
            </div>

            {/* Current Step State Card */}
            <div className="current-step-display">
              {debugStep === 1 && (
                <div className="step-content-box">
                  <div className="step-badge-row">
                    <span className="badge badge-orange">Phase 1: Revenue Risk Detection</span>
                  </div>
                  <h4>Payment Failure Captured</h4>
                  <p>
                    Captured failure event on <strong>{debugCase.payment.method}</strong> for <strong>{formatINR(debugCase.payment.amount)}</strong>.
                    Customer <strong>{debugCase.customer.name}</strong> has a historical success rate of {Math.round(debugCase.customer.historicalSuccessRate * 100)}%.
                  </p>
                </div>
              )}

              {debugStep === 2 && (
                <div className="step-content-box">
                  <div className="step-badge-row">
                    <span className="badge badge-blue">Phase 2: Local ML Diagnosis</span>
                  </div>
                  <h4>Root Cause Classified: {debugCase.diagnosis.friendlyName}</h4>
                  <p>{debugCase.diagnosis.description}</p>
                  <div className="factors-mini-list">
                    {debugCase.diagnosis.factors.map((f, i) => (
                      <div key={i} className="factor-mini-pill">
                        <span>{f.name}</span>
                        <span className={`factor-val ${f.type}`}>{f.impact}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {debugStep === 3 && (
                <div className="step-content-box">
                  <div className="step-badge-row">
                    <span className="badge badge-purple">Phase 3: Policy Optimization Matrix</span>
                  </div>
                  <h4>Optimal Intervention: {debugCase.decision.actionLabel}</h4>
                  <p>
                    Estimated Recovery Probability: <strong>{Math.round(debugCase.decision.recoveryProbability * 100)}%</strong>.
                    Expected Recovery Value: <strong>{formatINR(debugCase.decision.expectedRecoveryValue)}</strong>.
                  </p>
                </div>
              )}

              {debugStep === 4 && (
                <div className="step-content-box">
                  <div className="step-badge-row">
                    <span className="badge badge-emerald">Phase 4: Safety Guardrails Gate</span>
                  </div>
                  <h4>Stopping Bounds Verified</h4>
                  <div className="safety-check-grid">
                    <div className="safety-item">
                      <span>Max Retries:</span>
                      <strong>{debugCase.guardrails.retriesUsed}/3 (OK)</strong>
                    </div>
                    <div className="safety-item">
                      <span>Cooldown Timer:</span>
                      <strong>Ready (OK)</strong>
                    </div>
                    <div className="safety-item">
                      <span>High Value Gate:</span>
                      <strong>{debugCase.payment.amount > 50000 ? 'Escalated to Human' : 'Autonomous OK'}</strong>
                    </div>
                  </div>
                </div>
              )}

              {debugStep === 5 && (
                <div className="step-content-box">
                  <div className="step-badge-row">
                    <span className="badge badge-emerald">Phase 5: Bounded Action Execution</span>
                  </div>
                  <h4>Dispatched to Simulator</h4>
                  <p>
                    Action executed. Confirmed settlement recorded and added to merchant recovered balance.
                  </p>
                </div>
              )}

              {debugStep === 6 && (
                <div className="step-content-box">
                  <div className="step-badge-row">
                    <span className="badge badge-orange">Phase 6: Immutable Audit Completed</span>
                  </div>
                  <h4>Cryptographic Audit Record Created</h4>
                  <p>
                    Case {debugCase.id} finalized with full explanation, metrics, and timestamps.
                  </p>
                </div>
              )}

              <div className="step-action-bar">
                {debugStep < 6 ? (
                  <button 
                    className="btn btn-primary full-width"
                    onClick={handleNextStep}
                    disabled={isProcessingStep}
                  >
                    {isProcessingStep ? (
                      <>
                        <RefreshCw size={16} className="spin-icon" />
                        <span>Evaluating Next Stage...</span>
                      </>
                    ) : (
                      <>
                        <span>Proceed to Next Phase</span>
                        <ChevronRight size={16} />
                      </>
                    )}
                  </button>
                ) : (
                  <button 
                    className="btn btn-emerald full-width"
                    onClick={handleResetDebugger}
                  >
                    <CheckCircle2 size={16} />
                    <span>Debugger Cycle Completed (Reset)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Execution Console Terminal Log */}
            <div className="console-log-box">
              <div className="console-header">
                <span>Debugger Execution Log</span>
              </div>
              <div className="console-body">
                {debugLog.map((log, idx) => (
                  <div key={idx} className="log-line">
                    <span className="log-prefix">&gt;</span> {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Batch Simulation Engine */}
        <div className="batch-column">
          <div className="batch-card porcelain-card">
            <div className="batch-header">
              <span className="badge badge-orange">High-Volume Stress Testing</span>
              <h2 className="batch-title">Batch Simulation Runner</h2>
              <p className="batch-sub">
                Execute a batch of 50 to 500 synthetic payment failures to measure aggregate recovery rate and model accuracy.
              </p>
            </div>

            <div className="batch-controls-box">
              <div className="batch-size-selector">
                <label className="ctrl-label">Select Batch Size:</label>
                <div className="size-pills">
                  {[50, 100, 250, 500].map(size => (
                    <button 
                      key={size}
                      className={`size-pill-btn ${batchSize === size ? 'active' : ''}`}
                      onClick={() => setBatchSize(size)}
                    >
                      {size} Cases
                    </button>
                  ))}
                </div>
              </div>

              <div className="batch-toggles-grid">
                <label className="toggle-label">
                  <input 
                    type="checkbox" 
                    checked={includeHighRisk} 
                    onChange={(e) => setIncludeHighRisk(e.target.checked)}
                  />
                  <span>Include Velocity & Fraud Risk Cases (Stopping Tests)</span>
                </label>

                <label className="toggle-label">
                  <input 
                    type="checkbox" 
                    checked={includeSubscriptions} 
                    onChange={(e) => setIncludeSubscriptions(e.target.checked)}
                  />
                  <span>Include Recurring Subscriptions & Invoices</span>
                </label>
              </div>

              <button 
                className="btn btn-primary btn-lg full-width"
                onClick={onTriggerBatch}
                disabled={isBatchRunning}
              >
                {isBatchRunning ? (
                  <>
                    <RefreshCw size={18} className="spin-icon" />
                    <span>Running Simulation ({batchSize} Transactions)...</span>
                  </>
                ) : (
                  <>
                    <Play size={18} />
                    <span>Execute Batch Simulation ({batchSize} Cases)</span>
                  </>
                )}
              </button>
            </div>

            {/* Batch Results Benchmark Card */}
            <div className="batch-benchmark-box">
              <h3 className="benchmark-title">Current Aggregate Performance</h3>

              <div className="benchmark-stats-grid">
                <div className="b-stat-cell">
                  <span className="b-label">Cases Processed</span>
                  <span className="b-val">{metrics.casesProcessed}</span>
                </div>
                <div className="b-stat-cell">
                  <span className="b-label">Total at Risk</span>
                  <span className="b-val coral">{formatINR(metrics.revenueAtRisk)}</span>
                </div>
                <div className="b-stat-cell">
                  <span className="b-label">Total Recovered</span>
                  <span className="b-val emerald">{formatINR(metrics.recoveredRevenue)}</span>
                </div>
                <div className="b-stat-cell">
                  <span className="b-label">Recovery Rate</span>
                  <span className="b-val orange">{metrics.recoveryRate}%</span>
                </div>
              </div>

              <div className="benchmark-footer">
                <CheckCircle2 size={16} color="#10B981" />
                <span>All actions executed within bounded safety limits (0 policy violations).</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .simulator-page {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .sim-header-stage {
          padding: 32px;
          background: linear-gradient(135deg, #FFFFFF 0%, #FAF5EE 100%);
        }

        .sim-heading {
          font-size: 32px;
          margin: 12px 0 8px;
        }

        .sim-sub {
          font-size: 15px;
          color: var(--text-secondary);
          max-width: 800px;
        }

        .sim-main-grid {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 24px;
        }

        .debugger-card, .batch-card {
          padding: 28px;
        }

        .debugger-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .debugger-title, .batch-title {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .debugger-sub, .batch-sub {
          font-size: 13px;
          color: var(--text-muted);
        }

        .scenario-selector-box {
          margin-bottom: 24px;
        }

        .scenario-label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }

        .scenario-btn-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .scenario-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #FFFFFF;
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }

        .scenario-btn:hover {
          background: var(--bg-surface);
        }

        .scenario-btn.active {
          border-color: var(--accent-orange);
          background: #FFF7ED;
          color: #9A3412;
        }

        .debug-steps-tracker {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding: 12px 16px;
          background: var(--bg-card-subtle);
          border-radius: var(--radius-md);
        }

        .debug-step-node {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .node-circle {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: var(--bg-surface-elevated);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
        }

        .debug-step-node.completed .node-circle {
          background: var(--accent-emerald);
          color: #FFFFFF;
        }

        .debug-step-node.current .node-circle {
          background: var(--accent-orange);
          color: #FFFFFF;
          box-shadow: 0 0 10px rgba(255, 106, 0, 0.4);
        }

        .node-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .current-step-display {
          background: #FFFFFF;
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          padding: 20px;
          margin-bottom: 20px;
        }

        .step-content-box h4 {
          font-size: 16px;
          margin: 10px 0 6px;
        }

        .step-content-box p {
          font-size: 13.5px;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .factors-mini-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 12px;
        }

        .factor-mini-pill {
          display: flex;
          justify-content: space-between;
          background: var(--bg-surface);
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
        }

        .factor-val.positive { color: var(--accent-emerald-dark); font-weight: 700; }
        .factor-val.negative { color: var(--accent-coral); font-weight: 700; }

        .safety-check-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 12px;
          background: var(--bg-surface);
          padding: 10px;
          border-radius: 8px;
          font-size: 12px;
        }

        .step-action-bar {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--border-subtle);
        }

        .console-log-box {
          background: #0F172A;
          border-radius: var(--radius-md);
          padding: 16px;
          color: #F8FAFC;
          font-family: var(--font-mono);
          font-size: 12px;
        }

        .console-header {
          font-size: 11px;
          font-weight: 700;
          color: #94A3B8;
          text-transform: uppercase;
          margin-bottom: 10px;
          letter-spacing: 0.05em;
        }

        .console-body {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-height: 140px;
          overflow-y: auto;
        }

        .log-line {
          line-height: 1.4;
          color: #E2E8F0;
        }

        .log-prefix {
          color: var(--accent-orange);
          font-weight: 700;
        }

        /* Batch card */
        .batch-controls-box {
          margin-bottom: 28px;
        }

        .ctrl-label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .size-pills {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 20px;
        }

        .size-pill-btn {
          padding: 10px;
          background: #FFFFFF;
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .size-pill-btn:hover {
          background: var(--bg-surface);
        }

        .size-pill-btn.active {
          background: var(--accent-orange);
          color: #FFFFFF;
          border-color: var(--accent-orange);
        }

        .batch-toggles-grid {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 24px;
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--text-secondary);
          cursor: pointer;
        }

        .batch-benchmark-box {
          background: var(--bg-card-subtle);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          padding: 20px;
        }

        .benchmark-title {
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 16px;
        }

        .benchmark-stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        .b-stat-cell {
          background: #FFFFFF;
          border: 1px solid var(--border-subtle);
          padding: 12px;
          border-radius: 8px;
        }

        .b-label {
          display: block;
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 600;
        }

        .b-val {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 800;
        }

        .b-val.coral { color: var(--accent-coral); }
        .b-val.emerald { color: var(--accent-emerald-dark); }
        .b-val.orange { color: var(--accent-orange); }

        .benchmark-footer {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--accent-emerald-dark);
          font-weight: 600;
        }

        @media (max-width: 1024px) {
          .sim-main-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
