import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ChatPage from '../pages/ChatPage'
import CaseBuilderPage from '../pages/CaseBuilderPage'
import { lazy, Suspense } from 'react'
import '../styles/viewer3d.css'
const Viewer3D = lazy(() => import('../pages/Viewer3D'))

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/voice" element={<ChatPage />} />
        <Route path="/builder" element={<CaseBuilderPage />} />
        <Route
          path="/3d-viewer"
          element={
            <Suspense fallback={<div className="viewer3d-loading-fallback">Loading 3D Viewer...</div>}>
              <Viewer3D />
            </Suspense>
          }
        />
        <Route path="/" element={<Navigate to="/3d-viewer" replace />} />
        <Route path="*" element={<Navigate to="/3d-viewer" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
