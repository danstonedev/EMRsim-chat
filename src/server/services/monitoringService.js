/**
 * Monitoring Service
 * 
 * Collects system metrics and manages monitoring data.
 */

const os = require('os');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const dbClient = require('../database/dbClient');
const logger = require('../utils/logger');
const alertSystem = require('../utils/alertSystem');
const config = require('../config');

// Metrics cache
let metricsCache = {
  system: {
    lastUpdated: 0,
    data: null
  },
  applications: {
    lastUpdated: 0,
    data: null
  },
  performance: {
    hour: { lastUpdated: 0, data: [] },
    day: { lastUpdated: 0, data: [] },
    week: { lastUpdated: 0, data: [] }
  },
  errors: {
    lastUpdated: 0,
    data: null
  }
};

// Cache TTL in milliseconds
const CACHE_TTL = {
  SYSTEM: 60 * 1000, // 1 minute
  APPLICATION: 5 * 60 * 1000, // 5 minutes
  PERFORMANCE: 10 * 60 * 1000, // 10 minutes
  ERRORS: 2 * 60 * 1000 // 2 minutes
};

/**
 * Initialize monitoring service
 */
async function initialize() {
  logger.info('Initializing monitoring service');
  await alertSystem.initialize();
  
  // Schedule regular metric collection
  setInterval(collectSystemMetrics, config.monitoring.collectionInterval || 60000);
  
  // Collect initial metrics
  await collectSystemMetrics();
  
  logger.info('Monitoring service initialized');
}

/**
 * Get system status information
 */
async function getSystemStatus() {
  if (Date.now() - metricsCache.system.lastUpdated <= CACHE_TTL.SYSTEM) {
    return metricsCache.system.data;
  }
  
  await collectSystemMetrics();
  return metricsCache.system.data;
}

/**
 * Get performance metrics
 */
async function getPerformanceMetrics(timeRange = 'hour') {
  if (Date.now() - metricsCache.performance[timeRange].lastUpdated <= CACHE_TTL.PERFORMANCE) {
    return metricsCache.performance[timeRange].data;
  }
  
  const metrics = await fetchPerformanceMetrics(timeRange);
  metricsCache.performance[timeRange] = {
    lastUpdated: Date.now(),
    data: metrics
  };
  
  return metrics;
}

/**
 * Get error data
 */
async function getErrorData() {
  if (Date.now() - metricsCache.errors.lastUpdated <= CACHE_TTL.ERRORS) {
    return metricsCache.errors.data;
  }
  
  const errors = await fetchErrorData();
  metricsCache.errors = {
    lastUpdated: Date.now(),
    data: errors
  };
  
  return errors;
}

/**
 * Get all active alerts
 */
function getActiveAlerts() {
  return alertSystem.getActiveAlerts();
}

/**
 * Collect system metrics
 */
async function collectSystemMetrics() {
  try {
    // Get CPU usage
    const cpuUsage = await calculateCPUUsage();
    
    // Get memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;
    
    // Get disk usage
    const diskUsage = await calculateDiskUsage();
    
    // Get system uptime
    const uptime = os.uptime();
    
    // Get active connections
    const activeConnections = await getActiveConnections();
    
    // Determine overall status
    let status = 'operational';
    if (cpuUsage > 90 || memoryUsage > 90 || diskUsage > 95) {
      status = 'outage';
    } else if (cpuUsage > 70 || memoryUsage > 70 || diskUsage > 80) {
      status = 'degraded';
    }
    
    // Create system status object
    const systemStatus = {
      status,
      cpu: cpuUsage,
      memory: memoryUsage,
      diskSpace: diskUsage,
      uptime,
      activeConnections,
      timestamp: new Date().toISOString()
    };
    
    // Update cache
    metricsCache.system = {
      lastUpdated: Date.now(),
      data: systemStatus
    };
    
    // Process metrics for alerts
    alertSystem.processMetric('cpu', cpuUsage);
    alertSystem.processMetric('memory', memoryUsage);
    alertSystem.processMetric('diskSpace', diskUsage);
    alertSystem.processMetric('databaseConnections', activeConnections.database.percentage);
    alertSystem.processMetric('activeWebSockets', activeConnections.websockets.percentage);
    
    // Log system status periodically
    logger.debug('System metrics collected', systemStatus);
    
    return systemStatus;
  } catch (err) {
    logger.error('Failed to collect system metrics', err);
    throw err;
  }
}

/**
 * Calculate CPU usage
 */
async function calculateCPUUsage() {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;
  
  // Calculate CPU usage across all cores
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }
  
  // Calculate the average CPU usage percentage
  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;
  const usagePercent = 100 - (100 * idle / total);
  
  return parseFloat(usagePercent.toFixed(2));
}

/**
 * Calculate disk usage
 */
async function calculateDiskUsage() {
  try {
    const { stdout } = await exec('df -h / | tail -1 | awk \'{print $5}\'');
    const usagePercent = parseInt(stdout.trim().replace('%', ''));
    return usagePercent;
  } catch (err) {
    logger.error('Failed to calculate disk usage', err);
    return 0; // Return 0 on failure to avoid triggering false alerts
  }
}

/**
 * Get active connections
 */
async function getActiveConnections() {
  try {
    // Get database connections
    let dbConnections;
    if (dbClient.getDatabaseType() === 'postgres') {
      const result = await dbClient.query('SELECT count(*) as active, max_conn FROM pg_stat_activity, pg_settings WHERE name = \'max_connections\'');
      const active = parseInt(result.rows[0].active);
      const max = parseInt(result.rows[0].max_conn);
      dbConnections = { active, max, percentage: (active / max) * 100 };
    } else {
      // SQLite doesn't have connection pooling in the same way
      dbConnections = { active: 1, max: 1, percentage: 0 };
    }
    
    // Get WebSocket connections from global.WebSocketServer if available
    let webSocketConnections;
    if (global.WebSocketServer && typeof global.WebSocketServer.getConnections === 'function') {
      const connections = await new Promise((resolve) => {
        global.WebSocketServer.getConnections((err, count) => {
          resolve(err ? 0 : count);
        });
      });
      
      const maxConnections = config.websocket.maxConnections || 100;
      webSocketConnections = {
        active: connections,
        max: maxConnections,
        percentage: (connections / maxConnections) * 100
      };
    } else {
      webSocketConnections = { active: 0, max: 100, percentage: 0 };
    }
    
    return {
      database: dbConnections,
      websockets: webSocketConnections,
      total: dbConnections.active + webSocketConnections.active
    };
  } catch (err) {
    logger.error('Failed to get active connections', err);
    return {
      database: { active: 0, max: 1, percentage: 0 },
      websockets: { active: 0, max: 1, percentage: 0 },
      total: 0
    };
  }
}

/**
 * Fetch performance metrics from database
 */
async function fetchPerformanceMetrics(timeRange = 'hour') {
  try {
    let timeConstraint;
    
    switch (timeRange) {
      case 'day':
        timeConstraint = dbClient.createPortableQuery({
          sqlite: "datetime('now', '-1 day')",
          postgres: "NOW() - INTERVAL '1 day'"
        });
        break;
      case 'week':
        timeConstraint = dbClient.createPortableQuery({
          sqlite: "datetime('now', '-7 days')",
          postgres: "NOW() - INTERVAL '7 days'"
        });
        break;
      case 'hour':
      default:
        timeConstraint = dbClient.createPortableQuery({
          sqlite: "datetime('now', '-1 hour')",
          postgres: "NOW() - INTERVAL '1 hour'"
        });
        break;
    }
    
    const query = dbClient.createPortableQuery({
      sqlite: `
        SELECT name, AVG(value) as avg_value, MAX(value) as max_value, MIN(value) as min_value,
        strftime('%Y-%m-%dT%H:%M:00Z', timestamp) as time_bucket
        FROM performance_metrics
        WHERE timestamp >= ${timeConstraint}
        GROUP BY name, time_bucket
        ORDER BY time_bucket ASC
      `,
      postgres: `
        SELECT name, AVG(value) as avg_value, MAX(value) as max_value, MIN(value) as min_value,
        date_trunc('minute', timestamp) as time_bucket
        FROM performance_metrics
        WHERE timestamp >= ${timeConstraint}
        GROUP BY name, time_bucket
        ORDER BY time_bucket ASC
      `
    });
    
    const result = await dbClient.query(query);
    
    // Transform results into time series by metric name
    const metricsByName = {};
    
    for (const row of result.rows) {
      if (!metricsByName[row.name]) {
        metricsByName[row.name] = [];
      }
      
      metricsByName[row.name].push({
        timestamp: row.time_bucket,
        value: parseFloat(row.avg_value),
        min: parseFloat(row.min_value),
        max: parseFloat(row.max_value)
      });
    }
    
    // Convert to array format for API
    return Object.entries(metricsByName).map(([name, data]) => ({
      name,
      data
    }));
  } catch (err) {
    logger.error(`Failed to fetch performance metrics for ${timeRange}`, err);
    return [];
  }
}

/**
 * Fetch error data from database
 */
async function fetchErrorData() {
  try {
    // Count total errors in the last 24 hours
    const countQuery = dbClient.createPortableQuery({
      sqlite: "SELECT COUNT(*) as count FROM error_logs WHERE timestamp >= datetime('now', '-1 day')",
      postgres: "SELECT COUNT(*) as count FROM error_logs WHERE timestamp >= NOW() - INTERVAL '1 day'"
    });
    
    // Get recent errors grouped by message
    const errorsQuery = dbClient.createPortableQuery({
      sqlite: `
        SELECT message, COUNT(*) as count, MAX(timestamp) as latest_timestamp
        FROM error_logs
        WHERE timestamp >= datetime('now', '-1 day')
        GROUP BY message
        ORDER BY latest_timestamp DESC
        LIMIT 10
      `,
      postgres: `
        SELECT message, COUNT(*) as count, MAX(timestamp) as latest_timestamp
        FROM error_logs
        WHERE timestamp >= NOW() - INTERVAL '1 day'
        GROUP BY message
        ORDER BY latest_timestamp DESC
        LIMIT 10
      `
    });
    
    const [countResult, errorsResult] = await Promise.all([
      dbClient.queryOne(countQuery),
      dbClient.query(errorsQuery)
    ]);
    
    // Process error rate - number of errors compared to total requests
    const requestCountQuery = dbClient.createPortableQuery({
      sqlite: "SELECT COUNT(*) as count FROM request_logs WHERE timestamp >= datetime('now', '-1 day')",
      postgres: "SELECT COUNT(*) as count FROM request_logs WHERE timestamp >= NOW() - INTERVAL '1 day'"
    });
    
    const requestCountResult = await dbClient.queryOne(requestCountQuery);
    const requestCount = parseInt(requestCountResult.count);
    const errorCount = parseInt(countResult.count);
    
    const errorRate = requestCount > 0 ? errorCount / requestCount : 0;
    
    // Process error rate for alerts
    alertSystem.processMetric('errorRate', errorRate);
    
    return {
      count: errorCount,
      rate: errorRate,
      recentErrors: errorsResult.rows.map(row => ({
        message: row.message,
        count: parseInt(row.count),
        timestamp: row.latest_timestamp
      }))
    };
  } catch (err) {
    logger.error('Failed to fetch error data', err);
    return {
      count: 0,
      rate: 0,
      recentErrors: []
    };
  }
}

/**
 * Track a performance metric
 */
async function trackPerformanceMetric(name, value, tags = {}) {
  try {
    const query = dbClient.createPortableQuery({
      sqlite: `
        INSERT INTO performance_metrics (name, value, tags, timestamp)
        VALUES (?, ?, ?, datetime('now'))
      `,
      postgres: `
        INSERT INTO performance_metrics (name, value, tags, timestamp)
        VALUES ($1, $2, $3, NOW())
      `
    });
    
    await dbClient.query(query, [
      name,
      value,
      JSON.stringify(tags)
    ]);
    
    // Check if this is a response time metric that should trigger alerts
    if (name === 'api_response_time' || name === 'page_load_time') {
      alertSystem.processMetric('responseTime', value, { endpoint: tags.endpoint });
    }
  } catch (err) {
    logger.error(`Failed to track performance metric: ${name}`, err);
  }
}

/**
 * Track an error occurrence
 */
async function trackError(error, context = {}) {
  try {
    const query = dbClient.createPortableQuery({
      sqlite: `
        INSERT INTO error_logs (message, stack, context, timestamp)
        VALUES (?, ?, ?, datetime('now'))
      `,
      postgres: `
        INSERT INTO error_logs (message, stack, context, timestamp)
        VALUES ($1, $2, $3, NOW())
      `
    });
    
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : null;
    
    await dbClient.query(query, [
      message,
      stack,
      JSON.stringify(context)
    ]);
  } catch (err) {
    logger.error('Failed to track error', err);
  }
}

module.exports = {
  initialize,
  getSystemStatus,
  getPerformanceMetrics,
  getErrorData,
  getActiveAlerts,
  trackPerformanceMetric,
  trackError
};
