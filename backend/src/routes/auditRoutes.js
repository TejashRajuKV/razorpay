/**
 * Audit Routes - Audit trail and compliance endpoints
 * GET /api/v1/audit/logs - Get audit logs
 * GET /api/v1/audit/case/:id - Get case-specific audit trail
 * GET /api/v1/audit/stats - Get audit statistics
 */

const express = require('express');
const router = express.Router();
const auditService = require('../services/auditService');

/**
 * Get audit logs with filtering
 * Query params: entityType, entityId, eventType, startDate, endDate, limit
 */
router.get('/logs', async (req, res, next) => {
  try {
    const { 
      entityType, 
      entityId, 
      eventType, 
      startDate, 
      endDate, 
      limit = 100 
    } = req.query;
    
    let logs;
    
    if (entityType && entityId) {
      // Get logs for specific entity
      const filters = {};
      if (eventType) filters.eventType = eventType;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      
      logs = await auditService.getEntityLogs(entityType, entityId, filters);
    } else {
      // Get recent logs across all entities
      logs = await auditService.getRecentLogs(parseInt(limit));
    }
    
    res.json({
      success: true,
      data: {
        logs,
        count: logs.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get complete audit trail for a recovery case
 */
router.get('/case/:id', async (req, res, next) => {
  try {
    const auditTrail = await auditService.getCaseAuditTrail(req.params.id);
    
    res.json({
      success: true,
      data: auditTrail
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get audit statistics
 * Query params: startDate, endDate
 */
router.get('/stats', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    const stats = await auditService.getAuditStatistics(startDate, endDate);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Search audit logs by content
 * Query params: query
 */
router.get('/search', async (req, res, next) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 3 characters'
      });
    }
    
    const results = await auditService.searchAuditLogs(query);
    
    res.json({
      success: true,
      data: {
        results,
        count: results.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Export audit logs for compliance
 * Query params: startDate, endDate, format (json/csv)
 */
router.get('/export', async (req, res, next) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required for export'
      });
    }
    
    const logs = await auditService.exportAuditLogs(startDate, endDate);
    
    if (format === 'csv') {
      // Convert to CSV
      const csvRows = [];
      
      // Header
      csvRows.push('timestamp,entityId,eventType,eventData,previousState,newState,actor,ipAddress');
      
      // Data rows
      for (const log of logs) {
        csvRows.push([
          log.timestamp,
          log.entityId,
          log.eventType,
          `"${JSON.stringify(log.eventData).replace(/"/g, '""')}"`,
          log.previousState ? `"${JSON.stringify(log.previousState).replace(/"/g, '""')}"` : '',
          log.newState ? `"${JSON.stringify(log.newState).replace(/"/g, '""')}"` : '',
          log.actor,
          log.ipAddress || ''
        ].join(','));
      }
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit_export_${startDate}_${endDate}.csv"`);
      res.send(csvRows.join('\n'));
    } else {
      res.json({
        success: true,
        data: {
          exportPeriod: { startDate, endDate },
          totalRecords: logs.length,
          logs
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
