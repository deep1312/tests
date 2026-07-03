import axios, { AxiosError } from 'axios'
import { useAuthStore } from '../store/authStore'

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: inject JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor: handle 401/403 and token expiry
apiClient.interceptors.response.use(
  (response) => {
    const expiresIn = response.headers['x-token-expires-in']
    if (expiresIn) {
      const expiresInSeconds = parseInt(expiresIn, 10)
      if (!isNaN(expiresInSeconds)) {
        useAuthStore.getState().setTokenExpiresIn(expiresInSeconds)
      }
    }
    return response
  },
  (error: AxiosError) => {
    const responseData = error.response?.data as any;

    // Check for 401 Status OR the specific "unauthorized" code in the response body
    if (error.response?.status === 401 || responseData?.error?.code === 'unauthorized') {
      console.warn("Session expired or unauthorized. Redirecting to login...");
      useAuthStore.getState().clearToken()
      
      // Only redirect if we aren't already on the login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    } 
    else if (error.response?.status === 403) {
      useAuthStore.getState().setPermissionDenied(true)
    }

    return Promise.reject(error)
  }
)

export default apiClient