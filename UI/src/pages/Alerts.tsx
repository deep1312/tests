import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useAlerts, useAcknowledgeAlert } from '../api/alerts'
import { useServers } from '../api/servers'
import { useChecks } from '../api/checks'
import { LoadingSpinner } from '../components/shared/LoadingSpinner'
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
  WARNING: 'bg-yellow-100 text-yellow-800',
  CRITICAL: 'bg-red-100 text-red-800',
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <div className={`rounded-full p-1.5 ${color}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div>
        <p className="text-[18px] font-black text-slate-900 leading-none">{value}</p>
        <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400 mt-0.5">{label}</p>
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

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Alerts</h1>
          <p className="text-[11px] text-gray-500">View and acknowledge threshold breach alerts</p>
        </div>
        <button
          onClick={handleExport}
          disabled={alerts.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-600 shadow-sm hover:border-blue-300 hover:text-blue-600 disabled:opacity-40"
        >
          <Download className="h-3 w-3" />
          Export CSV
        </button>
      </div>

      {/* Summary Dashboard */}
      {summary.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SummaryCard icon={Bell} label="Total Alerts" value={summary.total} color="bg-blue-100 text-blue-600" />
          <SummaryCard icon={AlertTriangle} label="Critical" value={summary.critical} color="bg-red-100 text-red-600" />
          <SummaryCard icon={Activity} label="Warning" value={summary.warning} color="bg-amber-100 text-amber-600" />
          <SummaryCard icon={CheckCircle} label="Acknowledged" value={summary.acknowledged} color="bg-green-100 text-green-600" />
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      <div className="flex gap-1.5">
        {(['all', 'unacknowledged', 'acknowledged'] as const).map(s => (
          <button
            key={s}
            onClick={() => { setAckState(s === 'all' ? undefined : s); setPage(0) }}
            className={`px-2.5 py-1 text-xs rounded-full border ${(s === 'all' && !ackState) || ackState === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-4"><LoadingSpinner /></div>
        ) : isError ? (
          <div className="p-4"><ErrorBanner message="Failed to load alerts." /></div>
        ) : alerts.length === 0 ? (
          <EmptyState icon={Zap} title="No alerts" description="No alerts match the current filter" />
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Triggered', 'Server', 'Check', 'Metric', 'Value', 'Status', 'Ack', ...(role === 'admin' ? ['Action'] : [])].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {alerts.map(a => (
                <tr
                  key={`${a.alert_id}-${a.triggered_at}`}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedAlert(a)}
                >
                  <td className="px-3 py-2 text-xs text-gray-500">{formatInTZ(a.triggered_at)}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{serverMap.get(a.server_id) ?? `#${a.server_id}`}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{checkMap.get(a.check_id) ?? `#${a.check_id}`}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{a.metric_name}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{a.observed_value}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[a.status] ?? 'bg-gray-100 text-gray-800'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {a.acknowledged_at
                      ? <span className="flex items-center gap-1 text-green-600 text-[10px]"><CheckCircle className="w-3 h-3" />{formatInTZ(a.acknowledged_at)}</span>
                      : <span className="text-gray-400 text-[10px]">&mdash;</span>}
                  </td>
                  {role === 'admin' && (
                    <td className="px-3 py-2">
                      {!a.acknowledged_at && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAck(a.alert_id, a.triggered_at) }}
                          disabled={acknowledge.isPending}
                          className="text-[10px] px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
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
