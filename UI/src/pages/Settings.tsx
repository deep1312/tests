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
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Settings</h1>
        <p className="text-[11px] text-gray-500">Platform administration and configuration</p>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="bg-white rounded-lg shadow divide-y">
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" /> Credential Rotation
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Re-encrypt all stored server passwords with the current encryption key.
                Use this after rotating the <code className="bg-gray-100 px-0.5 rounded text-[10px]">CREDENTIAL_ENCRYPTION_KEY</code>.
              </p>
              {rotateResult && (
                <p className="mt-1 text-xs text-green-600 font-medium">{rotateResult}</p>
              )}
            </div>
            <button
              onClick={handleRotateCredentials}
              disabled={rotating}
              className="ml-4 px-3 py-1.5 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 whitespace-nowrap"
            >
              {rotating ? 'Rotating\u2026' : 'Rotate Credentials'}
            </button>
          </div>
        </div>

        <div className="p-4">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <SettingsIcon className="w-3.5 h-3.5" /> Platform Info
          </h2>
          <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-gray-500">API Version</p>
              <p className="font-medium">v1</p>
            </div>
            <div>
              <p className="text-gray-500">Docs</p>
              <a href="/docs" target="_blank" className="text-blue-600 hover:underline font-medium">Swagger UI \u2192</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
