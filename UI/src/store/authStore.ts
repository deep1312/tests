import { create } from 'zustand'

export interface AuthState {
  token: string | null
  role: 'admin' | 'viewer' | null
  expiresAt: number | null
  permissionDenied: boolean
  setToken: (token: string, role: 'admin' | 'viewer', expiresInSeconds: number) => void
  setTokenExpiresIn: (expiresInSeconds: number) => void
  clearToken: () => void
  setPermissionDenied: (denied: boolean) => void
  isAuthenticated: () => boolean
  isTokenExpiringSoon: () => boolean
}

/**
 * Zustand auth store for managing JWT token, role, and expiry
 * Validates: Requirements 10.1, 10.4, 10.9, 10.12
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('auth_token'),
  role: (localStorage.getItem('auth_role') as 'admin' | 'viewer') || null,
  expiresAt: localStorage.getItem('auth_expires_at')
    ? parseInt(localStorage.getItem('auth_expires_at')!, 10)
    : null,
  permissionDenied: false,

  setToken: (token: string, role: 'admin' | 'viewer', expiresInSeconds: number) => {
    const expiresAt = Date.now() + expiresInSeconds * 1000
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_role', role)
    localStorage.setItem('auth_expires_at', expiresAt.toString())
    set({ token, role, expiresAt, permissionDenied: false })
  },

  setTokenExpiresIn: (expiresInSeconds: number) => {
    const expiresAt = Date.now() + expiresInSeconds * 1000
    localStorage.setItem('auth_expires_at', expiresAt.toString())
    set({ expiresAt })
  },

  clearToken: () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_role')
    localStorage.removeItem('auth_expires_at')
    set({ token: null, role: null, expiresAt: null, permissionDenied: false })
  },

  setPermissionDenied: (denied: boolean) => {
    set({ permissionDenied: denied })
  },

  isAuthenticated: () => {
    const state = get()
    return state.token !== null && state.role !== null
  },

  isTokenExpiringSoon: () => {
    const state = get()
    if (!state.expiresAt) return false
    const timeUntilExpiry = state.expiresAt - Date.now()
    return timeUntilExpiry < 60_000 // Less than 60 seconds
  },
}))
