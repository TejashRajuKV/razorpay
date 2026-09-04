import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Play, 
  Lock, 
  XCircle,
  TrendingUp,
  User,
  Bot,
  FileText,
  Check
} from 'lucide-react';
import apiService from '../services/api';

export default function CaseDetail({ caseId, onBack, onExecuteRecovery }) {
  const [caseData, setCaseData] = useState(null);
  const [decisionPreview, setDecisionPreview] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [recoveryChannel, setRecoveryChannel] = useState(null);
  const [recoveryMessage, setRecoveryMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);

  useEffect(() => {
    const loadCaseData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [caseRes, decisionRes, auditRes, channelRes, messageRes] = await Promise.all([
          apiService.cases.getCaseById(caseId),
          apiService.cases.getDecisionPreview(caseId),
          apiService.audit.getAuditTrail(caseId),
          apiService.cases.getRecoveryChannel(caseId),
          apiService.cases.getRecoveryMessage(caseId, 'hinglish')
        ]);

        if (caseRes?.success) {
          setCaseData(caseRes.data);
        }
        if (decisionRes?.success) {
          setDecisionPreview(decisionRes.data);
        }
        if (auditRes?.success) {
          setAuditTrail(Array.isArray(auditRes.data) ? auditRes.data : (auditRes.data?.logs || []));
        }
        if (channelRes?.success) {
          setRecoveryChannel(channelRes.data);
        }
        if (messageRes?.success) {
          setRecoveryMessage(messageRes.data);
        }
      } catch (err) {
        console.error('Failed to load case data:', err);
        setError('Failed to load case details');
      } finally {
        setLoading(false);
      }
    };

    loadCaseData();
  }, [caseId]);

  const handleExecuteAction = async (actionType) => {
    setIsExecuting(true);
    setExecutionResult(null);
    try {
      const result = await onExecuteRecovery(caseId, actionType);
      setExecutionResult(result);
      // Reload case data after execution
      const [caseRes, auditRes] = await Promise.all([
        apiService.cases.getCaseById(caseId),
        apiService.audit.getAuditTrail(caseId)
      ]);
      if (caseRes?.success) setCaseData(caseRes.data);
      if (auditRes?.success) {
        setAuditTrail(Array.isArray(auditRes.data) ? auditRes.data : (auditRes.data?.logs || []));
      }
    } catch (err) {
      console.error('Failed to execute action:', err);
      setExecutionResult({ error: err.message });
    } finally {
      setIsExecuting(false);
    }
  };

  const formatINR = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="case-detail-page">
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading case details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="case-detail-page">
        <div className="error-state">
          <AlertTriangle size={32} />
          <p>{error}</p>
          <button className="btn btn-secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  const safeCase = caseData || {};
  const safeDecision = decisionPreview || {};
  const safeGuardrails = safeCase.guardrails || {};
  const safeCustomer = safeCase.customer || {};
  const safePayment = safeCase.payment || {};
  const safeDiagnosis = safeCase.diagnosis || {};

  const getStatusColor = (status) => {
    switch (status) {
      case 'RECOVERED': return 'status-success';
      case 'STOPPED': return 'status-stopped';
      case 'ESCALATED': return 'status-escalated';
      case 'ACTION_SCHEDULED': return 'status-scheduled';
      default: return 'status-detected';
    }
  };

  const getRiskLevel = () => {
    if (safePayment.amount >= 50000) return { level: 'HIGH', color: 'text-red' };
    if (safePayment.amount >= 20000) return { level: 'MEDIUM', color: 'text-orange' };
    return { level: 'LOW', color: 'text-green' };
  };

  const riskInfo = getRiskLevel();

  return (
    <div className="case-detail-page">
      {/* Breadcrumb */}
      <div className="case-breadcrumb">
        <button className="breadcrumb-back" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back to Recovery Cases</span>
        </button>
      </div>

      {/* Case Header */}
      <div className="case-header">
        <div className="case-header-main">
          <div className="case-title-section">
            <div className="case-id-row">
              <h1 className="case-id">{safeCase.id}</h1>
              <span className={`status-badge ${getStatusColor(safeCase.status)}`}>
                {safeCase.status.replace(/_/g, ' ')}
              </span>
              <span className={`risk-badge ${riskInfo.color}`}>
                <AlertTriangle size={14} />
                <span>{riskInfo.level} RISK</span>
              </span>
            </div>
            <h2 className="case-title">Payment Recovery Opportunity</h2>
            <p className="case-description">
              {safeDiagnosis.description || 'Payment failure detected requiring recovery intervention'}
            </p>
          </div>
        </div>
        <div className="case-header-actions">
          <button className="btn btn-secondary">
            <FileText size={16} />
            <span>View Audit Trail</span>
          </button>
          <button className="btn btn-primary">
            <ShieldCheck size={16} />
            <span>Review Recovery Plan</span>
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="metrics-section">
        <div className="metric-card">
          <span className="metric-label">Revenue at Risk</span>
          <span className="metric-value metric-risk">{formatINR(safePayment.amount)}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Expected Recovery</span>
          <span className="metric-value">{formatINR(safeDecision.expectedRecovery || safePayment.amount * 0.7)}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Recovery Probability</span>
          <span className="metric-value">{Math.round((safeDecision.recoveryProbability || 0.5) * 100)}%</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Recovery Attempts</span>
          <span className="metric-value">{safeGuardrails.retriesUsed || 0} / {safeGuardrails.maxRetriesAllowed || 3}</span>
        </div>
      </div>

      {/* Context Section */}
      <div className="context-section">
        <div className="context-card">
          <h3 className="context-title">Payment Context</h3>
          <div className="context-content">
            <div className="context-row">
              <span className="context-label">Payment ID</span>
              <span className="context-value">{safeCase.paymentId || 'N/A'}</span>
            </div>
            <div className="context-row">
              <span className="context-label">Payment Method</span>
              <span className="context-value">{safePayment.method || 'N/A'}</span>
            </div>
            <div className="context-row">
              <span className="context-label">Amount</span>
              <span className="context-value">{formatINR(safePayment.amount)}</span>
            </div>
            <div className="context-row">
              <span className="context-label">Failure Reason</span>
              <span className="context-value context-error">{safeDiagnosis.rootCause || 'Unknown'}</span>
            </div>
            <div className="context-row">
              <span className="context-label">Payment Status</span>
              <span className="context-value">{safePayment.status || 'FAILED'}</span>
            </div>
            <div className="context-row">
              <span className="context-label">Created</span>
              <span className="context-value">{formatDate(safeCase.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="context-card">
          <h3 className="context-title">Customer Profile</h3>
          <div className="context-content">
            <div className="customer-header">
              <div className="customer-avatar">
                {safeCustomer.name?.charAt(0) || 'C'}
              </div>
              <div className="customer-info">
                <div className="customer-name">{safeCustomer.name || 'Unknown'}</div>
                <div className="customer-tier">{safeCustomer.tier || 'GOLD'}</div>
              </div>
            </div>
            <div className="context-row">
              <span className="context-label">Lifetime Value</span>
              <span className="context-value">{formatINR(safeCustomer.lifetimeValue || 0)}</span>
            </div>
            <div className="context-row">
              <span className="context-label">Success Rate</span>
              <span className="context-value">{Math.round((safeCustomer.historicalSuccessRate || 0.7) * 100)}%</span>
            </div>
            <div className="context-row">
              <span className="context-label">Email</span>
              <span className="context-value">{safeCustomer.email || 'N/A'}</span>
            </div>
            <div className="context-row">
              <span className="context-label">Phone</span>
              <span className="context-value">{safeCustomer.phone || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Diagnosis Section */}
      <div className="diagnosis-section">
        <h3 className="section-title">
          <Bot size={20} className="section-icon" />
          <span>AI Diagnosis</span>
          <span className="confidence-badge">
            {Math.round((safeDiagnosis.confidence || 0.8) * 100)}% confidence
          </span>
        </h3>
        
        <div className="diagnosis-content">
          <div className="diagnosis-main">
            <div className="diagnosis-row">
              <span className="diagnosis-label">Diagnosis</span>
              <span className="diagnosis-value">{safeDiagnosis.rootCause || 'Payment failure detected'}</span>
            </div>
            <div className="diagnosis-row">
              <span className="diagnosis-label">Risk Probability</span>
              <span className="diagnosis-value diagnosis-risk">
                {Math.round((safeDecision.riskProbability || 0.3) * 100)}%
              </span>
            </div>
            <div className="diagnosis-row">
              <span className="diagnosis-label">Explanation</span>
              <span className="diagnosis-text">{safeDiagnosis.description || 'No explanation available'}</span>
            </div>
          </div>

          {/* Decision Path Visualization */}
          <div className="decision-path">
            <div className="path-step">
              <div className="step-circle step-active">
                <AlertTriangle size={14} />
              </div>
              <span className="step-label">Payment Failure</span>
            </div>
            <div className="path-connector" />
            <div className="path-step">
              <div className="step-circle step-active">
                <ShieldCheck size={14} />
              </div>
              <span className="step-label">Risk Detected</span>
            </div>
            <div className="path-connector" />
            <div className="path-step">
              <div className="step-circle step-active">
                <Bot size={14} />
              </div>
              <span className="step-label">Diagnosis</span>
            </div>
            <div className="path-connector" />
            <div className="path-step">
              <div className="step-circle step-active">
                <TrendingUp size={14} />
              </div>
              <span className="step-label">Recovery Opportunity</span>
            </div>
            <div className="path-connector" />
            <div className="path-step">
              <div className="step-circle step-current">
                <Play size={14} />
              </div>
              <span className="step-label">Recommended Action</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recovery Decision Section */}
      <div className="decision-section">
        <h3 className="section-title">
          <TrendingUp size={20} className="section-icon" />
          <span>Recovery Decision</span>
        </h3>

        <div className="decision-main">
          <div className="recommended-action">
            <div className="action-header">
              <span className="action-label">Recommended Action</span>
              <span className="action-rank">RANK #1</span>
            </div>
            <div className="action-name">{safeDecision.recommendedAction || 'Payment Retry'}</div>
            <div className="action-metrics">
              <div className="action-metric">
                <span className="metric-label">Probability</span>
                <span className="metric-value">{Math.round((safeDecision.recoveryProbability || 0.7) * 100)}%</span>
              </div>
              <div className="action-metric">
                <span className="metric-label">Expected Recovery</span>
                <span className="metric-value">{formatINR(safeDecision.expectedRecovery || safePayment.amount * 0.7)}</span>
              </div>
              <div className="action-metric">
                <span className="metric-label">Confidence</span>
                <span className="metric-value">{Math.round((safeDecision.confidence || 0.8) * 100)}%</span>
              </div>
            </div>
            <div className="action-reason">
              <span className="reason-label">Reason:</span>
              <span className="reason-text">{safeDecision.reason || 'Optimal timing and channel for recovery'}</span>
            </div>
          </div>

          {/* Alternative Candidates */}
          {safeDecision.candidates && safeDecision.candidates.length > 1 && (
            <div className="alternative-actions">
              <h4 className="alternatives-title">Alternative Actions</h4>
              {safeDecision.candidates.slice(1).map((candidate, idx) => (
                <div key={idx} className="candidate-action">
                  <div className="candidate-header">
                    <span className="candidate-rank">#{idx + 2}</span>
                    <span className="candidate-name">{candidate.action || 'Unknown'}</span>
                    <span className={`candidate-status ${candidate.blocked ? 'blocked' : 'allowed'}`}>
                      {candidate.blocked ? 'BLOCKED' : 'SAFE'}
                    </span>
                  </div>
                  <div className="candidate-metrics">
                    <span>{Math.round((candidate.probability || 0.5) * 100)}% prob</span>
                    <span>{formatINR(candidate.expectedRecovery || 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Safety Section */}
      <div className="safety-section">
        <h3 className="section-title">
          <ShieldCheck size={20} className="section-icon" />
          <span>Safety & Recovery Guardrails</span>
        </h3>

        <div className="safety-grid">
          <div className="safety-item">
            <span className="safety-label">Retry Limit</span>
            <span className="safety-value">{safeGuardrails.retriesUsed || 0} / {safeGuardrails.maxRetriesAllowed || 3}</span>
            <CheckCircle2 size={16} className="safety-icon safety-safe" />
          </div>
          <div className="safety-item">
            <span className="safety-label">Cooldown Status</span>
            <span className="safety-value">{safeGuardrails.isCooldownSatisfied ? 'Satisfied' : 'Waiting'}</span>
            <CheckCircle2 size={16} className="safety-icon safety-safe" />
          </div>
          <div className="safety-item">
            <span className="safety-label">High-Value Gate</span>
            <span className="safety-value">{safePayment.amount > 50000 ? 'Triggered' : 'Not Triggered'}</span>
            {safePayment.amount > 50000 ? (
              <AlertTriangle size={16} className="safety-icon safety-warning" />
            ) : (
              <CheckCircle2 size={16} className="safety-icon safety-safe" />
            )}
          </div>
          <div className="safety-item">
            <span className="safety-label">Confidence Threshold</span>
            <span className="safety-value">{(safeGuardrails.confidenceThreshold || 0.6) * 100}%</span>
            <CheckCircle2 size={16} className="safety-icon safety-safe" />
          </div>
          <div className="safety-item">
            <span className="safety-label">Execution Status</span>
            <span className="safety-value">{safeGuardrails.status || 'ALLOWED'}</span>
            {safeGuardrails.status === 'BLOCKED' ? (
              <XCircle size={16} className="safety-icon safety-blocked" />
            ) : (
              <CheckCircle2 size={16} className="safety-icon safety-safe" />
            )}
          </div>
        </div>

        <div className="safety-notice">
          <ShieldCheck size={16} className="notice-icon" />
          <span>AI recommends • Policy decides • Execution happens only after policy approval</span>
        </div>
      </div>

      {/* Recovery Channel Section */}
      {recoveryChannel && (
        <div className="channel-section">
          <h3 className="section-title">
            <User size={20} className="section-icon" />
            <span>Recommended Recovery Channel</span>
          </h3>

          <div className="channel-content">
            <div className="channel-main">
              <div className="channel-name">{recoveryChannel.channel?.replace(/_/g, ' ') || 'WhatsApp'}</div>
              <div className="channel-confidence">
                {Math.round((recoveryChannel.confidence || 0.8) * 100)}% confidence
              </div>
            </div>
            <div className="channel-reason">
              <span className="reason-label">Reason:</span>
              <span className="reason-text">{recoveryChannel.reason || 'Optimal for customer payment context'}</span>
            </div>
            {recoveryMessage && (
              <div className="message-preview">
                <div className="message-header">
                  <span className="message-label">Generated Message</span>
                  <span className="message-language">[{recoveryMessage.language || 'Hinglish'}]</span>
                </div>
                <div className="message-text">{recoveryMessage.message || 'No message available'}</div>
                <div className="message-disclaimer">
                  AI-generated recommendation / simulated — not sent
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recovery Action Section */}
      <div className="action-section">
        <h3 className="section-title">
          <Play size={20} className="section-icon" />
          <span>Recovery Plan</span>
        </h3>

        <div className="action-plan">
          <div className="plan-details">
            <div className="plan-row">
              <span className="plan-label">Recommended</span>
              <span className="plan-value">{safeDecision.recommendedAction || 'Payment Retry'}</span>
            </div>
            <div className="plan-row">
              <span className="plan-label">Expected Recovery</span>
              <span className="plan-value">{formatINR(safeDecision.expectedRecovery || safePayment.amount * 0.7)}</span>
            </div>
            <div className="plan-row">
              <span className="plan-label">Attempt</span>
              <span className="plan-value">{safeGuardrails.retriesUsed || 0} / {safeGuardrails.maxRetriesAllowed || 3}</span>
            </div>
            <div className="plan-row">
              <span className="plan-label">Status</span>
              <span className={`plan-value plan-status ${getStatusColor(safeCase.status)}`}>
                {safeCase.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          {executionResult && (
            <div className={`execution-result ${executionResult.recovered ? 'success' : 'error'}`}>
              {executionResult.recovered ? (
                <>
                  <CheckCircle2 size={20} />
                  <span>Successfully recovered {formatINR(executionResult.amount)}</span>
                </>
              ) : (
                <>
                  <XCircle size={20} />
                  <span>{executionResult.error || executionResult.reason || 'Action failed'}</span>
                </>
              )}
            </div>
          )}

          <div className="action-buttons">
            {safeCase.status === 'RECOVERED' ? (
              <div className="action-completed">
                <CheckCircle2 size={24} />
                <div>
                  <strong>Case Recovered</strong>
                  <span>Successfully recovered {formatINR(safeCase.recoveredAmount || 0)}</span>
                </div>
              </div>
            ) : safeCase.status === 'STOPPED' ? (
              <div className="action-blocked">
                <Lock size={24} />
                <div>
                  <strong>Recovery Stopped</strong>
                  <span>{safeGuardrails.stoppingRuleHit || 'Stopped by safety policy'}</span>
                </div>
              </div>
            ) : safeCase.status === 'ESCALATED' ? (
              <>
                <button 
                  className="btn btn-primary"
                  onClick={() => handleExecuteAction('APPROVE_HUMAN_RECOVERY')}
                  disabled={isExecuting || safeGuardrails.status === 'BLOCKED'}
                >
                  <Check size={16} />
                  <span>Approve High-Value Intervention</span>
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={() => handleExecuteAction('STOP_RECOVERY')}
                  disabled={isExecuting}
                >
                  <XCircle size={16} />
                  <span>Reject & Halt</span>
                </button>
              </>
            ) : (
              <>
                <button 
                  className="btn btn-primary"
                  onClick={() => handleExecuteAction(safeDecision.recommendedAction || 'RETRY_IMMEDIATE')}
                  disabled={isExecuting || safeGuardrails.status === 'BLOCKED'}
                >
                  {isExecuting ? (
                    <>
                      <Clock size={16} className="spin-icon" />
                      <span>Executing...</span>
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      <span>Execute Recovery</span>
                    </>
                  )}
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={() => handleExecuteAction('STOP_RECOVERY')}
                  disabled={isExecuting}
                >
                  <Lock size={16} />
                  <span>Halt Recovery</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Audit Trail Section */}
      <div className="audit-section">
        <h3 className="section-title">
          <FileText size={20} className="section-icon" />
          <span>Case Activity / Audit Trail</span>
        </h3>

        <div className="audit-timeline">
          {auditTrail.length === 0 ? (
            <div className="audit-empty">
              <FileText size={32} />
              <p>No audit events available</p>
            </div>
          ) : (
            auditTrail.map((event, idx) => (
              <div key={idx} className="audit-event">
                <div className="audit-time">{formatDate(event.timestamp)}</div>
                <div className="audit-content">
                  <div className="audit-type">{event.eventType || event.type || 'Unknown'}</div>
                  <div className="audit-description">{event.details || event.description || 'No description'}</div>
                  <div className="audit-actor">
                    <User size={12} />
                    <span>{event.actor || 'System'}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        .case-detail-page {
          display: flex;
          flex-direction: column;
          gap: 32px;
          background: #FFFEFA;
          min-height: 100vh;
          padding: 32px 40px;
          max-width: 1400px;
          margin: 0 auto;
        }

        /* Loading & Error States */
        .loading-state, .error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 80px 20px;
          color: #64748B;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #E8E1D6;
          border-top-color: #FF6A00;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-state {
          color: #EF4444;
        }

        /* Breadcrumb */
        .case-breadcrumb {
          margin-bottom: 8px;
        }

        .breadcrumb-back {
          display: flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          border: none;
          color: #64748B;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          transition: color 0.15s ease;
        }

        .breadcrumb-back:hover {
          color: #111110;
        }

        /* Case Header */
        .case-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          padding: 28px 32px;
          background: #FFFFFF;
          border: 1px solid #E8E1D6;
          border-radius: 16px;
        }

        .case-header-main {
          flex: 1;
        }

        .case-id-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .case-id {
          font-family: 'JetBrains Mono', monospace;
          font-size: 24px;
          font-weight: 800;
          color: #111110;
          letter-spacing: -0.02em;
        }

        .status-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 6px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .status-success {
          background: #ECFDF5;
          color: #10B981;
        }

        .status-stopped {
          background: #FEE2E2;
          color: #EF4444;
        }

        .status-escalated {
          background: #F5F3FF;
          color: #8B5CF6;
        }

        .status-scheduled {
          background: #EFF6FF;
          color: #3B82F6;
        }

        .status-detected {
          background: #FFF0E5;
          color: #FF6A00;
        }

        .risk-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 6px;
          background: #FEE2E2;
          color: #EF4444;
        }

        .risk-badge.text-orange {
          background: #FFF0E5;
          color: #FF6A00;
        }

        .risk-badge.text-green {
          background: #ECFDF5;
          color: #10B981;
        }

        .case-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 28px;
          font-weight: 700;
          color: #111110;
          margin-bottom: 8px;
          letter-spacing: -0.02em;
        }

        .case-description {
          font-size: 15px;
          color: #4E4E48;
          line-height: 1.5;
        }

        .case-header-actions {
          display: flex;
          gap: 12px;
        }

        /* Metrics Section */
        .metrics-section {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        .metric-card {
          background: #FFFFFF;
          border: 1px solid #E8E1D6;
          border-radius: 12px;
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .metric-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #94A3B8;
        }

        .metric-value {
          font-family: 'Outfit', sans-serif;
          font-size: 24px;
          font-weight: 800;
          color: #111110;
          letter-spacing: -0.02em;
        }

        .metric-risk {
          color: #EF4444;
        }

        /* Context Section */
        .context-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }

        .context-card {
          background: #FFFFFF;
          border: 1px solid #E8E1D6;
          border-radius: 16px;
          padding: 24px;
        }

        .context-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 18px;
          font-weight: 700;
          color: #111110;
          margin-bottom: 20px;
          letter-spacing: -0.01em;
        }

        .context-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .context-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #F3ECDB;
        }

        .context-row:last-child {
          border-bottom: none;
        }

        .context-label {
          font-size: 12px;
          font-weight: 600;
          color: #94A3B8;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .context-value {
          font-size: 14px;
          font-weight: 600;
          color: #111110;
        }

        .context-error {
          color: #EF4444;
        }

        .customer-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #FAF7F0;
          border-radius: 12px;
          margin-bottom: 16px;
        }

        .customer-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #FF6A00 0%, #EE5100 100%);
          color: #FFFFFF;
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 20px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .customer-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .customer-name {
          font-size: 16px;
          font-weight: 700;
          color: #111110;
        }

        .customer-tier {
          font-size: 12px;
          font-weight: 600;
          color: #FF6A00;
        }

        /* Diagnosis Section */
        .diagnosis-section {
          background: #FFFFFF;
          border: 1px solid #E8E1D6;
          border-radius: 16px;
          padding: 28px 32px;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 20px;
          font-weight: 700;
          color: #111110;
          margin-bottom: 24px;
          letter-spacing: -0.01em;
        }

        .section-icon {
          color: #8B5CF6;
        }

        .confidence-badge {
          margin-left: auto;
          font-size: 12px;
          font-weight: 700;
          color: #8B5CF6;
          background: #F5F3FF;
          padding: 4px 12px;
          border-radius: 6px;
        }

        .diagnosis-content {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 32px;
        }

        .diagnosis-main {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .diagnosis-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .diagnosis-label {
          font-size: 11px;
          font-weight: 700;
          color: #94A3B8;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .diagnosis-value {
          font-size: 16px;
          font-weight: 700;
          color: #111110;
        }

        .diagnosis-risk {
          color: #EF4444;
        }

        .diagnosis-text {
          font-size: 14px;
          color: #4E4E48;
          line-height: 1.5;
        }

        .decision-path {
          display: flex;
          align-items: center;
          gap: 0;
        }

        .path-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .step-circle {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #F3ECDB;
          color: #7A7A72;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .step-circle.step-active {
          background: #10B981;
          color: #FFFFFF;
        }

        .step-circle.step-current {
          background: #FF6A00;
          color: #FFFFFF;
          box-shadow: 0 0 0 4px rgba(255, 106, 0, 0.15);
        }

        .step-label {
          font-size: 11px;
          font-weight: 700;
          color: #7A7A72;
        }

        .path-connector {
          flex: 1;
          height: 2px;
          background: #E8E1D6;
          min-width: 20px;
        }

        /* Decision Section */
        .decision-section {
          background: #FFFFFF;
          border: 1px solid #E8E1D6;
          border-radius: 16px;
          padding: 28px 32px;
        }

        .decision-main {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .recommended-action {
          background: linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 12px;
          padding: 24px;
        }

        .action-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .action-label {
          font-size: 11px;
          font-weight: 700;
          color: #8B5CF6;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .action-rank {
          font-size: 12px;
          font-weight: 800;
          color: #8B5CF6;
          background: #FFFFFF;
          padding: 4px 10px;
          border-radius: 6px;
        }

        .action-name {
          font-size: 20px;
          font-weight: 800;
          color: #5B21B6;
          margin-bottom: 16px;
        }

        .action-metrics {
          display: flex;
          gap: 24px;
          margin-bottom: 16px;
        }

        .action-metric {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .action-metric .metric-label {
          font-size: 11px;
          color: #8B5CF6;
        }

        .action-metric .metric-value {
          font-size: 18px;
          font-weight: 700;
          color: #5B21B6;
        }

        .action-reason {
          display: flex;
          gap: 8px;
          font-size: 13px;
          color: #6D28D9;
        }

        .reason-label {
          font-weight: 700;
        }

        .alternatives-title {
          font-size: 14px;
          font-weight: 700;
          color: #111110;
          margin-bottom: 12px;
        }

        .alternative-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .candidate-action {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #FAF7F0;
          border: 1px solid #E8E1D6;
          border-radius: 8px;
        }

        .candidate-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .candidate-rank {
          font-size: 12px;
          font-weight: 800;
          color: #64748B;
        }

        .candidate-name {
          font-size: 14px;
          font-weight: 700;
          color: #111110;
        }

        .candidate-status {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .candidate-status.blocked {
          background: #FEE2E2;
          color: #EF4444;
        }

        .candidate-status.allowed {
          background: #ECFDF5;
          color: #10B981;
        }

        .candidate-metrics {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: #64748B;
        }

        /* Safety Section */
        .safety-section {
          background: #FFFFFF;
          border: 1px solid #E8E1D6;
          border-radius: 16px;
          padding: 28px 32px;
        }

        .safety-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .safety-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #FAF7F0;
          border: 1px solid #E8E1D6;
          border-radius: 10px;
        }

        .safety-label {
          font-size: 12px;
          font-weight: 600;
          color: #64748B;
        }

        .safety-value {
          font-size: 14px;
          font-weight: 700;
          color: #111110;
        }

        .safety-icon {
          margin-left: 8px;
        }

        .safety-icon.safety-safe {
          color: #10B981;
        }

        .safety-icon.safety-warning {
          color: #F59E0B;
        }

        .safety-icon.safety-blocked {
          color: #EF4444;
        }

        .safety-notice {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #F0FDF4;
          border: 1px solid #BBF7D0;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          color: #166534;
        }

        .notice-icon {
          color: #10B981;
        }

        /* Channel Section */
        .channel-section {
          background: #FFFFFF;
          border: 1px solid #E8E1D6;
          border-radius: 16px;
          padding: 28px 32px;
        }

        .channel-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .channel-main {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .channel-name {
          font-size: 20px;
          font-weight: 800;
          color: #111110;
        }

        .channel-confidence {
          font-size: 13px;
          font-weight: 700;
          color: #10B981;
          background: #ECFDF5;
          padding: 4px 12px;
          border-radius: 6px;
        }

        .channel-reason {
          display: flex;
          gap: 8px;
          font-size: 14px;
          color: #4E4E48;
        }

        .message-preview {
          background: #F8FAFC;
          border: 1px solid #E8E1D6;
          border-radius: 12px;
          padding: 20px;
        }

        .message-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .message-label {
          font-size: 12px;
          font-weight: 700;
          color: #64748B;
          text-transform: uppercase;
        }

        .message-language {
          font-size: 11px;
          font-weight: 600;
          color: #8B5CF6;
          background: #F5F3FF;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .message-text {
          font-size: 14px;
          color: #111110;
          line-height: 1.5;
          margin-bottom: 12px;
        }

        .message-disclaimer {
          font-size: 11px;
          color: #94A3B8;
          font-style: italic;
        }

        /* Action Section */
        .action-section {
          background: #FFFFFF;
          border: 1px solid #E8E1D6;
          border-radius: 16px;
          padding: 28px 32px;
        }

        .action-plan {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .plan-details {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .plan-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #FAF7F0;
          border-radius: 8px;
        }

        .plan-label {
          font-size: 12px;
          font-weight: 600;
          color: #64748B;
        }

        .plan-value {
          font-size: 14px;
          font-weight: 700;
          color: #111110;
        }

        .plan-status.status-success {
          color: #10B981;
        }

        .plan-status.status-stopped {
          color: #EF4444;
        }

        .plan-status.status-escalated {
          color: #8B5CF6;
        }

        .plan-status.status-scheduled {
          color: #3B82F6;
        }

        .plan-status.status-detected {
          color: #FF6A00;
        }

        .execution-result {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
        }

        .execution-result.success {
          background: #ECFDF5;
          color: #10B981;
        }

        .execution-result.error {
          background: #FEE2E2;
          color: #EF4444;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
        }

        .action-completed {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          background: #ECFDF5;
          border: 1px solid #10B981;
          border-radius: 12px;
        }

        .action-blocked {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          background: #FEE2E2;
          border: 1px solid #EF4444;
          border-radius: 12px;
        }

        /* Audit Section */
        .audit-section {
          background: #FFFFFF;
          border: 1px solid #E8E1D6;
          border-radius: 16px;
          padding: 28px 32px;
        }

        .audit-timeline {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .audit-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 40px;
          color: #94A3B8;
        }

        .audit-event {
          display: flex;
          gap: 16px;
          padding: 16px;
          background: #FAF7F0;
          border: 1px solid #E8E1D6;
          border-radius: 10px;
        }

        .audit-time {
          font-size: 11px;
          font-weight: 700;
          color: #94A3B8;
          min-width: 140px;
        }

        .audit-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .audit-type {
          font-size: 13px;
          font-weight: 700;
          color: #111110;
        }

        .audit-description {
          font-size: 13px;
          color: #4E4E48;
          line-height: 1.4;
        }

        .audit-actor {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #64748B;
        }

        /* Buttons */
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-family: 'Outfit', sans-serif;
          font-weight: 600;
          font-size: 13px;
          padding: 10px 20px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-primary {
          background: #111110;
          color: #FFFFFF;
        }

        .btn-primary:hover {
          background: #2A2A2A;
        }

        .btn-primary:disabled {
          background: #E8E1D6;
          color: #94A3B8;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #FFFFFF;
          color: #111110;
          border: 1px solid #E8E1D6;
        }

        .btn-secondary:hover {
          border-color: #111110;
          background: #FAFAF8;
        }

        .spin-icon {
          animation: spin 1s linear infinite;
        }

        /* Responsive Design */
        @media (max-width: 1024px) {
          .case-detail-page {
            padding: 24px;
          }

          .case-header {
            flex-direction: column;
          }

          .metrics-section {
            grid-template-columns: repeat(2, 1fr);
          }

          .context-section {
            grid-template-columns: 1fr;
          }

          .diagnosis-content {
            grid-template-columns: 1fr;
          }

          .plan-details {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .case-detail-page {
            padding: 20px;
            gap: 24px;
          }

          .metrics-section {
            grid-template-columns: 1fr;
          }

          .case-header-actions {
            flex-direction: column;
            width: 100%;
          }

          .action-buttons {
            flex-direction: column;
          }

          .decision-path {
            flex-wrap: wrap;
          }

          .path-connector {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}