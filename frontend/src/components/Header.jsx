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
          background: #FFFEFA;
          border-bottom: 1px solid #1A1A1A;
          padding: 14px 28px;
        }

        .header-inner {
          max-width: 1280px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .brand-group {
          display: flex;
          align-items: center;
          gap: 10px;
          user-select: none;
        }

        .logo-badge {
          width: 38px;
          height: 38px;
          background: #111110;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          box-shadow: none;
        }

        .brand-titles {
          display: flex;
          flex-direction: column;
        }

        .brand-name {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 15px;
          line-height: 1.1;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #111110;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .brand-ai {
          background: none;
          -webkit-text-fill-color: #111110;
          font-weight: 400;
        }

        .brand-subtitle {
          font-size: 10.5px;
          font-weight: 500;
          color: #7A7A72;
          letter-spacing: 0.04em;
        }

        .mode-nav {
          display: flex;
          align-items: center;
          padding: 3px;
          gap: 2px;
          background: #fff;
          border: 1px solid #E9E1CC;
          border-radius: 999px;
          box-shadow: none;
        }

        .nav-mode-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 16px;
          font-weight: 600;
          font-size: 12.5px;
          color: #4E4E48;
          background: transparent;
          border: none;
          border-radius: 999px;
          cursor: pointer;
        }

        .nav-mode-btn.active {
          background: #111110;
          color: #fff;
          font-weight: 700;
        }

        .live-counter-pill {
          background: var(--teal);
          color: #111110;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 7px;
          border-radius: 999px;
          text-transform: uppercase;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .agent-status-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 600;
          color: #111110;
          background: #fff;
          border: 1px solid #E9E1CC;
          border-radius: 999px;
        }

        .accuracy-tag {
          font-size: 11px;
          font-weight: 700;
          color: #111110;
          background: var(--teal);
          padding: 2px 8px;
          border-radius: 999px;
        }
        .header-actions .btn {
          background: var(--teal);
          color: #111110;
          border: 1.5px solid #111110;
          border-radius: 999px;
          box-shadow: 2.5px 2.5px 0px #111110;
          font-weight: 700;
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
