import React from 'react';
import { 
  Bot, 
  Sparkles, 
  ShieldCheck, 
  Activity, 
  LayoutDashboard, 
  Compass, 
  PlayCircle,
  Bell,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

export default function Header({ 
  currentView, 
  setCurrentView, 
  metrics, 
  onTriggerBatch, 
  isBatchRunning 
}) {
  return (
    <header className="site-header">
      <div className="header-inner">
        {/* Brand Logo & Tag */}
        <div className="brand-group" onClick={() => setCurrentView('landing')} style={{ cursor: 'pointer' }}>
          <div className="logo-badge">
            <Bot size={22} color="#FFFFFF" strokeWidth={2.5} />
            <div className="logo-glow" />
          </div>
          <div className="brand-titles">
            <div className="brand-name">
              <span>Razorpay</span>
              <span className="brand-ai">AI Recovery</span>
            </div>
            <div className="brand-subtitle">
              <span>Track 03 • Autonomous Revenue Agent</span>
            </div>
          </div>
        </div>

        {/* Center Mode Switcher (Landing Page vs Merchant Console) */}
        <nav className="mode-nav glass-pill">
          <button 
            className={`nav-mode-btn ${currentView === 'landing' ? 'active' : ''}`}
            onClick={() => setCurrentView('landing')}
          >
            <Compass size={16} />
            <span>Product Showcase</span>
          </button>
          <button 
            className={`nav-mode-btn ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            <LayoutDashboard size={16} />
            <span>Merchant Console</span>
            <span className="live-counter-pill">Live</span>
          </button>
        </nav>

        {/* Right Status Indicator & Quick Batch Action */}
        <div className="header-actions">
          {/* Live Agent Health Pill */}
          <div className="agent-status-pill glass-pill" title="AI Autonomous Recovery Loop Active">
            <span className="live-pulse" />
            <span className="status-text">Agent Active</span>
            <span className="accuracy-tag">{metrics.mlAccuracy}% Acc</span>
          </div>

          {/* Quick Simulation Batch Action */}
          <button 
            className="btn btn-primary btn-sm"
            onClick={onTriggerBatch}
            disabled={isBatchRunning}
          >
            {isBatchRunning ? (
              <>
                <RefreshCw size={14} className="spin-icon" />
                <span>Simulating...</span>
              </>
            ) : (
              <>
                <PlayCircle size={15} />
                <span>Run Batch (50 Cases)</span>
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        .site-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(250, 246, 240, 0.92);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(26, 26, 26, 0.08);
          padding: 16px 40px;
          transition: all 0.3s ease;
        }

        .header-inner {
          max-width: 1320px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }

        .brand-group {
          display: flex;
          align-items: center;
          gap: 12px;
          user-select: none;
        }

        .logo-badge {
          width: 38px;
          height: 38px;
          background: #1A1A1A;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 2px 2px 0px #60C9AD;
        }

        .brand-titles {
          display: flex;
          flex-direction: column;
        }

        .brand-name {
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 16px;
          line-height: 1.15;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .brand-ai {
          font-family: var(--font-serif);
          font-weight: 400;
          font-size: 18px;
          color: var(--text-primary);
          font-style: italic;
        }

        .brand-subtitle {
          font-size: 11px;
          font-weight: 500;
          color: var(--text-muted);
          letter-spacing: 0.02em;
        }

        .mode-nav {
          display: flex;
          align-items: center;
          padding: 3px;
          gap: 4px;
          background: #FFFFFF;
          border: 1px solid var(--border-dark);
          border-radius: var(--radius-pill);
          box-shadow: 2px 2px 0px #1A1A1A;
        }

        .nav-mode-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 18px;
          font-family: var(--font-body);
          font-weight: 600;
          font-size: 13px;
          color: var(--text-secondary);
          background: transparent;
          border: 1px solid transparent;
          border-radius: var(--radius-pill);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .nav-mode-btn:hover {
          color: var(--text-primary);
          background: rgba(0, 0, 0, 0.04);
        }

        .nav-mode-btn.active {
          background: var(--accent-mint);
          color: var(--text-primary);
          border-color: var(--border-dark);
          box-shadow: 1.5px 1.5px 0px #1A1A1A;
          font-weight: 600;
        }

        .live-counter-pill {
          background: #FFFFFF;
          color: var(--text-primary);
          border: 1px solid var(--border-dark);
          font-size: 9.5px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 999px;
          text-transform: uppercase;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .agent-status-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
          background: #FFFFFF;
          border: 1px solid var(--border-dark);
          border-radius: var(--radius-pill);
          box-shadow: 2px 2px 0px #1A1A1A;
        }

        .accuracy-tag {
          font-size: 11px;
          font-weight: 600;
          color: var(--accent-emerald-dark);
          background: var(--accent-emerald-light);
          padding: 1px 6px;
          border-radius: 4px;
          border: 1px solid rgba(26,26,26,0.2);
        }

        .spin-icon {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 900px) {
          .site-header {
            padding: 12px 16px;
          }
          .brand-subtitle, .accuracy-tag {
            display: none;
          }
          .nav-mode-btn span:not(.live-counter-pill) {
            display: none;
          }
        }
      `}</style>
    </header>
  );
}
