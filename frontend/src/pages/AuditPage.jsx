import React, { useState } from 'react';
import { 
  FileText, 
  ShieldCheck, 
  Search, 
  Download, 
  CheckCircle2, 
  Lock, 
  Clock, 
  Code, 
  ChevronDown, 
  ChevronRight,
  Filter,
  Bot
} from 'lucide-react';

export default function AuditPage({ auditLogs }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const filteredLogs = auditLogs.filter(log => 
    log.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.caseId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.eventType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.details.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatINR = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const handleExportCSV = () => {
    const headers = "ID,Timestamp,CaseID,Actor,EventType,Details,SafetyStatus,RecoveryDelta\n";
    const rows = auditLogs.map(l => 
      `"${l.id}","${l.timestamp}","${l.caseId}","${l.actor}","${l.eventType}","${l.details.replace(/"/g, '""')}","${l.safetyStatus}","${l.recoveryDelta}"`
    ).join("\n");
    
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="audit-page">
      {/* Header */}
      <section className="audit-header porcelain-card">
        <div className="audit-header-inner">
          <div>
            <span className="badge badge-orange">
              <ShieldCheck size={14} />
              <span>Immutable Governance Trail</span>
            </span>
            <h1 className="audit-heading font-serif-title">
              Audit Logs & Compliance Ledger
            </h1>
            <p className="audit-sub">
              Every detection, ML diagnosis, guardrail evaluation, action execution, and financial 
              settlement is written with millisecond timestamps and cryptographic audit hashes.
            </p>
          </div>

          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={15} />
            <span>Export Audit Trail (CSV)</span>
          </button>
        </div>
      </section>

      {/* Main Table Card */}
      <div className="audit-table-card porcelain-card">
        <div className="audit-controls-bar">
          <div className="search-box">
            <Search size={16} color="#94A3B8" />
            <input 
              type="text" 
              placeholder="Search audit logs by Case ID, Event Type, Actor, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          <span className="badge badge-emerald">
            <CheckCircle2 size={12} />
            <span>{filteredLogs.length} Verified Entries</span>
          </span>
        </div>

        <div className="table-responsive">
          <table className="custom-audit-table">
            <thead>
              <tr>
                <th>Log ID</th>
                <th>Timestamp</th>
                <th>Case ID</th>
                <th>Actor</th>
                <th>Event Type</th>
                <th>Reasoning / Action Details</th>
                <th>Safety Status</th>
                <th>Delta</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-row">No audit logs matching search.</td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)} className="audit-row">
                    <td className="font-mono font-weight-700">{log.id}</td>
                    <td className="font-mono text-muted">{new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td>
                      <span className="case-id-pill">{log.caseId}</span>
                    </td>
                    <td>
                      <span className={`actor-tag ${log.actor.toLowerCase()}`}>
                        {log.actor.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="font-weight-600">{log.eventType.replace(/_/g, ' ')}</td>
                    <td className="details-col">{log.details}</td>
                    <td>
                      <span className="safety-badge">
                        <CheckCircle2 size={12} color="#10B981" />
                        <span>{log.safetyStatus.replace(/_/g, ' ')}</span>
                      </span>
                    </td>
                    <td className="font-mono font-weight-700">
                      {log.recoveryDelta > 0 ? (
                        <span className="emerald-text">+{formatINR(log.recoveryDelta)}</span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Inspector Modal if Selected */}
      {selectedLog && (
        <div className="json-modal-backdrop" onClick={() => setSelectedLog(null)}>
          <div className="json-modal porcelain-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Audit Log JSON Payload: {selectedLog.id}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedLog(null)}>Close</button>
            </div>
            <pre className="json-code">
              {JSON.stringify(selectedLog, null, 2)}
            </pre>
          </div>
        </div>
      )}

      <style>{`
        .audit-page {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .audit-header {
          padding: 32px;
          background: linear-gradient(135deg, #FFFFFF 0%, #FAF5EE 100%);
        }

        .audit-header-inner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }

        .audit-heading {
          font-size: 30px;
          margin: 12px 0 8px;
        }

        .audit-sub {
          font-size: 15px;
          color: var(--text-secondary);
          max-width: 800px;
        }

        .audit-table-card {
          padding: 24px;
        }

        .audit-controls-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          gap: 16px;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--bg-surface);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          padding: 10px 14px;
          flex: 1;
          max-width: 540px;
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

        .table-responsive {
          overflow-x: auto;
        }

        .custom-audit-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .custom-audit-table th {
          text-align: left;
          padding: 12px;
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          border-bottom: 1px solid var(--border-subtle);
          text-transform: uppercase;
        }

        .custom-audit-table td {
          padding: 14px 12px;
          border-bottom: 1px solid var(--border-subtle);
          vertical-align: middle;
        }

        .audit-row {
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .audit-row:hover {
          background: #FFFBF7;
        }

        .case-id-pill {
          font-family: var(--font-mono);
          font-weight: 700;
          font-size: 11.5px;
          background: var(--bg-surface-elevated);
          padding: 2px 8px;
          border-radius: 4px;
        }

        .actor-tag {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .actor-tag.policy_engine { background: var(--accent-purple-light); color: var(--accent-purple); }
        .actor-tag.safety_guardrail { background: var(--accent-coral-light); color: var(--accent-coral); }
        .actor-tag.ai_recovery_agent { background: var(--accent-emerald-light); color: var(--accent-emerald-dark); }
        .actor-tag.detection_engine { background: var(--accent-orange-light); color: var(--accent-orange); }

        .details-col {
          max-width: 320px;
          line-height: 1.4;
          color: var(--text-secondary);
        }

        .safety-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11.5px;
          color: var(--text-secondary);
        }

        .font-mono { font-family: var(--font-mono); }
        .font-weight-700 { font-weight: 700; }
        .font-weight-600 { font-weight: 600; }
        .text-muted { color: var(--text-muted); }
        .emerald-text { color: var(--accent-emerald-dark); }

        .empty-row {
          text-align: center;
          padding: 32px;
          color: var(--text-muted);
        }

        .json-modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .json-modal {
          background: #FFFFFF;
          max-width: 600px;
          width: 90%;
          padding: 24px;
          max-height: 80vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .json-code {
          background: #0F172A;
          color: #38BDF8;
          padding: 16px;
          border-radius: 8px;
          font-family: var(--font-mono);
          font-size: 12.5px;
          overflow-x: auto;
        }
      `}</style>
    </div>
  );
}
