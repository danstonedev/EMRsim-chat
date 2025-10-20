import React from 'react';

/**
 * Error boundary component for chat interfaces
 * Prevents errors in chat components from crashing the entire application
 */
class ChatErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  
  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    // Log the error to error tracking service and/or console
    this.setState({ errorInfo });
    
    console.error('Chat component error:', error, errorInfo);
    
    // If you have a monitoring service, log the error there
    if (window.monitoring) {
      window.monitoring.logError('chat-component-error', error, {
        componentStack: errorInfo.componentStack,
        ...this.props.metadata
      });
    }
  }
  
  resetError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };
  
  render() {
    const { hasError, error, errorInfo } = this.state;
    const { fallback, children } = this.props;
    
    if (hasError) {
      // If custom fallback provided, use it with error details
      if (fallback) {
        return fallback({ 
          error, 
          errorInfo, 
          reset: this.resetError 
        });
      }
      
      // Default error UI
      return (
        <div className="chat-error-boundary">
          <div className="error-container">
            <h3>Something went wrong with the chat component</h3>
            <p className="error-message">{error?.message || 'Unknown error'}</p>
            <button 
              onClick={this.resetError} 
              className="error-reset-button"
            >
              Try Again
            </button>
            
            {/* Show component stack in development only */}
            {process.env.NODE_ENV !== 'production' && errorInfo && (
              <details className="error-details">
                <summary>Component Stack</summary>
                <pre>{errorInfo.componentStack}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    
    // When there's no error, render children normally
    return children;
  }
}

export default ChatErrorBoundary;
