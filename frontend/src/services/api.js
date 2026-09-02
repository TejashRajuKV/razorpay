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
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

/**
 * Recovery API endpoints
 */
export const recoveryAPI = {
  executeAction: (caseId, actionType) =>
    apiRequest('/recovery/execute', {
      method: 'POST',
      body: JSON.stringify({ caseId, actionType }),
    }),
  getRecoveryHistory: (caseId) => apiRequest(`/recovery/history/${caseId}`),
};

/**
 * Analytics API endpoints
 */
export const analyticsAPI = {
  getMetrics: () => apiRequest('/analytics/metrics'),
  getTrends: (timeRange = '7d') => apiRequest(`/analytics/trends?range=${timeRange}`),
  getMLInsights: () => apiRequest('/analytics/ml-insights'),
};

/**
 * Audit API endpoints
 */
export const auditAPI = {
  getLogs: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return apiRequest(`/audit${params ? `?${params}` : ''}`);
  },
  getAuditTrail: (caseId) => apiRequest(`/audit/trail/${caseId}`),
};

/**
 * Simulator API endpoints
 */
export const simulatorAPI = {
  runBatchSimulation: (batchSize = 50) =>
    apiRequest('/simulator/batch', {
      method: 'POST',
      body: JSON.stringify({ batchSize }),
    }),
  injectScenario: (scenarioKey) =>
    apiRequest('/simulator/inject', {
      method: 'POST',
      body: JSON.stringify({ scenarioKey }),
    }),
  resetSimulator: () => apiRequest('/simulator/reset', { method: 'POST' }),
};

/**
 * Health check endpoint
 */
export const healthCheck = () => apiRequest('/health');

export default {
  dashboard: dashboardAPI,
  cases: casesAPI,
  recovery: recoveryAPI,
  analytics: analyticsAPI,
  audit: auditAPI,
  simulator: simulatorAPI,
  healthCheck,
};
