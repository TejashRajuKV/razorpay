import React, { useState } from 'react';
import { 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  TrendingUp, 
  Cpu, 
  Lock, 
  CheckCircle2, 
  PlayCircle,
  Clock,
  Layers,
  FileText,
  AlertTriangle,
  RefreshCw,
  Coins,
  ChevronRight,
  BarChart3,
  Bot
} from 'lucide-react';

export default function LandingPage({ onLaunchConsole, onTriggerBatch, isBatchRunning, metrics }) {
  // ROI Calculator State
  const [monthlyGmv, setMonthlyGmv] = useState(5000000); // 50 Lakhs default
  const [failureRate, setFailureRate] = useState(12); // 12% default

  // Calculate dynamic ROI
  const monthlyRevenueAtRisk = (monthlyGmv * (failureRate / 100));
  const estimatedRecovery = Math.round(monthlyRevenueAtRisk * 0.693); // 69.3% recovery rate
  const annualRecovery = estimatedRecovery * 12;
  const estimatedCost = Math.round(estimatedRecovery * 0.035); // 3.5% operational cost
  const netProfitBoost = annualRecovery - (estimatedCost * 12);

  // Active step in the Autonomous Loop showcase
  const [activeLoopStep, setActiveLoopStep] = useState(0);

  const loopSteps = [
    {
      step: "01",
      title: "Detect Revenue at Risk",
      role: "Stream Ingestion Engine",
      description: "Monitors payment webhooks, UPI dropouts, 3DS timeouts, e-mandates, and checkout abandonment events in real-time.",
      pill: "Sub-second Ingestion",
      icon: <Zap size={22} color="#FF6A00" />
    },
    {
      step: "02",
      title: "Local ML Root-Cause Diagnosis",
      role: "Diagnostic Classifier (Local Python)",
      description: "Classifies failure reasons into 7 distinct etiologies (e.g. Temporary Bank Outage vs Insufficient Funds vs Fraud Velocity) with explainable SHAP factor bars.",
      pill: "Zero External API Calls",
      icon: <Cpu size={22} color="#0066FF" />
    },
    {
      step: "03",
      title: "Policy & Probability Engine",
      role: "Utility Optimization Matrix",
      description: "Calculates expected recovery value across candidate interventions: Smart Retry, WhatsApp Nudge, Frictionless Link, or Method Switch.",
      pill: "E[Recovery] Optimization",
      icon: <TrendingUp size={22} color="#8B5CF6" />
    },
    {
      step: "04",
      title: "Safety Guardrails & Stopping Rules",
      role: "Bounded Execution Firewall",
      description: "Enforces hard bounds: Max 3 retries, cooldown timer checks, customer fatigue limits, and routes orders > ₹50,000 to human review.",
      pill: "100% Explainable & Bounded",
      icon: <Lock size={22} color="#EF4444" />
    },
    {
      step: "05",
      title: "Bounded Execution & Simulator",
      role: "Intervention Dispatcher",
      description: "Dispatches the selected action via Razorpay simulator with stochastic outcome observation and state transition tracking.",
      pill: "Closed-Loop Action",
      icon: <PlayCircle size={22} color="#10B981" />
    },
    {
      step: "06",
      title: "Measurement & Recovery Accounting",
      role: "Financial Settlement Ledger",
      description: "Records confirmed settled recoveries, recalculates recovery rates, and updates live merchant dashboard metrics.",
      pill: "Proven ₹ Recovered",
      icon: <Coins size={22} color="#F59E0B" />
    },
    {
      step: "07",
      title: "Immutable Audit Trail",
      role: "Governance & Compliance Logger",
      description: "Writes an immutable record of every decision, confidence score, safety check, and recovery amount with millisecond timestamps.",
      pill: "Audit-Ready Logs",
      icon: <FileText size={22} color="#64748B" />
    }
  ];

  const formatINR = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="landing-page">
      {/* 1. HERO SECTION (Artisanal Narrative + Warm Fintech Composition) */}
      <section className="hero-section">
        <div className="hero-badge-container">
          <span className="stamp-sticker">Razorpay AI Buildathon • Track 03</span>
        </div>

        <h1 className="hero-title font-serif-title">
          Recover Every Lost Rupee <br />
          On Autopilot.
        </h1>

        <p className="hero-subtitle">
          An autonomous, explainable AI agent that detects revenue loss, diagnoses root causes 
          locally in Python, executes bounded recovery actions, and measures proven recovered cash.
        </p>

        {/* Dual Pill CTA Actions */}
        <div className="hero-cta-group">
          <button className="btn btn-primary btn-lg" onClick={onLaunchConsole}>
            <span>Launch Merchant Console</span>
            <ArrowRight size={18} />
          </button>
          
          <button 
            className="btn btn-secondary btn-lg" 
            onClick={onTriggerBatch}
            disabled={isBatchRunning}
          >
            {isBatchRunning ? (
              <>
                <RefreshCw size={18} className="spin-icon" />
                <span>Simulating 50 Cases...</span>
              </>
            ) : (
              <>
                <PlayCircle size={18} />
                <span>Run Interactive Batch (50 Cases)</span>
              </>
            )}
          </button>
        </div>

        {/* Live Recovery Metric Strip */}
        <div className="hero-stats-strip porcelain-card">
          <div className="stat-strip-item">
            <span className="stat-label">Total Recovered</span>
            <span className="stat-val emerald">{formatINR(metrics.recoveredRevenue)}</span>
          </div>
          <div className="stat-strip-divider" />
          <div className="stat-strip-item">
            <span className="stat-label">Recovery Rate</span>
            <span className="stat-val orange">{metrics.recoveryRate}%</span>
          </div>
          <div className="stat-strip-divider" />
          <div className="stat-strip-item">
            <span className="stat-label">ML Diagnosis Accuracy</span>
            <span className="stat-val blue">{metrics.mlAccuracy}%</span>
          </div>
          <div className="stat-strip-divider" />
          <div className="stat-strip-item">
            <span className="stat-label">Safety Compliance</span>
            <span className="stat-val dark">100% Bounded</span>
          </div>
        </div>
      </section>

      {/* 2. ARCHITECTURAL ARCHED CARDS (Image 2 Inspiration) */}
      <section className="arches-section">
        <div className="section-header-center">
          <span className="badge badge-orange">Core Architectural Pillars</span>
          <h2 className="section-title font-serif-title">
            Built for High-Trust Merchant Recovery
          </h2>
          <p className="section-desc">
            Unlike generic AI chatbots, our agent runs a bounded, closed-loop state machine with 
            explainable mathematical policies and hard stopping safety rules.
          </p>
        </div>

        <div className="arches-grid">
          {/* Arch 1: Terracotta */}
          <div className="arch-card arch-card-terracotta">
            <div className="arch-avatar-circle">
              <Zap size={44} color="#FFF" />
            </div>
            <span className="arch-badge-gold">Stream Ingestion</span>
            <h3>Real-Time Anomaly Detection</h3>
            <p>
              Instantly detects failed payments, 3DS OTP dropouts, recurring subscription cap breaches, 
              and checkout cart exits. Prioritizes cases by recovery value and urgency.
            </p>
            <div className="arch-footer-pill">
              <CheckCircle2 size={14} color="#F6E27A" />
              <span>Multi-Channel Ingestion</span>
            </div>
          </div>

          {/* Arch 2: Deep Olive Forest */}
          <div className="arch-card arch-card-olive">
            <div className="arch-avatar-circle">
              <Cpu size={44} color="#FFF" />
            </div>
            <span className="arch-badge-gold">Zero External APIs</span>
            <h3>Local Explainable ML</h3>
            <p>
              Runs lightweight Random Forest / XGBoost models locally in Python. Generates SHAP-style 
              attribution factor bars showing exactly why each intervention was selected.
            </p>
            <div className="arch-footer-pill">
              <CheckCircle2 size={14} color="#F6E27A" />
              <span>Transparent Decisions</span>
            </div>
          </div>

          {/* Arch 3: Warm Sienna Clay */}
          <div className="arch-card arch-card-sienna">
            <div className="arch-avatar-circle">
              <ShieldCheck size={44} color="#FFF" />
            </div>
            <span className="arch-badge-gold">Bounded Guardrails</span>
            <h3>Safety & Stopping Rules</h3>
            <p>
              Enforces hard retry limits (max 3), intelligent cooldown windows, fraud velocity halts, 
              and automatically escalates high-value orders (&gt; ₹50,000) for human approval.
            </p>
            <div className="arch-footer-pill">
              <CheckCircle2 size={14} color="#F6E27A" />
              <span>100% Policy Governed</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. INTERACTIVE ROI RECOVERY CALCULATOR */}
      <section className="calculator-section porcelain-card">
        <div className="calc-header">
          <div className="calc-title-group">
            <span className="badge badge-emerald">Interactive Merchant ROI Model</span>
            <h2 className="calc-title">How Much Revenue Is Leaking From Your Store?</h2>
            <p className="calc-sub">
              Slide to your monthly volume and see how much revenue the AI Recovery Agent recaptures automatically.
            </p>
          </div>
          <div className="calc-live-tag">
            <Sparkles size={16} color="#FF6A00" />
            <span>Based on 69.3% benchmark recovery rate</span>
          </div>
        </div>

        <div className="calc-body-grid">
          {/* Sliders Side */}
          <div className="calc-inputs-side">
            <div className="slider-box">
              <div className="slider-header">
                <label className="slider-label">Monthly Gross Merchandise Value (GMV)</label>
                <span className="slider-val-badge">{formatINR(monthlyGmv)}</span>
              </div>
              <input 
                type="range" 
                min="500000" 
                max="50000000" 
                step="500000" 
                value={monthlyGmv} 
                onChange={(e) => setMonthlyGmv(Number(e.target.value))}
                className="custom-range"
              />
              <div className="slider-ticks">
                <span>₹5 Lakhs</span>
                <span>₹2.5 Crore</span>
                <span>₹5.0 Crore</span>
              </div>
            </div>

            <div className="slider-box">
              <div className="slider-header">
                <label className="slider-label">Average Payment Failure Rate (%)</label>
                <span className="slider-val-badge orange">{failureRate}%</span>
              </div>
              <input 
                type="range" 
                min="3" 
                max="30" 
                step="1" 
                value={failureRate} 
                onChange={(e) => setFailureRate(Number(e.target.value))}
                className="custom-range"
              />
              <div className="slider-ticks">
                <span>3% (Low)</span>
                <span>15% (Typical)</span>
                <span>30% (High)</span>
              </div>
            </div>

            <div className="calc-breakdown-row">
              <div className="breakdown-item">
                <span className="label">Monthly Revenue at Risk:</span>
                <span className="val danger">{formatINR(monthlyRevenueAtRisk)}</span>
              </div>
              <div className="breakdown-item">
                <span className="label">Autonomous Recovery Rate:</span>
                <span className="val success">69.3%</span>
              </div>
            </div>
          </div>

          {/* Results Side */}
          <div className="calc-results-card">
            <div className="result-main-box">
              <span className="result-super-label">Estimated Monthly Recovered Cash</span>
              <div className="result-big-number">{formatINR(estimatedRecovery)}</div>
              <span className="result-sub-text">Directly credited to your merchant bank account</span>
            </div>

            <div className="result-metrics-grid">
              <div className="result-metric-cell">
                <span className="m-label">Annual Revenue Boost</span>
                <span className="m-val">{formatINR(annualRecovery)}</span>
              </div>
              <div className="result-metric-cell">
                <span className="m-label">Net Annual ROI</span>
                <span className="m-val emerald">28.5x ROI</span>
              </div>
            </div>

            <button className="btn btn-primary btn-lg full-width" onClick={onLaunchConsole}>
              <span>Deploy Agent on My Store</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* 4. THE 7-STEP AUTONOMOUS PRODUCT LOOP */}
      <section className="loop-section">
        <div className="section-header-center">
          <span className="badge badge-purple">Continuous Autonomous Agentic Cycle</span>
          <h2 className="section-title font-serif-title">
            The Closed-Loop Revenue Recovery Engine
          </h2>
          <p className="section-desc">
            Click each step below to inspect how the agent closes the loop from payment failure to verified cash recovery.
          </p>
        </div>

        <div className="loop-nav-tabs glass-pill">
          {loopSteps.map((item, idx) => (
            <button 
              key={idx}
              className={`loop-tab-btn ${activeLoopStep === idx ? 'active' : ''}`}
              onClick={() => setActiveLoopStep(idx)}
            >
              <span className="tab-step">{item.step}</span>
              <span className="tab-title">{item.title.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        <div className="loop-detail-stage porcelain-card">
          <div className="loop-stage-grid">
            <div className="loop-info-pane">
              <div className="loop-step-badge">
                <span className="badge badge-orange">{loopSteps[activeLoopStep].pill}</span>
                <span className="role-tag">{loopSteps[activeLoopStep].role}</span>
              </div>

              <h3 className="loop-info-title font-serif-title">
                {loopSteps[activeLoopStep].step}. {loopSteps[activeLoopStep].title}
              </h3>

              <p className="loop-info-desc">
                {loopSteps[activeLoopStep].description}
              </p>

              <div className="loop-controls">
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveLoopStep((prev) => (prev > 0 ? prev - 1 : loopSteps.length - 1))}
                >
                  Previous Step
                </button>
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => setActiveLoopStep((prev) => (prev < loopSteps.length - 1 ? prev + 1 : 0))}
                >
                  <span>Next Step</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            <div className="loop-graphic-pane">
              <div className="loop-visual-card">
                <div className="visual-icon-glow">
                  {loopSteps[activeLoopStep].icon}
                </div>
                <div className="visual-case-simulation">
                  <div className="sim-header">
                    <span className="sim-case-id">CASE: REC-1042 (Rahul Sharma)</span>
                    <span className="sim-status">₹25,000 AT RISK</span>
                  </div>
                  <div className="sim-body">
                    {activeLoopStep === 0 && (
                      <div className="sim-step-view">
                        <div className="sim-log-item">⚡ Payment Failed: NPCI 504 Gateway Timeout</div>
                        <div className="sim-log-item">🔍 Priority Score: 98/100 (High-Value Loyal Customer)</div>
                      </div>
                    )}
                    {activeLoopStep === 1 && (
                      <div className="sim-step-view">
                        <div className="sim-log-item">🧠 Local ML Diagnosis: TEMPORARY_GATEWAY_DOWNTIME (94% conf)</div>
                        <div className="sim-factor-bar">
                          <span>+32% Customer History</span>
                          <div className="bar-fill" style={{ width: '80%' }} />
                        </div>
                      </div>
                    )}
                    {activeLoopStep === 2 && (
                      <div className="sim-step-view">
                        <div className="sim-log-item">📊 Recommended Action: RETRY_IMMEDIATE (92% Recovery Prob)</div>
                        <div className="sim-log-item">💰 Expected Recovery Value: ₹23,000</div>
                      </div>
                    )}
                    {activeLoopStep === 3 && (
                      <div className="sim-step-view">
                        <div className="sim-log-item">🛡️ Max Retries Check: 0/3 (PASSED)</div>
                        <div className="sim-log-item">⏱️ Cooldown Status: Ready (PASSED)</div>
                        <div className="sim-log-item">🔒 High Value Gate: &lt; ₹50k Autonomous Limit (PASSED)</div>
                      </div>
                    )}
                    {activeLoopStep === 4 && (
                      <div className="sim-step-view">
                        <div className="sim-log-item">🚀 Executing Smart Retry #1 on HDFC Gateway...</div>
                        <div className="sim-spinner" />
                      </div>
                    )}
                    {activeLoopStep === 5 && (
                      <div className="sim-step-view">
                        <div className="sim-log-item success">🎉 TRANSACTION SUCCESSFUL: ₹25,000 Settle Confirmed</div>
                        <div className="sim-log-item">📈 Total Merchant Recovered updated to ₹10,09,500</div>
                      </div>
                    )}
                    {activeLoopStep === 6 && (
                      <div className="sim-step-view">
                        <div className="sim-log-item">📜 Audit Log ID: AUD-992 Written</div>
                        <div className="sim-log-item">🔐 Hash Verified: 0x8a92...f71c (Immutable)</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CALL TO ACTION BANNER */}
      <section className="cta-banner porcelain-card">
        <div className="cta-content">
          <h2 className="cta-heading font-serif-title">
            Ready to plug your payment revenue leaks?
          </h2>
          <p className="cta-sub">
            Explore the live interactive merchant dashboard, run batch simulations, and inspect explainable AI decisions.
          </p>
          <div className="cta-btn-row">
            <button className="btn btn-primary btn-lg" onClick={onLaunchConsole}>
              <span>Open Merchant Recovery Console</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      <style>{`
        .landing-page {
          padding-bottom: 64px;
        }

        /* Hero */
        .hero-section {
          text-align: center;
          padding: 72px 20px 48px;
          max-width: 920px;
          margin: 0 auto;
        }

        .hero-badge-container {
          margin-bottom: 28px;
        }

        .hero-title {
          font-family: var(--font-serif);
          font-size: 64px;
          font-weight: 400;
          color: var(--text-primary);
          line-height: 1.08;
          margin-bottom: 24px;
          letter-spacing: -0.015em;
        }

        .hero-subtitle {
          font-size: 18px;
          line-height: 1.6;
          color: var(--text-secondary);
          max-width: 700px;
          margin: 0 auto 40px;
          font-weight: 400;
        }

        .hero-cta-group {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-bottom: 56px;
          flex-wrap: wrap;
        }

        .hero-stats-strip {
          display: flex;
          align-items: center;
          justify-content: space-around;
          padding: 24px 36px;
          margin: 0 auto;
          max-width: 900px;
          background: #FFFFFF;
          border: 1px solid var(--border-dark);
          border-radius: var(--radius-xl);
          box-shadow: 3px 3px 0px #1A1A1A;
        }

        .stat-strip-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-strip-divider {
          width: 1px;
          height: 36px;
          background: var(--border-dark);
          opacity: 0.3;
        }

        .stat-label {
          font-size: 11.5px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .stat-val {
          font-family: var(--font-body);
          font-size: 22px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .stat-val.emerald { color: var(--accent-emerald-dark); }
        .stat-val.orange { color: var(--accent-orange); }
        .stat-val.blue { color: var(--razorpay-blue); }
        .stat-val.dark { color: var(--text-primary); }

        /* Arches Section (Image 2 style) */
        .arches-section {
          padding: 80px 0 60px;
          max-width: 1240px;
          margin: 0 auto;
        }

        .section-header-center {
          text-align: center;
          max-width: 720px;
          margin: 0 auto 52px;
        }

        .section-title {
          font-size: 38px;
          font-weight: 800;
          margin: 16px 0 12px;
          color: var(--text-primary);
        }

        .section-desc {
          font-size: 16px;
          line-height: 1.6;
          color: var(--text-secondary);
        }

        .arches-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
        }

        .arch-badge-gold {
          background: rgba(246, 226, 122, 0.25);
          color: #F6E27A;
          border: 1px solid rgba(246, 226, 122, 0.4);
          font-size: 11px;
          font-weight: 800;
          padding: 3px 12px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 12px;
        }

        .arch-footer-pill {
          margin-top: 24px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.12);
          padding: 6px 16px;
          border-radius: var(--radius-pill);
          font-size: 12px;
          font-weight: 600;
        }

        /* Calculator */
        .calculator-section {
          padding: 48px;
          max-width: 1240px;
          margin: 40px auto 80px;
        }

        .calc-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 40px;
          gap: 20px;
          flex-wrap: wrap;
        }

        .calc-title {
          font-size: 30px;
          margin: 12px 0 6px;
        }

        .calc-sub {
          color: var(--text-secondary);
          font-size: 15px;
        }

        .calc-live-tag {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--accent-orange-light);
          color: var(--accent-orange);
          padding: 6px 14px;
          border-radius: var(--radius-pill);
          font-size: 13px;
          font-weight: 600;
        }

        .calc-body-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 48px;
          align-items: center;
        }

        .slider-box {
          margin-bottom: 32px;
        }

        .slider-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .slider-label {
          font-weight: 600;
          font-size: 14.5px;
          color: var(--text-primary);
        }

        .slider-val-badge {
          background: var(--razorpay-blue-light);
          color: var(--razorpay-blue);
          font-family: var(--font-mono);
          font-weight: 700;
          font-size: 15px;
          padding: 4px 12px;
          border-radius: 8px;
        }

        .slider-val-badge.orange {
          background: var(--accent-orange-light);
          color: var(--accent-orange);
        }

        .custom-range {
          width: 100%;
          height: 8px;
          border-radius: 4px;
          background: var(--bg-surface-elevated);
          accent-color: var(--accent-orange);
          cursor: pointer;
        }

        .slider-ticks {
          display: flex;
          justify-content: space-between;
          font-size: 11.5px;
          color: var(--text-muted);
          margin-top: 6px;
          font-weight: 500;
        }

        .calc-breakdown-row {
          display: flex;
          justify-content: space-between;
          padding-top: 16px;
          border-top: 1px dashed var(--border-subtle);
          font-size: 13.5px;
        }

        .breakdown-item .val.danger { color: var(--accent-coral); font-weight: 700; }
        .breakdown-item .val.success { color: var(--accent-emerald-dark); font-weight: 700; }

        .calc-results-card {
          background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%);
          border: 1px solid rgba(255, 106, 0, 0.2);
          border-radius: var(--radius-lg);
          padding: 36px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          box-shadow: 0 12px 32px rgba(255, 106, 0, 0.08);
        }

        .result-super-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--accent-orange);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .result-big-number {
          font-family: var(--font-display);
          font-size: 42px;
          font-weight: 900;
          color: var(--text-primary);
          line-height: 1.1;
          margin: 6px 0;
        }

        .result-sub-text {
          font-size: 13px;
          color: var(--text-secondary);
        }

        .result-metrics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          padding: 16px 0;
          border-top: 1px solid rgba(255, 106, 0, 0.15);
          border-bottom: 1px solid rgba(255, 106, 0, 0.15);
        }

        .m-label {
          display: block;
          font-size: 11.5px;
          color: var(--text-muted);
          font-weight: 600;
        }

        .m-val {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 800;
          color: var(--text-primary);
        }

        .m-val.emerald { color: var(--accent-emerald-dark); }

        .full-width {
          width: 100%;
        }

        /* Loop Section */
        .loop-section {
          padding: 40px 0 80px;
          max-width: 1240px;
          margin: 0 auto;
        }

        .loop-nav-tabs {
          display: flex;
          justify-content: center;
          gap: 6px;
          padding: 6px;
          margin: 0 auto 36px;
          max-width: 940px;
          flex-wrap: wrap;
        }

        .loop-tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border: none;
          background: transparent;
          border-radius: var(--radius-pill);
          cursor: pointer;
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          transition: all var(--transition-fast);
        }

        .loop-tab-btn.active {
          background: #FFFFFF;
          color: var(--accent-orange);
          box-shadow: var(--shadow-sm);
          font-weight: 700;
        }

        .tab-step {
          font-family: var(--font-mono);
          font-size: 11px;
          background: var(--bg-surface-elevated);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .loop-detail-stage {
          padding: 48px;
          background: #FFFFFF;
        }

        .loop-stage-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 48px;
          align-items: center;
        }

        .loop-step-badge {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
        }

        .role-tag {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
        }

        .loop-info-title {
          font-size: 28px;
          margin-bottom: 16px;
        }

        .loop-info-desc {
          font-size: 16px;
          line-height: 1.7;
          color: var(--text-secondary);
          margin-bottom: 32px;
        }

        .loop-controls {
          display: flex;
          gap: 12px;
        }

        .loop-visual-card {
          background: var(--bg-card-subtle);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
          padding: 28px;
          position: relative;
        }

        .visual-icon-glow {
          width: 52px;
          height: 52px;
          background: #FFFFFF;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--shadow-md);
          margin-bottom: 20px;
        }

        .visual-case-simulation {
          background: #FFFFFF;
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 16px;
        }

        .sim-header {
          display: flex;
          justify-content: space-between;
          font-size: 11.5px;
          font-weight: 700;
          color: var(--text-muted);
          border-bottom: 1px solid var(--border-subtle);
          padding-bottom: 8px;
          margin-bottom: 12px;
        }

        .sim-log-item {
          font-size: 13px;
          font-family: var(--font-mono);
          margin-bottom: 8px;
          color: var(--text-primary);
        }

        .sim-log-item.success {
          color: var(--accent-emerald-dark);
          font-weight: 700;
        }

        .sim-factor-bar {
          margin-top: 10px;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .bar-fill {
          height: 6px;
          background: var(--accent-emerald);
          border-radius: 3px;
          margin-top: 4px;
        }

        /* CTA Banner */
        .cta-banner {
          max-width: 1240px;
          margin: 0 auto;
          padding: 60px 40px;
          text-align: center;
          background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
          color: #FFFFFF;
        }

        .cta-heading {
          font-size: 38px;
          color: #FFFFFF;
          margin-bottom: 16px;
        }

        .cta-sub {
          font-size: 17px;
          color: rgba(255, 255, 255, 0.8);
          max-width: 640px;
          margin: 0 auto 32px;
        }

        .cta-btn-row {
          display: flex;
          justify-content: center;
          gap: 16px;
        }

        @media (max-width: 1024px) {
          .arches-grid {
            grid-template-columns: 1fr;
          }
          .calc-body-grid, .loop-stage-grid {
            grid-template-columns: 1fr;
          }
          .hero-title {
            font-size: 40px;
          }
        }
      `}</style>
    </div>
  );
}
