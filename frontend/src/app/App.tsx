/**
 * Main application component
 * 
 * This is the root component that wraps the entire application.
 * For now, it simply renders the AppRouter, but this will become
 * the central place for app-level concerns like:
 * - Global providers (auth, theme, etc.)
 * - App-level error boundaries
 * - Loading states
 * - Layout structure
 */
import AppRouter from './AppRouter'
import BuildBadge from '../shared/BuildBadge'

export default function App() {
  return (
    <>
      <AppRouter />
      <BuildBadge />
    </>
  )
}
