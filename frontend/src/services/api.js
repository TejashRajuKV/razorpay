/**
 * API Service for connecting frontend to backend
 * Base URL configuration for backend API
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

/**
 * Generic fetch wrapper with error handling
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`[API Error] ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Dashboard API endpoints
 */
export const dashboardAPI = {
  getOverview: () => apiRequest('/dashboard/overview'),
  getRevenueAtRisk: () => apiRequest('/dashboard/revenue-at-risk'),
  getCustomerSegments: () => apiRequest('/dashboard/customer-segments'),
};

/**
 * Normalize a flat backend case object into the nested shape
 * expected by Dashboard and other UI components,
 * while preserving all existing fields for backward compatibility.
 * Backend provides: customer_name, amount_at_risk, diagnosis (string), etc.
 * Dashboard expects: item.customer.name, item.customer.tier, item.payment.method, item.payment.amount, item.diagnosis.friendlyName
 */
function normalizeCase(backendCase) {
  const tier = backendCase.tier || 'GOLD';
  const diagnosisValue = typeof backendCase.diagnosis === 'string'
    ? backendCase.diagnosis
    : (backendCase.diagnosis?.friendlyName || backendCase.diagnosis?.rootCause || 'Unknown failure');
  const normalized = {
    id: backendCase.id,
    customer: {
      name: backendCase.customer_name || '',
      tier,
    },
    payment: {
      method: backendCase.payment_method || 'UPI',
      amount: backendCase.amount_at_risk || 0,
    },
    diagnosis: {
      friendlyName: diagnosisValue,
      rootCause: diagnosisValue,
    },
    status: backendCase.status || 'DETECTED',
    recoveryAmount: backendCase.recoveredAmount || 0,
  };
  return { ...backendCase, ...normalized };
}

/**
 * Cases API endpoints
 */
export const casesAPI = {
  getAllCases: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const raw = apiRequest(`/cases${params ? `?${params}` : ''}`);
    if (!raw?.success || !raw?.data?.cases) return { success: false };
    return {
      success: true,
      data: {
        cases: raw.data.cases.map(normalizeCase),
        count: raw.data.count,
      },
    };
  },
  getCaseById: (caseId) => apiRequest(`/cases/${caseId}`),
  getDecisionPreview: (caseId) => apiRequest(`/cases/${caseId}/decision-preview`),
  getRecoveryChannel: (caseId) => apiRequest(`/cases/${caseId}/recovery-channel`),
  getRecoveryMessage: (caseId, language = 'hinglish') => apiRequest(`/cases/${caseId}/recovery-message?language=${language}`),
  updateCaseStatus: (caseId, status) => 
    apiRequest(`/cases/${caseId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
};

/**
 * Normalize frontend action names to backend action names
 */
const normalizeActionName = (frontendAction) => {
  const mapping = {
    RETRY_IMMEDIATE: 'retry',
    RETRY_OPTIMAL_WINDOW: 'retry_later',
    SEND_SMART_PAYMENT_LINK: 'payment_link',
    SEND_WHATSAPP_REMINDER: 'reminder',
    SEND_REMINDER: 'reminder',
    SWITCH_PAYMENT_METHOD: 'payment_link',
    ESCALATE_HUMAN_REVIEW: 'escalate',
    STOP_RECOVERY: 'stop',
  };
  return mapping[frontendAction] || frontendAction;
};

/**
 * Recovery API endpoints
 * Backend case detail already contains actions array.
 */
export const recoveryAPI = {
  executeAction: (caseId, actionType) =>
    apiRequest(`/cases/${caseId}/action`, {
      method: 'POST',
      body: JSON.stringify({ actionType: normalizeActionName(actionType) }),
    }),
  getRecoveryHistory: async (caseId) => {
    const res = await apiRequest(`/cases/${caseId}`);
    return res?.data?.actions || res?.data || [];
  },
};

/**
 * Analytics API endpoints
 * Backend: GET /analytics/overview, GET /analytics/trends?period=daily|hourly|weekly|monthly
 */
export const analyticsAPI = {
  getOverview: () => apiRequest('/analytics/overview'),
  getMetrics: () => apiRequest('/analytics/overview'),
  getAdvanced: () => apiRequest('/analytics/advanced'),
  getAlerts: () => apiRequest('/recovery/alerts'),
  getTrends: (timeRange = '7d') => {
    const periodMap = {
      '24h': 'hourly',
      '1d': 'hourly',
      '7d': 'daily',
      '30d': 'weekly',
      '90d': 'monthly',
      daily: 'daily',
      hourly: 'hourly',
      weekly: 'weekly',
      monthly: 'monthly',
    };
    const period = periodMap[timeRange] || 'daily';
    return apiRequest(`/analytics/trends?period=${period}`);
  },
  getMLInsights: () => apiRequest('/analytics/ml-insights'),
};

/**
 * Audit API endpoints
 */
export const auditAPI = {
  getLogs: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return apiRequest(`/audit/logs${params ? `?${params}` : ''}`);
  },
  getAuditTrail: (caseId) => apiRequest(`/audit/case/${caseId}`),
};

/**
 * Simulator API endpoints
 * Backend: POST /recovery/simulate-batch { count }, POST /recovery/run-batch
 * Scenario inject/reset are FRONTEND-ONLY demo helpers (no backend endpoint).
 */
export const simulatorAPI = {
  runBatchSimulation: (batchSize = 50) =>
    apiRequest('/recovery/simulate-batch', {
      method: 'POST',
      body: JSON.stringify({ count: batchSize }),
    }),
  runBatch: (payload = {}) =>
    apiRequest('/recovery/run-batch', {
      method: 'POST',
      body: JSON.stringify({ limit: 50, ...payload }),
    }),
  injectScenario: async (scenarioKey) => {
    console.warn('[simulator] injectScenario is frontend-only demo helper, no backend call:', scenarioKey);
    return { success: true, demoOnly: true, scenarioKey };
  },
  resetSimulator: async () => {
    console.warn('[simulator] resetSimulator is frontend-only demo helper');
    return { success: true, demoOnly: true };
  },
};

/**
 * Health check endpoint
 * Backend root health is GET /health (NOT under /api/v1)
 * Must bypass API_BASE_URL prefix.
 */
const API_ROOT_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1').replace(/\/api\/v\d+$/, '');
export const healthCheck = async () => {
  const res = await fetch(`${API_ROOT_URL}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
};

export default {
  dashboard: dashboardAPI,
  cases: casesAPI,
  recovery: recoveryAPI,
  analytics: analyticsAPI,
  audit: auditAPI,
  simulator: simulatorAPI,
  healthCheck,
};
