import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useAlerts, useAcknowledgeAlert } from '../api/alerts'
import { useServers } from '../api/servers'
import { useChecks } from '../api/checks'

import { ErrorBanner } from '../components/shared/ErrorBanner'
import { EmptyState } from '../components/shared/EmptyState'
import { NotificationPopup } from '../components/monitoring/NotificationPopup'
import { AlertDetailSheet } from '../components/monitoring/AlertDetailSheet'
import { playAlertSound } from '../utils/sound'
import { downloadCSV } from '../utils/csv'
import { Zap, CheckCircle, AlertTriangle, Download, Bell, Activity } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { formatInTZ } from '../utils/timezone'
import type { Alert } from '../api/alerts'

const STATUS_COLORS: Record<string, string> = {
  WARNING: 'bg-warning/10 text-warning border-warning/20',
  CRITICAL: 'bg-destructive/10 text-destructive border-destructive/20',
}

function SummaryCard({ icon: Icon, label, value, iconBg, iconColor }: { icon: any; label: string; value: number | string; iconBg: string; iconColor: string }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">{label}</span>
      </div>
      <p className="text-3xl font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label.toLowerCase()}</p>
    </div>
  )
}

/* ── Skeleton ── */
function AlertsSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" aria-hidden="true">
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <div className="h-7 w-36 skeleton" />
          <div className="h-4 w-56 skeleton" />
        </div>
        <div className="h-10 w-28 skeleton rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
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

export function Alerts() {
  const { role } = useAuth()
  const [page, setPage] = useState(0)
  const [ackState, setAckState] = useState<'unacknowledged' | 'acknowledged' | undefined>(undefined)
  const [error, setError] = useState('')
  const limit = 25

  const { data, isLoading, isError } = useAlerts(
    undefined, undefined, undefined, ackState, undefined, undefined, limit, page * limit
  )
  const { data: summaryData } = useAlerts(undefined, undefined, undefined, undefined, undefined, undefined, 1000, 0)
  const acknowledge = useAcknowledgeAlert()

  const { data: serverData } = useServers()
  const { data: checksData } = useChecks()

  const serverMap = new Map((serverData?.data ?? []).map(s => [s.server_id, s.server_label]))
  const checkMap = new Map((checksData?.data ?? []).map(c => [c.check_id, c.check_name]))

  const alerts = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = Math.ceil(total / limit)

  const summary = useMemo(() => {
    const all = summaryData?.data ?? []
    return {
      total: all.length,
      critical: all.filter(a => a.status === 'CRITICAL').length,
      warning: all.filter(a => a.status === 'WARNING').length,
      acknowledged: all.filter(a => a.acknowledged_at).length,
      unacknowledged: all.filter(a => !a.acknowledged_at).length,
    }
  }, [summaryData])

  // Notification state
  const [notifications, setNotifications] = useState<Array<{ type: 'alert'; item: Alert }>>([])
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const seenIdsRef = useRef<Set<string>>(new Set())

  // Detect new alerts on data change
  const prevAlertsRef = useRef(alerts)
  useEffect(() => {
    const prevIds = new Set(prevAlertsRef.current.map(a => `${a.alert_id}-${a.triggered_at}`))
    const newAlerts = alerts.filter(a => !prevIds.has(`${a.alert_id}-${a.triggered_at}`) && !seenIdsRef.current.has(`${a.alert_id}-${a.triggered_at}`))

    if (newAlerts.length > 0) {
      playAlertSound()
      setNotifications(prev => [
        ...prev,
        ...newAlerts.map(item => ({ type: 'alert' as const, item })),
      ])
      newAlerts.forEach(a => seenIdsRef.current.add(`${a.alert_id}-${a.triggered_at}`))
    }
    prevAlertsRef.current = alerts
  }, [alerts])

  const removeNotification = useCallback((alertId: number, triggeredAt: string) => {
    setNotifications(prev => prev.filter(n => !(n.item.alert_id === alertId && n.item.triggered_at === triggeredAt)))
  }, [])

  const handleAck = async (alertId: number, triggeredAt: string) => {
    try {
      await acknowledge.mutateAsync({ alertId, triggeredAt })
      setError('')
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Failed to acknowledge alert')
    }
  }

  const handleExport = () => {
    const rows = alerts.map(a => ({
      'Alert ID': a.alert_id,
      'Server': serverMap.get(a.server_id) ?? `#${a.server_id}`,
      'Check': checkMap.get(a.check_id) ?? `#${a.check_id}`,
      'Metric': a.metric_name,
      'Value': a.observed_value,
      'Status': a.status,
      'Triggered At': formatInTZ(a.triggered_at),
      'Acknowledged At': a.acknowledged_at ? formatInTZ(a.acknowledged_at) : '',
    }))
    downloadCSV(rows, `alerts-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  if (isLoading) return <AlertsSkeleton />

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">View and acknowledge threshold breach alerts</p>
        </div>
        <button
          onClick={handleExport}
          disabled={alerts.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 transition-all duration-200 disabled:opacity-40"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* ── Summary Stats ── */}
      {summary.total > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard icon={Bell} label="Total Alerts" value={summary.total} iconBg="bg-info/10" iconColor="text-info" />
          <SummaryCard icon={AlertTriangle} label="Critical" value={summary.critical} iconBg="bg-destructive/10" iconColor="text-destructive" />
          <SummaryCard icon={Activity} label="Warning" value={summary.warning} iconBg="bg-warning/10" iconColor="text-warning" />
          <SummaryCard icon={CheckCircle} label="Acknowledged" value={summary.acknowledged} iconBg="bg-success/10" iconColor="text-success" />
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {/* ── Filter Tabs ── */}
      <div className="flex items-center gap-2">
        {(['all', 'unacknowledged', 'acknowledged'] as const).map(s => (
          <button
            key={s}
            onClick={() => { setAckState(s === 'all' ? undefined : s); setPage(0) }}
            className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all duration-200 ${
              (s === 'all' && !ackState) || ackState === s
                ? 'bg-primary text-primary-foreground border-primary shadow-glow-sm'
                : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted/80'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Alerts Table ── */}
      <div className="glass-card overflow-hidden">
        {isError ? (
          <div className="p-6"><ErrorBanner message="Failed to load alerts." /></div>
        ) : alerts.length === 0 ? (
          <EmptyState icon={Zap} title="No alerts" description="No alerts match the current filter" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-muted/50">
                    {['Triggered', 'Server', 'Check', 'Metric', 'Value', 'Status', 'Ack', ...(role === 'admin' ? ['Action'] : [])].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {alerts.map(a => (
                    <tr
                      key={`${a.alert_id}-${a.triggered_at}`}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedAlert(a)}
                    >
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatInTZ(a.triggered_at)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{serverMap.get(a.server_id) ?? `#${a.server_id}`}</td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{checkMap.get(a.check_id) ?? `#${a.check_id}`}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{a.metric_name}</td>
                      <td className="px-4 py-3 text-sm text-foreground tabular-nums">{a.observed_value}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-semibold ${STATUS_COLORS[a.status] ?? 'bg-muted text-muted-foreground border-border'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            a.status === 'CRITICAL' ? 'bg-destructive' : a.status === 'WARNING' ? 'bg-warning' : 'bg-muted-foreground'
                          }`} />
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {a.acknowledged_at
                          ? <span className="flex items-center gap-1.5 text-success text-xs font-medium"><CheckCircle className="w-3.5 h-3.5" />{formatInTZ(a.acknowledged_at)}</span>
                          : <span className="text-muted-foreground text-xs">&mdash;</span>}
                      </td>
                      {role === 'admin' && (
                        <td className="px-4 py-3">
                          {!a.acknowledged_at && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAck(a.alert_id, a.triggered_at) }}
                              disabled={acknowledge.isPending}
                              className="px-3 py-1.5 rounded-xl bg-success/10 text-success text-xs font-semibold border border-success/20 hover:bg-success/20 transition-all duration-200 disabled:opacity-50"
                            >
                              Acknowledge
                            </button>
                          )}
                        </td>
                      )}
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
          key={`${n.item.alert_id}-${n.item.triggered_at}`}
          type="alert"
          title={checkMap.get(n.item.check_id) ?? `Check #${n.item.check_id}`}
          checkName={checkMap.get(n.item.check_id) ?? `#${n.item.check_id}`}
          serverName={serverMap.get(n.item.server_id) ?? `#${n.item.server_id}`}
          timestamp={n.item.triggered_at}
          onClick={() => { setSelectedAlert(n.item); removeNotification(n.item.alert_id, n.item.triggered_at) }}
          onDismiss={() => removeNotification(n.item.alert_id, n.item.triggered_at)}
        />
      ))}

      {/* Alert Detail Sheet */}
      <AlertDetailSheet
        alert={selectedAlert}
        serverName={serverMap.get(selectedAlert?.server_id ?? 0) ?? `#${selectedAlert?.server_id}`}
        checkName={checkMap.get(selectedAlert?.check_id ?? 0) ?? `#${selectedAlert?.check_id}`}
        open={!!selectedAlert}
        onOpenChange={(open) => { if (!open) setSelectedAlert(null) }}
      />
    </div>
  )
}

export default Alerts
