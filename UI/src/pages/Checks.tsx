import { useState } from 'react'
import { Plus, Pencil, Trash2, CheckCircle } from 'lucide-react'
import { useChecks, useCreateCheck, useUpdateCheck, useDeleteCheck, Check } from '../api/checks'

import { ErrorBanner } from '../components/shared/ErrorBanner'
import { EmptyState } from '../components/shared/EmptyState'
import { useAuth } from '../hooks/useAuth'

interface CheckFormProps {
  initial?: Partial<Check>
  onSubmit: (data: any) => void
  onCancel: () => void
  isLoading: boolean
}

type TimeUnit = 'seconds' | 'minutes'

interface ValueUnit {
  value: number
  unit: TimeUnit
}

function msToValueUnit(ms: number | undefined | null, fallbackMs: number): ValueUnit {
  const v = ms ?? fallbackMs
  const inMin = v / 60000
  return Number.isInteger(inMin) && inMin > 0
    ? { value: inMin, unit: 'minutes' }
    : { value: Math.round(v / 1000), unit: 'seconds' }
}

function secToValueUnit(sec: number | undefined | null): ValueUnit | undefined {
  if (sec == null) return undefined
  const inMin = sec / 60
  return Number.isInteger(inMin) && inMin > 0
    ? { value: inMin, unit: 'minutes' }
    : { value: sec, unit: 'seconds' }
}

function toBackendTimeout(value: number, unit: TimeUnit): number {
  return unit === 'minutes' ? value * 60000 : value * 1000
}

function toBackendFrequency(value: number, unit: TimeUnit): number {
  return unit === 'minutes' ? value * 60 : value
}

function CheckForm({ initial, onSubmit, onCancel, isLoading }: CheckFormProps) {
  const initTimeout = msToValueUnit(initial?.timeout_ms, 60000)
  const initFreq = secToValueUnit(initial?.default_frequency_sec)
  const [form, setForm] = useState({
    check_code: initial?.check_code ?? '',
    check_name: initial?.check_name ?? '',
    category: initial?.category ?? '',
    query_text: initial?.query_text ?? '',
    timeout_value: initTimeout.value,
    timeout_unit: initTimeout.unit,
    frequency_value: initFreq?.value,
    frequency_unit: initFreq?.unit ?? 'minutes' as TimeUnit,
    is_active: initial?.is_active ?? true,
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      check_code: form.check_code,
      check_name: form.check_name,
      category: form.category,
      query_text: form.query_text,
      timeout_ms: toBackendTimeout(form.timeout_value, form.timeout_unit),
      default_frequency_sec: form.frequency_value != null ? toBackendFrequency(form.frequency_value, form.frequency_unit) : undefined,
      is_active: form.is_active,
    })
  }

  const inputClass = 'w-full h-10 px-3 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:ring-2 focus:ring-ring outline-none transition-all duration-200 placeholder:text-muted-foreground/50'
  const selectClass = 'h-10 px-3 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:ring-2 focus:ring-ring outline-none transition-all duration-200'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Code *</label>
          <input required className={inputClass} value={form.check_code} onChange={e => set('check_code', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Name *</label>
          <input required className={inputClass} value={form.check_name} onChange={e => set('check_name', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Category *</label>
          <input required className={inputClass} placeholder="perf / avail / repl" value={form.category} onChange={e => set('category', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Timeout</label>
          <div className="flex gap-2">
            <input type="number" min={1} className={`${inputClass} w-2/3`} value={form.timeout_value} onChange={e => set('timeout_value', Number(e.target.value))} />
            <select className={`${selectClass} w-1/3`} value={form.timeout_unit} onChange={e => set('timeout_unit', e.target.value)}>
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Frequency</label>
          <div className="flex gap-2">
            <input type="number" min={1} className={`${inputClass} w-2/3`} placeholder="e.g. 30" value={form.frequency_value ?? ''} onChange={e => set('frequency_value', e.target.value ? Number(e.target.value) : undefined)} />
            <select className={`${selectClass} w-1/3`} value={form.frequency_unit} onChange={e => set('frequency_unit', e.target.value)}>
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
            </select>
          </div>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Query *</label>
        <textarea required rows={3} className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-foreground text-sm font-mono focus:ring-2 focus:ring-ring outline-none transition-all duration-200 resize-y" value={form.query_text} onChange={e => set('query_text', e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded border-border" />
        <label htmlFor="is_active" className="text-sm text-foreground font-medium">Active</label>
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
function ChecksSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" aria-hidden="true">
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <div className="h-7 w-32 skeleton" />
          <div className="h-4 w-48 skeleton" />
        </div>
        <div className="h-10 w-28 skeleton rounded-xl" />
      </div>
      <div className="glass-card overflow-hidden">
        <div className="bg-muted/50 h-10 w-full" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="px-4 py-3 flex gap-4 border-b border-border/30">
            <div className="h-4 w-20 skeleton" />
            <div className="h-4 w-32 skeleton" />
            <div className="h-4 w-16 skeleton" />
            <div className="h-4 w-12 skeleton" />
            <div className="h-4 w-12 skeleton" />
            <div className="h-4 w-8 skeleton rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function Checks() {
  const { role } = useAuth()
  const [page, setPage] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Check | null>(null)
  const [error, setError] = useState('')
  const limit = 20

  const { data, isLoading, isError } = useChecks(undefined, undefined, limit, page * limit)
  const createCheck = useCreateCheck()
  const updateCheck = useUpdateCheck()
  const deleteCheck = useDeleteCheck()

  const checks = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = Math.ceil(total / limit)

  const handleCreate = async (formData: any) => {
    try { await createCheck.mutateAsync(formData); setShowForm(false); setError('') }
    catch (e: any) { setError(e?.response?.data?.error?.message ?? 'Failed to create check') }
  }

  const handleUpdate = async (formData: any) => {
    if (!editing) return
    try { await updateCheck.mutateAsync({ checkId: editing.check_id, data: { ...formData, version: editing.version } }); setEditing(null); setError('') }
    catch (e: any) { setError(e?.response?.data?.error?.message ?? 'Failed to update check') }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this check?')) return
    try { await deleteCheck.mutateAsync(id) }
    catch (e: any) { setError(e?.response?.data?.error?.message ?? 'Failed to delete check') }
  }

  if (isLoading) return <ChecksSkeleton />

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Checks</h1>
          <p className="text-sm text-muted-foreground mt-1">Define and manage health checks for your servers</p>
        </div>
        {role === 'admin' && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold shadow-glow-sm hover:shadow-glow-md transition-all duration-300 text-sm group">
            <Plus className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" /> Add Check
          </button>
        )}
      </div>

      {/* ── Error ── */}
      {error && <ErrorBanner message={error} />}

      {/* ── Form Panel ── */}
      {(showForm || editing) && (
        <div className="glass-card p-6 border-primary/20 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">{editing ? 'Edit Check' : 'Add Check'}</h2>
              <p className="text-xs text-muted-foreground">{editing ? 'Modify the check configuration' : 'Create a new health check definition'}</p>
            </div>
          </div>
          <CheckForm
            initial={editing ?? undefined}
            onSubmit={editing ? handleUpdate : handleCreate}
            onCancel={() => { setShowForm(false); setEditing(null) }}
            isLoading={createCheck.isPending || updateCheck.isPending}
          />
        </div>
      )}

      {/* ── Table ── */}
      <div className="glass-card overflow-hidden">
        {isError ? <div className="p-6"><ErrorBanner message="Failed to load checks." /></div>
          : checks.length === 0 ? (
            <div className="p-10">
              <EmptyState icon={CheckCircle} title="No checks yet" description="Add your first health check to start monitoring" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-muted/50">
                    {['Code', 'Name', 'Category', 'Timeout', 'Frequency', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {checks.map(c => (
                    <tr key={c.check_id} className="hover:bg-muted/30 transition-colors duration-200">
                      <td className="px-4 py-3 text-sm font-mono text-foreground">{c.check_code}</td>
                      <td className="px-4 py-3 text-sm text-foreground font-medium">{c.check_name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">{c.category}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground tabular-nums">{(() => { if (c.timeout_ms == null) return '\u2014'; const vu = msToValueUnit(c.timeout_ms, 0); return `${vu.value}${vu.unit === 'minutes' ? 'm' : 's'}` })()}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground tabular-nums">{(() => { if (c.default_frequency_sec == null) return '\u2014'; const vu = secToValueUnit(c.default_frequency_sec); if (!vu) return '\u2014'; return `${vu.value}${vu.unit === 'minutes' ? 'm' : 's'}` })()}</td>
                      <td className="px-4 py-3">
                        {role === 'admin' ? (
                          <button
                            onClick={() => updateCheck.mutateAsync({ checkId: c.check_id, data: { is_active: !c.is_active, version: c.version } })}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-200 ${c.is_active ? 'bg-primary' : 'bg-muted-foreground/20'}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-card shadow-sm transition-transform duration-200 ${c.is_active ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                          </button>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${c.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {c.is_active ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {role === 'admin' && (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setEditing(c)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-all duration-200"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDelete(c.check_id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </td>
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

export default Checks
