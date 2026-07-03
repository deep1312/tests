import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useAuth } from '../../hooks/useAuth'
import { AlertTriangle, Loader2 } from 'lucide-react'

/**
 * Session expiry warning banner
 * Displays when X-Token-Expires-In < 60 seconds
 * Validates: Requirements 10.9, 10.12
 */
export function SessionBanner() {
  const { isTokenExpiringSoon } = useAuthStore()
  const { refreshToken } = useAuth()
  const [showBanner, setShowBanner] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    const checkTokenExpiry = () => {
      setShowBanner(isTokenExpiringSoon())
    }

    // Check every 10 seconds
    const interval = setInterval(checkTokenExpiry, 10_000)
    checkTokenExpiry()

    return () => clearInterval(interval)
  }, [isTokenExpiringSoon])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refreshToken()
      setShowBanner(false)
    } catch (error) {
      console.error('Failed to refresh token:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  if (!showBanner) return null

  return (
    <div className="mx-4 mt-2 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-warning/10 border border-warning/20 animate-slide-in">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-warning/20 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-warning" />
        </div>
        <p className="text-sm font-medium text-foreground">
          Your session is about to expire. Please refresh to continue.
        </p>
      </div>
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-warning/20 text-warning text-sm font-semibold hover:bg-warning/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isRefreshing ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Refreshing...
          </>
        ) : (
          'Refresh Session'
        )}
      </button>
    </div>
  )
}

export default SessionBanner
