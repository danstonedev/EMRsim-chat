import React, { createContext, useContext, useEffect } from 'react';
import { errorLogger } from '../services/errorLogging';

interface ErrorLogContextType {
  logError: (error: Error | string, context?: Record<string, any>) => void;
}

const ErrorLogContext = createContext<ErrorLogContextType | undefined>(undefined);

export const ErrorLogProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  // Initialize error logger on mount
  useEffect(() => {
    errorLogger.init({
      flushIntervalMs: 30000, // 30 seconds
      maxBufferSize: 10
    });
    
    return () => {
      errorLogger.destroy();
    };
  }, []);

  const logError = (error: Error | string, context: Record<string, any> = {}) => {
    errorLogger.logError(error, { context });
  };

  return (
    <ErrorLogContext.Provider value={{ logError }}>
      {children}
    </ErrorLogContext.Provider>
  );
};

export const useErrorLog = (): ErrorLogContextType => {
  const context = useContext(ErrorLogContext);
  if (context === undefined) {
    throw new Error('useErrorLog must be used within an ErrorLogProvider');
  }
  return context;
};
