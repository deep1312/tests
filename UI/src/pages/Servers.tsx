import { useState, useMemo, useEffect } from 'react'
import { Plus, Pencil, Trash2, Server as ServerIcon, Globe, Database, ShieldCheck, Activity, ChevronDown, ChevronRight, Clock } from 'lucide-react'
import { useServers, useCreateServer, useUpdateServer, useDeactivateServer, useActivateServer, useDeleteServer, Server } from '../api/servers'
import { useMappings, useUpdateMapping, useChecks, Mapping } from '../api/checks'
import { LoadingSpinner } from '../components/shared/LoadingSpinner'
import { ErrorBanner } from '../components/shared/ErrorBanner'
import { EmptyState } from '../components/shared/EmptyState'
import { useAuth } from '../hooks/useAuth'

type TimeUnit = 'seconds' | 'minutes'

function secToValueUnit(sec: number | undefined | null): { value: number; unit: TimeUnit } | undefined {
  if (sec == null) return undefined
  const inMin = sec / 60
  return Number.isInteger(inMin) && inMin > 0
    ? { value: inMin, unit: 'minutes' }
    : { value: sec, unit: 'seconds' }
}

function toBackendFrequency(value: number, unit: TimeUnit): number {
  return unit === 'minutes' ? value * 60 : value
}

function formatFreq(sec: number | undefined | null): string {
  const vu = secToValueUnit(sec)
  if (!vu) return '\u2014'
  return `${vu.value}${vu.unit === 'minutes' ? 'm' : 's'}`
}

interface ServerFormProps {
  initial?: Partial<Server> & { password?: string }
  onSubmit: (data: any) => void
  onCancel: () => void
  isLoading: boolean
}

function ServerForm({ initial, onSubmit, onCancel, isLoading }: ServerFormProps) {
  const [form, setForm] = useState({
    server_label: initial?.server_label ?? '',
    server_ip: initial?.server_ip ?? '',
    port: initial?.port ?? 5432,
    db_name: initial?.db_name ?? '',
    username: initial?.username ?? '',
    password: '',
    env_type: initial?.env_type ?? '',
    server_role: initial?.server_role ?? '',
    ssl_mode: initial?.ssl_mode ?? 'prefer',
  })

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const payload: any = {
      server_label: form.server_label.trim(),
      server_ip: form.server_ip.trim(),
      port: parseInt(form.port.toString(), 10),
      db_name: form.db_name.trim(),
      username: form.username.trim(),
      ssl_mode: form.ssl_mode,
    }

    if (form.password) {
      payload.password = form.password
    }

    if (form.env_type.trim()) payload.env_type = form.env_type.trim()
    if (form.server_role.trim()) payload.server_role = form.server_role.trim()

    onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1">Identification</h3>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">Label *</label>
            <input required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" placeholder="Production Cluster A" value={form.server_label} onChange={e => set('server_label', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Host / IP *</label>
              <input required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" value={form.server_ip} onChange={e => set('server_ip', e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Port *</label>
              <input required type="number" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" value={form.port} onChange={e => set('port', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1">Database Credentials</h3>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">Database *</label>
            <input required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" value={form.db_name} onChange={e => set('db_name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Username *</label>
              <input required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" value={form.username} onChange={e => set('username', e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Password {initial ? '(Unchanged)' : '*'}</label>
              <input type="password" required={!initial} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" value={form.password} onChange={e => set('password', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1">Server Classification</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">Environment Type</label>
            <input className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" placeholder="e.g. production, staging, uat" value={form.env_type} onChange={e => set('env_type', e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">Server Role</label>
            <input className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" placeholder="e.g. primary, secondary, standalone" value={form.server_role} onChange={e => set('server_role', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="px-4 py-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
        <button type="submit" disabled={isLoading} className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm shadow-blue-200 disabled:opacity-50 transition-all active:scale-95">
          {isLoading ? 'Validating...' : 'Save'}
        </button>
      </div>
    </form>
  )
}

interface FreqEditorProps {
  mapping: Mapping
  checkName: string
  defaultFreqSec: number | undefined | null
  onSave: (mappingId: number, customFrequencySec: number | null) => Promise<void>
  onToggleEnabled: (mappingId: number, isEnabled: boolean) => Promise<void>
  isSaving: boolean
}

function FreqEditor({ mapping, checkName, defaultFreqSec, onSave, onToggleEnabled, isSaving }: FreqEditorProps) {
  const effectiveSec = mapping.custom_frequency_sec ?? defaultFreqSec ?? 30
  const effective = secToValueUnit(effectiveSec) ?? { value: 30, unit: 'seconds' as TimeUnit }

  const [editValue, setEditValue] = useState(effective.value)
  const [editUnit, setEditUnit] = useState<TimeUnit>(effective.unit)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!dirty) {
      setEditValue(effective.value)
      setEditUnit(effective.unit)
    }
  }, [mapping.custom_frequency_sec, defaultFreqSec])

  const handleSave = async () => {
    await onSave(mapping.mapping_id, toBackendFrequency(editValue, editUnit))
    setDirty(false)
  }

  const handleClear = async () => {
    await onSave(mapping.mapping_id, null as any)
    setDirty(false)
  }

  return (
    <div className="flex items-center gap-1.5 py-1.5 border-b border-slate-50 last:border-0">
      <button
        onClick={() => onToggleEnabled(mapping.mapping_id, !mapping.is_enabled)}
        disabled={isSaving}
        className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors shrink-0 ${
          mapping.is_enabled ? 'bg-emerald-400' : 'bg-slate-300'
        }`}
        title={mapping.is_enabled ? 'Disable check' : 'Enable check'}
      >
        <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow-sm transition-transform ${
          mapping.is_enabled ? 'translate-x-[12px]' : 'translate-x-[1px]'
        }`} />
      </button>
      <span className="text-[11px] font-medium text-slate-700 truncate max-w-[90px]">{checkName}</span>
      <span className="text-[8px] font-mono text-slate-400 shrink-0">({formatFreq(defaultFreqSec)})</span>
      {mapping.is_enabled ? (
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          <input
            type="number"
            min={1}
            className="w-12 border border-slate-200 rounded px-1 py-1 text-[9px] font-mono text-slate-700 bg-white focus:ring-2 focus:ring-blue-500/20 outline-none"
            value={editValue}
            onChange={e => { setEditValue(Number(e.target.value)); setDirty(true) }}
          />
          <select
            className="border border-slate-200 rounded px-0.5 py-1 text-[9px] bg-white outline-none"
            value={editUnit}
            onChange={e => { setEditUnit(e.target.value as TimeUnit); setDirty(true) }}
          >
            <option value="seconds">s</option>
            <option value="minutes">m</option>
          </select>
          {dirty && (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-1.5 py-1 text-[8px] font-black uppercase bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-all"
              >
                {isSaving ? '..' : 'Sv'}
              </button>
              <button
                onClick={() => { setEditValue(effective.value); setEditUnit(effective.unit); setDirty(false) }}
                className="px-1 py-1 text-[8px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
              >
                X
              </button>
            </>
          )}
          {mapping.custom_frequency_sec != null && !dirty && (
            <button
              onClick={handleClear}
              className="px-1 py-1 text-[8px] font-bold text-rose-300 hover:text-rose-500 transition-colors"
              title="Clear override"
            >
              &times;
            </button>
          )}
        </div>
      ) : (
        <span className="text-[8px] text-slate-300 italic ml-auto">off</span>
      )}
    </div>
  )
}

interface ServerCardProps {
  server: Server
  role: string | undefined
  deactivate: any
  activate: any
  deleteServer: any
  updateMapping: any
  onEdit: (s: Server) => void
  onDelete: (id: number) => void
  onDeactivate: (id: number) => void
  onActivate: (id: number) => void
  onSaveMappingFreq: (mappingId: number, customFrequencySec: number | null) => Promise<void>
  onToggleMappingEnabled: (mappingId: number, isEnabled: boolean) => Promise<void>
  checkNameMap: Map<number, string>
  checkDefaultFreqMap: Map<number, number | undefined>
  onError: (msg: string) => void
}

function ServerCard({
  server: s,
  role,
  deactivate,
  activate,
  updateMapping,
  onEdit,
  onDelete,
  onDeactivate,
  onActivate,
  onSaveMappingFreq,
  onToggleMappingEnabled,
  checkNameMap,
  checkDefaultFreqMap,
  onError,
}: ServerCardProps) {
  const [expanded, setExpanded] = useState(false)

  const { data: mappingsData, isLoading: mappingsLoading } = useMappings(
    s.server_id,
    undefined,
    100,
    0,
    { enabled: expanded }
  )
  const mappings = mappingsData?.data ?? []

  return (
    <div className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-16 h-16 -mr-5 -mt-5 rounded-full opacity-5 ${s.is_active ? 'bg-emerald-500' : 'bg-slate-500'}`} />
      
      <div className="p-3">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${s.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 truncate max-w-[130px]">{s.server_label}</h3>
              <div className="flex items-center gap-1 mt-0.5">
                {s.is_active ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[8px] font-bold leading-tight">
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[8px] font-bold leading-tight">
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    Inactive
                  </span>
                )}
                {s.is_di_server && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[8px] font-bold leading-tight">
                    DI Server
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {role === 'admin' && (
              <>
                <button onClick={() => onEdit(s)} className="p-1 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => onDelete(s.server_id)} className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-1 mb-2">
          <div className="flex items-center justify-between text-[11px] font-medium">
            <span className="text-slate-400 flex items-center gap-1"><Globe className="w-3 h-3" /> Endpoint</span>
            <span className="text-slate-700 font-mono">{s.server_ip}:{s.port}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-medium">
            <span className="text-slate-400 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Environment</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${s.env_type === 'prod' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
              {s.env_type?.toUpperCase() || 'N/A'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-medium">
            <span className="text-slate-400 flex items-center gap-1"><Activity className="w-3 h-3" /> Role</span>
            <span className="text-slate-700">{s.server_role || 'Standalone'}</span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">DB: {s.db_name}</span>
          <div className="flex items-center gap-1.5">
            {role === 'admin' ? (
              <>
                <button
                  onClick={() => s.is_active ? onDeactivate(s.server_id) : onActivate(s.server_id)}
                  disabled={deactivate.isPending || activate.isPending}
                  className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                    s.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${
                    s.is_active ? 'translate-x-[14px]' : 'translate-x-[1px]'
                  }`} />
                </button>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  {s.is_active ? 'Active' : 'Inactive'}
                </span>
              </>
            ) : (
              <span className={`text-[9px] font-bold uppercase tracking-wider ${s.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>
                {s.is_active ? 'Active' : 'Inactive'}
              </span>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border-t border-slate-100 transition-colors text-[10px] font-bold text-slate-500 uppercase tracking-wider"
      >
        <span className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          Check Frequencies
        </span>
        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-white px-3 py-2 max-h-64 overflow-y-auto">
          {mappingsLoading ? (
            <div className="py-2"><LoadingSpinner /></div>
          ) : mappings.length === 0 ? (
            <p className="text-[10px] text-slate-400 py-1 italic">No checks mapped to this server.</p>
          ) : (
            <div>
              <div className="flex items-center justify-between text-[8px] font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100 mb-1">
                <span>Check</span>
                <span>Frequency Override</span>
              </div>
              {mappings.map(m => (
                <FreqEditor
                  key={m.mapping_id}
                  mapping={m}
                  checkName={checkNameMap.get(m.check_id) ?? `Check #${m.check_id}`}
                  defaultFreqSec={checkDefaultFreqMap.get(m.check_id)}
                  onSave={onSaveMappingFreq}
                  onToggleEnabled={onToggleMappingEnabled}
                  isSaving={updateMapping.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function Servers() {
  const { role } = useAuth()
  const [page, setPage] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Server | null>(null)
  const [error, setError] = useState('')
  const limit = 20

  const { data, isLoading, isError } = useServers(undefined, undefined, undefined, limit, page * limit)
  const createServer = useCreateServer()
  const updateServer = useUpdateServer()
  const deactivate = useDeactivateServer()
  const activate = useActivateServer()
  const deleteServer = useDeleteServer()

  const updateMapping = useUpdateMapping()
  const { data: checksData } = useChecks(undefined, undefined, 200, 0)

  const servers = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = Math.ceil(total / limit)
  const checks = checksData?.data ?? []

  const checkNameMap = useMemo(() => {
    const m = new Map<number, string>()
    for (const c of checks) m.set(c.check_id, c.check_name)
    return m
  }, [checks])

  const checkDefaultFreqMap = useMemo(() => {
    const m = new Map<number, number | undefined>()
    for (const c of checks) m.set(c.check_id, c.default_frequency_sec)
    return m
  }, [checks])

  const handleApiError = (e: any) => {
    console.error('Server operation error:', e)
    const errorData = e?.response?.data
    if (errorData?.error?.message) {
      const msg = errorData.error.message
      const fields = errorData.error.fields
      if (fields && typeof fields === 'object' && Object.keys(fields).length > 0) {
        const fieldMsgs = Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('; ')
        setError(`${msg} (${fieldMsgs})`)
      } else {
        setError(msg)
      }
    } else if (errorData?.detail && Array.isArray(errorData.detail)) {
      setError(`Validation Error: ${errorData.detail[0].msg} (${errorData.detail[0].loc.join('.')})`)
    } else if (e?.message) {
      setError(e.message)
    } else {
      setError('An unexpected error occurred.')
    }
  }

  const handleCreate = async (formData: any) => {
    try {
      await createServer.mutateAsync(formData)
      setShowForm(false)
      setError('')
    } catch (e: any) {
      handleApiError(e)
    }
  }

  const handleUpdate = async (formData: any) => {
    if (!editing) return
    try {
      await updateServer.mutateAsync({ 
        serverId: editing.server_id, 
        data: { ...formData, version: editing.version } 
      })
      setEditing(null)
      setError('')
    } catch (e: any) {
      handleApiError(e)
    }
  }

  const handleDeactivate = async (id: number) => {
    if (!confirm('Deactivate this server node? Monitoring will pause.')) return
    try { 
      await deactivate.mutateAsync(id) 
      setError('')
    } catch (e: any) { 
      setError(e?.response?.data?.error?.message ?? 'Failed to deactivate') 
    }
  }

  const handleActivate = async (id: number) => {
    try { 
      await activate.mutateAsync(id) 
      setError('')
    } catch (e: any) { 
      setError(e?.response?.data?.error?.message ?? 'Failed to activate') 
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Permanently delete this server? Historical data may be lost.')) return
    try { 
      await deleteServer.mutateAsync(id) 
      setError('')
    } catch (e: any) { 
      setError(e?.response?.data?.error?.message ?? 'Failed to delete') 
    }
  }

  const handleSaveMappingFreq = async (mappingId: number, customFrequencySec: number | null) => {
    try {
      await updateMapping.mutateAsync({ mappingId, data: { custom_frequency_sec: customFrequencySec } })
      setError('')
    } catch (e: any) {
      handleApiError(e)
    }
  }

  const handleToggleMappingEnabled = async (mappingId: number, isEnabled: boolean) => {
    try {
      await updateMapping.mutateAsync({ mappingId, data: { is_enabled: isEnabled } })
      setError('')
    } catch (e: any) {
      handleApiError(e)
    }
  }

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-row items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Infrastructure</h1>
          <p className="text-xs text-slate-500 font-medium">{total} server node{total === 1 ? '' : 's'}</p>
        </div>
        {role === 'admin' && (
          <button 
            onClick={() => { setShowForm(true); setError('') }} 
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-xl hover:bg-blue-600 transition-all shadow-md shadow-slate-200 group text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5 transition-transform group-hover:rotate-90" /> 
            Register Server
          </button>
        )}
      </div>

      {error && <div className="mb-2"><ErrorBanner message={error} /></div>}

      {(showForm || editing) && (
        <div className="bg-white rounded-xl border border-blue-100 p-4 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
              <ServerIcon className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-black text-slate-800">{editing ? 'Modify Instance' : 'New Instance'}</h2>
          </div>
          <ServerForm
            initial={editing ?? undefined}
            onSubmit={editing ? handleUpdate : handleCreate}
            onCancel={() => { setShowForm(false); setEditing(null); setError('') }}
            isLoading={createServer.isPending || updateServer.isPending}
          />
        </div>
      )}

      <div className="min-h-[300px]">
        {isLoading && !data ? (
          <div className="flex items-center justify-center h-48"><LoadingSpinner /></div>
        ) : isError && !servers.length ? (
          <div className="max-w-md mx-auto"><ErrorBanner message="Failed to synchronize with infrastructure API." /></div>
        ) : servers.length === 0 ? (
          <div className="bg-white rounded-xl p-8 border-2 border-dashed border-slate-200">
            <EmptyState icon={ServerIcon} title="No Active Nodes" description="Get started by connecting your first PostgreSQL database." />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {servers.map(s => (
              <ServerCard
                key={s.server_id}
                server={s}
                role={role}
                deactivate={deactivate}
                activate={activate}
                deleteServer={deleteServer}
                updateMapping={updateMapping}
                onEdit={setEditing}
                onDelete={handleDelete}
                onDeactivate={handleDeactivate}
                onActivate={handleActivate}
                onSaveMappingFreq={handleSaveMappingFreq}
                onToggleMappingEnabled={handleToggleMappingEnabled}
                checkNameMap={checkNameMap}
                checkDefaultFreqMap={checkDefaultFreqMap}
                onError={setError}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-1.5">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-[10px] font-black uppercase border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50 transition-colors">Previous</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-[10px] font-black uppercase bg-slate-900 text-white rounded-lg disabled:opacity-30 hover:bg-slate-800 transition-colors shadow-sm shadow-slate-200">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Servers;
