import { useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import apiClient from '../api/client'

/**
 * Custom hook for auth operations
 * Exposes: isAuthenticated, role, logout(), refreshToken()
 * Validates: Requirements 10.6, 10.10
 */
export function useAuth() {
  const { token, role, clearToken, setToken, isAuthenticated } = useAuthStore()

  const logout = useCallback(() => {
    clearToken()
    window.location.href = '/login'
  }, [clearToken])

  const refreshToken = useCallback(async () => {
    if (!token) {
      throw new Error('No token to refresh')
    }

    try {
      const response = await apiClient.post('/auth/refresh', {})
      const { token: newToken, expires_in } = response.data.data
      setToken(newToken, role!, expires_in)
      return newToken
    } catch (error) {
      clearToken()
      window.location.href = '/login'
      throw error
    }
  }, [token, role, setToken, clearToken])

  return {
    isAuthenticated: isAuthenticated(),
    role,
    logout,
    refreshToken,
  }
}
