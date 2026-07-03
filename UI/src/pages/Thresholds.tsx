import { useState } from 'react'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useThresholds, useCreateThreshold, useUpdateThreshold, useDeleteThreshold, Threshold } from '../api/thresholds'
import { useChecks } from '../api/checks'
import { useServers } from '../api/servers'
import { LoadingSpinner } from '../components/shared/LoadingSpinner'
import { ErrorBanner } from '../components/shared/ErrorBanner'
import { EmptyState } from '../components/shared/EmptyState'
import { AlertTriangle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

function ThresholdForm({ initial, onSubmit, onCancel, isLoading }: {
  initial?: Partial<Threshold>
  onSubmit: (data: any) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const { data: checksData } = useChecks()
  const { data: serversData } = useServers()
  const checks = checksData?.data ?? []
  const servers = serversData?.data ?? []

  const [form, setForm] = useState({
    check_id: initial?.check_id ?? '',
    server_id: initial?.server_id ?? '',
    metric_name: initial?.metric_name ?? '',
    comparison_operator: initial?.comparison_operator ?? '>',
    warning_value: initial?.warning_value ?? '',
    critical_value: initial?.critical_value ?? '',
    is_active: initial?.is_active ?? true,
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: any = {
      check_id: Number(form.check_id),
      metric_name: form.metric_name,
      comparison_operator: form.comparison_operator,
      is_active: form.is_active,
    }
    if (form.server_id !== '') payload.server_id = Number(form.server_id)
    if (form.warning_value !== '') payload.warning_value = Number(form.warning_value)
    if (form.critical_value !== '') payload.critical_value = Number(form.critical_value)
    onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700">Check *</label>
          <select required className="mt-0.5 block w-full border rounded px-2 py-1.5 text-xs" value={form.check_id} onChange={e => set('check_id', e.target.value)}>
            <option value="">Select check...</option>
            {checks.map(c => <option key={c.check_id} value={c.check_id}>{c.check_name} (ID {c.check_id})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Server (blank = global)</label>
          <select className="mt-0.5 block w-full border rounded px-2 py-1.5 text-xs" value={form.server_id} onChange={e => set('server_id', e.target.value)}>
            <option value="">All servers (global)</option>
            {servers.filter(s => s.is_active).map(s => <option key={s.server_id} value={s.server_id}>{s.server_label} (ID {s.server_id})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Metric Name *</label>
          <input required className="mt-0.5 block w-full border rounded px-2 py-1.5 text-xs" value={form.metric_name} onChange={e => set('metric_name', e.target.value)} placeholder="e.g. connection_pct" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Operator *</label>
          <select required className="mt-0.5 block w-full border rounded px-2 py-1.5 text-xs" value={form.comparison_operator} onChange={e => set('comparison_operator', e.target.value)}>
            {['>', '<', '=', '!=', '~'].map(op => <option key={op} value={op}>{op}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Warning Value</label>
          <input type="number" step="any" className="mt-0.5 block w-full border rounded px-2 py-1.5 text-xs" value={form.warning_value} onChange={e => set('warning_value', e.target.value)} placeholder="e.g. 80" />
          <p className="text-[9px] text-gray-400 mt-0.5">Metric &gt; this value triggers a WARNING alert</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Critical Value</label>
          <input type="number" step="any" className="mt-0.5 block w-full border rounded px-2 py-1.5 text-xs" value={form.critical_value} onChange={e => set('critical_value', e.target.value)} placeholder="e.g. 95" />
          <p className="text-[9px] text-gray-400 mt-0.5">Metric &gt; this value triggers a CRITICAL alert</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <input type="checkbox" id="th_active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
        <label htmlFor="th_active" className="text-xs text-gray-700">Active</label>
      </div>
      <div className="flex justify-end gap-1.5">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={isLoading} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {isLoading ? 'Saving\u2026' : 'Save'}
        </button>
      </div>
    </form>
  )
}

export function Thresholds() {
  const { role } = useAuth()
  const [page, setPage] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Threshold | null>(null)
  const [error, setError] = useState('')
  const limit = 20

  const { data, isLoading, isError } = useThresholds(undefined, undefined, limit, page * limit)
  const { data: checksData } = useChecks()
  const { data: serversData } = useServers()
  const createThreshold = useCreateThreshold()
  const updateThreshold = useUpdateThreshold()
  const deleteThreshold = useDeleteThreshold()

  const thresholds = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = Math.ceil(total / limit)
  const checks = new Map((checksData?.data ?? []).map(c => [c.check_id, c.check_name]))
  const servers = new Map((serversData?.data ?? []).map(s => [s.server_id, s.server_label]))

  const handleCreate = async (formData: any) => {
    try { await createThreshold.mutateAsync(formData); setShowForm(false); setError('') }
    catch (e: any) { setError(e?.response?.data?.error?.message ?? 'Failed to create threshold') }
  }

  const handleUpdate = async (formData: any) => {
    if (!editing) return
    try { await updateThreshold.mutateAsync({ thresholdId: editing.threshold_id, data: { ...formData, version: editing.version } }); setEditing(null); setError('') }
    catch (e: any) { setError(e?.response?.data?.error?.message ?? 'Failed to update threshold') }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this threshold?')) return
    try { await deleteThreshold.mutateAsync(id) }
    catch (e: any) { setError(e?.response?.data?.error?.message ?? 'Failed') }
  }

  const handleToggleActive = async (t: Threshold) => {
    try { await updateThreshold.mutateAsync({ thresholdId: t.threshold_id, data: { is_active: !t.is_active, version: t.version } }) }
    catch (e: any) { setError(e?.response?.data?.error?.message ?? 'Failed to toggle') }
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Thresholds</h1>
          <p className="text-[11px] text-gray-500">Define warning and critical thresholds per check, per server, per metric</p>
        </div>
        {role === 'admin' && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs">
            <Plus className="w-3.5 h-3.5" /> Add Threshold
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      {(showForm || editing) && (
        <div className="bg-white rounded-lg shadow p-4 border border-blue-200">
          <h2 className="text-sm font-semibold mb-3">{editing ? 'Edit Threshold' : 'Add Threshold'}</h2>
          <ThresholdForm
            initial={editing ?? undefined}
            onSubmit={editing ? handleUpdate : handleCreate}
            onCancel={() => { setShowForm(false); setEditing(null) }}
            isLoading={createThreshold.isPending || updateThreshold.isPending}
          />
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? <div className="p-4"><LoadingSpinner /></div>
          : isError ? <div className="p-4"><ErrorBanner message="Failed to load thresholds." /></div>
          : thresholds.length === 0 ? <EmptyState icon={AlertTriangle} title="No thresholds yet" description="Add your first threshold to start receiving alerts for metric violations" />
          : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Check', 'Server', 'Metric', 'Operator', 'Warning', 'Critical', 'Active', ...role === 'admin' ? ['Actions'] : []].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {thresholds.map(t => (
                    <tr key={t.threshold_id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs text-gray-700">{checks.get(t.check_id) ?? `Check #${t.check_id}`}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{t.server_id ? (servers.get(t.server_id) ?? `#${t.server_id}`) : <span className="italic text-gray-400">global</span>}</td>
                      <td className="px-3 py-2 text-xs font-mono text-gray-700">{t.metric_name}</td>
                      <td className="px-3 py-2 text-xs font-mono text-gray-700">{t.comparison_operator}</td>
                      <td className="px-3 py-2 text-xs">{t.warning_value != null ? <span className="text-amber-600 font-semibold">{t.warning_value}</span> : <span className="text-gray-300">&mdash;</span>}</td>
                      <td className="px-3 py-2 text-xs">{t.critical_value != null ? <span className="text-red-600 font-semibold">{t.critical_value}</span> : <span className="text-gray-300">&mdash;</span>}</td>
                      <td className="px-3 py-2">
                        {role === 'admin' ? (
                          <button onClick={() => handleToggleActive(t)} className="text-xs">
                            {t.is_active ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                          </button>
                        ) : (
                          <span className="text-xs">{t.is_active ? <span className="text-green-600">Yes</span> : <span className="text-gray-400">No</span>}</span>
                        )}
                      </td>
                      {role === 'admin' && (
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setEditing(t)} className="text-gray-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDelete(t.threshold_id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        {totalPages > 1 && (
          <div className="px-3 py-2 border-t flex items-center justify-between text-xs text-gray-500">
            <span>Page {page + 1} of {totalPages} ({total} total)</span>
            <div className="flex gap-1.5">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-2 py-1 border rounded text-xs disabled:opacity-40">Prev</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="px-2 py-1 border rounded text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Thresholds
