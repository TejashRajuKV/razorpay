import React, { useState } from 'react';
import Header from './components/Header';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import SimulatorPage from './pages/SimulatorPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AuditPage from './pages/AuditPage';
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

  // Application Dynamic State
  const [metrics, setMetrics] = useState(INITIAL_METRICS);
  const [cases, setCases] = useState(INITIAL_CASES);
  const [selectedCaseId, setSelectedCaseId] = useState('REC-1042');
  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  // Execute a bounded recovery action on a case
  const handleExecuteRecovery = (caseId, actionType) => {
    const targetCase = cases.find(c => c.id === caseId);
    if (!targetCase) return null;

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

  // Trigger high-volume batch simulation
  const handleTriggerBatch = async () => {
    setIsBatchRunning(true);
    setCurrentView('dashboard');
    
    // Simulate batch execution delay
    await new Promise(r => setTimeout(r, 2200));

    const simulatedAddedRevenue = 325000;
    const addedCases = 50;
    const recoveredBatchCases = 36;

    setMetrics(prev => {
      const newTotal = prev.totalMonitoredRevenue + 1200000;
      const newAtRisk = prev.revenueAtRisk + 480000;
      const newRecovered = prev.recoveredRevenue + simulatedAddedRevenue;
      const newRate = Number(((newRecovered / newAtRisk) * 100).toFixed(1));

      return {
        ...prev,
        totalMonitoredRevenue: newTotal,
        revenueAtRisk: newAtRisk,
        recoveredRevenue: newRecovered,
        recoveryRate: newRate,
        casesProcessed: prev.casesProcessed + addedCases,
        activeCases: prev.activeCases + 6,
        stoppedCases: prev.stoppedCases + 4,
        escalatedCases: prev.escalatedCases + 2
      };
    });

    // Add batch audit log
    const batchAudit = {
      id: `AUD-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      caseId: 'BATCH-SIM-402',
      actor: 'AI_RECOVERY_AGENT',
      eventType: 'BATCH_SIMULATION_EXECUTED',
      details: `Executed batch of 50 synthetic transactions: 36 recovered (+₹3,25,000), 4 stopped by safety bounds, 2 human escalations.`,
      safetyStatus: 'BATCH_COMPLETED_BOUNDED',
      recoveryDelta: simulatedAddedRevenue
    };

    setAuditLogs(prev => [batchAudit, ...prev]);
    setIsBatchRunning(false);

    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.5 }
    });
  };

  // Inject a specific scenario into the case queue
  const handleInjectScenario = (scenarioKey) => {
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
