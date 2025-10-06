import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import VoiceChatApp from './pages/App'

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/voice" element={<VoiceChatApp />} />
        <Route path="/" element={<Navigate to="/voice" replace />} />
        <Route path="*" element={<Navigate to="/voice" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
