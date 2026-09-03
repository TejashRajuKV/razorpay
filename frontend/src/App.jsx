import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import SimulatorPage from './pages/SimulatorPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AuditPage from './pages/AuditPage';
import apiService from './services/api';
import { 
  INITIAL_METRICS, 
  INITIAL_CASES, 
  INITIAL_AUDIT_LOGS 
} from './data/mockData';
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

  // Application Dynamic State — mock is explicit offline fallback only
  const [metrics, setMetrics] = useState(INITIAL_METRICS);
  const [cases, setCases] = useState(INITIAL_CASES);
  const [selectedCaseId, setSelectedCaseId] = useState('REC-1042');
  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [loadingFromBackend, setLoadingFromBackend] = useState(false);
  const [backendError, setBackendError] = useState(null);

  // Check backend connection on mount
  useEffect(() => {
    const checkBackendConnection = async () => {
      try {
        const health = await apiService.healthCheck();
        setBackendConnected(true);
        console.log('[App] Backend connected:', health);
        
        // Optionally fetch initial data from backend
        await loadInitialDataFromBackend();
      } catch (error) {
        setBackendConnected(false);
        console.warn('[App] Backend not available, using mock data:', error.message);
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
      setBackendError(null);
    } catch (error) {
      console.error('[App] Failed to load data from backend:', error);
      setBackendError('Backend request failed — showing cached demo data');
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

    // Explicit offline demo fallback only (backend disconnected) — clearly marked
    // Local fallback (original mock behavior)
    // Safety checks
    if (actionType === 'STOP_RECOVERY') {
      const updatedCases = cases.map(c => {
        if (c.id === caseId) {
          return {
            ...c,
            status: 'STOPPED',
            guardrails: {
              ...c.guardrails,
              stoppingRuleHit: 'MANUAL_OR_SAFETY_STOP_TRIGGERED',
              status: 'HALTED_BY_SAFETY_POLICY'
            },
            history: [
              ...c.history,
              { timestamp: new Date().toISOString(), actor: 'SAFETY_GUARDRAIL', event: 'Case halted by safety policy' }
            ]
          };
        }
        return c;
      });

      setCases(updatedCases);
      setMetrics(prev => ({
        ...prev,
        stoppedCases: prev.stoppedCases + 1,
        activeCases: Math.max(0, prev.activeCases - 1)
      }));

      // Add to audit log
      const newAudit = {
        id: `AUD-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: new Date().toISOString(),
        caseId: caseId,
        actor: 'SAFETY_GUARDRAIL',
        eventType: 'STOPPING_RULE_TRIGGERED',
        details: `Recovery halted for case ${caseId} by safety policy.`,
        safetyStatus: 'HALTED_PREVENTION',
        recoveryDelta: 0
      };
      setAuditLogs(prev => [newAudit, ...prev]);

      return { stopped: true, reason: 'Case stopped by safety policy' };
    }

    // Normal recovery execution
    const recoveredAmount = targetCase.payment.amount;
    const updatedCases = cases.map(c => {
      if (c.id === caseId) {
        return {
          ...c,
          status: 'RECOVERED',
          recoveredAmount: recoveredAmount,
          guardrails: {
            ...c.guardrails,
            retriesUsed: c.guardrails.retriesUsed + 1,
            status: 'RECOVERED_SUCCESSFULLY'
          },
          history: [
            ...c.history,
            { timestamp: new Date().toISOString(), actor: 'POLICY_ENGINE', event: `Executed ${actionType}` },
            { timestamp: new Date().toISOString(), actor: 'PAYMENT_SIMULATOR', event: `SUCCESS: Settled ₹${recoveredAmount.toLocaleString('en-IN')}` }
          ]
        };
      }
      return c;
    });

    setCases(updatedCases);

    // Update aggregate metrics
    setMetrics(prev => {
      const newRecovered = prev.recoveredRevenue + recoveredAmount;
      const newRate = Number(((newRecovered / prev.revenueAtRisk) * 100).toFixed(1));
      return {
        ...prev,
        recoveredRevenue: newRecovered,
        recoveryRate: Math.min(100, newRate),
        activeCases: Math.max(0, prev.activeCases - 1)
      };
    });

    // Add audit log entry
    const newAudit = {
      id: `AUD-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      caseId: caseId,
      actor: 'AI_RECOVERY_AGENT',
      eventType: 'REVENUE_RECOVERED',
      details: `Executed bounded intervention (${actionType}) on ${targetCase.customer.name}. Payment settled for ₹${recoveredAmount.toLocaleString('en-IN')}.`,
      safetyStatus: 'RECOVERY_CONFIRMED',
      recoveryDelta: recoveredAmount
    };
    setAuditLogs(prev => [newAudit, ...prev]);

    return {
      recovered: true,
      amount: recoveredAmount,
      customerName: targetCase.customer.name
    };
  };

  // Trigger high-volume batch simulation — backend values only, no hardcoded revenue
  const handleTriggerBatch = async () => {
    setIsBatchRunning(true);
    setCurrentView('dashboard');

    if (backendConnected) {
      try {
        const result = await apiService.simulator.runBatchSimulation(50);
        if (result.success) {
          console.log('[App] Batch simulation executed via backend:', result.data);
          const b = result.data || {};
          await refreshFromBackend();
          const batchAudit = {
            id: `AUD-${Math.floor(1000 + Math.random() * 9000)}`,
            timestamp: new Date().toISOString(),
            caseId: 'BATCH-SIM-402',
            actor: 'AI_RECOVERY_AGENT',
            eventType: 'BATCH_SIMULATION_EXECUTED',
            details: `Backend batch: ${b.successful ?? b.totalCases ?? 0} recovered of ${b.totalCases ?? b.totalProcessed ?? 0}, ₹${Number(b.totalRecovered || 0).toLocaleString('en-IN')} recovered.`,
            safetyStatus: 'BATCH_COMPLETED_BOUNDED',
            recoveryDelta: Number(b.totalRecovered || 0)
          };
          setAuditLogs(prev => [batchAudit, ...prev]);
          setIsBatchRunning(false);
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
    
    // Explicit offline demo: no backend, no fake revenue inflation
    setBackendError('Backend unavailable — showing cached demo data (batch not executed)');
    setIsBatchRunning(false);
  };

  // Scenario injection is a frontend-only demo helper (no backend endpoint)
  const handleInjectScenario = async (scenarioKey) => {
    setCurrentView('dashboard');
    if (scenarioKey === 'RAHUL_UPI') {
      setSelectedCaseId('REC-1042');
    } else if (scenarioKey === 'PRIYA_CARD') {
      setSelectedCaseId('REC-1043');
    } else if (scenarioKey === 'VIKRAM_ENTERPRISE') {
      setSelectedCaseId('REC-1045');
    } else if (scenarioKey === 'KUNAL_RISK') {
      setSelectedCaseId('REC-1046');
    }
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
          Offline demo mode — backend disconnected. Showing cached demo data. ML Engine: Fallback / Offline · Model: Local heuristics
        </div>
      )}
      {backendConnected && (
        <div style={{ background: '#ECFDF5', borderBottom: '1px solid #1A1A1A', padding: '6px 20px', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>
          ML Engine: Connected · Model: Local Python
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
            {dashboardTab === 'overview' && (
              <Dashboard 
                metrics={metrics}
                cases={cases}
                selectedCaseId={selectedCaseId}
                setSelectedCaseId={setSelectedCaseId}
                onExecuteRecovery={handleExecuteRecovery}
                onTriggerBatch={handleTriggerBatch}
                isBatchRunning={isBatchRunning}
                onInjectScenario={handleInjectScenario}
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
