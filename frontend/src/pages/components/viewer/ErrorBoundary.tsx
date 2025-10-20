import React from 'react'
import { Html } from '@react-three/drei'

type ErrorBoundaryState = { hasError: boolean; error?: any }

class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: any) {
    // Silent error handling for production
    try {
      console.error('3D Viewer Error:', error?.message || error)
    } catch {
      /* noop */
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Html center>
          <div className="viewer-error-box">
            <div className="viewer-error-title">3D Viewer Error</div>
            <div>There was a problem rendering the model.</div>
          </div>
        </Html>
      )
    }
    return this.props.children
  }
}

export { ErrorBoundary }
export default ErrorBoundary
