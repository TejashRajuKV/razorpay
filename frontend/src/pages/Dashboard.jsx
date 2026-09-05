import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  TrendingUp, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  RefreshCw, 
  Zap, 
  Sparkles, 
  Coins, 
  Layers, 
  PhoneCall, 
  Send, 
  ExternalLink, 
  ChevronRight, 
  User, 
  CreditCard, 
  ShieldAlert, 
  Lock,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Search,
  Filter,
  Eye,
  FileText,
  Building,
  Check,
  XCircle,
  HelpCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { casesAPI } from '../services/api';

function ChannelMessageBox({ caseId }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ch, msg] = await Promise.all([
          casesAPI.getRecoveryChannel(caseId),
          casesAPI.getRecoveryMessage(caseId, 'hinglish'),
        ]);
        if (!cancelled && ch?.success && msg?.success) setData({ channel: ch.data, message: msg.data });
      } catch { /* mock/demo ids have no backend case — hide */ }
    })();
    return () => { cancelled = true; };
  }, [caseId]);
  if (!data) return null;
  return (
    <div className="decision-matrix-box">
      <div className="section-sub-header">
        <Send size={15} color="#8B5CF6" />
        <span>Recommended Channel & Message (simulated, never sent)</span>
      </div>
      <div className="recommended-action-card">
        <div className="rec-action-header">
          <span className="rec-action-name">{data.channel.channel.replace(/_/g, ' ')}</span>
          <span className="badge badge-emerald">{Math.round((data.channel.confidence || 0) * 100)}% confidence</span>
        </div>
        <div className="rec-action-sub">{data.channel.reason}</div>
        <div className="rec-action-sub" style={{ marginTop: 8 }}>
          [{data.message.language}] {data.message.message}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({
  metrics,
  cases,
  selectedCaseId,
  setSelectedCaseId,
  onOpenCase,
  onExecuteRecovery,
  onTriggerBatch,
  isBatchRunning,
  onInjectScenario,
  activeTab,
  setActiveTab
}) {
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const [executionMessage, setExecutionMessage] = useState(null);

  // Selected case
  const activeCase = cases.find(c => c.id === selectedCaseId) || cases[0];

  // Filtered cases
  const filteredCases = cases.filter(c => {
    const matchesSearch = 
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.payment?.method?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      c.diagnosis.rootCause.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'URGENT') return c.payment.amount >= 20000 && c.status !== 'RECOVERED';
    return c.status === filterStatus;
  });

  const formatINR = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const handleRunAction = async (caseId, actionType) => {
    setIsExecutingAction(true);
    setExecutionMessage(`Executing bounded action: ${actionType}...`);
    
    // Simulate slight latency
    await new Promise(r => setTimeout(r, 900));
    
    const result = onExecuteRecovery(caseId, actionType);
    setIsExecutingAction(false);
    
    if (result && result.recovered) {
      setExecutionMessage(`Success! Recovered ${formatINR(result.amount)} from ${result.customerName}`);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } else if (result && result.stopped) {
      setExecutionMessage(`Case halted by safety policy: ${result.reason}`);
    } else {
      setExecutionMessage(`Action completed. Status updated.`);
    }

    setTimeout(() => setExecutionMessage(null), 5000);
  };

  return (
    <div className="dashboard-layout">
      {/* 1. TOP HERO AGENT COMMAND BANNER (Inspired by Image 1 Stage) */}
      <section className="agent-command-stage porcelain-card">
        <div className="command-inner-grid">
          <div className="command-info-side">
            <div className="command-badge-row">
              <span className="badge badge-orange">
                <Bot size={13} />
                <span>Autonomous Agent v2.4</span>
              </span>
              <span className="badge badge-emerald">
                <span className="live-pulse" />
                <span>Continuous Loop Active</span>
              </span>
            </div>

            <h1 className="command-heading">
              Revenue Recovery Command Center
            </h1>

            <p className="command-sub">
              Actively monitoring merchant payment events across UPI, Credit/Debit Cards, Subscriptions, and Checkouts.
            </p>

            {/* Quick Actions Strip */}
            <div className="command-actions-row">
              <button 
                className="btn btn-primary"
                onClick={onTriggerBatch}
                disabled={isBatchRunning}
              >
                {isBatchRunning ? (
                  <>
                    <RefreshCw size={15} className="spin-icon" />
                    <span>Processing Batch (50 Cases)...</span>
                  </>
                ) : (
                  <>
                    <Play size={15} />
                    <span>Run Batch Simulation (50 Cases)</span>
                  </>
                )}
              </button>

              <button 
                className="btn btn-secondary"
                onClick={() => onInjectScenario('RAHUL_UPI')}
              >
                <Zap size={15} color="#FF6A00" />
                <span>Inject ₹25k UPI Failure (REC-1042)</span>
              </button>

              <button 
                className="btn btn-secondary"
                onClick={() => onInjectScenario('VIKRAM_ENTERPRISE')}
              >
                <Building size={15} color="#0066FF" />
                <span>Inject ₹1.45L High Value (REC-1045)</span>
              </button>
            </div>
          </div>

          {/* Autonomous Cycle Visualizer Widget (Image 1 style) */}
          <div className="cycle-visual-card">
            <div className="cycle-card-header">
              <span className="cycle-title">Current Agent State</span>
              <span className="cycle-clock"><Clock size={12} /> Real-time</span>
            </div>

            <div className="cycle-flow-steps">
              <div className="cycle-step active">
                <div className="step-circle green"><Zap size={12} /></div>
                <span className="step-name">Detect</span>
              </div>
              <div className="cycle-connector active" />
              <div className="cycle-step active">
                <div className="step-circle green"><Bot size={12} /></div>
                <span className="step-name">Diagnose</span>
              </div>
              <div className="cycle-connector active" />
              <div className="cycle-step active">
                <div className="step-circle green"><TrendingUp size={12} /></div>
                <span className="step-name">Decide</span>
              </div>
              <div className="cycle-connector active" />
              <div className="cycle-step active">
                <div className="step-circle orange"><ShieldCheck size={12} /></div>
                <span className="step-name">Guardrails</span>
              </div>
              <div className="cycle-connector" />
              <div className="cycle-step">
                <div className="step-circle"><Play size={12} /></div>
                <span className="step-name">Execute</span>
              </div>
            </div>

            <div className="cycle-status-pill">
              <span className="status-highlight">Safety Policy Verified:</span>
              <span>All 6 stopping bounds enforced</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. PORCELAIN KPI METRIC CARDS (Image 1 Bottom Cards Style) */}
      <section className="metrics-grid">
        <div className="porcelain-card metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Monitored</span>
            <div className="metric-icon-box blue"><Coins size={18} /></div>
          </div>
          <div className="metric-value">{formatINR(metrics.totalMonitoredRevenue)}</div>
          <div className="metric-footer">
            <span className="metric-sub">Across 142 payment events</span>
          </div>
        </div>

        <div className="porcelain-card metric-card">
          <div className="metric-header">
            <span className="metric-title">Revenue At Risk</span>
            <div className="metric-icon-box orange"><AlertTriangle size={18} /></div>
          </div>
          <div className="metric-value coral">{formatINR(metrics.revenueAtRisk)}</div>
          <div className="metric-footer">
            <span className="badge badge-coral">{metrics.activeCases} active cases</span>
          </div>
        </div>

        <div className="porcelain-card metric-card metric-highlight-card">
          <div className="metric-header">
            <span className="metric-title">Recovered Cash</span>
            <div className="metric-icon-box emerald"><Sparkles size={18} /></div>
          </div>
          <div className="metric-value emerald">{formatINR(metrics.recoveredRevenue)}</div>
          <div className="metric-footer">
            <span className="badge badge-emerald">
              <TrendingUp size={12} />
              <span>{metrics.recoveryRate}% Recovery Rate</span>
            </span>
          </div>
        </div>

        <div className="porcelain-card metric-card">
          <div className="metric-header">
            <span className="metric-title">Bounded Stopping Halts</span>
            <div className="metric-icon-box amber"><Lock size={18} /></div>
          </div>
          <div className="metric-value">{metrics.stoppedCases}</div>
          <div className="metric-footer">
            <span className="metric-sub">Protected from repeat spam</span>
          </div>
        </div>

        <div className="porcelain-card metric-card">
          <div className="metric-header">
            <span className="metric-title">Human Escalations</span>
            <div className="metric-icon-box purple"><User size={18} /></div>
          </div>
          <div className="metric-value">{metrics.escalatedCases}</div>
          <div className="metric-footer">
            <span className="badge badge-purple">&gt; ₹50k Orders</span>
          </div>
        </div>
      </section>

      {/* Execution Feedback Banner */}
      {executionMessage && (
        <div className="execution-toast-banner porcelain-card">
          <Sparkles size={18} color="#FF6A00" />
          <span>{executionMessage}</span>
        </div>
      )}

      {/* 3. MAIN WORKSPACE: LEFT CASES QUEUE & RIGHT 360° INSPECTOR (Image 1 Style) */}
      <div className="workspace-split">
        {/* Left Column: Live Recovery Cases Hub */}
        <div className="cases-column">
          <div className="cases-panel porcelain-card">
            <div className="panel-header">
              <div className="panel-title-group">
                <h2 className="panel-title">Recovery Queue</h2>
                <span className="badge badge-orange">{filteredCases.length} Cases</span>
              </div>

              {/* Filter Pills */}
              <div className="filter-pill-strip">
                {['ALL', 'URGENT', 'DETECTED', 'ACTION_SCHEDULED', 'RECOVERED', 'ESCALATED', 'STOPPED'].map(status => (
                  <button
                    key={status}
                    className={`filter-pill-btn ${filterStatus === status ? 'active' : ''}`}
                    onClick={() => setFilterStatus(status)}
                  >
                    {status === 'ALL' ? 'All Cases' : status.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="search-box">
              <Search size={16} color="#94A3B8" />
              <input 
                type="text" 
                placeholder="Search by Case ID, Customer Name, Payment Method, Diagnosis..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            {/* Cases List */}
            <div className="cases-list">
              {filteredCases.length === 0 ? (
                <div className="empty-state">
                  <Bot size={36} color="#94A3B8" />
                  <p>No cases matching current filter.</p>
                </div>
              ) : (
                filteredCases.map(item => {
                  const isSelected = item.id === activeCase.id;
                  return (
                    <div 
                      key={item.id}
                      className={`case-row-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedCaseId(item.id)}
                    >
                      <div className="case-row-main">
                        <div className="case-id-group">
                          <span className="case-id-text">{item.id}</span>
                          <span className="case-method-tag">{item.payment?.method}</span>
                          {item.customer.tier === 'VIP_PLATINUM' && (
                            <span className="badge badge-purple">VIP</span>
                          )}
                          {item.customer.tier === 'ENTERPRISE' && (
                            <span className="badge badge-blue">Enterprise</span>
                          )}
                        </div>

                        <div className="case-customer-name">
                          {item.customer.name}
                        </div>

                        <div className="case-diagnosis-desc">
                          {item.diagnosis.friendlyName}
                        </div>
                      </div>

                      <div className="case-row-metrics">
                        <div className="case-amount">
                          {formatINR(item.payment.amount)}
                        </div>

                        <div className="case-prob-badge">
                          <span className="prob-text">{Math.round(item.decision.recoveryProbability * 100)}% Rec. Prob</span>
                        </div>

                        <div className="case-status-badge">
                          {item.status === 'RECOVERED' && (
                            <span className="badge badge-emerald"><Check size={12} /> Recovered</span>
                          )}
                          {item.status === 'DETECTED' && (
                            <span className="badge badge-orange"><Zap size={12} /> Detected</span>
                          )}
                          {item.status === 'ACTION_SCHEDULED' && (
                            <span className="badge badge-blue"><Clock size={12} /> Scheduled</span>
                          )}
                          {item.status === 'ESCALATED' && (
                            <span className="badge badge-purple"><User size={12} /> Escalated</span>
                          )}
                          {item.status === 'STOPPED' && (
                            <span className="badge badge-coral"><XCircle size={12} /> Stopped</span>
                          )}
                        </div>
                      </div>

                      <ChevronRight size={18} color="#94A3B8" className="row-arrow" />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: 360° Inspector & Decision Explainer (Image 1 Mobile Widget Style) */}
        <div className="inspector-column">
          <div className="inspector-card porcelain-card">
            {/* Inspector Top Bar */}
            <div className="inspector-header">
              <div>
                <span className="badge badge-orange">Case Inspector</span>
                <h3 className="inspector-case-id">{activeCase.id}</h3>
              </div>
              <div className="inspector-status-badge">
                {activeCase.status === 'RECOVERED' ? (
                  <span className="badge badge-emerald">Recovered {formatINR(activeCase.recoveredAmount)}</span>
                ) : activeCase.status === 'STOPPED' ? (
                  <span className="badge badge-coral">Halted by Policy</span>
                ) : activeCase.status === 'ESCALATED' ? (
                  <span className="badge badge-purple">Human Approval Needed</span>
                ) : (
                  <span className="badge badge-orange">Action Ready</span>
                )}
                {onOpenCase && (
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => onOpenCase(activeCase.id)}>
                    <Eye size={14} /><span>Open full investigation</span>
                  </button>
                )}
              </div>
            </div>

            {/* Customer & Payment Snapshot */}
            <div className="snapshot-box">
              <div className="snapshot-customer">
                <div className="customer-avatar">
                  {activeCase.customer.name.charAt(0)}
                </div>
                <div className="customer-details">
                  <div className="customer-name-row">
                    <span className="name">{activeCase.customer.name}</span>
                    <span className="tier-tag">{activeCase.customer.tier}</span>
                  </div>
                  <div className="contact-line">{activeCase.customer.email} • {activeCase.customer.phone}</div>
                </div>
              </div>

              <div className="snapshot-stats-row">
                <div className="stat-cell">
                  <span className="s-label">Amount at Risk</span>
                  <span className="s-val coral">{formatINR(activeCase.payment.amount)}</span>
                </div>
                <div className="stat-cell">
                  <span className="s-label">Past Success Rate</span>
                  <span className="s-val emerald">{Math.round(activeCase.customer.historicalSuccessRate * 100)}%</span>
                </div>
                <div className="stat-cell">
                  <span className="s-label">Lifetime Value</span>
                  <span className="s-val">{formatINR(activeCase.customer.lifetimeValue)}</span>
                </div>
              </div>
            </div>

            {/* AI Root-Cause Diagnosis (Local ML Engine) */}
            <div className="diagnosis-box">
              <div className="section-sub-header">
                <Bot size={15} color="#0066FF" />
                <span>AI Root-Cause Diagnosis (Local ML)</span>
                <span className="confidence-pill">{Math.round(activeCase.diagnosis.confidence * 100)}% Confidence</span>
              </div>

              <div className="diagnosis-pill-box">
                <span className="diagnosis-code">{activeCase.diagnosis.rootCause}</span>
                <p className="diagnosis-explanation">{activeCase.diagnosis.description}</p>
              </div>

              {/* Explainable SHAP Attribution Factors */}
              <div className="factors-container">
                <span className="factors-title">Decision Factor Attributions:</span>
                {activeCase.diagnosis.factors.map((factor, idx) => (
                  <div key={idx} className="factor-item">
                    <span className="factor-name">{factor.name}</span>
                    <span className={`factor-impact ${factor.type}`}>
                      {factor.impact}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Recommendation Matrix */}
            <div className="decision-matrix-box">
              <div className="section-sub-header">
                <TrendingUp size={15} color="#8B5CF6" />
                <span>Recommended Recovery Intervention</span>
              </div>

              <div className="recommended-action-card">
                <div className="rec-action-header">
                  <span className="rec-action-name">{activeCase.decision.actionLabel}</span>
                  <span className="badge badge-emerald">
                    {Math.round(activeCase.decision.recoveryProbability * 100)}% Expected Success
                  </span>
                </div>
                <div className="rec-action-sub">
                  Channel: {activeCase.decision.channel.replace(/_/g, ' ')} • Expected Rec: {formatINR(activeCase.decision.expectedRecoveryValue)}
                </div>
              </div>
            </div>

            <ChannelMessageBox caseId={activeCase.id} />

            {/* Safety Guardrails & Stopping Rules Check */}
            <div className="guardrails-box">
              <div className="section-sub-header">
                <ShieldCheck size={15} color="#10B981" />
                <span>Safety Guardrails & Stopping Bounds</span>
              </div>

              <div className="guardrail-checklist">
                <div className="guardrail-row">
                  <span className="g-label">Max Retries Rule (Max 3):</span>
                  <span className="g-val">{activeCase.guardrails.retriesUsed} / {activeCase.guardrails.maxRetriesAllowed} Used</span>
                  <CheckCircle2 size={14} color="#10B981" />
                </div>
                <div className="guardrail-row">
                  <span className="g-label">Cooldown Enforcement:</span>
                  <span className="g-val">{activeCase.guardrails.isCooldownSatisfied ? 'Cooldown Satisfied' : 'Waiting Cooldown'}</span>
                  <CheckCircle2 size={14} color="#10B981" />
                </div>
                <div className="guardrail-row">
                  <span className="g-label">High-Value Gate (&gt; ₹50k):</span>
                  <span className="g-val">{activeCase.payment.amount > 50000 ? 'Human Gate Triggered' : 'Autonomous Allowed'}</span>
                  {activeCase.payment.amount > 50000 ? <AlertTriangle size={14} color="#F59E0B" /> : <CheckCircle2 size={14} color="#10B981" />}
                </div>
              </div>
            </div>

            {/* Interactive Action Triggers */}
            <div className="inspector-actions">
              {activeCase.status === 'RECOVERED' ? (
                <div className="recovered-success-banner">
                  <CheckCircle2 size={20} color="#10B981" />
                  <div>
                    <strong>Successfully Recovered {formatINR(activeCase.recoveredAmount)}</strong>
                    <div className="sub">Settlement confirmed & recorded in audit ledger.</div>
                  </div>
                </div>
              ) : activeCase.status === 'STOPPED' ? (
                <div className="stopped-banner">
                  <Lock size={18} color="#EF4444" />
                  <div>
                    <strong>Recovery Stopped by Safety Guardrail</strong>
                    <div className="sub">{activeCase.guardrails.stoppingRuleHit}</div>
                  </div>
                </div>
              ) : activeCase.status === 'ESCALATED' ? (
                <div className="action-button-group">
                  <button 
                    className="btn btn-primary full-width"
                    onClick={() => handleRunAction(activeCase.id, 'APPROVE_HUMAN_RECOVERY')}
                    disabled={isExecutingAction}
                  >
                    <Check size={16} />
                    <span>Approve High-Value Intervention</span>
                  </button>
                  <button 
                    className="btn btn-secondary full-width"
                    onClick={() => handleRunAction(activeCase.id, 'STOP_RECOVERY')}
                    disabled={isExecutingAction}
                  >
                    <XCircle size={16} color="#EF4444" />
                    <span>Reject & Halt</span>
                  </button>
                </div>
              ) : (
                <div className="action-button-group">
                  <button 
                    className="btn btn-primary btn-lg full-width"
                    onClick={() => handleRunAction(activeCase.id, activeCase.decision.recommendedAction)}
                    disabled={isExecutingAction}
                  >
                    {isExecutingAction ? (
                      <>
                        <RefreshCw size={16} className="spin-icon" />
                        <span>Simulating Bounded Execution...</span>
                      </>
                    ) : (
                      <>
                        <Play size={16} />
                        <span>Execute {activeCase.decision.actionLabel}</span>
                      </>
                    )}
                  </button>
                  <button 
                    className="btn btn-secondary btn-sm full-width"
                    onClick={() => handleRunAction(activeCase.id, 'STOP_RECOVERY')}
                    disabled={isExecutingAction}
                  >
                    <Lock size={14} color="#64748B" />
                    <span>Halt Recovery (Safety Stop)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .dashboard-layout {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* 1. Command Stage */
        .agent-command-stage {
          background: linear-gradient(135deg, #FFFFFF 0%, #FAF5EE 100%);
          padding: 32px;
        }

        .command-inner-grid {
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          gap: 32px;
          align-items: center;
        }

        .command-badge-row {
          display: flex;
          gap: 10px;
          margin-bottom: 12px;
        }

        .command-heading {
          font-size: 28px;
          font-weight: 800;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .command-sub {
          font-size: 14.5px;
          color: var(--text-secondary);
          margin-bottom: 24px;
          max-width: 600px;
        }

        .command-actions-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        /* Cycle visual card (Image 1 style) */
        .cycle-visual-card {
          background: #FFFFFF;
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
          padding: 20px 24px;
          box-shadow: var(--shadow-sm);
        }

        .cycle-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
          margin-bottom: 18px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .cycle-clock {
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--accent-emerald-dark);
        }

        .cycle-flow-steps {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .cycle-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        .step-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--bg-surface-elevated);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          transition: all 0.3s ease;
        }

        .step-circle.green {
          background: var(--accent-emerald-light);
          color: var(--accent-emerald-dark);
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.2);
        }

        .step-circle.orange {
          background: var(--accent-orange-light);
          color: var(--accent-orange);
          box-shadow: 0 0 10px rgba(255, 106, 0, 0.25);
        }

        .step-name {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-secondary);
        }

        .cycle-connector {
          flex: 1;
          height: 2px;
          background: var(--border-subtle);
          margin: 0 4px 18px;
        }

        .cycle-connector.active {
          background: var(--accent-emerald);
        }

        .cycle-status-pill {
          background: var(--bg-card-subtle);
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12px;
          display: flex;
          justify-content: space-between;
          color: var(--text-secondary);
        }

        .status-highlight {
          font-weight: 700;
          color: var(--text-primary);
        }

        /* 2. Metrics Grid */
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
        }

        .metric-card {
          padding: 20px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .metric-highlight-card {
          background: linear-gradient(135deg, #FFFFFF 0%, #F0FDF4 100%);
          border-color: rgba(16, 185, 129, 0.3);
        }

        .metric-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .metric-title {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .metric-icon-box {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .metric-icon-box.blue { background: var(--razorpay-blue-light); color: var(--razorpay-blue); }
        .metric-icon-box.orange { background: var(--accent-orange-light); color: var(--accent-orange); }
        .metric-icon-box.emerald { background: var(--accent-emerald-light); color: var(--accent-emerald-dark); }
        .metric-icon-box.amber { background: var(--accent-amber-light); color: var(--accent-amber); }
        .metric-icon-box.purple { background: var(--accent-purple-light); color: var(--accent-purple); }

        .metric-value {
          font-family: var(--font-display);
          font-size: 24px;
          font-weight: 800;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .metric-value.emerald { color: var(--accent-emerald-dark); }
        .metric-value.coral { color: var(--accent-coral); }

        .metric-sub {
          font-size: 11.5px;
          color: var(--text-muted);
        }

        .execution-toast-banner {
          background: #FFF7ED;
          border: 1px solid var(--accent-orange);
          padding: 12px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 600;
          font-size: 14px;
          color: #9A3412;
          animation: fadeIn 0.3s ease;
        }

        /* 3. Workspace Split */
        .workspace-split {
          display: grid;
          grid-template-columns: 1.25fr 1fr;
          gap: 24px;
          align-items: start;
        }

        .cases-panel {
          padding: 24px;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .panel-title-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .panel-title {
          font-size: 18px;
          font-weight: 700;
        }

        .filter-pill-strip {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .filter-pill-btn {
          border: 1px solid var(--border-subtle);
          background: #FFFFFF;
          padding: 4px 10px;
          border-radius: var(--radius-pill);
          font-size: 11.5px;
          font-weight: 600;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .filter-pill-btn:hover {
          background: var(--bg-surface);
        }

        .filter-pill-btn.active {
          background: var(--accent-orange);
          color: #FFFFFF;
          border-color: var(--accent-orange);
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--bg-surface);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          padding: 10px 14px;
          margin-bottom: 16px;
        }

        .search-input {
          flex: 1;
          border: none;
          background: transparent;
          font-family: var(--font-body);
          font-size: 13.5px;
          color: var(--text-primary);
          outline: none;
        }

        .cases-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 640px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .case-row-card {
          background: #FFFFFF;
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          padding: 14px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .case-row-card:hover {
          border-color: var(--accent-orange);
          transform: translateX(4px);
        }

        .case-row-card.selected {
          border-color: var(--accent-orange);
          background: #FFFBF7;
          box-shadow: 0 4px 16px rgba(255, 106, 0, 0.12);
        }

        .case-row-main {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .case-id-group {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .case-id-text {
          font-family: var(--font-mono);
          font-weight: 700;
          font-size: 13px;
          color: var(--text-primary);
        }

        .case-method-tag {
          font-size: 10.5px;
          background: var(--bg-surface-elevated);
          color: var(--text-secondary);
          padding: 1px 6px;
          border-radius: 4px;
          font-weight: 600;
        }

        .case-customer-name {
          font-weight: 700;
          font-size: 14px;
          color: var(--text-primary);
        }

        .case-diagnosis-desc {
          font-size: 12px;
          color: var(--text-muted);
        }

        .case-row-metrics {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }

        .case-amount {
          font-family: var(--font-mono);
          font-weight: 800;
          font-size: 15px;
          color: var(--text-primary);
        }

        .case-prob-badge {
          font-size: 11px;
          font-weight: 700;
          color: var(--accent-emerald-dark);
        }

        /* Inspector Card (Image 1 Mobile Widget Style) */
        .inspector-card {
          padding: 24px;
          position: sticky;
          top: 80px;
        }

        .inspector-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--border-subtle);
        }

        .inspector-case-id {
          font-family: var(--font-mono);
          font-size: 22px;
          font-weight: 800;
          margin-top: 4px;
        }

        .snapshot-box {
          background: var(--bg-card-subtle);
          border-radius: var(--radius-md);
          padding: 16px;
          margin-bottom: 20px;
        }

        .snapshot-customer {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
        }

        .customer-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--accent-orange);
          color: #FFFFFF;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }

        .customer-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .customer-name-row .name {
          font-weight: 700;
          font-size: 15px;
        }

        .tier-tag {
          font-size: 10.5px;
          font-weight: 700;
          background: #FEF3C7;
          color: #B45309;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .contact-line {
          font-size: 12px;
          color: var(--text-muted);
        }

        .snapshot-stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          padding-top: 12px;
          border-top: 1px dashed var(--border-subtle);
        }

        .stat-cell .s-label {
          display: block;
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 600;
        }

        .stat-cell .s-val {
          font-family: var(--font-mono);
          font-size: 13.5px;
          font-weight: 700;
        }

        .stat-cell .s-val.coral { color: var(--accent-coral); }
        .stat-cell .s-val.emerald { color: var(--accent-emerald-dark); }

        .section-sub-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12.5px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 10px;
        }

        .confidence-pill {
          margin-left: auto;
          font-size: 11px;
          background: var(--razorpay-blue-light);
          color: var(--razorpay-blue);
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 700;
        }

        .diagnosis-box {
          margin-bottom: 20px;
        }

        .diagnosis-pill-box {
          background: #FFFFFF;
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 12px;
        }

        .diagnosis-code {
          display: inline-block;
          font-family: var(--font-mono);
          font-size: 11.5px;
          font-weight: 700;
          color: var(--razorpay-blue);
          margin-bottom: 4px;
        }

        .diagnosis-explanation {
          font-size: 12.5px;
          color: var(--text-secondary);
          line-height: 1.4;
        }

        .factors-container {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .factors-title {
          font-size: 11.5px;
          font-weight: 600;
          color: var(--text-muted);
        }

        .factor-item {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          background: var(--bg-card-subtle);
          padding: 6px 10px;
          border-radius: 6px;
        }

        .factor-impact.positive { color: var(--accent-emerald-dark); font-weight: 700; }
        .factor-impact.negative { color: var(--accent-coral); font-weight: 700; }

        .decision-matrix-box {
          margin-bottom: 20px;
        }

        .recommended-action-card {
          background: linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 8px;
          padding: 12px;
        }

        .rec-action-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .rec-action-name {
          font-weight: 700;
          font-size: 13.5px;
          color: #5B21B6;
        }

        .rec-action-sub {
          font-size: 11.5px;
          color: #6D28D9;
        }

        .guardrails-box {
          margin-bottom: 20px;
        }

        .guardrail-checklist {
          background: #FFFFFF;
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .guardrail-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
        }

        .g-label { color: var(--text-secondary); }
        .g-val { font-weight: 600; color: var(--text-primary); }

        .inspector-actions {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid var(--border-subtle);
        }

        .recovered-success-banner {
          background: var(--accent-emerald-light);
          border: 1px solid var(--accent-emerald);
          color: var(--accent-emerald-dark);
          padding: 14px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13.5px;
        }

        .stopped-banner {
          background: var(--accent-coral-light);
          border: 1px solid var(--accent-coral);
          color: var(--accent-coral);
          padding: 14px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13.5px;
        }

        .action-button-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .full-width {
          width: 100%;
        }

        @media (max-width: 1100px) {
          .command-inner-grid, .workspace-split {
            grid-template-columns: 1fr;
          }
          .metrics-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
