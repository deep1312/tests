import { useState } from 'react'
import apiClient from '../api/client'
import { ErrorBanner } from '../components/shared/ErrorBanner'
import { Settings as SettingsIcon, RotateCcw } from 'lucide-react'

export function Settings() {
  const [rotating, setRotating] = useState(false)
  const [rotateResult, setRotateResult] = useState<string | null>(null)
  const [error, setError] = useState('')

  const handleRotateCredentials = async () => {
    if (!confirm('This will re-encrypt all server passwords with the current key. Continue?')) return
    setRotating(true)
    setRotateResult(null)
    setError('')
    try {
      const res = await apiClient.post('/admin/credentials/rotate', {})
      const count = res.data?.data?.rotated_count ?? res.data?.data?.count ?? '?'
      setRotateResult(`Successfully rotated credentials for ${count} server(s).`)
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Credential rotation failed')
    } finally {
      setRotating(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Platform administration and configuration</p>
        </div>
      </div>

      {/* ── Error ── */}
      {error && <ErrorBanner message={error} />}

      {/* ── Credential Rotation ── */}
      <div className="glass-card overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5 text-warning" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Credential Rotation</h2>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  Re-encrypt all stored server passwords with the current encryption key.
                  Use this after rotating the <code className="bg-muted px-1.5 py-0.5 rounded-lg text-xs font-mono text-foreground">CREDENTIAL_ENCRYPTION_KEY</code>.
                </p>
                {rotateResult && (
                  <p className="mt-2 text-sm text-success font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" />
                    {rotateResult}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleRotateCredentials}
              disabled={rotating}
              className="px-4 py-2 rounded-xl bg-warning text-primary-foreground font-semibold shadow-glow-sm hover:shadow-glow-md transition-all duration-300 disabled:opacity-50 whitespace-nowrap text-sm shrink-0"
            >
              {rotating ? 'Rotating\u2026' : 'Rotate Credentials'}
            </button>
          </div>
        </div>

        {/* ── Platform Info ── */}
        <div className="p-6 border-t border-border/50">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center shrink-0">
              <SettingsIcon className="w-5 h-5 text-info" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-foreground">Platform Info</h2>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl bg-muted/50 border border-border/50 p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">API Version</p>
                  <p className="text-lg font-bold text-foreground mt-1">v1</p>
                </div>
                <div className="rounded-xl bg-muted/50 border border-border/50 p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Documentation</p>
                  <a href="/docs" target="_blank" className="text-lg font-bold text-primary hover:text-primary/80 transition-colors duration-200 mt-1 inline-flex items-center gap-1">
                    Swagger UI <span className="text-sm">→</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
