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
          background: rgba(251, 247, 240, 0.88);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--border-subtle);
          padding: 12px 32px;
          transition: all 0.3s ease;
        }

        .header-inner {
          max-width: 1440px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .brand-group {
          display: flex;
          align-items: center;
          gap: 12px;
          user-select: none;
        }

        .logo-badge {
          width: 42px;
          height: 42px;
          background: linear-gradient(135deg, #FF7A1A 0%, #FF5500 100%);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          box-shadow: var(--shadow-glow-orange);
        }

        .brand-titles {
          display: flex;
          flex-direction: column;
        }

        .brand-name {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 17px;
          line-height: 1.15;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .brand-ai {
          background: linear-gradient(135deg, #FF6A00 0%, #0066FF 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .brand-subtitle {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          letter-spacing: 0.02em;
        }

        .mode-nav {
          display: flex;
          align-items: center;
          padding: 4px;
          gap: 4px;
          box-shadow: var(--shadow-sm);
        }

        .nav-mode-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 13.5px;
          color: var(--text-secondary);
          background: transparent;
          border: none;
          border-radius: var(--radius-pill);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .nav-mode-btn:hover {
          color: var(--text-primary);
          background: rgba(0, 0, 0, 0.03);
        }

        .nav-mode-btn.active {
          background: #FFFFFF;
          color: var(--accent-orange);
          box-shadow: 0 4px 12px rgba(120, 90, 50, 0.08);
          font-weight: 700;
        }

        .live-counter-pill {
          background: var(--accent-emerald-light);
          color: var(--accent-emerald-dark);
          font-size: 10px;
          font-weight: 800;
          padding: 2px 7px;
          border-radius: 999px;
          text-transform: uppercase;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .agent-status-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .accuracy-tag {
          font-size: 11px;
          font-weight: 700;
          color: var(--accent-emerald-dark);
          background: var(--accent-emerald-light);
          padding: 2px 6px;
          border-radius: 6px;
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
