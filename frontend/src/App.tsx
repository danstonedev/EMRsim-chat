import { createBrowserRouter, Navigate } from 'react-router-dom';
import DemoPage from './pages/DemoPage';

// ...existing imports

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/demo" replace /> },
  { path: '/demo', element: <DemoPage /> },
  // ...existing routes
]);

// ...existing code

export default router;