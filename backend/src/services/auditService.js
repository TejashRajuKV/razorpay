/**
 * Audit Service - Immutable event logging for compliance and debugging
 * Records all significant decisions, actions, and state changes
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

/**
 * Log an audit event with full context
 * @param {Object} event - Event data
 * @param {String} event.entityType - Type of entity (case, action, payment, customer)
 * @param {String} event.entityId - ID of the entity
 * @param {String} event.eventType - Type of event
 * @param {Object} event.eventData - Additional event data
 * @param {Object} [event.previousState] - State before change
 * @param {Object} [event.newState] - State after change
 * @param {String} [event.userOrSystem] - Who triggered the event
 * @param {String} [event.ipAddress] - IP address of requester
 * @returns {Promise<String>} Created audit log ID
 */
async function logEvent(event) {
  const logId = uuidv4();
  
  const insertQuery = `
    INSERT INTO audit_logs 
    (id, entity_type, entity_id, event_type, event_data, 
     previous_state, new_state, user_or_system, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  await db.query(insertQuery, [
    logId,
    event.entityType,
    event.entityId,
    event.eventType,
    JSON.stringify(event.eventData || {}),
    event.previousState ? JSON.stringify(event.previousState) : null,
    event.newState ? JSON.stringify(event.newState) : null,
    event.userOrSystem || 'system',
    event.ipAddress || null
  ]);
  
  return logId;
}

/**
 * Get audit logs for a specific entity
 * @param {String} entityType - Type of entity
 * @param {String} entityId - ID of the entity
 * @param {Object} [filters] - Optional filters
 * @returns {Promise<Array>} Audit log entries
 */
async function getEntityLogs(entityType, entityId, filters = {}) {
  let whereClauses = ['entity_type = ?', 'entity_id = ?'];
  let params = [entityType, entityId];
  
  if (filters.eventType) {
    whereClauses.push('event_type = ?');
    params.push(filters.eventType);
  }
  
  if (filters.startDate) {
    whereClauses.push('created_at >= ?');
    params.push(filters.startDate);
  }
  
  if (filters.endDate) {
    whereClauses.push('created_at <= ?');
    params.push(filters.endDate);
  }
  
  const whereClause = whereClauses.join(' AND ');
  
  const query = `
    SELECT * FROM audit_logs
    WHERE ${whereClause}
    ORDER BY created_at ASC
  `;
  
  return await db.query(query, params);
}

/**
 * Get recent audit logs across all entities
 * @param {Number} limit - Maximum number of records to return
 * @returns {Promise<Array>} Recent audit logs
 */
async function getRecentLogs(limit = 100) {
  const query = `
    SELECT * FROM audit_logs
    ORDER BY created_at DESC
    LIMIT ?
  `;
  
  return await db.query(query, [limit]);
}

/**
 * Get audit trail for a recovery case including related actions
 * @param {String} caseId - Recovery case ID
 * @returns {Promise<Object>} Complete audit trail
 */
async function getCaseAuditTrail(caseId) {
  // Get case-level events
  const caseLogs = await getEntityLogs('case', caseId);
  
  // Get action IDs for this case
  const actionIdsQuery = `
    SELECT id FROM recovery_actions WHERE case_id = ?
  `;
  const actionIds = await db.query(actionIdsQuery, [caseId]);
  
  // Get action-level events
  let actionLogs = [];
  for (const action of actionIds) {
    const logs = await getEntityLogs('action', action.id);
    actionLogs = [...actionLogs, ...logs];
  }
  
  // Combine and sort by timestamp
  const allLogs = [...caseLogs, ...actionLogs].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );
  
  return {
    caseId,
    totalEvents: allLogs.length,
    events: allLogs.map(log => ({
      id: log.id,
      timestamp: log.created_at,
      entityType: log.entity_type,
      entityId: log.entity_id,
      eventType: log.event_type,
      eventData: typeof log.event_data === 'string' ? JSON.parse(log.event_data) : log.event_data,
      previousState: log.previous_state ? (typeof log.previous_state === 'string' ? JSON.parse(log.previous_state) : log.previous_state) : null,
      newState: log.new_state ? (typeof log.new_state === 'string' ? JSON.parse(log.new_state) : log.new_state) : null,
      userOrSystem: log.user_or_system
    }))
  };
}

/**
 * Get audit statistics for reporting
 * @param {String} startDate - Start date for statistics
 * @param {String} endDate - End date for statistics
 * @returns {Promise<Object>} Audit statistics
 */
async function getAuditStatistics(startDate, endDate) {
  const dateFilter = startDate && endDate 
    ? 'WHERE created_at BETWEEN ? AND ?' 
    : '';
  const params = startDate && endDate ? [startDate, endDate] : [];
  
  const statsQuery = `
    SELECT 
      COUNT(*) as total_events,
      COUNT(DISTINCT entity_id) as unique_entities,
      COUNT(DISTINCT CASE WHEN entity_type = 'case' THEN entity_id END) as cases_affected,
      COUNT(DISTINCT CASE WHEN entity_type = 'action' THEN entity_id END) as actions_logged,
      COUNT(CASE WHEN event_type LIKE '%success%' THEN 1 END) as successful_events,
      COUNT(CASE WHEN event_type LIKE '%fail%' OR event_type LIKE '%error%' THEN 1 END) as failed_events
    FROM audit_logs
    ${dateFilter}
  `;
  
  const stats = await db.query(statsQuery, params);
  
  // Get event type distribution
  const distributionQuery = `
    SELECT event_type, COUNT(*) as count
    FROM audit_logs
    ${dateFilter}
    GROUP BY event_type
    ORDER BY count DESC
  `;
  
  const distribution = await db.query(distributionQuery, params);
  
  return {
    summary: stats[0],
    eventTypeDistribution: distribution,
    period: { startDate, endDate }
  };
}

/**
 * Search audit logs by event data content
 * Useful for finding specific patterns or values
 * @param {String} searchTerm - Term to search in event_data JSON
 * @returns {Promise<Array>} Matching audit logs
 */
async function searchAuditLogs(searchTerm) {
  // Note: JSON search syntax varies by database
  // This is a simplified version for SQLite
  const query = `
    SELECT * FROM audit_logs
    WHERE event_data LIKE ?
    ORDER BY created_at DESC
    LIMIT 100
  `;
  
  return await db.query(query, [`%${searchTerm}%`]);
}

/**
 * Export audit logs for compliance/compliance reporting
 * @param {String} startDate - Start date
 * @param {String} endDate - End date
 * @returns {Promise<Array>} Exportable audit log records
 */
async function exportAuditLogs(startDate, endDate) {
  const query = `
    SELECT * FROM audit_logs
    WHERE created_at BETWEEN ? AND ?
    ORDER BY created_at ASC
  `;
  
  const logs = await db.query(query, [startDate, endDate]);
  
  return logs.map(log => ({
    timestamp: log.created_at,
    entityId: `${log.entity_type}:${log.entity_id}`,
    eventType: log.event_type,
    eventData: typeof log.event_data === 'string' ? JSON.parse(log.event_data) : log.event_data,
    previousState: log.previous_state ? JSON.parse(log.previous_state) : null,
    newState: log.new_state ? JSON.parse(log.new_state) : null,
    actor: log.user_or_system,
    ipAddress: log.ip_address
  }));
}

module.exports = {
  logEvent,
  getEntityLogs,
  getRecentLogs,
  getCaseAuditTrail,
  getAuditStatistics,
  searchAuditLogs,
  exportAuditLogs
};
