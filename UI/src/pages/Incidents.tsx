import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIncidents } from '../api/incidents'
import { useServers } from '../api/servers'
import { useChecks } from '../api/checks'
import { LoadingSpinner } from '../components/shared/LoadingSpinner'
import { ErrorBanner } from '../components/shared/ErrorBanner'
import { EmptyState } from '../components/shared/EmptyState'
import { NotificationPopup } from '../components/monitoring/NotificationPopup'
import { playAlertSound } from '../utils/sound'
import { downloadCSV } from '../utils/csv'
import { FileText, Download, Bug, CheckCircle, Activity } from 'lucide-react'
import { formatInTZ } from '../utils/timezone'
import type { Incident } from '../api/incidents'

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

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-800',
  RESOLVED: 'bg-green-100 text-green-800',
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

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Incidents</h1>
          <p className="text-[11px] text-gray-500">Track and manage fault events</p>
        </div>
        <button
          onClick={handleExport}
          disabled={incidents.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-600 shadow-sm hover:border-blue-300 hover:text-blue-600 disabled:opacity-40"
        >
          <Download className="h-3 w-3" />
          Export CSV
        </button>
      </div>

      {/* Summary Dashboard */}
      {summary.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <SummaryCard icon={Activity} label="Total Incidents" value={summary.total} color="bg-blue-100 text-blue-600" />
          <SummaryCard icon={Bug} label="Open" value={summary.open} color="bg-red-100 text-red-600" />
          <SummaryCard icon={CheckCircle} label="Resolved" value={summary.resolved} color="bg-green-100 text-green-600" />
        </div>
      )}

      <div className="flex gap-1.5">
        {[{ label: 'All', value: undefined }, { label: 'Open', value: 1 }, { label: 'Resolved', value: 2 }].map(opt => (
          <button
            key={opt.label}
            onClick={() => { setStatusFilter(opt.value); setPage(0) }}
            className={`px-2.5 py-1 text-xs rounded-full border ${statusFilter === opt.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-4"><LoadingSpinner /></div>
        ) : isError ? (
          <div className="p-4"><ErrorBanner message="Failed to load incidents." /></div>
        ) : incidents.length === 0 ? (
          <EmptyState icon={FileText} title="No incidents" description="No incidents match the current filter" />
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['ID', 'Server', 'Check', 'Status', 'Started', 'Ended', 'Root Cause'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {incidents.map(i => (
                <tr
                  key={i.incident_id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/incidents/${i.incident_id}`)}
                >
                  <td className="px-3 py-2 text-xs font-medium text-blue-600">#{i.incident_id}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{serverMap.get(i.server_id) ?? `#${i.server_id}`}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{checkMap.get(i.check_id) ?? `#${i.check_id}`}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[i.status] ?? 'bg-gray-100 text-gray-800'}`}>
                      {i.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{formatInTZ(i.started_at)}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{i.ended_at ? formatInTZ(i.ended_at) : '\u2014'}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 max-w-xs truncate">{i.root_cause ?? '\u2014'}</td>
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
