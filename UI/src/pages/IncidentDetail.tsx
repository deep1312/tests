import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useIncident, usePatchIncidentRootCause } from '../api/incidents'
import { useServers } from '../api/servers'
import { useChecks } from '../api/checks'
import { ErrorBanner } from '../components/shared/ErrorBanner'
import { ArrowLeft, CheckCircle, Clock, AlertTriangle, Flag, Activity, Server, FileSearch, Calendar, CalendarCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { formatInTZ } from '../utils/timezone'

const STATUS_LABELS: Record<number, string> = { 1: 'OPEN', 2: 'RESOLVED' }
const ALERT_STATUS: Record<number, string> = { 1: 'WARNING', 2: 'CRITICAL' }
const ALERT_COLORS: Record<number, string> = { 1: 'bg-warning/10 text-warning border-warning/20', 2: 'bg-destructive/10 text-destructive border-destructive/20' }

function buildTimelineEvents(incident: any): Array<{ icon: any; color: string; title: string; description: string; timestamp: string }> {
  const events: Array<{ icon: any; color: string; title: string; description: string; timestamp: string }> = []

  events.push({
    icon: Activity,
    color: '#2563eb',
    title: 'Incident Created',
    description: `Incident #${incident.incident_id} was opened`,
    timestamp: incident.started_at,
  })

  const alerts = incident.alerts ?? []
  const alertTimestamps = new Set(alerts.map((a: any) => a.triggered_at))
          alertTimestamps.forEach((ts: any) => {
            const countAtTime = alerts.filter((a: any) => a.triggered_at === ts).length
            const severities = [...new Set(alerts.filter((a: any) => a.triggered_at === ts).map((a: any) => ALERT_STATUS[a.status] ?? a.status))]
            events.push({
              icon: AlertTriangle,
              color: severities.includes('CRITICAL') ? '#dc2626' : '#d97706',
              title: `Alert${countAtTime > 1 ? 's' : ''} Triggered`,
              description: `${countAtTime} alert${countAtTime > 1 ? 's' : ''} (${severities.join(', ')})`,
              timestamp: ts,
            })
          })

  const ackTimestamps = new Set(alerts.filter((a: any) => a.acknowledged_at).map((a: any) => a.acknowledged_at))
          ackTimestamps.forEach((ts: any) => {
    const countAtTime = alerts.filter((a: any) => a.acknowledged_at === ts).length
    events.push({
      icon: CheckCircle,
      color: '#16a34a',
      title: 'Alert Acknowledged',
      description: `${countAtTime} alert${countAtTime > 1 ? 's' : ''} acknowledged`,
      timestamp: ts,
    })
  })

  if (incident.root_cause) {
    events.push({
      icon: Flag,
      color: '#7c3aed',
      title: 'Root Cause Identified',
      description: incident.root_cause,
      timestamp: incident.ended_at ?? incident.started_at,
    })
  }

  if (incident.ended_at) {
    events.push({
      icon: Clock,
      color: '#16a34a',
      title: 'Incident Resolved',
      description: `Duration: ${Math.floor((new Date(incident.ended_at).getTime() - new Date(incident.started_at).getTime()) / 60000)} minutes`,
      timestamp: incident.ended_at,
    })
  }

  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  return events
}

function generateIncidentDescription(
  incident: any,
  serverName: string,
  checkName: string,
): string {
  const statusLabel = incident.status === 'OPEN' ? 'open' : 'resolved'
  const alertCount = (incident.alerts ?? []).length
  const alertInfo = alertCount > 0
    ? `The incident has ${alertCount} associated alert${alertCount !== 1 ? 's' : ''}.`
    : 'No alerts are currently associated with this incident.'
  const rootCauseInfo = incident.root_cause
    ? `The identified root cause is: "${incident.root_cause}".`
    : 'The root cause has not yet been identified.'
  const durationInfo = incident.duration_seconds != null
    ? `The incident has been running for ${Math.floor(incident.duration_seconds / 60)} minute${Math.floor(incident.duration_seconds / 60) !== 1 ? 's' : ''}.`
    : ''
  return `An incident was ${statusLabel === 'open' ? 'opened' : 'resolved'} for check "${checkName}" on server "${serverName}". The incident started on ${formatInTZ(incident.started_at)} and is currently ${statusLabel}. ${alertInfo} ${rootCauseInfo} ${durationInfo}`.trim()
}

/* ── Skeleton ── */
function IncidentDetailSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" aria-hidden="true">
      <div className="h-4 w-32 skeleton" />
      <div className="glass-card p-6 space-y-4">
        <div className="flex justify-between">
          <div className="h-7 w-48 skeleton" />
          <div className="h-6 w-20 skeleton rounded-full" />
        </div>
        <div className="h-16 w-full skeleton rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}
        </div>
      </div>
      <div className="glass-card p-6 space-y-4">
        <div className="h-5 w-24 skeleton" />
        {[1, 2, 3].map(i => <div key={i} className="h-12 w-full skeleton" />)}
      </div>
    </div>
  )
}

export function IncidentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { role } = useAuth()
  const [editingRootCause, setEditingRootCause] = useState(false)
  const [rootCauseText, setRootCauseText] = useState('')
  const [saveError, setSaveError] = useState('')

  const { data: incident, isLoading, isError } = useIncident(Number(id))
  const { data: serverData } = useServers()
  const { data: checksData } = useChecks()
  const patchRootCause = usePatchIncidentRootCause()

  const serverMap = new Map((serverData?.data ?? []).map(s => [s.server_id, s.server_label]))
  const checkMap = new Map((checksData?.data ?? []).map(c => [c.check_id, c.check_name]))

  const serverName = incident ? (serverMap.get(incident.server_id) ?? `#${incident.server_id}`) : ''
  const checkName = incident ? (checkMap.get(incident.check_id) ?? `#${incident.check_id}`) : ''

  const description = useMemo(
    () => incident ? generateIncidentDescription(incident, serverName, checkName) : '',
    [incident, serverName, checkName]
  )

  const handleSaveRootCause = async () => {
    try {
      await patchRootCause.mutateAsync({ incidentId: Number(id), rootCause: rootCauseText })
      setEditingRootCause(false)
      setSaveError('')
    } catch (e: any) {
      setSaveError(e?.response?.data?.error?.message ?? 'Failed to save')
    }
  }

  if (isLoading) return <IncidentDetailSkeleton />
  if (isError || !incident) return <div className="p-6 max-w-7xl mx-auto"><ErrorBanner message="Failed to load incident." /></div>

  const statusText = STATUS_LABELS[incident.status as any] ?? incident.status
  const isOpen = incident.status === 'OPEN' || (incident.status as any) === 1

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Back Button ── */}
      <button
        onClick={() => navigate('/incidents')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Incidents
      </button>

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Incident #{incident.incident_id}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {checkName} on {serverName}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${
          isOpen
            ? 'bg-destructive/10 text-destructive border-destructive/20'
            : 'bg-primary/10 text-primary border-primary/20'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-destructive ' : 'bg-primary'}`} />
          {statusText}
        </span>
      </div>

      {/* ── Description Card ── */}
      <div className="glass-card p-5">
        <div className="rounded-xl bg-info/5 border border-info/10 p-4">
          <p className="text-sm leading-relaxed text-foreground">{description}</p>
        </div>
      </div>

      {/* ── Info Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Server className="w-3.5 h-3.5 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground font-medium">Server</p>
          </div>
          <p className="text-sm font-semibold text-foreground">{serverName}</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-lg bg-warning/10 flex items-center justify-center">
              <FileSearch className="w-3.5 h-3.5 text-warning" />
            </div>
            <p className="text-xs text-muted-foreground font-medium">Check</p>
          </div>
          <p className="text-sm font-semibold text-foreground">{checkName}</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-lg bg-info/10 flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5 text-info" />
            </div>
            <p className="text-xs text-muted-foreground font-medium">Started</p>
          </div>
          <p className="text-sm font-semibold text-foreground">{formatInTZ(incident.started_at)}</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarCheck className="w-3.5 h-3.5 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground font-medium">Ended</p>
          </div>
          <p className="text-sm font-semibold text-foreground">{incident.ended_at ? formatInTZ(incident.ended_at) : '\u2014'}</p>
        </div>
      </div>

      {/* ── Root Cause ── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Flag className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Root Cause</h2>
          </div>
          {role === 'admin' && !editingRootCause && (
            <button
              onClick={() => { setEditingRootCause(true); setRootCauseText(incident.root_cause ?? '') }}
              className="text-xs text-primary font-medium hover:text-primary/80 transition-colors"
            >
              Edit
            </button>
          )}
        </div>
        {editingRootCause ? (
          <div className="space-y-3">
            <textarea
              className="w-full h-10 px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:ring-2 focus:ring-ring focus:outline-none resize-none"
              rows={3}
              value={rootCauseText}
              onChange={e => setRootCauseText(e.target.value)}
              placeholder="Describe the root cause..."
            />
            {saveError && <p className="text-xs text-destructive">{saveError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleSaveRootCause}
                disabled={patchRootCause.isPending}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-glow-sm hover:shadow-glow-md transition-all duration-300 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => setEditingRootCause(false)}
                className="px-4 py-2 rounded-xl bg-muted text-foreground font-medium text-xs hover:bg-muted/80 transition-all duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground">{incident.root_cause ?? <span className="text-muted-foreground italic">Not set</span>}</p>
        )}
      </div>

      {/* ── Timeline ── */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center">
            <Clock className="w-4 h-4 text-info" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Timeline</h2>
        </div>
        <div className="relative pl-8 space-y-0">
          {(() => {
            const events = buildTimelineEvents(incident)
            return events.map((event, idx) => (
              <div key={idx} className="relative pb-6 last:pb-0">
                {idx < events.length - 1 && (
                  <div className="absolute left-[9px] top-5 bottom-0 w-px bg-border/50" />
                )}
                <div className="absolute left-0 top-0.5 rounded-full p-1.5" style={{ backgroundColor: event.color + '15' }}>
                  <event.icon className="h-3.5 w-3.5" style={{ color: event.color }} />
                </div>
                <div className="ml-6">
                  <p className="text-sm font-semibold text-foreground">{event.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">{formatInTZ(event.timestamp)}</p>
                </div>
              </div>
            ))
          })()}
        </div>
      </div>

      {/* ── Associated Alerts ── */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-warning" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Associated Alerts</h2>
              <p className="text-[11px] text-muted-foreground">Alerts triggered by this incident</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-[11px] font-semibold">
            {(incident as any).alerts?.length ?? 0} alerts
          </span>
        </div>
        {(incident as any).alerts?.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No alerts associated with this incident.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-muted/50">
                  {['Triggered', 'Metric', 'Value', 'Status', 'Acknowledged'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {((incident as any).alerts ?? []).map((a: any) => (
                  <tr key={`${a.alert_id}-${a.triggered_at}`} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatInTZ(a.triggered_at)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{a.metric_name}</td>
                    <td className="px-4 py-3 text-sm text-foreground tabular-nums">{a.observed_value}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-semibold ${ALERT_COLORS[a.status] ?? 'bg-muted text-muted-foreground border-border'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          a.status === 2 ? 'bg-destructive' : a.status === 1 ? 'bg-warning' : 'bg-muted-foreground'
                        }`} />
                        {ALERT_STATUS[a.status] ?? a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {a.acknowledged_at
                        ? <span className="flex items-center gap-1.5 text-primary text-xs font-medium"><CheckCircle className="w-3.5 h-3.5" />{formatInTZ(a.acknowledged_at)}</span>
                        : <span className="text-muted-foreground text-xs">&mdash;</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default IncidentDetail
