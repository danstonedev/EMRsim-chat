import React, { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';
import { ErrorBoundary } from '../ErrorBoundary';
import { usePerformance } from '../../providers/PerformanceContext';
import './MonitoringDashboard.css';

// Types
interface MetricData {
  name: string;
  value: number;
  timestamp: string;
}

interface MetricSeries {
  name: string;
  data: Array<{
    value: number;
    timestamp: string;
  }>;
}

interface ErrorData {
  count: number;
  recentErrors: Array<{
    message: string;
    timestamp: string;
    count: number;
  }>;
}

interface SystemStatus {
  status: 'operational' | 'degraded' | 'outage';
  cpu: number;
  memory: number;
  diskSpace: number;
  uptime: number;
  activeConnections: number;
}

// Dashboard component
const MonitoringDashboard: React.FC = () => {
  const [performanceMetrics, setPerformanceMetrics] = useState<MetricSeries[]>([]);
  const [errorData, setErrorData] = useState<ErrorData | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [timeRange, setTimeRange] = useState<'hour' | 'day' | 'week'>('hour');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  const { trackMetric } = usePerformance();
  
  // Load dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Track page load start time for performance measurement
        const startTime = performance.now();
        
        // Fetch metrics in parallel
        const [metricsResponse, errorsResponse, statusResponse] = await Promise.all([
          apiClient.get(`/monitoring/metrics?timeRange=${timeRange}`),
          apiClient.get('/monitoring/errors'),
          apiClient.get('/monitoring/system-status')
        ]);
        
        // Update state with fetched data
        setPerformanceMetrics(metricsResponse.data.metrics);
        setErrorData(errorsResponse.data);
        setSystemStatus(statusResponse.data);
        
        // Track dashboard load time
        const loadTime = performance.now() - startTime;
        trackMetric('dashboard_load_time', loadTime, { timeRange });
      } catch (err) {
        const fetchError = err instanceof Error ? err : new Error('Failed to fetch monitoring data');
        setError(fetchError);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDashboardData();
    
    // Set up periodic refresh
    const refreshInterval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, [timeRange, trackMetric]);
  
  // Render system status indicator
  const renderSystemStatus = () => {
    if (!systemStatus) return null;
    
    return (
      <div className={`system-status system-status-${systemStatus.status}`}>
        <h3>System Status: {systemStatus.status.toUpperCase()}</h3>
        
        <div className="status-metrics">
          <div className="status-metric">
            <span className="metric-label">CPU</span>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${systemStatus.cpu}%` }}
              />
            </div>
            <span className="metric-value">{systemStatus.cpu.toFixed(1)}%</span>
          </div>
          
          <div className="status-metric">
            <span className="metric-label">Memory</span>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${systemStatus.memory}%` }}
              />
            </div>
            <span className="metric-value">{systemStatus.memory.toFixed(1)}%</span>
          </div>
          
          <div className="status-metric">
            <span className="metric-label">Disk</span>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${systemStatus.diskSpace}%` }}
              />
            </div>
            <span className="metric-value">{systemStatus.diskSpace.toFixed(1)}%</span>
          </div>
        </div>
        
        <div className="additional-metrics">
          <div className="additional-metric">
            <span className="metric-label">Uptime</span>
            <span className="metric-value">{formatUptime(systemStatus.uptime)}</span>
          </div>
          
          <div className="additional-metric">
            <span className="metric-label">Active Connections</span>
            <span className="metric-value">{systemStatus.activeConnections}</span>
          </div>
        </div>
      </div>
    );
  };
  
  // Render performance metrics charts
  const renderPerformanceCharts = () => {
    if (performanceMetrics.length === 0) {
      return <p>No performance data available</p>;
    }
    
    return (
      <div className="performance-charts">
        {performanceMetrics.map(metric => (
          <div key={metric.name} className="metric-chart">
            <h4>{formatMetricName(metric.name)}</h4>
            <div className="chart-container">
              {/* 
                Here we'd normally use a charting library like Chart.js or Recharts
                For simplicity, showing a placeholder with the latest value
              */}
              <div className="chart-placeholder">
                <div className="chart-value">
                  {metric.data.length > 0 ? 
                    `${metric.data[metric.data.length - 1].value.toFixed(2)}ms` : 
                    'No data'
                  }
                </div>
                <div className="chart-label">Latest value</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  // Render error reports
  const renderErrorReports = () => {
    if (!errorData) {
      return <p>No error data available</p>;
    }
    
    return (
      <div className="error-reports">
        <div className="error-summary">
          <div className="error-count">
            <span className="count">{errorData.count}</span>
            <span className="label">Total Errors</span>
          </div>
        </div>
        
        <h4>Recent Errors</h4>
        <table className="error-table">
          <thead>
            <tr>
              <th>Error</th>
              <th>Time</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {errorData.recentErrors.length === 0 ? (
              <tr>
                <td colSpan={3} className="no-data">No recent errors</td>
              </tr>
            ) : (
              errorData.recentErrors.map((error, index) => (
                <tr key={index}>
                  <td className="error-message">{error.message}</td>
                  <td>{formatTime(error.timestamp)}</td>
                  <td>{error.count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  };
  
  // Utility functions for formatting
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    return `${days}d ${hours}h ${minutes}m`;
  };
  
  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString();
  };
  
  const formatMetricName = (name: string): string => {
    return name
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  return (
    <ErrorBoundary>
      <div className="monitoring-dashboard">
        <header className="dashboard-header">
          <h2>System Monitoring</h2>
          <div className="time-range-selector">
            <button 
              className={timeRange === 'hour' ? 'active' : ''} 
              onClick={() => setTimeRange('hour')}
            >
              Last Hour
            </button>
            <button 
              className={timeRange === 'day' ? 'active' : ''} 
              onClick={() => setTimeRange('day')}
            >
              Last Day
            </button>
            <button 
              className={timeRange === 'week' ? 'active' : ''} 
              onClick={() => setTimeRange('week')}
            >
              Last Week
            </button>
          </div>
        </header>
        
        {isLoading ? (
          <div className="loading-indicator">Loading dashboard data...</div>
        ) : error ? (
          <div className="error-message">
            Error loading monitoring data: {error.message}
          </div>
        ) : (
          <div className="dashboard-content">
            <section className="dashboard-section">
              <h3>System Status</h3>
              {renderSystemStatus()}
            </section>
            
            <section className="dashboard-section">
              <h3>Performance Metrics</h3>
              {renderPerformanceCharts()}
            </section>
            
            <section className="dashboard-section">
              <h3>Error Reports</h3>
              {renderErrorReports()}
            </section>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default MonitoringDashboard;
