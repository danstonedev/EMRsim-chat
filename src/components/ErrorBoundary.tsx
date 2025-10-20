import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // You can log the error to an error reporting service
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Render fallback UI
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function' && this.state.error) {
          return (this.props.fallback as (error: Error) => ReactNode)(this.state.error);
        }
        return this.props.fallback;
      }
      
      // Default fallback UI
      return (
        <div className="error-boundary-fallback">
          <h2>Something went wrong</h2>
          <details>
            <summary>Error details</summary>
            <p>{this.state.error?.toString()}</p>
          </details>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Default error fallback component
export const DefaultErrorFallback: React.FC<{ error: Error | null }> = ({ error }) => (
  <div className="error-fallback">
    <h2>Something went wrong</h2>
    <p>We've encountered an unexpected error. Please try again or contact support if the issue persists.</p>
    {error && (
      <details>
        <summary>Technical details</summary>
        <pre>{error.message}</pre>
      </details>
    )}
    <button onClick={() => window.location.reload()}>Refresh page</button>
  </div>
);

// Feature-specific error fallbacks
export const SimulationErrorFallback: React.FC<{ error: Error | null }> = ({ error }) => (
  <div className="error-fallback simulation-error">
    <h2>Simulation Error</h2>
    <p>We encountered a problem with the simulation. Your progress has been saved.</p>
    <button onClick={() => window.location.reload()}>Restart simulation</button>
  </div>
);

export const ChatErrorFallback: React.FC<{ error: Error | null }> = ({ error }) => (
  <div className="error-fallback chat-error">
    <h2>Chat Connection Error</h2>
    <p>We're having trouble connecting to the chat service.</p>
    <button onClick={() => window.location.reload()}>Reconnect</button>
  </div>
);
