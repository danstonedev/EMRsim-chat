import React from 'react'
import { Html } from '@react-three/drei'
import { animationError } from '../../../shared/utils/animationLogging'

type ErrorBoundaryState = { hasError: boolean; error?: any }

class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: any, info: any) {
    animationError('3D Viewer ErrorBoundary caught an error', { error, info })
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
