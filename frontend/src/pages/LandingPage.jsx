import React, { useState, useRef, useEffect } from 'react';
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
  Bot,
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  Maximize2
} from 'lucide-react';

import Footer from '../components/Footer';
import { casesAPI, auditAPI } from '../services/api';
export default function LandingPage({ onLaunchConsole, onTriggerBatch, isBatchRunning, metrics, cases = [] }) {
  // Live showcase case: highest amount at risk from real backend data (never hardcoded)
  const showcaseCase = (Array.isArray(cases) && cases.length > 0)
    ? [...cases].sort((a, b) => (
      (Number(b.amount_at_risk ?? b.payment?.amount ?? 0) || 0) -
      (Number(a.amount_at_risk ?? a.payment?.amount ?? 0) || 0)
    ))[0]
    : null;
  const [showcaseDecision, setShowcaseDecision] = useState(null);
  const [showcaseAudit, setShowcaseAudit] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setShowcaseDecision(null);
    setShowcaseAudit(null);
    if (!showcaseCase?.id) return undefined;
    (async () => {
      try {
        const preview = await casesAPI.getDecisionPreview(showcaseCase.id).catch(() => null);
        const trail = await auditAPI.getAuditTrail(showcaseCase.id).catch(() => null);
        if (!cancelled) {
          if (preview?.success) setShowcaseDecision(preview.data);
          if (trail?.success) setShowcaseAudit(trail.data);
        }
      } catch { /* showcase panel falls back to row-level case data */ }
    })();
    return () => { cancelled = true; };
  }, [showcaseCase?.id]);
  // Video Player State
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleRestart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      } else if (videoRef.current.webkitRequestFullscreen) {
        videoRef.current.webkitRequestFullscreen();
      }
    }
  };

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
          <span className="hero-highlight">On Autopilot.</span>
        </h1>

        <p className="hero-subtitle">
          An autonomous, explainable AI agent that detects revenue loss, diagnoses root causes 
          locally in Python, executes bounded recovery actions, and measures proven recovered cash.
        </p>

        {/* Dual Pill CTA Actions */}
        <div className="hero-cta-group">
          <button className="btn btn-primary btn-lg custom-mint-pill" onClick={onLaunchConsole}>
            <span>Launch Merchant Console</span>
            <ArrowRight size={18} />
          </button>
          
          <button 
            className="btn btn-secondary btn-lg custom-parchment-pill" 
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
                <PlayCircle size={18} color="#FF6A00" />
                <span>Run Interactive Batch (50 Cases)</span>
              </>
            )}
          </button>
        </div>

        {/* --- HERO VIDEO SHOWCASE CONTAINER (ROBOT PUTTING SIMULATOR) --- */}
        <div className="hero-video-showcase-container porcelain-card">
          {/* Video Player Frame */}
          <div className="video-player-wrapper">
            <video
              ref={videoRef}
              src="/i_want_it_like_a_robot_putting.mp4"
              className="hero-video-element"
              autoPlay
              loop
              muted={isMuted}
              playsInline
              onClick={togglePlay}
            />

            {/* Center Big Play Button (shown when paused) */}
            {!isPlaying && (
              <button className="video-center-play-btn" onClick={togglePlay} aria-label="Play Video">
                <Play size={36} color="#FFFFFF" />
              </button>
            )}

          </div>
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
            <span className="stat-val">100% Bounded</span>
          </div>
        </div>
      </section>

      {/* 2. PATHWAYS EDITORIAL SECTION (light storytelling, ref-inspired) */}
      <section className="pathways-section">
        <div className="pathways-header">
          <span className="pathways-eyebrow">Core Architectural Pillars</span>
          <h2 className="pathways-title font-serif-title">
            Built for High-Trust Merchant Recovery
          </h2>
          <p className="pathways-sub">
            Unlike generic AI chatbots, our agent runs a bounded, closed-loop state machine with{' '}
            <u>explainable policies</u>, <u>local diagnosis</u>, and <u>hard safety rules</u>.
          </p>
        </div>

        {/* Row 01 */}
        <div className="pathway-row">
          <div className="pathway-visual visual-mint">
            <video
              src="/something_realsitic_robot_like.mp4"
              className="pathway-video"
              autoPlay
              loop
              muted
              playsInline
            />
            <span className="pathway-visual-caption overlay">Live ingestion • webhooks • UPI • 3DS</span>
            <span className="pathway-visual-num">01</span>
          </div>
          <div className="pathway-copy">
            <span className="pathway-step">01 — Stream Ingestion</span>
            <h3 className="font-serif-title">Real-Time Anomaly Detection</h3>
            <p>
              Instantly detects failed payments, 3DS OTP dropouts, recurring subscription cap breaches,
              and checkout cart exits. Prioritizes cases by recovery value and urgency.
            </p>
            <ul className="pathway-points">
              <li><CheckCircle2 size={14} /> Multi-channel webhooks</li>
              <li><CheckCircle2 size={14} /> Value-based prioritization</li>
            </ul>
            <button className="pathway-btn" onClick={onLaunchConsole}>Learn more</button>
          </div>
        </div>

        <div className="pathway-dotted" aria-hidden="true" />

        {/* Row 02 */}
        <div className="pathway-row reverse">
          <div className="pathway-visual visual-sand">
            <img
              src="/o-jibo1210.gif"
              className="pathway-video"
              alt="ML robot illustration"
            />
            <span className="pathway-visual-caption overlay">Random Forest • XGBoost • SHAP bars</span>
            <span className="pathway-visual-num">02</span>
          </div>
          <div className="pathway-copy">
            <span className="pathway-step">02 — Zero External APIs</span>
            <h3 className="font-serif-title">Local Explainable ML</h3>
            <p>
              Runs lightweight Random Forest / XGBoost models locally in Python. Generates SHAP-style
              attribution factor bars showing exactly why each intervention was selected.
            </p>
            <ul className="pathway-points">
              <li><CheckCircle2 size={14} /> 100% local inference</li>
              <li><CheckCircle2 size={14} /> Transparent factor bars</li>
            </ul>
            <button className="pathway-btn" onClick={onLaunchConsole}>Learn more</button>
          </div>
        </div>

        <div className="pathway-dotted flip" aria-hidden="true" />

        {/* Row 03 */}
        <div className="pathway-row">
          <div className="pathway-visual visual-blush">
            <img
              src="/62304854b77261b257b64f25cc7b7fa2.gif"
              className="pathway-video"
              alt="Safety guardrails illustration"
            />
            <span className="pathway-visual-caption overlay">Max 3 retries • cooldowns • &gt;₹50k review</span>
            <span className="pathway-visual-num">03</span>
          </div>
          <div className="pathway-copy">
            <span className="pathway-step">03 — Bounded Guardrails</span>
            <h3 className="font-serif-title">Safety &amp; Stopping Rules</h3>
            <p>
              Enforces hard retry limits (max 3), intelligent cooldown windows, fraud velocity halts,
              and automatically escalates high-value orders (&gt; ₹50,000) for human approval.
            </p>
            <ul className="pathway-points">
              <li><CheckCircle2 size={14} /> 100% policy governed</li>
              <li><CheckCircle2 size={14} /> Human escalation path</li>
            </ul>
            <button className="pathway-btn" onClick={onLaunchConsole}>Learn more</button>
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
                  {(() => {
                    if (!showcaseCase) {
                      return (
                        <div className="sim-body">
                          <div className="sim-step-view">
                            <div className="sim-log-item">No live case data — connect the backend to walk a real recovery loop here.</div>
                          </div>
                        </div>
                      );
                    }
                    const scAmount = Number(showcaseCase.amount_at_risk ?? showcaseCase.payment?.amount ?? 0) || 0;
                    const scName = showcaseCase.customer_name || showcaseCase.customer?.name || '—';
                    const scReason = showcaseCase.failure_reason || 'unknown';
                    const scPriority = showcaseCase.priority_score ?? showcaseCase.priorityScore;
                    const scDiag = showcaseDecision?.diagnosis?.diagnosis
                      || (typeof showcaseCase.diagnosis === 'string' ? showcaseCase.diagnosis : showcaseCase.diagnosis?.rootCause)
                      || 'unknown';
                    const scConf = showcaseDecision?.diagnosis?.confidence ?? showcaseCase.diagnosis_confidence ?? null;
                    const scDecision = showcaseDecision?.decision || {};
                    const scAction = scDecision.action || showcaseCase.recommended_action || 'pending assessment';
                    const scProb = scDecision.probability;
                    const scExpected = scDecision.expectedRecovery;
                    const scGate = scAmount > 50000 ? 'Human Gate Triggered (> ₹50k)' : '< ₹50k Autonomous Limit';
                    const scEscalated = scDecision.guardrails?.humanEscalation ? ' (escalated to human review)' : '';
                    const scEvents = showcaseAudit?.events || [];
                    const scLatest = scEvents[scEvents.length - 1];
                    return (<>
                  <div className="sim-header">
                    <span className="sim-case-id">CASE: {String(showcaseCase.id).slice(0, 8)} ({scName})</span>
                    <span className="sim-status">{formatINR(scAmount)} AT RISK</span>
                  </div>
                  <div className="sim-body">
                    {activeLoopStep === 0 && (
                      <div className="sim-step-view">
                        <div className="sim-log-item">⚡ Payment Failed: {String(scReason).replace(/_/g, ' ')}</div>
                        <div className="sim-log-item">🔍 Priority Score: {scPriority != null ? `${Math.round(Number(scPriority) * 100)}/100` : '—'}</div>
                      </div>
                    )}
                    {activeLoopStep === 1 && (
                      <div className="sim-step-view">
                        <div className="sim-log-item">🧠 Local ML Diagnosis: {String(scDiag).toUpperCase()}{scConf != null ? ` (${Math.round(Number(scConf) * 100)}% conf)` : ''}</div>
                        <div className="sim-log-item">Live case data from backend — no demo fixture.</div>
                      </div>
                    )}
                    {activeLoopStep === 2 && (
                      <div className="sim-step-view">
                        <div className="sim-log-item">📊 Recommended Action: {String(scAction).replace(/_/g, ' ').toUpperCase()}{scProb != null ? ` (${Math.round(Number(scProb) * 100)}% Recovery Prob)` : ''}</div>
                        <div className="sim-log-item">💰 Expected Recovery Value: {scExpected != null ? formatINR(Number(scExpected)) : '—'}</div>
                      </div>
                    )}
                    {activeLoopStep === 3 && (
                      <div className="sim-step-view">
                        <div className="sim-log-item">🛡️ Backend-enforced bounds: max 3 retries, cooldown windows</div>
                        <div className="sim-log-item">🔒 High Value Gate: {scGate}{scEscalated}</div>
                      </div>
                    )}
                    {activeLoopStep === 4 && (
                      <div className="sim-step-view">
                        <div className="sim-log-item">🚀 Dispatching: {String(scAction).replace(/_/g, ' ')} — executed via backend simulator, never silently.</div>
                        <div className="sim-spinner" />
                      </div>
                    )}
                    {activeLoopStep === 5 && (
                      <div className="sim-step-view">
                        <div className="sim-log-item">Case status: {(showcaseCase.status || 'open').toUpperCase()}</div>
                        <div className="sim-log-item">📈 Total Merchant Recovered: {formatINR(metrics.recoveredRevenue || 0)} (live)</div>
                      </div>
                    )}
                    {activeLoopStep === 6 && (
                      <div className="sim-step-view">
                        <div className="sim-log-item">📜 Audit events for this case: {showcaseAudit?.totalEvents ?? scEvents.length}</div>
                        <div className="sim-log-item">{scLatest ? `Latest: ${scLatest.eventType || scLatest.event_type}` : 'Every decision writes to the audit trail.'}</div>
                      </div>
                    )}
                  </div>
                    </>);
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer onLaunchConsole={onLaunchConsole} />

      <style>{`
        .landing-page {
          padding-bottom: 0;
          background: #FFFEFA;
        }

        /* Hero — ref: cream, serif, stamp badge, teal pills */
        .hero-section {
          text-align: center;
          padding: 72px 0 0;
          max-width: none;
          width: 100%;
          margin: 0 auto;
          background: #FFFEFA;
        }
        .hero-badge-container, .hero-title, .hero-subtitle, .hero-cta-group {
          max-width: 900px;
          margin-left: auto;
          margin-right: auto;
          padding-left: 20px;
          padding-right: 20px;
        }
        .hero-badge-container { margin-bottom: 26px; }
        .hero-title, .hero-subtitle, .hero-cta-group { position: relative; z-index: 2; }

        .hero-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(42px, 6vw, 68px);
          font-weight: 500;
          color: #111110;
          line-height: 1.06;
          letter-spacing: -0.02em;
          margin-bottom: 18px;
        }

        .hero-highlight {
          background: none;
          -webkit-text-fill-color: #111110;
          font-style: italic;
          font-weight: 500;
        }

        .hero-subtitle {
          font-size: 17px;
          line-height: 1.65;
          color: #4E4E48;
          max-width: 660px;
          margin: 0 auto 32px;
        }

        .hero-cta-group {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          margin-bottom: 0 !important;
          padding-bottom: 0 !important;
          flex-wrap: wrap;
        }
        .hero-cta-group .btn {
          border: 1.5px solid #111110;
          border-radius: 999px;
          box-shadow: 3px 3px 0px #111110;
          font-weight: 700;
        }
        .hero-cta-group .btn-primary { background: #7ED6C0; color: #111110; }
        .hero-cta-group .btn-secondary { background: #fff; color: #111110; }

        .hero-stats-strip {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 36px;
          padding: 18px 32px;
          margin: 0 auto;
          max-width: none;
          background: #FFFEFA;
          border-top: 1px solid #EFE7D5;
          border-bottom: 1px solid #EFE7D5;
          border-radius: 0;
          box-shadow: none;
        }

        .stat-strip-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-strip-divider {
          width: 1px;
          height: 36px;
          background: var(--border-subtle);
        }

        .stat-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .stat-val {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 800;
          color: var(--text-primary);
        }

        .stat-val { color: #111110; }
        .stat-val.emerald, .stat-val.orange, .stat-val.blue { color: #111110; }

        /* Generic section header — ref serif */
        .section-header-center { text-align: center; max-width: 720px; margin: 0 auto 48px; }
        .section-title { font-family: 'Playfair Display', Georgia, serif; font-size: 38px; font-weight: 500; margin: 16px 0 12px; color: #111110; letter-spacing: -0.02em; }
        .section-desc { font-size: 15.5px; line-height: 1.65; color: #4E4E48; }

        /* Pathways editorial (ref-inspired light storytelling) */
        .pathways-section {
          background: #FFFEFA;
          border-top: 1px solid #EFE7D8;
          border-bottom: 1px solid #EFE7D8;
          padding: 72px 24px 84px;
          margin: 56px 0 0;
        }
        .pathways-header {
          text-align: center;
          max-width: 760px;
          margin: 0 auto 64px;
        }
        .pathways-eyebrow {
          display: inline-block;
          font-size: 12.5px;
          font-weight: 700;
          color: #C2540A;
          background: #FFF3E8;
          border: 1px solid #F5DCC3;
          padding: 5px 16px;
          border-radius: 999px;
          margin-bottom: 18px;
        }
        .pathways-title {
          font-size: clamp(32px, 4.5vw, 50px);
          line-height: 1.08;
          font-weight: 500;
          color: #111;
          margin: 0 0 16px;
          letter-spacing: -0.02em;
        }
        .pathways-sub {
          font-size: 16px;
          line-height: 1.65;
          color: #4A4A44;
          margin: 0 auto;
          max-width: 640px;
        }
        .pathways-sub u { text-decoration-thickness: 1px; text-underline-offset: 3px; }
        .pathway-row {
          max-width: 1060px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 64px;
          align-items: center;
        }
        .pathway-row.reverse > .pathway-visual { order: 2; }
        .pathway-row.reverse > .pathway-copy { order: 1; text-align: left; }
        .pathway-visual {
          position: relative;
          min-height: 320px;
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          overflow: hidden;
          border: 1px solid rgba(0,0,0,0.06);
        }
        .visual-mint { background: linear-gradient(180deg, #EAF6EF 0%, #FDFEFB 78%); }
        .visual-sand { background: linear-gradient(180deg, #F5EDD9 0%, #FFFEFA 78%); }
        .visual-blush { background: linear-gradient(180deg, #F9E8DD 0%, #FFFEFA 78%); }
        .pathway-sketch-ring {
          position: absolute;
          inset: 22px;
          border: 1.5px dashed rgba(0,0,0,0.18);
          border-radius: 4px;
          pointer-events: none;
        }
        .pathway-visual-caption {
          font-size: 12px;
          font-weight: 600;
          color: #6B6B64;
          background: rgba(255,255,255,0.8);
          padding: 4px 12px;
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,0.08);
        }
        .pathway-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .pathway-visual-caption.overlay {
          position: absolute;
          bottom: 14px;
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          z-index: 2;
        }
        .pathway-visual-num { z-index: 2; }
        .pathway-visual-num {
          position: absolute;
          bottom: 8px;
          right: 16px;
          font-family: var(--font-serif);
          font-size: 64px;
          line-height: 1;
          color: rgba(0,0,0,0.07);
          font-weight: 700;
        }
        .pathway-copy h3 {
          font-size: 30px;
          line-height: 1.15;
          font-weight: 500;
          color: #111;
          margin: 10px 0 12px;
        }
        .pathway-step {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #1A1A1A;
        }
        .pathway-copy p {
          font-size: 14.5px;
          line-height: 1.7;
          color: #4E4E48;
          margin: 0 0 16px;
          max-width: 440px;
        }
        .pathway-points {
          list-style: none;
          padding: 0;
          margin: 0 0 20px;
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          font-size: 13px;
          font-weight: 600;
          color: #2B2B27;
        }
        .pathway-points li { display: flex; align-items: center; gap: 6px; }
        .pathway-btn {
          background: #7ED6C0;
          color: #111;
          border: 1.5px solid #111;
          border-radius: 999px;
          padding: 8px 22px;
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 2.5px 2.5px 0px #111;
          transition: all 0.15s ease;
        }
        .pathway-btn:hover { transform: translate(-1px,-1px); box-shadow: 3.5px 3.5px 0px #111; }
        .pathway-dotted {
          max-width: 1060px;
          margin: 8px auto;
          height: 70px;
          background-image: radial-gradient(#111 1.2px, transparent 1.3px);
          background-size: 14px 14px;
          background-repeat: no-repeat;
          background-position: 22% center;
          mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='70'%3E%3Cpath d='M 60 10 Q 120 65 300 45' fill='none' stroke='black' stroke-width='2' stroke-dasharray='5 7'/%3E%3C/svg%3E");
          -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='70'%3E%3Cpath d='M 60 10 Q 120 65 300 45' fill='none' stroke='black' stroke-width='2' stroke-dasharray='5 7'/%3E%3C/svg%3E");
          mask-repeat: no-repeat;
          mask-position: 22% center;
          opacity: 0.7;
        }
        .pathway-dotted.flip {
          mask-position: 68% center;
          background-position: 68% center;
          transform: scaleX(-1);
        }
        @media (max-width: 860px) {
          .pathway-row { grid-template-columns: 1fr; gap: 24px; }
          .pathway-row.reverse > .pathway-visual { order: 1; }
          .pathway-row.reverse > .pathway-copy { order: 2; }
          .pathway-dotted { display: none; }
          .pathway-copy p { max-width: none; }
        }

        /* Calculator — ref paper card */
        .calculator-section {
          padding: 48px;
          max-width: 1080px;
          margin: 64px auto 72px;
          background: #FFFFFF;
          border: 1px solid #1A1A1A;
          border-radius: 16px;
          box-shadow: none;
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
          font-family: 'Playfair Display', Georgia, serif;
          font-weight: 500;
          font-size: 34px;
          margin: 12px 0 6px;
          color: #111110;
          letter-spacing: -0.02em;
        }

        .calc-sub {
          color: #4E4E48;
          font-size: 14.5px;
        }

        .calc-live-tag {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #FFF6E9;
          color: #9A4A12;
          border: 1px solid #F0DCC3;
          padding: 6px 14px;
          border-radius: var(--radius-pill);
          font-size: 12.5px;
          font-weight: 700;
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
          background: #111110;
          color: #fff;
          font-weight: 700;
          font-size: 13px;
          padding: 4px 12px;
          border-radius: 999px;
        }

        .slider-val-badge.orange {
          background: #7ED6C0;
          color: #111110;
          border: 1px solid #111110;
        }

        .custom-range {
          width: 100%;
          height: 8px;
          border-radius: 4px;
          background: #EFE7D5;
          accent-color: #111110;
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

        .breakdown-item .val.danger, .breakdown-item .val.success { color: #111110; font-weight: 700; }

        .calc-results-card {
          background: #FAF5E9;
          border: 1px solid #E9E1CC;
          border-radius: 12px;
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          box-shadow: none;
        }

        .result-super-label {
          font-size: 11px;
          font-weight: 800;
          color: #7A7A72;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .result-big-number {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 42px;
          font-weight: 500;
          color: #111110;
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
          border-top: 1px solid #1A1A1A;
          border-bottom: 1px solid #E9E1CC;
        }

        .m-label {
          display: block;
          font-size: 11.5px;
          color: var(--text-muted);
          font-weight: 600;
        }

        .m-val {
          font-size: 18px;
          font-weight: 800;
          color: #111110;
        }

        .m-val.emerald { color: #111110; }

        .full-width {
          width: 100%;
        }

        /* Loop Section — ref */
        .loop-section {
          padding: 64px 24px 72px;
          max-width: 1080px;
          margin: 0 auto;
        }

        .loop-nav-tabs {
          display: flex;
          justify-content: center;
          gap: 6px;
          background: #fff;
          border: 1px solid #E9E1CC;
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
          background: #1E293B;
          color: #F8FAFC;
          box-shadow: none;
          font-weight: 700;
        }
        .loop-tab-btn.active .tab-step {
          background: #F3ECDB;
          color: #1E293B;
        }

        .tab-step {
          font-size: 11px;
          background: #F3ECDB;
          color: #1E293B;
          padding: 2px 6px;
          border-radius: 999px;
        }

        .loop-detail-stage {
          padding: 40px;
          background: #FFFFFF;
          border: 1px solid #1A1A1A;
          border-radius: 16px;
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
          font-family: 'Playfair Display', Georgia, serif;
          font-weight: 500;
          font-size: 30px;
          margin-bottom: 14px;
          color: #111110;
        }

        .loop-info-desc {
          font-size: 14.5px;
          line-height: 1.7;
          color: #4E4E48;
          margin-bottom: 28px;
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
          color: #111110;
          font-weight: 700;
        }

        .sim-factor-bar {
          margin-top: 10px;
          font-size: 12px;
          color: #4E4E48;
        }

        .bar-fill {
          height: 6px;
          background: #111110;
          border-radius: 3px;
          margin-top: 4px;
        }

        /* CTA Banner — ref sand card */
        .cta-banner {
          max-width: 1080px;
          margin: 0 auto 72px;
          padding: 56px 40px;
          text-align: center;
          background: #FAF0D3;
          color: #111110;
          border: 1px solid #E9E1CC;
          border-radius: 16px;
        }

        .cta-heading {
          font-family: 'Playfair Display', Georgia, serif;
          font-weight: 500;
          font-size: 40px;
          color: #111110;
          margin-bottom: 14px;
        }

        .cta-sub {
          font-size: 15px;
          color: #4E4E48;
          max-width: 600px;
          margin: 0 auto 28px;
        }

        .cta-btn-row {
          display: flex;
          justify-content: center;
          gap: 16px;
        }

        /* Custom Pills — ref teal */
        .custom-mint-pill {
          background: #7ED6C0 !important;
          color: #111110 !important;
          border: 1.5px solid #111110 !important;
          box-shadow: 3px 3px 0px #111110 !important;
          border-radius: 9999px !important;
          font-weight: 700 !important;
        }

        .custom-mint-pill:hover {
          background: #5FC6AD !important;
          transform: translate(-1px, -1px);
          box-shadow: 4px 4px 0px #111110 !important;
        }

        .custom-parchment-pill {
          background: #FFFFFF !important;
          color: #111110 !important;
          border: 1.5px solid #111110 !important;
          box-shadow: 3px 3px 0px #111110 !important;
          border-radius: 9999px !important;
          font-weight: 700 !important;
        }

        .custom-parchment-pill:hover {
          background: #FFFEFA !important;
          transform: translate(-1px, -1px);
          box-shadow: 4px 4px 0px #111110 !important;
        }

        /* Hero Video — full-bleed edge-to-edge, no cream bleed */
        .hero-video-showcase-container {
          width: 100vw;
          max-width: none;
          margin: 0 0 0 50%;
          transform: translateX(-50%);
          border-radius: 0;
          overflow: hidden;
          background: #000000;
          border: none;
          box-shadow: none;
        }

        .video-showcase-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 24px;
          background: rgba(251, 247, 240, 0.95);
          border-bottom: 1px solid var(--border-subtle);
        }

        .video-title-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .video-badge-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: var(--accent-orange);
          box-shadow: 0 0 10px var(--accent-orange);
          animation: pulse 1.8s infinite;
        }

        .video-showcase-title {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 14px;
          color: var(--text-primary);
        }

        .video-status-badges {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pulse-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent-emerald-dark);
          margin-right: 4px;
          animation: pulse 1.5s infinite;
        }

        .video-player-wrapper {
          position: relative;
          width: 100%;
          height: 82vh;
          min-height: 560px;
          max-height: 860px;
          background: #000000;
          display: block;
          overflow: hidden;
        }
        .hero-video-element {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          cursor: pointer;
          display: block;
        }

        .video-floating-badge {
          position: absolute;
          top: 18px;
          left: 20px;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.8);
          border-radius: 999px;
          font-size: 12.5px;
          font-weight: 700;
          color: var(--text-primary);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        }

        .video-center-play-btn {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 12;
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: rgba(255, 106, 0, 0.9);
          border: 3px solid #FFFFFF;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 12px 36px rgba(255, 106, 0, 0.5);
          transition: transform 0.2s ease, background 0.2s ease;
        }

        .video-center-play-btn:hover {
          transform: translate(-50%, -50%) scale(1.1);
          background: #FF6A00;
        }

        /* Floating Widget Box (Inspired by Reference Image "Chat with Angie") */
        .video-floating-widget {
          position: absolute;
          bottom: 20px;
          right: 20px;
          z-index: 10;
          width: 260px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-radius: 18px;
          border: 1px solid rgba(226, 214, 196, 0.9);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.16);
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: transform 0.25s ease;
        }

        .video-floating-widget:hover {
          transform: translateY(-4px);
        }

        .widget-avatar-box {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: var(--accent-orange-light);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 2px;
        }

        .widget-label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--accent-orange);
        }

        .widget-heading {
          font-family: var(--font-serif);
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .widget-sub {
          font-size: 11.5px;
          color: var(--text-muted);
          line-height: 1.35;
          margin-bottom: 6px;
        }

        .widget-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          padding: 8px 12px;
          background: #10B981;
          color: #FFFFFF;
          border: 1.5px solid #047857;
          border-radius: 999px;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
          transition: all 0.2s ease;
        }

        .widget-btn:hover {
          background: #059669;
          transform: translateY(-1px);
        }

        /* Control Bar Overlay */
        .video-controls-bar {
          position: absolute;
          bottom: 18px;
          left: 20px;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          background: rgba(15, 23, 42, 0.82);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 999px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }

        .video-ctrl-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.12);
          border: none;
          color: #FFFFFF;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s ease, transform 0.15s ease;
        }

        .video-ctrl-btn:hover {
          background: rgba(255, 255, 255, 0.25);
          transform: scale(1.08);
        }

        .video-ctrl-divider {
          width: 1px;
          height: 18px;
          background: rgba(255, 255, 255, 0.2);
          margin: 0 2px;
        }

        .video-ctrl-label {
          font-size: 11.5px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          padding: 0 6px;
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
          .video-floating-widget {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
