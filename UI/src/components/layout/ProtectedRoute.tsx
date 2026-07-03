import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'admin' | 'viewer'
}

/**
 * Route wrapper that redirects unauthenticated users to /login
 * Optionally enforces role-based access
 * Validates: Requirements 14.2, 10.3
 */
export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, role } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && role !== requiredRole && role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
