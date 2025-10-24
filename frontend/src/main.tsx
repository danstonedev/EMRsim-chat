import { createRoot } from 'react-dom/client'
// Import all styles through a single entry point to guarantee order
import './styles/index.css'
import App from './app/App'
import { SettingsProvider } from './shared/settingsContext'
import ErrorBoundary from './shared/ErrorBoundary'

// Filter verbose console logs in development
if (import.meta.env.DEV) {
  const originalLog = console.log
  console.log = (...args: any[]) => {
    const message = args[0]?.toString() || ''
    // Suppress verbose orchestration logs
    if (message.includes('orchestration:')) return
    originalLog(...args)
  }
}

const root = createRoot(document.getElementById('root')!)
root.render(
  <ErrorBoundary>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </ErrorBoundary>
)
