import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import HomePage from '../pages/HomePage'
import ChatPage from '../pages/ChatPage'
import { lazy, Suspense } from 'react'
import '../styles/viewer3d.css'
const Viewer3D = lazy(() => import('../pages/Viewer3D'))
const TranscriptPage = lazy(() => import('../pages/TranscriptPage'))

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/voice" element={<ChatPage />} />
        <Route
          path="/3d-viewer"
          element={
            <Suspense fallback={<div className="viewer3d-loading-fallback">Loading 3D Viewer...</div>}>
              <Viewer3D />
            </Suspense>
          }
        />
        <Route
          path="/transcript/:sessionId"
          element={
            <Suspense fallback={<div className="viewer3d-loading-fallback">Loading transcript…</div>}>
              <TranscriptPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
