import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import CaseDetail from './pages/CaseDetail';
import { resolveScenarioCase } from './services/scenarios';
import SimulatorPage from './pages/SimulatorPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AuditPage from './pages/AuditPage';
import apiService from './services/api';

// Empty initial state — backend is the sole data source.
// No mock rows are ever presented as live data (audit Bug #4).
const EMPTY_METRICS = {
  totalMonitoredRevenue: 0,
  revenueAtRisk: 0,
  recoveredRevenue: 0,
  recoveryRate: 0,
  casesProcessed: 0,
  activeCases: 0,
  stoppedCases: 0,
  escalatedCases: 0,
  avgRecoveryTimeMinutes: 0
};
import { 
  LayoutDashboard, 
  Cpu, 
  BarChart3, 
  ShieldCheck, 
  Sparkles,
  Layers,
  ArrowRight,
  Bot
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function App() {
  // Main view: 'landing' or 'dashboard'
  const [currentView, setCurrentView] = useState('landing');
  
  // Dashboard Sub-navigation: 'overview', 'simulator', 'analytics', 'audit'
  const [dashboardTab, setDashboardTab] = useState('overview');

  // Application Dynamic State — backend is authoritative; empty until loaded
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [investigatingCaseId, setInvestigatingCaseId] = useState(null);
  const [alertFocusIds, setAlertFocusIds] = useState(null);
  const [topAlert, setTopAlert] = useState(null);

  // From a leakage alert: show only the affected cases in the recovery queue
  const handleViewAlertCases = (caseIds) => {
    setAlertFocusIds(Array.isArray(caseIds) ? caseIds : []);
    setCurrentView('dashboard');
    setDashboardTab('overview');
    window.location.hash = '#/';
  };
  const [auditLogs, setAuditLogs] = useState([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [loadingFromBackend, setLoadingFromBackend] = useState(false);
  const [backendError, setBackendError] = useState(null);

  // Deep-link support: #/cases/:id opens the investigation page,
  // browser back/forward works via hashchange (no router dependency)
  useEffect(() => {
    const syncHashToCase = () => {
      const match = (window.location.hash || '').match(/^#\/cases\/([\w-]+)/);
      if (match) {
        setSelectedCaseId(match[1]);
        setInvestigatingCaseId(match[1]);
        setCurrentView('dashboard');
        setDashboardTab('overview');
      } else {
        setInvestigatingCaseId(null);
      }
    };
    syncHashToCase();
    window.addEventListener('hashchange', syncHashToCase);
    return () => window.removeEventListener('hashchange', syncHashToCase);
  }, []);

  // Check backend connection on mount
  useEffect(() => {
    const checkBackendConnection = async () => {
      try {
        const health = await apiService.healthCheck();
        setBackendConnected(true);
        console.log('[App] Backend connected:', health);
        
        // Optionally fetch initial data from backend
        await loadInitialDataFromBackend();
        // Settle overdue promises globally so MISSED fires without anyone reading records
        apiService.simulator.checkOverduePromises().catch(() => {});
      } catch (error) {
        setBackendConnected(false);
        setBackendError('Backend unavailable — start the server. No data is shown.');
        console.warn('[App] Backend not available, showing no data:', error.message);
      }
    };

    checkBackendConnection();
  }, []);

  // Load initial data from backend API
  const loadInitialDataFromBackend = async () => {
    setLoadingFromBackend(true);
    try {
      // Fetch dashboard overview
      const overviewRes = await apiService.dashboard.getOverview();
      if (overviewRes.success && overviewRes.data) {
        setMetrics(prev => ({
          ...prev,
          totalMonitoredRevenue: overviewRes.data.totalRevenue || prev.totalMonitoredRevenue,
          revenueAtRisk: overviewRes.data.revenueAtRisk || prev.revenueAtRisk,
          recoveredRevenue: overviewRes.data.recoveredRevenue || prev.recoveredRevenue,
          recoveryRate: parseFloat(overviewRes.data.recoveryRate) || prev.recoveryRate,
          activeCases: overviewRes.data.casesAtRisk || prev.activeCases,
        }));
      }

      // Fetch cases — backend: { success, data: { cases, count } }
      const casesRes = await apiService.cases.getAllCases();
      if (casesRes.success && casesRes.data?.cases && Array.isArray(casesRes.data.cases)) {
        setCases(casesRes.data.cases);
      }

      // Fetch audit logs — backend: { success, data: { logs, count } }
      const auditRes = await apiService.audit.getLogs();
      if (auditRes.success && auditRes.data) {
        const logs = Array.isArray(auditRes.data) ? auditRes.data : (auditRes.data.logs || []);
        setAuditLogs(logs);
      }

      // Top leakage alert for the dashboard incident pill (uses caseIds it already carries)
      try {
        const alertRes = await apiService.analytics.getAlerts();
        const list = alertRes?.success ? (alertRes.data?.alerts || []) : [];
        setTopAlert(list.find((a) => Array.isArray(a.caseIds) && a.caseIds.length > 0) || list[0] || null);
      } catch { /* incident pill stays hidden without backend data */ }

      // Recoverable revenue (measured per-diagnosis resolution rates)
      try {
        const recRes = await apiService.analytics.getRecoverable();
        if (recRes?.success && recRes.data) {
          setMetrics(prev => ({
            ...prev,
            recoverableRevenue: recRes.data.recoverable || 0,
            recoverableShare: recRes.data.shareOfAtRisk || 0,
          }));
        }
      } catch { /* recoverable card stays at zero without backend data */ }

      // Live ML train/test metrics (Python service) — shown only when actually evaluated
      try {
        const mlRes = await apiService.analytics.getMLMetrics();
        if (mlRes?.success && mlRes.data?.available && mlRes.data.mlAccuracy != null) {
          setMetrics(prev => ({
            ...prev,
            mlAccuracy: mlRes.data.mlAccuracy,
            mlF1Score: mlRes.data.mlF1Score,
            mlRocAuc: mlRes.data.mlRocAuc,
          }));
        }
      } catch { /* ML metrics stay hidden until a real evaluation exposes them */ }

      setBackendError(null);
    } catch (error) {
      console.error('[App] Failed to load data from backend:', error);
      setBackendError('Backend request failed — showing no data.');
    } finally {
      setLoadingFromBackend(false);
    }
  };

  // Refresh dashboard + case + audit from backend after an action (prevents drift from SQL)
  const refreshFromBackend = async (caseId) => {
    try {
      const [overviewRes, casesRes] = await Promise.all([
        apiService.dashboard.getOverview(),
        apiService.cases.getAllCases(),
      ]);
      if (overviewRes?.success && overviewRes.data) {
        setMetrics(prev => ({
          ...prev,
          totalMonitoredRevenue: overviewRes.data.totalRevenue ?? prev.totalMonitoredRevenue,
          revenueAtRisk: overviewRes.data.revenueAtRisk ?? prev.revenueAtRisk,
          recoveredRevenue: overviewRes.data.recoveredRevenue ?? prev.recoveredRevenue,
          recoveryRate: parseFloat(overviewRes.data.recoveryRate) || prev.recoveryRate,
          activeCases: overviewRes.data.casesAtRisk ?? prev.activeCases,
        }));
      }
      if (casesRes?.success && Array.isArray(casesRes.data?.cases)) {
        setCases(casesRes.data.cases);
      }
      if (caseId) {
        try {
          const trail = await apiService.audit.getAuditTrail(caseId);
          if (trail?.success && trail.data) {
            const logs = await apiService.audit.getLogs();
            const list = Array.isArray(logs?.data) ? logs.data : (logs?.data?.logs || null);
            if (list) setAuditLogs(list);
          }
        } catch { /* audit refresh is best-effort */ }
      }
    } catch (e) {
      console.warn('[App] refreshFromBackend failed:', e.message);
    }
  };

  // Execute a bounded recovery action on a case (with optional backend sync)
  const handleExecuteRecovery = async (caseId, actionType) => {
    const targetCase = cases.find(c => c.id === caseId);
    if (!targetCase) return null;

    // Connected flow: backend simulator is source of truth — trust its result
    if (backendConnected) {
      try {
        const apiResult = await apiService.recovery.executeAction(caseId, actionType);
        const payload = apiResult?.data || {};
        if (apiResult.success) {
          console.log('[App] Recovery action executed via backend:', payload);
          if (payload.blocked) {
            setBackendError(`Action blocked: ${payload.reason || 'safety rule'}`);
            await refreshFromBackend(caseId);
            return { stopped: true, blocked: true, reason: payload.reason || 'Blocked by safety policy' };
          }
          if (actionType === 'STOP_RECOVERY') {
            await refreshFromBackend(caseId);
            return { stopped: true, reason: 'Case stopped by safety policy' };
          }
          // Trust backend simulator: success → actual recoveredAmount, failure → show failure
          const recoveredAmount = Number(payload.recoveredAmount || 0);
          const ok = payload.success !== false && recoveredAmount > 0;
          await refreshFromBackend(caseId);
          if (!ok) {
            setBackendError(`Action executed but not recovered (${payload.message || 'simulator failure'})`);
            return { recovered: false, amount: 0, message: payload.message };
          }
          return {
            recovered: true,
            amount: recoveredAmount,
            customerName: targetCase.customer?.name
          };
        }
      } catch (error) {
        console.error('[App] Backend recovery failed:', error.message);
        setBackendError(`Backend request failed — ${error.message}`);
        throw error;
      }
    }

    // Backend disconnected — refuse instead of fabricating a recovery outcome
    if (!backendConnected) {
      const msg = 'Backend unavailable — action not executed. No data was changed.';
      setBackendError(msg);
      return { recovered: false, stopped: false, blocked: true, reason: msg };
    }
    // Backend gave no usable result — never fabricate recovery outcomes or audit entries
    const noResult = 'Backend did not return a result — no action recorded, no data changed.';
    setBackendError(noResult);
    return { recovered: false, amount: 0, message: noResult };
  };

  // Trigger batch recovery on REAL cases — outcomes persist to the DB via POST /recovery/run-batch
  const handleTriggerBatch = async () => {
    setIsBatchRunning(true);
    setCurrentView('dashboard');

    if (backendConnected) {
      try {
        const result = await apiService.simulator.runBatch({ limit: 50 });
        if (result.success) {
          console.log('[App] Batch recovery executed via backend:', result.data);
          const b = result.data || {};
          await refreshFromBackend();
          setBackendError(null);
          confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 } });
          return;
        }
        throw new Error(result?.error || 'Batch failed');
      } catch (error) {
        console.error('[App] Backend batch simulation failed:', error.message);
        setBackendError(`Backend request failed — ${error.message}`);
        setIsBatchRunning(false);
        return;
      }
    }
    
    // Explicit offline: no backend, nothing executed, no data shown
    setBackendError('Backend unavailable — batch not executed. No data is shown.');
    setIsBatchRunning(false);
  };

  // Scenario injection is a frontend-only demo helper (no backend endpoint):
  // it selects a real loaded backend case matching the scenario's intent.
  const handleInjectScenario = async (scenarioKey) => {
    setCurrentView('dashboard');
    const target = resolveScenarioCase(scenarioKey, cases);
    if (!target) {
      setBackendError(`No loaded backend case matches scenario ${scenarioKey} — nothing selected.`);
      return;
    }
    setSelectedCaseId(target.id);
  };

  return (
    <div className="app-container">
      {/* Top Universal Navigation */}
      <Header
        currentView={currentView}
        setCurrentView={setCurrentView}
        metrics={metrics}
        onTriggerBatch={handleTriggerBatch}
        isBatchRunning={isBatchRunning}
      />
      {!backendConnected && (
        <div style={{ background: '#FEF3C7', borderBottom: '1px solid #1A1A1A', padding: '8px 20px', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>
          ⚠ BACKEND OFFLINE — no data is shown. Start the backend server to load live recovery data.
        </div>
      )}
      {backendConnected && (
        <div style={{ background: '#ECFDF5', borderBottom: '1px solid #1A1A1A', padding: '6px 20px', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>
          ● LIVE BACKEND — sandbox financial environment: simulated recovery runs do not move real money · ML Engine: Local Python
        </div>
      )}
      {backendError && (
        <div style={{ background: '#FEE2E2', borderBottom: '1px solid #1A1A1A', padding: '8px 20px', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>
          {backendError} <button onClick={() => setBackendError(null)} style={{ marginLeft: 12, fontWeight: 800 }}>Dismiss</button>
        </div>
      )}

      <main className="main-content">
        {currentView === 'landing' ? (
          <LandingPage
            onLaunchConsole={() => setCurrentView('dashboard')}
            onTriggerBatch={handleTriggerBatch}
            isBatchRunning={isBatchRunning}
            metrics={metrics}
            cases={cases}
          />
        ) : (
          <div className="merchant-console-layout">
            {/* Dashboard Sub-Navigation Tabs */}
            <div className="console-nav-strip glass-pill">
              <button 
                className={`console-tab-btn ${dashboardTab === 'overview' ? 'active' : ''}`}
                onClick={() => setDashboardTab('overview')}
              >
                <LayoutDashboard size={15} />
                <span>Command Overview & Cases</span>
              </button>

              <button 
                className={`console-tab-btn ${dashboardTab === 'simulator' ? 'active' : ''}`}
                onClick={() => setDashboardTab('simulator')}
              >
                <Cpu size={15} />
                <span>Interactive Simulator & Batch Engine</span>
              </button>

              <button 
                className={`console-tab-btn ${dashboardTab === 'analytics' ? 'active' : ''}`}
                onClick={() => setDashboardTab('analytics')}
              >
                <BarChart3 size={15} />
                <span>ML & Recovery Analytics</span>
              </button>

              <button 
                className={`console-tab-btn ${dashboardTab === 'audit' ? 'active' : ''}`}
                onClick={() => setDashboardTab('audit')}
              >
                <ShieldCheck size={15} />
                <span>Governance & Audit Logs</span>
              </button>
            </div>

            {/* View Switching inside Console */}
            {dashboardTab === 'overview' && investigatingCaseId && (
              <CaseDetail
                caseId={investigatingCaseId}
                onBack={() => { window.location.hash = '#/'; }}
                onExecuteRecovery={handleExecuteRecovery}
              />
            )}
            {dashboardTab === 'overview' && !investigatingCaseId && (
              <Dashboard
                metrics={metrics}
                cases={cases}
                selectedCaseId={selectedCaseId}
                setSelectedCaseId={setSelectedCaseId}
                onOpenCase={(id) => { window.location.hash = `#/cases/${id}`; }}
                onExecuteRecovery={handleExecuteRecovery}
                onTriggerBatch={handleTriggerBatch}
                isBatchRunning={isBatchRunning}
                onInjectScenario={handleInjectScenario}
                focusIds={alertFocusIds}
                onClearFocus={() => setAlertFocusIds(null)}
                incidentAlert={topAlert}
                onInvestigateAlert={() => topAlert && handleViewAlertCases(topAlert.caseIds || [])}
              />
            )}

            {dashboardTab === 'simulator' && (
              <SimulatorPage 
                metrics={metrics}
                cases={cases}
                onTriggerBatch={handleTriggerBatch}
                isBatchRunning={isBatchRunning}
                onInjectScenario={handleInjectScenario}
                onExecuteRecovery={handleExecuteRecovery}
              />
            )}

            {dashboardTab === 'analytics' && (
              <AnalyticsPage
                metrics={metrics}
                onViewAlertCases={handleViewAlertCases}
                onGoSimulator={() => { setCurrentView('dashboard'); setDashboardTab('simulator'); }}
              />
            )}

            {dashboardTab === 'audit' && (
              <AuditPage 
                auditLogs={auditLogs}
              />
            )}
          </div>
        )}
      </main>

      <style>{`
        .merchant-console-layout {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .console-nav-strip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px;
          max-width: 860px;
          margin: 0 auto;
          box-shadow: var(--shadow-sm);
        }

        .console-tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          background: transparent;
          border: none;
          border-radius: var(--radius-pill);
          font-family: var(--font-display);
          font-size: 13.5px;
          font-weight: 600;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .console-tab-btn:hover {
          color: var(--text-primary);
          background: rgba(0, 0, 0, 0.03);
        }

        .console-tab-btn.active {
          background: #FFFFFF;
          color: var(--accent-orange);
          box-shadow: 0 4px 12px rgba(120, 90, 50, 0.08);
          font-weight: 700;
        }

        @media (max-width: 900px) {
          .console-nav-strip {
            flex-wrap: wrap;
            border-radius: var(--radius-lg);
          }
          .console-tab-btn {
            font-size: 12px;
            padding: 6px 12px;
          }
        }
      `}</style>
    </div>
  );
}
