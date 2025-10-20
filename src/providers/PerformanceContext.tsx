import React, { createContext, useContext, useEffect } from 'react';
import { performanceMonitor } from '../services/performanceMonitoring';

interface PerformanceContextType {
  trackMetric: (name: string, value: number, tags?: Record<string, string>) => void;
  trackApiCall: (endpoint: string, method: string, duration: number, status: number) => void;
}

const PerformanceContext = createContext<PerformanceContextType | undefined>(undefined);

export const PerformanceProvider: React.FC<{
  children: React.ReactNode;
  sampleRate?: number;
}> = ({ children, sampleRate = 0.1 }) => {
  // Initialize performance monitoring on mount
  useEffect(() => {
    performanceMonitor.init({
      sampleRate,
      reportingInterval: 60000, // 1 minute
    });
    
    return () => {
      performanceMonitor.destroy();
    };
  }, [sampleRate]);

  const value = {
    trackMetric: (name: string, value: number, tags: Record<string, string> = {}) => {
      performanceMonitor.trackMetric(name, value, tags);
    },
    trackApiCall: (endpoint: string, method: string, duration: number, status: number) => {
      performanceMonitor.trackApiCall(endpoint, method, duration, status);
    },
  };

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  );
};

export const usePerformance = (): PerformanceContextType => {
  const context = useContext(PerformanceContext);
  if (context === undefined) {
    throw new Error('usePerformance must be used within a PerformanceProvider');
  }
  return context;
};
