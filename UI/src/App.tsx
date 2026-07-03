import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { SessionBanner } from './components/layout/SessionBanner'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Servers from './pages/Servers'
import Checks from './pages/Checks'
import Thresholds from './pages/Thresholds'
import Alerts from './pages/Alerts'
import Incidents from './pages/Incidents'
import IncidentDetail from './pages/IncidentDetail'
import AuditLog from './pages/AuditLog'
import Settings from './pages/Settings'
import Monitoring from './pages/Monitoring'
import MonitoringDashboard from './pages/MonitoringDashboard'
import TableCountDashboard from './pages/TableCountDashboard'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <SessionBanner />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout><Dashboard /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/servers"
        element={
          <ProtectedRoute>
            <AppLayout><Servers /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/checks"
        element={
          <ProtectedRoute>
            <AppLayout><Checks /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/thresholds"
        element={
          <ProtectedRoute>
            <AppLayout><Thresholds /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/monitoring-dashboard"
        element={
          <ProtectedRoute>
            <AppLayout><MonitoringDashboard /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/alerts"
        element={
          <ProtectedRoute>
            <AppLayout><Alerts /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/incidents"
        element={
          <ProtectedRoute>
            <AppLayout><Incidents /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/incidents/:id"
        element={
          <ProtectedRoute>
            <AppLayout><IncidentDetail /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/monitoring"
        element={
          <ProtectedRoute>
            <AppLayout><Monitoring /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/table-count"
        element={
          <ProtectedRoute>
            <AppLayout><TableCountDashboard /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit"
        element={
          <ProtectedRoute requiredRole="admin">
            <AppLayout><AuditLog /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute requiredRole="admin">
            <AppLayout><Settings /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
