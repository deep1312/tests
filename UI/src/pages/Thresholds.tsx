import { useState } from 'react'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useThresholds, useCreateThreshold, useUpdateThreshold, useDeleteThreshold, Threshold } from '../api/thresholds'
import { useChecks } from '../api/checks'
import { useServers } from '../api/servers'

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

  const inputClass = 'w-full h-10 px-3 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:ring-2 focus:ring-ring outline-none transition-all duration-200 placeholder:text-muted-foreground/50'
  const selectClass = 'w-full h-10 px-3 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:ring-2 focus:ring-ring outline-none transition-all duration-200'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Check *</label>
          <select required className={selectClass} value={form.check_id} onChange={e => set('check_id', e.target.value)}>
            <option value="">Select check...</option>
            {checks.map(c => <option key={c.check_id} value={c.check_id}>{c.check_name} (ID {c.check_id})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Server (blank = global)</label>
          <select className={selectClass} value={form.server_id} onChange={e => set('server_id', e.target.value)}>
            <option value="">All servers (global)</option>
            {servers.filter(s => s.is_active).map(s => <option key={s.server_id} value={s.server_id}>{s.server_label} (ID {s.server_id})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Metric Name *</label>
          <input required className={inputClass} value={form.metric_name} onChange={e => set('metric_name', e.target.value)} placeholder="e.g. connection_pct" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Operator *</label>
          <select required className={selectClass} value={form.comparison_operator} onChange={e => set('comparison_operator', e.target.value)}>
            {['>', '<', '=', '!=', '~'].map(op => <option key={op} value={op}>{op}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Warning Value</label>
          <input type="number" step="any" className={inputClass} value={form.warning_value} onChange={e => set('warning_value', e.target.value)} placeholder="e.g. 80" />
          <p className="text-[10px] text-muted-foreground mt-1.5">Metric &gt; this value triggers a WARNING alert</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Critical Value</label>
          <input type="number" step="any" className={inputClass} value={form.critical_value} onChange={e => set('critical_value', e.target.value)} placeholder="e.g. 95" />
          <p className="text-[10px] text-muted-foreground mt-1.5">Metric &gt; this value triggers a CRITICAL alert</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="th_active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded border-border" />
        <label htmlFor="th_active" className="text-sm text-foreground font-medium">Active</label>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 transition-all duration-200 text-sm">Cancel</button>
        <button type="submit" disabled={isLoading} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold shadow-glow-sm hover:shadow-glow-md transition-all duration-300 disabled:opacity-50 text-sm">
          {isLoading ? 'Saving\u2026' : 'Save'}
        </button>
      </div>
    </form>
  )
}

/* ── Skeleton ── */
function ThresholdsSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" aria-hidden="true">
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <div className="h-7 w-36 skeleton" />
          <div className="h-4 w-64 skeleton" />
        </div>
        <div className="h-10 w-36 skeleton rounded-xl" />
      </div>
      <div className="glass-card overflow-hidden">
        <div className="bg-muted/50 h-10 w-full" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="px-4 py-3 flex gap-4 border-b border-border/30">
            <div className="h-4 w-24 skeleton" />
            <div className="h-4 w-20 skeleton" />
            <div className="h-4 w-28 skeleton" />
            <div className="h-4 w-10 skeleton" />
            <div className="h-4 w-14 skeleton" />
            <div className="h-4 w-14 skeleton" />
            <div className="h-4 w-8 skeleton" />
          </div>
        ))}
      </div>
    </div>
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

  if (isLoading) return <ThresholdsSkeleton />

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Thresholds</h1>
          <p className="text-sm text-muted-foreground mt-1">Define warning and critical thresholds per check, per server, per metric</p>
        </div>
        {role === 'admin' && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold shadow-glow-sm hover:shadow-glow-md transition-all duration-300 text-sm group">
            <Plus className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" /> Add Threshold
          </button>
        )}
      </div>

      {/* ── Error ── */}
      {error && <ErrorBanner message={error} />}

      {/* ── Form Panel ── */}
      {(showForm || editing) && (
        <div className="glass-card p-6 border-primary/20 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">{editing ? 'Edit Threshold' : 'Add Threshold'}</h2>
              <p className="text-xs text-muted-foreground">{editing ? 'Modify threshold configuration' : 'Define a new alerting threshold'}</p>
            </div>
          </div>
          <ThresholdForm
            initial={editing ?? undefined}
            onSubmit={editing ? handleUpdate : handleCreate}
            onCancel={() => { setShowForm(false); setEditing(null) }}
            isLoading={createThreshold.isPending || updateThreshold.isPending}
          />
        </div>
      )}

      {/* ── Table ── */}
      <div className="glass-card overflow-hidden">
        {isError ? <div className="p-6"><ErrorBanner message="Failed to load thresholds." /></div>
          : thresholds.length === 0 ? (
            <div className="p-10">
              <EmptyState icon={AlertTriangle} title="No thresholds yet" description="Add your first threshold to start receiving alerts for metric violations" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-muted/50">
                    {['Check', 'Server', 'Metric', 'Operator', 'Warning', 'Critical', 'Active', ...role === 'admin' ? ['Actions'] : []].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {thresholds.map(t => (
                    <tr key={t.threshold_id} className="hover:bg-muted/30 transition-colors duration-200">
                      <td className="px-4 py-3 text-sm text-foreground font-medium">{checks.get(t.check_id) ?? `Check #${t.check_id}`}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {t.server_id ? (
                          servers.get(t.server_id) ?? `#${t.server_id}`
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-info/10 text-info border border-info/20">global</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-foreground">{t.metric_name}</td>
                      <td className="px-4 py-3 text-sm font-mono text-foreground font-semibold">{t.comparison_operator}</td>
                      <td className="px-4 py-3 text-sm">
                        {t.warning_value != null ? (
                          <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-warning/10 text-warning tabular-nums">{t.warning_value}</span>
                        ) : (
                          <span className="text-muted-foreground/50">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {t.critical_value != null ? (
                          <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-destructive/10 text-destructive tabular-nums">{t.critical_value}</span>
                        ) : (
                          <span className="text-muted-foreground/50">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {role === 'admin' ? (
                          <button onClick={() => handleToggleActive(t)} className="transition-all duration-200">
                            {t.is_active ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                          </button>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${t.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${t.is_active ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                            {t.is_active ? 'Yes' : 'No'}
                          </span>
                        )}
                      </td>
                      {role === 'admin' && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setEditing(t)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-all duration-200"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDelete(t.threshold_id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Page {page + 1} of {totalPages} ({total} total)
            </span>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-4 py-2 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 transition-all duration-200 text-sm disabled:opacity-30">Prev</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold shadow-glow-sm hover:shadow-glow-md transition-all duration-300 text-sm disabled:opacity-30">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Thresholds
