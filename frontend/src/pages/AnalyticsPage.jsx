import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Cpu, 
  Sparkles, 
  CheckCircle2, 
  PieChart, 
  ShieldCheck, 
  Target, 
  ArrowUpRight,
  Activity
} from 'lucide-react';
import { analyticsAPI } from '../services/api';

export default function AnalyticsPage({ metrics, onViewAlertCases, onGoSimulator }) {
  const [advanced, setAdvanced] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [strategyComparison, setStrategyComparison] = useState(null);
  const [overview, setOverview] = useState(null);
  const [waterfall, setWaterfall] = useState(null);
  const [trendRange, setTrendRange] = useState('7d');
  const [trends, setTrends] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await analyticsAPI.getTrends(trendRange).catch(() => null);
        if (!cancelled && res?.success) setTrends(res.data);
      } catch { /* trend section stays hidden without backend data */ }
    })();
    return () => { cancelled = true; };
  }, [trendRange]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [advRes, alertRes, stratRes, ovRes, wfRes] = await Promise.all([
          analyticsAPI.getAdvanced(),
          analyticsAPI.getAlerts(),
          analyticsAPI.getStrategyComparison().catch(() => null),
          analyticsAPI.getOverview().catch(() => null),
          analyticsAPI.getWaterfall().catch(() => null),
        ]);
        if (!cancelled) {
          if (advRes?.success) setAdvanced(advRes.data);
          if (alertRes?.success) setAlerts(alertRes.data);
          if (stratRes?.success) setStrategyComparison(stratRes.data);
          if (ovRes?.success) setOverview(ovRes.data);
          if (wfRes?.success) setWaterfall(wfRes.data);
        }
      } catch { /* backend unavailable — sections below render only with live data */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const liveActions = overview?.actionEffectiveness || [];
  const liveDiagnoses = overview?.successByDiagnosis || [];
  const totalDiagnosed = liveDiagnoses.reduce((s, d) => s + (Number(d.total) || 0), 0);

  const formatINR = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="analytics-page">
      {/* Header Banner */}
      <section className="analytics-header porcelain-card">
        <div className="header-title-group">
          <span className="badge badge-purple">
            <Cpu size={14} />
            <span>Honest ML & Recovery Analytics</span>
          </span>
          <h1 className="analytics-heading font-serif-title">
            Model Performance & Channel Conversions
          </h1>
          <p className="analytics-sub">
            ML insights below are derived from live recovery analytics (real cases/actions in SQL).
            Model scores are shown only when produced by actual train/test evaluation — no fake accuracy.
          </p>
        </div>
      </section>

      {/* 1. Recovery Metrics (real SQL-backed; ML scores only if actually evaluated) */}
      <div className="ml-metrics-strip">
        <div className="porcelain-card ml-stat-card">
          <span className="ml-label">Recovered Revenue</span>
          <div className="ml-val emerald">₹{Number(metrics.recoveredRevenue || 0).toLocaleString('en-IN')}</div>
          <span className="ml-note">Measured from SQL</span>
        </div>

        <div className="porcelain-card ml-stat-card">
          <span className="ml-label">Recovery Rate</span>
          <div className="ml-val blue">{metrics.recoveryRate || 0}%</div>
          <span className="ml-note">Recovered / at-risk</span>
        </div>

        <div className="porcelain-card ml-stat-card">
          <span className="ml-label">Revenue At Risk</span>
          <div className="ml-val purple">₹{Number(metrics.revenueAtRisk || 0).toLocaleString('en-IN')}</div>
          <span className="ml-note">Failed / abandoned</span>
        </div>

        <div className="porcelain-card ml-stat-card">
          <span className="ml-label">Avg Recovery Time</span>
          <div className="ml-val orange">{metrics.avgRecoveryTimeMinutes || '—'}</div>
          <span className="ml-note">{metrics.avgRecoveryTimeMinutes ? 'Fastest via smart retry' : 'Not measured yet'}</span>
        </div>
      </div>
      {metrics.mlAccuracy ? (
        <div className="porcelain-card" style={{ padding: 16 }}>
          <span className="ml-label">Model evaluation (train/test): </span>
          <span>Acc {metrics.mlAccuracy}% · F1 {metrics.mlF1Score} · AUC {metrics.mlRocAuc}</span>
          <p className="metrics-note" style={{ color: '#cc6600', fontSize: 12, marginTop: 8 }}>
            ⚠ Trained on synthetic data. Metrics are demonstration values, not production evidence.
          </p>
        </div>
      ) : (
        <div className="porcelain-card" style={{ padding: 16, fontSize: 13 }}>
          Model accuracy / F1 / ROC-AUC are hidden until a real Python train/test evaluation exposes them.
        </div>
      )}

      {/* Backend-driven: revenue leakage alerts + advanced recovery analytics */}
      {alerts && alerts.alerts && alerts.alerts.length > 0 && (
        <div className="porcelain-card" style={{ padding: 20 }}>
          <h3 className="card-title">Revenue Leakage Alerts</h3>
          {alerts.alerts.map((a, idx) => (
            <div key={idx} style={{ padding: '10px 0', borderTop: idx ? '1px solid #eee' : 'none', fontSize: 13 }}>
              <strong>[{a.severity}] {a.title}</strong> — {a.description}
              <div style={{ color: 'var(--text-secondary)' }}>
                At risk: {formatINR(a.amountAtRisk)} · Cases: {a.affectedCases} · Cause: {a.mainCause}
              </div>
              <div>AI recommendation: {a.recommendedAction}</div>
              {Array.isArray(a.caseIds) && a.caseIds.length > 0 && onViewAlertCases && (
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => onViewAlertCases(a.caseIds)}>
                    <span>View Cases ({a.caseIds.length})</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {advanced && (
        <div className="ml-metrics-strip">
          <div className="porcelain-card ml-stat-card">
            <span className="ml-label">Net Recovered</span>
            <div className="ml-val emerald">₹{Number(advanced.netRecovered || 0).toLocaleString('en-IN')}</div>
            <span className="ml-note">Gross minus costs</span>
          </div>
          <div className="porcelain-card ml-stat-card">
            <span className="ml-label">Recovery ROI</span>
            <div className="ml-val blue">{advanced.roi ?? '—'}</div>
            <span className="ml-note">Net / cost</span>
          </div>
          <div className="porcelain-card ml-stat-card">
            <span className="ml-label">Blocked / Escalations</span>
            <div className="ml-val orange">{advanced.blockedActions} / {advanced.humanEscalations}</div>
            <span className="ml-note">Guardrail activity</span>
          </div>
          <div className="porcelain-card ml-stat-card">
            <span className="ml-label">Best Action / Channel</span>
            <div className="ml-val purple" style={{ fontSize: 18 }}>{advanced.bestAction || '—'} / {advanced.bestChannel || '—'}</div>
            <span className="ml-note">By recovered revenue</span>
          </div>
        </div>
      )}

      {/* Recovery trend (live SQL, selectable range) */}
      <div className="porcelain-card channel-card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Recovery Trend</h3>
            <p className="card-sub">Resolved cases and recovered revenue per period, from live case data.</p>
          </div>
          <div className="filter-pill-strip">
            {['24h', '7d', '30d', '90d'].map((r) => (
              <button
                key={r}
                className={`filter-pill-btn ${trendRange === r ? 'active' : ''}`}
                onClick={() => setTrendRange(r)}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {trends && Array.isArray(trends.trends) && trends.trends.length > 0 ? (
          <div className="cause-list">
            {(() => {
              const rows = [...trends.trends].reverse();
              const max = Math.max(1, ...rows.map((t) => Number(t.amount_recovered) || 0));
              return rows.map((t) => (
                <div key={t.period} className="cause-item">
                  <div className="cause-row-top">
                    <span className="cause-name">{t.period}</span>
                    <span className="cause-pct">{formatINR(Number(t.amount_recovered) || 0)} · {t.cases_resolved}/{t.cases_created} resolved</span>
                  </div>
                  <div className="cause-bar-bg">
                    <div className="cause-bar-fill" style={{ width: `${Math.min(100, ((Number(t.amount_recovered) || 0) / max) * 100)}%` }} />
                  </div>
                </div>
              ));
            })()}
          </div>
        ) : (
          <p className="card-sub" style={{ padding: '12px 0' }}>
            No trend data from backend yet. No data is shown.
          </p>
        )}
      </div>

      {/* Recovery waterfall (live SQL buckets) */}
      {waterfall && Array.isArray(waterfall.buckets) && waterfall.buckets.length > 0 && (
        <div className="porcelain-card channel-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Recovery Waterfall</h3>
              <p className="card-sub">At Risk → Detected → Actioned → Recovered → Failed → Stopped, from live case data.</p>
            </div>
          </div>
          <div className="cause-list">
            {(() => {
              const max = Math.max(1, ...waterfall.buckets.map((b) => Number(b.amount) || 0));
              return waterfall.buckets.map((b) => (
                <div key={b.key} className="cause-item">
                  <div className="cause-row-top">
                    <span className="cause-name">{b.label}</span>
                    <span className="cause-pct">{formatINR(Number(b.amount) || 0)} · {b.cases} cases</span>
                  </div>
                  <div className="cause-bar-bg">
                    <div className="cause-bar-fill" style={{ width: `${Math.min(100, ((Number(b.amount) || 0) / max) * 100)}%` }} />
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Strategy comparison (live backend simulation, no real payments) */}
      {strategyComparison && strategyComparison.strategies && (
        <div className="porcelain-card channel-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Strategy Comparison</h3>
              <p className="card-sub">
                Simulated A/B/C intervention sequences on {strategyComparison.casesEvaluated} live cases. No real payments moved.
              </p>
            </div>
            {strategyComparison.winner && <span className="badge badge-emerald">Recommended: {strategyComparison.winner}</span>}
          </div>
          <div className="channel-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Strategy</th>
                  <th>Sequence</th>
                  <th>Recovered (₹)</th>
                  <th>Rate</th>
                  <th>Net Recovered (₹)</th>
                  <th>Successes</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(strategyComparison.strategies).map(([name, s]) => (
                  <tr key={name}>
                    <td className="font-weight-600">
                      {name} {strategyComparison.winner === name && '★'}
                    </td>
                    <td>{(s.sequence || []).join(' → ')}</td>
                    <td className="font-mono font-weight-700 emerald-text">{formatINR(s.recovered || 0)}</td>
                    <td>{((s.recoveryRate || 0) * 100).toFixed(1)}%</td>
                    <td className="font-mono">{formatINR(s.netRecovered || 0)}</td>
                    <td>{s.successful ?? '—'} / {s.cases ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Action Conversion Performance & Root Cause Distribution */}
      <div className="analytics-grid">
        {/* Left: Action Conversion Table */}
        <div className="porcelain-card channel-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Recovery Rate by Action Channel</h3>
              <p className="card-sub">Comparison of intervention success rates and net recovered revenue.</p>
            </div>
            <span className="badge badge-emerald">6 Active Channels</span>
          </div>

          <div className="channel-table-container">
            {liveActions.length > 0 ? (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Action Channel</th>
                  <th>Attempts</th>
                  <th>Successes</th>
                  <th>Success Rate</th>
                  <th>Recovered (₹)</th>
                </tr>
              </thead>
              <tbody>
                {liveActions.map((item, idx) => (
                  <tr key={idx}>
                    <td className="font-weight-600">{item.action_type}</td>
                    <td>{item.attempts}</td>
                    <td>{item.successes}</td>
                    <td>
                      <div className="rate-cell">
                        <span className="rate-number">{Number(item.success_rate || 0).toFixed(1)}%</span>
                        <div className="rate-bar-bg">
                          <div className="rate-bar-fill" style={{ width: `${Math.min(100, Number(item.success_rate) || 0)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="font-mono font-weight-700 emerald-text">{formatINR(Number(item.recovered_amount) || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            ) : (
              <div style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <p className="card-sub" style={{ margin: 0 }}>
                  No recovery actions yet — run a batch simulation to populate analytics.
                </p>
                {onGoSimulator && (
                  <button className="btn btn-primary btn-sm" onClick={onGoSimulator}>
                    <span>Go to Simulator</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Root Cause Pareto Breakdown */}
        <div className="porcelain-card pareto-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Root-Cause Failure Distribution</h3>
              <p className="card-sub">Prevalence of failure etiologies & historical recovery ease.</p>
            </div>
          </div>

          <div className="cause-list">
            {liveDiagnoses.length > 0 ? liveDiagnoses.map((cause, idx) => {
              const pct = totalDiagnosed > 0 ? (Number(cause.total) / totalDiagnosed) * 100 : 0;
              return (
              <div key={idx} className="cause-item">
                <div className="cause-row-top">
                  <span className="cause-name">{cause.diagnosis}</span>
                  <span className="cause-pct">{pct.toFixed(1)}% of all failures</span>
                </div>
                <div className="cause-bar-bg">
                  <div
                    className="cause-bar-fill"
                    style={{
                      width: `${Math.min(100, pct * 2)}%`,
                    }}
                  />
                </div>
                <div className="cause-footer">
                  <span>Count: {cause.total} cases</span>
                  <span className="recoverability">Avg Recoverability: <strong>{Number(cause.success_rate || 0).toFixed(1)}%</strong></span>
                </div>
              </div>
              );
            }) : (
              <p className="card-sub" style={{ padding: '12px 0' }}>
                No diagnosis data from backend yet. No data is shown.
              </p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .analytics-page {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .analytics-header {
          padding: 32px;
          background: linear-gradient(135deg, #FFFFFF 0%, #FAF5EE 100%);
        }

        .analytics-heading {
          font-size: 30px;
          margin: 12px 0 8px;
        }

        .analytics-sub {
          font-size: 15px;
          color: var(--text-secondary);
        }

        .ml-metrics-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        .ml-stat-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ml-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .ml-val {
          font-family: var(--font-display);
          font-size: 32px;
          font-weight: 800;
        }

        .ml-val.emerald { color: var(--accent-emerald-dark); }
        .ml-val.blue { color: var(--razorpay-blue); }
        .ml-val.purple { color: var(--accent-purple); }
        .ml-val.orange { color: var(--accent-orange); }

        .ml-note {
          font-size: 12px;
          color: var(--text-muted);
        }

        .analytics-grid {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 24px;
        }

        .channel-card, .pareto-card {
          padding: 28px;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .card-title {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .card-sub {
          font-size: 13px;
          color: var(--text-muted);
        }

        .filter-pill-strip {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .filter-pill-btn {
          border: 1px solid var(--border-subtle);
          background: #FFFFFF;
          padding: 4px 10px;
          border-radius: var(--radius-pill);
          font-size: 11.5px;
          font-weight: 600;
          color: var(--text-secondary);
          cursor: pointer;
        }

        .filter-pill-btn.active {
          background: var(--accent-orange);
          color: #FFFFFF;
          border-color: var(--accent-orange);
        }

        .custom-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13.5px;
        }

        .custom-table th {
          text-align: left;
          padding: 10px 12px;
          font-size: 11.5px;
          font-weight: 700;
          color: var(--text-muted);
          border-bottom: 1px solid var(--border-subtle);
          text-transform: uppercase;
        }

        .custom-table td {
          padding: 12px;
          border-bottom: 1px solid var(--border-subtle);
        }

        .font-weight-600 { font-weight: 600; }
        .font-weight-700 { font-weight: 700; }
        .font-mono { font-family: var(--font-mono); }
        .emerald-text { color: var(--accent-emerald-dark); }

        .rate-cell {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .rate-number {
          font-weight: 700;
          font-size: 12.5px;
          min-width: 44px;
        }

        .rate-bar-bg {
          flex: 1;
          height: 6px;
          background: var(--bg-surface-elevated);
          border-radius: 3px;
          overflow: hidden;
        }

        .rate-bar-fill {
          height: 100%;
          background: var(--accent-emerald);
          border-radius: 3px;
        }

        .cause-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .cause-item {
          background: var(--bg-card-subtle);
          border-radius: var(--radius-md);
          padding: 14px 16px;
        }

        .cause-row-top {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .cause-pct {
          color: var(--text-muted);
          font-weight: 600;
        }

        .cause-bar-bg {
          height: 6px;
          background: var(--bg-surface-elevated);
          border-radius: 3px;
          margin-bottom: 8px;
        }

        .cause-bar-fill {
          height: 100%;
          border-radius: 3px;
        }

        .cause-footer {
          display: flex;
          justify-content: space-between;
          font-size: 11.5px;
          color: var(--text-secondary);
        }

        .recoverability strong {
          color: var(--accent-emerald-dark);
        }

        @media (max-width: 1024px) {
          .ml-metrics-strip {
            grid-template-columns: repeat(2, 1fr);
          }
          .analytics-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
