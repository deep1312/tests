import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIncidents } from '../api/incidents'
import { useServers } from '../api/servers'
import { useChecks } from '../api/checks'

import { ErrorBanner } from '../components/shared/ErrorBanner'
import { EmptyState } from '../components/shared/EmptyState'
import { NotificationPopup } from '../components/monitoring/NotificationPopup'
import { playAlertSound } from '../utils/sound'
import { downloadCSV } from '../utils/csv'
import { FileText, Download, Bug, CheckCircle, Activity } from 'lucide-react'
import { formatInTZ } from '../utils/timezone'
import type { Incident } from '../api/incidents'

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-destructive/10 text-destructive border-destructive/20',
  RESOLVED: 'bg-success/10 text-success border-success/20',
}

/* ── Skeleton ── */
function IncidentsSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" aria-hidden="true">
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <div className="h-7 w-36 skeleton" />
          <div className="h-4 w-52 skeleton" />
        </div>
        <div className="h-10 w-28 skeleton rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card p-5 space-y-3">
            <div className="flex justify-between">
              <div className="h-10 w-10 skeleton rounded-xl" />
              <div className="h-5 w-16 skeleton rounded-full" />
            </div>
            <div className="h-8 w-20 skeleton" />
            <div className="h-3 w-28 skeleton" />
          </div>
        ))}
      </div>
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3 bg-muted/50">
          <div className="h-4 w-full skeleton" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="px-5 py-3 border-t border-border/50">
            <div className="h-4 w-full skeleton" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function Incidents() {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined)
  const limit = 25

  const { data, isLoading, isError } = useIncidents(undefined, undefined, undefined, limit, page * limit)
  const { data: summaryData } = useIncidents(undefined, undefined, undefined, 1000, 0)

  const { data: serverData } = useServers()
  const { data: checksData } = useChecks()

  const serverMap = new Map((serverData?.data ?? []).map(s => [s.server_id, s.server_label]))
  const checkMap = new Map((checksData?.data ?? []).map(c => [c.check_id, c.check_name]))

  const incidents = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = Math.ceil(total / limit)

  const summary = useMemo(() => {
    const all = summaryData?.data ?? []
    return {
      total: all.length,
      open: all.filter(i => i.status === 'OPEN').length,
      resolved: all.filter(i => i.status === 'RESOLVED').length,
    }
  }, [summaryData])

  // Notification state
  const [notifications, setNotifications] = useState<Array<{ type: 'incident'; item: Incident }>>([])
  const seenIdsRef = useRef<Set<number>>(new Set())

  const prevIncidentsRef = useRef(incidents)
  useEffect(() => {
    const prevIds = new Set(prevIncidentsRef.current.map(i => i.incident_id))
    const newIncidents = incidents.filter(i => !prevIds.has(i.incident_id) && !seenIdsRef.current.has(i.incident_id))

    if (newIncidents.length > 0) {
      playAlertSound()
      setNotifications(prev => [
        ...prev,
        ...newIncidents.map(item => ({ type: 'incident' as const, item })),
      ])
      newIncidents.forEach(i => seenIdsRef.current.add(i.incident_id))
    }
    prevIncidentsRef.current = incidents
  }, [incidents])

  const removeNotification = useCallback((incidentId: number) => {
    setNotifications(prev => prev.filter(n => n.item.incident_id !== incidentId))
  }, [])

  const handleExport = () => {
    const rows = incidents.map(i => ({
      'Incident ID': i.incident_id,
      'Server': serverMap.get(i.server_id) ?? `#${i.server_id}`,
      'Check': checkMap.get(i.check_id) ?? `#${i.check_id}`,
      'Status': i.status,
      'Started At': formatInTZ(i.started_at),
      'Ended At': i.ended_at ? formatInTZ(i.ended_at) : '',
      'Root Cause': i.root_cause ?? '',
      'Duration (seconds)': i.duration_seconds ?? '',
    }))
    downloadCSV(rows, `incidents-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  if (isLoading) return <IncidentsSkeleton />

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Incidents</h1>
          <p className="text-sm text-muted-foreground mt-1">Track and manage fault events across your fleet</p>
        </div>
        <button
          onClick={handleExport}
          disabled={incidents.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 transition-all duration-200 disabled:opacity-40"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* ── Summary Stats ── */}
      {summary.total > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-info" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">Total</span>
            </div>
            <p className="text-3xl font-bold text-foreground tabular-nums">{summary.total}</p>
            <p className="text-xs text-muted-foreground mt-1">total incidents</p>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <Bug className="w-5 h-5 text-destructive" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">Open</span>
            </div>
            <p className="text-3xl font-bold text-foreground tabular-nums">{summary.open}</p>
            <p className="text-xs text-muted-foreground mt-1">open incidents</p>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">Resolved</span>
            </div>
            <p className="text-3xl font-bold text-foreground tabular-nums">{summary.resolved}</p>
            <p className="text-xs text-muted-foreground mt-1">resolved incidents</p>
          </div>
        </div>
      )}

      {/* ── Filter Tabs ── */}
      <div className="flex items-center gap-2">
        {[{ label: 'All', value: undefined }, { label: 'Open', value: 1 }, { label: 'Resolved', value: 2 }].map(opt => (
          <button
            key={opt.label}
            onClick={() => { setStatusFilter(opt.value); setPage(0) }}
            className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all duration-200 ${
              statusFilter === opt.value
                ? 'bg-primary text-primary-foreground border-primary shadow-glow-sm'
                : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted/80'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── Incidents Table ── */}
      <div className="glass-card overflow-hidden">
        {isError ? (
          <div className="p-6"><ErrorBanner message="Failed to load incidents." /></div>
        ) : incidents.length === 0 ? (
          <EmptyState icon={FileText} title="No incidents" description="No incidents match the current filter" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-muted/50">
                    {['ID', 'Server', 'Check', 'Status', 'Started', 'Ended', 'Root Cause'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {incidents.map(i => (
                    <tr
                      key={i.incident_id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/incidents/${i.incident_id}`)}
                    >
                      <td className="px-4 py-3 text-sm font-semibold text-primary group-hover:text-primary/80 transition-colors">#{i.incident_id}</td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{serverMap.get(i.server_id) ?? `#${i.server_id}`}</td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{checkMap.get(i.check_id) ?? `#${i.check_id}`}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-semibold ${STATUS_COLORS[i.status] ?? 'bg-muted text-muted-foreground border-border'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            i.status === 'OPEN' ? 'bg-destructive' : 'bg-success'
                          }`} />
                          {i.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatInTZ(i.started_at)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{i.ended_at ? formatInTZ(i.ended_at) : '\u2014'}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">{i.root_cause ?? '\u2014'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Page {page + 1} of {totalPages} <span className="text-muted-foreground/60">({total} total)</span>
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                    className="px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-medium hover:bg-muted/80 transition-all duration-200 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                    className="px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-medium hover:bg-muted/80 transition-all duration-200 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Notification Popups */}
      {notifications.slice(-3).map(n => (
        <NotificationPopup
          key={n.item.incident_id}
          type="incident"
          title={checkMap.get(n.item.check_id) ?? `Check #${n.item.check_id}`}
          checkName={checkMap.get(n.item.check_id) ?? `#${n.item.check_id}`}
          serverName={serverMap.get(n.item.server_id) ?? `#${n.item.server_id}`}
          timestamp={n.item.started_at}
          onClick={() => { navigate(`/incidents/${n.item.incident_id}`); removeNotification(n.item.incident_id) }}
          onDismiss={() => removeNotification(n.item.incident_id)}
        />
      ))}
    </div>
  )
}

export default Incidents
