import { useState } from 'react'
import { Plus, Pencil, Trash2, CheckCircle } from 'lucide-react'
import { useChecks, useCreateCheck, useUpdateCheck, useDeleteCheck, Check } from '../api/checks'
import { LoadingSpinner } from '../components/shared/LoadingSpinner'
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

  const selClass = 'mt-0.5 block w-full border rounded px-2 py-1.5 text-xs bg-white'

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700">Code *</label>
          <input required className="mt-0.5 block w-full border rounded px-2 py-1.5 text-xs" value={form.check_code} onChange={e => set('check_code', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Name *</label>
          <input required className="mt-0.5 block w-full border rounded px-2 py-1.5 text-xs" value={form.check_name} onChange={e => set('check_name', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Category *</label>
          <input required className="mt-0.5 block w-full border rounded px-2 py-1.5 text-xs" placeholder="perf / avail / repl" value={form.category} onChange={e => set('category', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Timeout</label>
          <div className="flex gap-1.5 mt-0.5">
            <input type="number" min={1} className="block w-2/3 border rounded px-2 py-1.5 text-xs" value={form.timeout_value} onChange={e => set('timeout_value', Number(e.target.value))} />
            <select className={`${selClass} w-1/3`} value={form.timeout_unit} onChange={e => set('timeout_unit', e.target.value)}>
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Frequency</label>
          <div className="flex gap-1.5 mt-0.5">
            <input type="number" min={1} className="block w-2/3 border rounded px-2 py-1.5 text-xs" placeholder="e.g. 30" value={form.frequency_value ?? ''} onChange={e => set('frequency_value', e.target.value ? Number(e.target.value) : undefined)} />
            <select className={`${selClass} w-1/3`} value={form.frequency_unit} onChange={e => set('frequency_unit', e.target.value)}>
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
            </select>
          </div>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700">Query *</label>
        <textarea required rows={3} className="mt-0.5 block w-full border rounded px-2 py-1.5 text-xs font-mono" value={form.query_text} onChange={e => set('query_text', e.target.value)} />
      </div>
      <div className="flex items-center gap-1.5">
        <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
        <label htmlFor="is_active" className="text-xs text-gray-700">Active</label>
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

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Checks</h1>
          <p className="text-[11px] text-gray-500">Define and manage health checks</p>
        </div>
        {role === 'admin' && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs">
            <Plus className="w-3.5 h-3.5" /> Add Check
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      {(showForm || editing) && (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-sm font-semibold mb-3">{editing ? 'Edit Check' : 'Add Check'}</h2>
          <CheckForm
            initial={editing ?? undefined}
            onSubmit={editing ? handleUpdate : handleCreate}
            onCancel={() => { setShowForm(false); setEditing(null) }}
            isLoading={createCheck.isPending || updateCheck.isPending}
          />
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? <div className="p-4"><LoadingSpinner /></div>
          : isError ? <div className="p-4"><ErrorBanner message="Failed to load checks." /></div>
          : checks.length === 0 ? <EmptyState icon={CheckCircle} title="No checks yet" description="Add your first health check" />
          : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Code', 'Name', 'Category', 'Timeout', 'Frequency', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {checks.map(c => (
                  <tr key={c.check_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs font-mono text-gray-700">{c.check_code}</td>
                    <td className="px-3 py-2 text-xs text-gray-900">{c.check_name}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{c.category}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{(() => { if (c.timeout_ms == null) return '\u2014'; const vu = msToValueUnit(c.timeout_ms, 0); return `${vu.value}${vu.unit === 'minutes' ? 'm' : 's'}` })()}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{(() => { if (c.default_frequency_sec == null) return '\u2014'; const vu = secToValueUnit(c.default_frequency_sec); if (!vu) return '\u2014'; return `${vu.value}${vu.unit === 'minutes' ? 'm' : 's'}` })()}</td>
                    <td className="px-3 py-2">
                      {role === 'admin' ? (
                        <button
                          onClick={() => updateCheck.mutateAsync({ checkId: c.check_id, data: { is_active: !c.is_active, version: c.version } })}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${c.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${c.is_active ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                        </button>
                      ) : (
                        <span className={`text-[10px] font-medium ${c.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                          {c.is_active ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {role === 'admin' && (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setEditing(c)} className="text-gray-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(c.check_id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

export default Checks
