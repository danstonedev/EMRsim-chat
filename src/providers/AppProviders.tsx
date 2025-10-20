import React from 'react';
import { UserProvider } from './UserContext';
import { SimulationProvider } from './SimulationContext';
import { UIProvider } from './UIContext';
import { ErrorLogProvider } from './ErrorLogContext';
import { PerformanceProvider } from './PerformanceContext';

interface AppProvidersProps {
  children: React.ReactNode;
}

/**
 * AppProviders component organizes all context providers in one place
 * This improves maintainability and makes the provider hierarchy clear
 */
const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <ErrorLogProvider>
      <PerformanceProvider sampleRate={0.1}>
        <UserProvider>
          <SimulationProvider>
            <UIProvider>
              {children}
            </UIProvider>
          </SimulationProvider>
        </UserProvider>
      </PerformanceProvider>
    </ErrorLogProvider>
  );
};

export default AppProviders;
