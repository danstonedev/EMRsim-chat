import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import AppProviders from './providers/AppProviders';
import Navigation from './components/Navigation';
import { DefaultErrorFallback } from './components/ErrorBoundary';
import './App.css';

// Lazy-loaded components for code splitting
const Home = lazy(() => import('./pages/Home'));
const SimulationWorkspace = lazy(() => import('./pages/SimulationWorkspace'));
const PatientHistory = lazy(() => import('./pages/PatientHistory'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

function App() {
  return (
    <ErrorBoundary fallback={<DefaultErrorFallback error={null} />}>
      <AppProviders>
        <BrowserRouter>
          <div className="app-container">
            <Navigation />
            
            <main className="app-main">
              <ErrorBoundary>
                <Suspense fallback={<LoadingSpinner />}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/simulation/:id" element={<SimulationWorkspace />} />
                    <Route path="/history" element={<PatientHistory />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/404" element={<NotFound />} />
                    <Route path="*" element={<Navigate to="/404" replace />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </main>
          </div>
        </BrowserRouter>
      </AppProviders>
    </ErrorBoundary>
  );
}

export default App;
