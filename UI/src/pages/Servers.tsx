import { useState, useMemo, useEffect } from 'react'
import { Plus, Pencil, Trash2, Server as ServerIcon, Globe, Database, ShieldCheck, Activity, ChevronDown, ChevronRight, Clock } from 'lucide-react'
import { useServers, useCreateServer, useUpdateServer, useDeactivateServer, useActivateServer, useDeleteServer, Server } from '../api/servers'
import { useMappings, useUpdateMapping, useChecks, Mapping } from '../api/checks'
import { LoadingSpinner } from '../components/shared/LoadingSpinner'
import { ErrorBanner } from '../components/shared/ErrorBanner'
import { EmptyState } from '../components/shared/EmptyState'
import { Tooltip } from '../components/shared/Tooltip'
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

  const inputClass = 'w-full h-10 px-3 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:ring-2 focus:ring-ring outline-none transition-all duration-200 placeholder:text-muted-foreground/50'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Identification */}
        <div className="space-y-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2">Identification</h3>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Label *</label>
            <input required className={inputClass} placeholder="Production Cluster A" value={form.server_label} onChange={e => set('server_label', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Host / IP *</label>
              <input required className={inputClass} value={form.server_ip} onChange={e => set('server_ip', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Port *</label>
              <input required type="number" className={inputClass} value={form.port} onChange={e => set('port', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Credentials */}
        <div className="space-y-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2">Database Credentials</h3>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Database *</label>
            <input required className={inputClass} value={form.db_name} onChange={e => set('db_name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Username *</label>
              <input required className={inputClass} value={form.username} onChange={e => set('username', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Password {initial ? '(Unchanged)' : '*'}</label>
              <input type="password" required={!initial} className={inputClass} value={form.password} onChange={e => set('password', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* Classification */}
      <div className="space-y-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2">Server Classification</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Environment Type</label>
            <input className={inputClass} placeholder="e.g. production, staging, uat" value={form.env_type} onChange={e => set('env_type', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Server Role</label>
            <input className={inputClass} placeholder="e.g. primary, secondary, standalone" value={form.server_role} onChange={e => set('server_role', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 transition-all duration-200 text-sm">Cancel</button>
        <button type="submit" disabled={isLoading} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold shadow-glow-sm hover:shadow-glow-md transition-all duration-300 disabled:opacity-50 text-sm">
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
    <div className="flex items-center gap-2 py-2 border-b border-border/30 last:border-0 hover:bg-muted/20 px-1 rounded-lg transition-colors duration-200">
      <button
        onClick={() => onToggleEnabled(mapping.mapping_id, !mapping.is_enabled)}
        disabled={isSaving}
        className={`relative inline-flex h-4 w-7 items-center rounded-full transition-all duration-200 shrink-0 ${
          mapping.is_enabled ? 'bg-primary' : 'bg-muted-foreground/20'
        }`}
        title={mapping.is_enabled ? 'Disable check' : 'Enable check'}
      >
        <span className={`inline-block h-3 w-3 transform rounded-full bg-card shadow-sm transition-transform duration-200 ${
          mapping.is_enabled ? 'translate-x-[12px]' : 'translate-x-[2px]'
        }`} />
      </button>
      <span className="text-xs font-medium text-foreground truncate max-w-[100px]">{checkName}</span>
      <span className="text-[9px] font-mono text-muted-foreground shrink-0">({formatFreq(defaultFreqSec)})</span>
      {mapping.is_enabled ? (
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <input
            type="number"
            min={1}
            className="w-14 h-7 border border-border rounded-lg px-1.5 text-[10px] font-mono text-foreground bg-muted/50 focus:ring-2 focus:ring-ring outline-none transition-all duration-200"
            value={editValue}
            onChange={e => { setEditValue(Number(e.target.value)); setDirty(true) }}
          />
          <select
            className="h-7 border border-border rounded-lg px-1 text-[10px] bg-muted/50 text-foreground outline-none transition-all duration-200"
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
                className="px-2 py-1 text-[9px] font-semibold uppercase bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all duration-200"
              >
                {isSaving ? '..' : 'Save'}
              </button>
              <button
                onClick={() => { setEditValue(effective.value); setEditUnit(effective.unit); setDirty(false) }}
                className="px-1.5 py-1 text-[9px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
              >
                ✕
              </button>
            </>
          )}
          {mapping.custom_frequency_sec != null && !dirty && (
            <button
              onClick={handleClear}
              className="px-1.5 py-1 text-[9px] font-medium text-destructive/70 hover:text-destructive transition-colors duration-200"
              title="Clear override"
            >
              &times;
            </button>
          )}
        </div>
      ) : (
        <span className="text-[9px] text-muted-foreground/60 italic ml-auto">off</span>
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
  isExpanded: boolean
  onToggleExpand: () => void
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
  isExpanded,
  onToggleExpand,
}: ServerCardProps) {

  const { data: mappingsData, isLoading: mappingsLoading } = useMappings(
    s.server_id,
    undefined,
    100,
    0,
    { enabled: isExpanded }
  )
  const mappings = mappingsData?.data ?? []

  return (
    <div className={`glass-card-hover group flex flex-col relative transition-all duration-300 ${isExpanded ? 'z-50 ring-2 ring-primary/20 shadow-lg' : 'z-10 hover:z-20'}`}>
      {/* Card Body */}
      <div className="p-4 flex-1">
        {/* Header Row */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
              <Database className={`w-5 h-5 ${s.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">{s.server_label}</h3>
              <div className="flex items-center gap-1.5 mt-1">
                {s.is_active ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold border border-primary/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold border border-border">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                    Inactive
                  </span>
                )}
                {s.is_di_server && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-info/10 text-info text-[10px] font-semibold border border-info/20">
                    DI Server
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {role === 'admin' && (
              <>
                <button onClick={() => onEdit(s)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-all duration-200"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => onDelete(s.server_id)} className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-all duration-200"><Trash2 className="w-3.5 h-3.5" /></button>
              </>
            )}
          </div>
        </div>

        {/* Server Details */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between text-xs">
            <Tooltip content="Network address and port of the database server">
              <span className="text-muted-foreground flex items-center gap-1.5 cursor-help"><Globe className="w-3.5 h-3.5" /> Endpoint</span>
            </Tooltip>
            <span className="text-foreground font-mono font-medium">{s.server_ip}:{s.port}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <Tooltip content="Deployment environment type (e.g. prod, dev)">
              <span className="text-muted-foreground flex items-center gap-1.5 cursor-help"><ShieldCheck className="w-3.5 h-3.5" /> Environment</span>
            </Tooltip>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              s.env_type === 'prod' ? 'bg-destructive/10 text-destructive border border-destructive/20' : 'bg-info/10 text-info border border-info/20'
            }`}>
              {s.env_type?.toUpperCase() || 'N/A'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <Tooltip content="Assigned role of this server in the architecture">
              <span className="text-muted-foreground flex items-center gap-1.5 cursor-help"><Activity className="w-3.5 h-3.5" /> Role</span>
            </Tooltip>
            <span className="text-foreground font-medium">{s.server_role || 'Standalone'}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-border/50 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">DB: {s.db_name}</span>
          <div className="flex items-center gap-2">
            {role === 'admin' ? (
              <>
                <button
                  onClick={() => s.is_active ? onDeactivate(s.server_id) : onActivate(s.server_id)}
                  disabled={deactivate.isPending || activate.isPending}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-200 ${
                    s.is_active ? 'bg-primary' : 'bg-muted-foreground/20'
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-card shadow-sm transition-transform duration-200 ${
                    s.is_active ? 'translate-x-[18px]' : 'translate-x-[2px]'
                  }`} />
                </button>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {s.is_active ? 'Active' : 'Inactive'}
                </span>
              </>
            ) : (
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${s.is_active ? 'text-primary' : 'text-muted-foreground'}`}>
                {s.is_active ? 'Active' : 'Inactive'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expandable Frequencies Section */}
      <div className="relative mt-auto border-t border-border/50">
        <button
          onClick={onToggleExpand}
          className={`w-full flex items-center justify-between px-4 py-2.5 transition-all duration-200 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider ${isExpanded ? 'bg-muted/50' : 'bg-muted/30 hover:bg-muted/50'}`}
        >
          <span className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            Check Frequencies
          </span>
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {isExpanded && (
          <div className="absolute top-full left-0 w-full glass-card border-t-0 rounded-t-none rounded-b-2xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="bg-muted/30 px-4 py-3 max-h-64 overflow-y-auto rounded-b-2xl backdrop-blur-xl">
              {mappingsLoading ? (
                <div className="py-3"><LoadingSpinner /></div>
              ) : mappings.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 italic">No checks mapped to this server.</p>
              ) : (
                <div>
                  <div className="flex items-center justify-between text-[9px] font-semibold text-muted-foreground uppercase tracking-wider pb-2 border-b border-border/30 mb-1">
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
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Skeleton ── */
function ServersSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" aria-hidden="true">
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <div className="h-7 w-44 skeleton" />
          <div className="h-4 w-32 skeleton" />
        </div>
        <div className="h-10 w-36 skeleton rounded-xl" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="glass-card p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 skeleton rounded-xl" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-24 skeleton" />
                <div className="h-3 w-16 skeleton rounded-full" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full skeleton" />
              <div className="h-3 w-3/4 skeleton" />
              <div className="h-3 w-1/2 skeleton" />
            </div>
            <div className="h-8 w-full skeleton rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function Servers() {
  const { role } = useAuth()
  const [page, setPage] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Server | null>(null)
  const [error, setError] = useState('')
  const [activeAccordionId, setActiveAccordionId] = useState<number | null>(null)
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

  if (isLoading && !data) return <ServersSkeleton />

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Infrastructure</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} server node{total === 1 ? '' : 's'} registered</p>
        </div>
        {role === 'admin' && (
          <button 
            onClick={() => { setShowForm(true); setError('') }} 
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold shadow-glow-sm hover:shadow-glow-md transition-all duration-300 text-sm group"
          >
            <Plus className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" /> 
            Register Server
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
              <ServerIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">{editing ? 'Modify Instance' : 'New Instance'}</h2>
              <p className="text-xs text-muted-foreground">{editing ? 'Update the server configuration' : 'Connect a new PostgreSQL database'}</p>
            </div>
          </div>
          <ServerForm
            initial={editing ?? undefined}
            onSubmit={editing ? handleUpdate : handleCreate}
            onCancel={() => { setShowForm(false); setEditing(null); setError('') }}
            isLoading={createServer.isPending || updateServer.isPending}
          />
        </div>
      )}

      {/* ── Server Grid ── */}
      <div className="min-h-[300px]">
        {isError && !servers.length ? (
          <div className="max-w-md mx-auto"><ErrorBanner message="Failed to synchronize with infrastructure API." /></div>
        ) : servers.length === 0 ? (
          <div className="glass-card p-10 border-2 border-dashed border-border/50">
            <EmptyState icon={ServerIcon} title="No Active Nodes" description="Get started by connecting your first PostgreSQL database." />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {servers.map(s => (
              <ServerCard
                key={s.server_id}
                server={s}
                role={role ?? undefined}
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
                isExpanded={activeAccordionId === s.server_id}
                onToggleExpand={() => setActiveAccordionId(activeAccordionId === s.server_id ? null : s.server_id)}
              />
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="mt-4 glass-card px-5 py-3 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-4 py-2 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 transition-all duration-200 text-sm disabled:opacity-30">Previous</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold shadow-glow-sm hover:shadow-glow-md transition-all duration-300 text-sm disabled:opacity-30">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Servers;
