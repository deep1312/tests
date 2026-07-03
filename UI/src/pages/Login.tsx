import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import apiClient from '../api/client'
import { Database, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'
import { ThemeToggle } from '../components/ThemeToggle'

function getRoleFromToken(token: string): 'admin' | 'viewer' {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.role === 'admin' ? 'admin' : 'viewer'
  } catch {
    return 'viewer'
  }
}

export function Login() {
  const navigate = useNavigate()
  const setToken = useAuthStore((state) => state.setToken)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await apiClient.post('/auth/login', {
        username,
        password,
      })

      const { token, expires_in } = response.data.data
      const role = getRoleFromToken(token)

      setToken(token, role, expires_in)
      navigate('/')
    } catch (err: any) {
      setError('Invalid username or password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-background bg-gradient-mesh">
      {/* Left Panel — Decorative */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-primary/5" />
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-info/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 max-w-md text-center px-8">
          <div className="w-20 h-20 rounded-2xl bg-primary mx-auto mb-8 flex items-center justify-center shadow-glow-lg">
            <Database className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-foreground tracking-tight mb-4">
            PG Insides
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Enterprise-grade PostgreSQL health monitoring. Real-time insights, intelligent alerting, and comprehensive observability.
          </p>
          <div className="flex items-center justify-center gap-6 mt-10">
            {['Real-time Metrics', 'Smart Alerts', 'Deep Analytics'].map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success" />
                <span className="text-xs text-muted-foreground font-medium">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px] animate-slide-in">
          {/* Theme toggle */}
          <div className="flex justify-end mb-8">
            <ThemeToggle />
          </div>

          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow-sm">
              <Database className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">PG Insides</h1>
          </div>

          <div className="space-y-2 mb-8">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              Welcome back
            </h2>
            <p className="text-sm text-muted-foreground">
              Sign in to access your monitoring dashboard
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 animate-slide-in">
                <div className="w-2 h-2 rounded-full bg-destructive flex-shrink-0" />
                <p className="text-sm font-medium text-destructive">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-foreground mb-2">
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className="w-full h-11 px-4 rounded-xl bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200 disabled:opacity-50"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    className="w-full h-11 px-4 pr-11 rounded-xl bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200 disabled:opacity-50"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-glow-sm hover:shadow-glow-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            PostgreSQL Health Monitoring Platform • v1.0
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
