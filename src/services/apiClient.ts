import axios from 'axios';
import { performanceMonitor } from './performanceMonitoring';
import { errorLogger, ErrorSeverity } from './errorLogging';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for API calls
apiClient.interceptors.request.use(
  (config) => {
    // Add request start time for performance tracking
    config.metadata = { startTime: Date.now() };
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for API calls
apiClient.interceptors.response.use(
  (response) => {
    // Calculate request duration
    if (response.config.metadata) {
      const duration = Date.now() - response.config.metadata.startTime;
      
      // Track API call performance
      performanceMonitor.trackApiCall(
        response.config.url || '',
        response.config.method?.toUpperCase() || 'UNKNOWN',
        duration,
        response.status
      );
    }
    
    return response;
  },
  (error) => {
    // Calculate request duration for failed requests
    if (error.config?.metadata) {
      const duration = Date.now() - error.config.metadata.startTime;
      
      // Track failed API call performance
      performanceMonitor.trackApiCall(
        error.config.url || '',
        error.config.method?.toUpperCase() || 'UNKNOWN',
        duration,
        error.response?.status || 0
      );
      
      // Log error for failed API calls
      errorLogger.logError(
        error,
        {
          severity: error.response?.status >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
          context: {
            url: error.config.url,
            method: error.config.method,
            status: error.response?.status,
            data: error.response?.data,
          },
          tags: ['api-error', `status-${error.response?.status || 'network'}`],
        }
      );
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
