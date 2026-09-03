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
 * Cases API endpoints
 */
export const casesAPI = {
  getAllCases: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return apiRequest(`/cases${params ? `?${params}` : ''}`);
  },
  getCaseById: (caseId) => apiRequest(`/cases/${caseId}`),
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
