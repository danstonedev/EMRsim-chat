/**
 * Alert System
 * 
 * Manages monitoring alerts and notifications based on system metrics and thresholds.
 */

const logger = require('./logger');
const nodemailer = require('nodemailer');
const { formatDistanceToNow } = require('date-fns');
const config = require('../config');

// Alert severity levels
const SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical'
};

// Alert thresholds
const thresholds = {
  cpu: {
    warning: 70, // 70% CPU utilization
    critical: 90  // 90% CPU utilization
  },
  memory: {
    warning: 75, // 75% memory usage
    critical: 90  // 90% memory usage
  },
  diskSpace: {
    warning: 80, // 80% disk space usage
    critical: 95  // 95% disk space usage
  },
  responseTime: {
    warning: 1000,  // 1000ms response time
    critical: 3000  // 3000ms response time
  },
  errorRate: {
    warning: 0.01, // 1% error rate
    critical: 0.05 // 5% error rate
  },
  databaseConnections: {
    warning: 80, // 80% of max connections
    critical: 95  // 95% of max connections
  },
  activeWebSockets: {
    warning: 80, // 80% of max websocket connections
    critical: 95  // 95% of max websocket connections
  }
};

// Active alerts store
const activeAlerts = new Map();

// Create email transport for notifications
let emailTransport;
if (config.alerts.email.enabled) {
  emailTransport = nodemailer.createTransport({
    host: config.alerts.email.host,
    port: config.alerts.email.port,
    secure: config.alerts.email.secure,
    auth: {
      user: config.alerts.email.user,
      pass: config.alerts.email.password
    }
  });
}

/**
 * Initialize the alert system
 */
async function initialize() {
  logger.info('Alert system initialized with configured thresholds');
  
  if (config.alerts.email.enabled) {
    try {
      // Verify email connection
      await emailTransport.verify();
      logger.info('Email notification system verified');
    } catch (err) {
      logger.error('Failed to initialize email notifications', err);
    }
  }
}

/**
 * Process a metric and trigger alerts if thresholds are exceeded
 */
function processMetric(metricType, value, metadata = {}) {
  const threshold = thresholds[metricType];
  
  if (!threshold) {
    logger.warn(`No threshold defined for metric: ${metricType}`);
    return null;
  }
  
  let severity = null;
  
  // Check if the metric exceeds thresholds
  if (value >= threshold.critical) {
    severity = SEVERITY.CRITICAL;
  } else if (value >= threshold.warning) {
    severity = SEVERITY.WARNING;
  }
  
  // If no thresholds exceeded, check if there's an active alert to resolve
  if (!severity) {
    const alertKey = `${metricType}:${metadata.id || 'system'}`;
    if (activeAlerts.has(alertKey)) {
      const resolvedAlert = activeAlerts.get(alertKey);
      activeAlerts.delete(alertKey);
      
      // Log the resolution
      logger.info(`Alert resolved: ${metricType} value ${value} is now below threshold`, {
        metric: metricType,
        value,
        threshold: threshold.warning,
        metadata
      });
      
      // Send resolution notification
      sendAlertNotification({
        type: metricType,
        value,
        severity: SEVERITY.INFO,
        metadata,
        resolved: true,
        previousSeverity: resolvedAlert.severity,
        duration: formatDistanceToNow(new Date(resolvedAlert.timestamp))
      });
      
      return null;
    }
    
    // No threshold exceeded and no active alert to resolve
    return null;
  }
  
  // Create alert object
  const alert = {
    id: `${metricType}:${Date.now()}`,
    type: metricType,
    value,
    threshold: severity === SEVERITY.CRITICAL ? threshold.critical : threshold.warning,
    severity,
    metadata,
    timestamp: new Date().toISOString()
  };
  
  // Store alert in active alerts map
  const alertKey = `${metricType}:${metadata.id || 'system'}`;
  
  // Check if this is a new alert or an escalation
  const isNew = !activeAlerts.has(alertKey);
  const isEscalation = !isNew && 
    activeAlerts.get(alertKey).severity === SEVERITY.WARNING && 
    severity === SEVERITY.CRITICAL;
  
  // Only send notifications for new alerts or escalations
  if (isNew || isEscalation) {
    // Log the alert
    logger.warn(`Alert triggered: ${metricType} value ${value} exceeds ${severity} threshold`, {
      metric: metricType,
      value,
      threshold: alert.threshold,
      severity,
      metadata
    });
    
    // Send notification
    sendAlertNotification(alert);
  }
  
  // Update active alerts map
  activeAlerts.set(alertKey, alert);
  
  return alert;
}

/**
 * Send notification about an alert
 */
async function sendAlertNotification(alert) {
  // Skip notifications if disabled
  if (!config.alerts.enabled) return;
  
  // Format alert message
  const isResolved = alert.resolved === true;
  const emoji = isResolved ? '✅' : alert.severity === SEVERITY.CRITICAL ? '🔴' : '⚠️';
  
  const subject = isResolved
    ? `[RESOLVED] EMRsim-chat ${alert.type} alert`
    : `[${alert.severity.toUpperCase()}] EMRsim-chat ${alert.type} alert`;
    
  const message = isResolved
    ? `Alert resolved: ${alert.type} is now within acceptable thresholds.
       - Value: ${alert.value}
       - Previous Severity: ${alert.previousSeverity}
       - Duration: ${alert.duration}
       ${formatMetadata(alert.metadata)}`
    : `${emoji} ${alert.type} alert triggered:
       - Value: ${alert.value}
       - Threshold: ${alert.threshold}
       - Severity: ${alert.severity}
       ${formatMetadata(alert.metadata)}`;
  
  // Send email notification if enabled
  if (config.alerts.email.enabled) {
    try {
      await emailTransport.sendMail({
        from: config.alerts.email.from,
        to: config.alerts.email.recipients,
        subject,
        text: message
      });
    } catch (err) {
      logger.error('Failed to send email notification', err);
    }
  }
  
  // Send webhook notification if enabled
  if (config.alerts.webhook.enabled) {
    try {
      await fetch(config.alerts.webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          message,
          alert: {
            ...alert,
            applicationName: 'EMRsim-chat',
            environment: process.env.NODE_ENV || 'development',
          }
        })
      });
    } catch (err) {
      logger.error('Failed to send webhook notification', err);
    }
  }
  
  // Log the notification
  logger.info(`Alert notification sent: ${subject}`);
}

/**
 * Format metadata as a string
 */
function formatMetadata(metadata) {
  if (!metadata || Object.keys(metadata).length === 0) return '';
  
  return Object.entries(metadata)
    .map(([key, value]) => `       - ${key}: ${value}`)
    .join('\n');
}

/**
 * Get all active alerts
 */
function getActiveAlerts() {
  return Array.from(activeAlerts.values());
}

/**
 * Update alert thresholds
 */
function updateThresholds(newThresholds) {
  Object.entries(newThresholds).forEach(([key, value]) => {
    if (thresholds[key]) {
      thresholds[key] = { ...thresholds[key], ...value };
    }
  });
  
  logger.info('Alert thresholds updated', { newThresholds });
}

module.exports = {
  initialize,
  processMetric,
  getActiveAlerts,
  updateThresholds,
  SEVERITY
};
