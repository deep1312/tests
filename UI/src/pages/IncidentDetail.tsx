import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useIncident, usePatchIncidentRootCause } from '../api/incidents'
import { useServers } from '../api/servers'
import { useChecks } from '../api/checks'
import { LoadingSpinner } from '../components/shared/LoadingSpinner'
import { ErrorBanner } from '../components/shared/ErrorBanner'
import { Card } from '../components/ui/card'
import { ArrowLeft, CheckCircle, Clock, AlertTriangle, Flag, Activity } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { formatInTZ } from '../utils/timezone'

const STATUS_LABELS: Record<number, string> = { 1: 'OPEN', 2: 'RESOLVED' }
const ALERT_STATUS: Record<number, string> = { 1: 'WARNING', 2: 'CRITICAL' }
const ALERT_COLORS: Record<number, string> = { 1: 'bg-yellow-100 text-yellow-800', 2: 'bg-red-100 text-red-800' }

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

  if (isLoading) return <div className="p-4"><LoadingSpinner /></div>
  if (isError || !incident) return <div className="p-4"><ErrorBanner message="Failed to load incident." /></div>

  return (
    <div className="p-4 space-y-4">
      <button onClick={() => navigate('/incidents')} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Incidents
      </button>

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">Incident #{incident.incident_id}</h1>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${incident.status === 'OPEN' || (incident.status as any) === 1 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
            {STATUS_LABELS[incident.status as any] ?? incident.status}
          </span>
        </div>

        <Card className="p-3 bg-blue-50 border-blue-200">
          <p className="text-xs leading-relaxed text-slate-700">{description}</p>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div><p className="text-gray-500">Server</p><p className="font-medium">{serverName}</p></div>
          <div><p className="text-gray-500">Check</p><p className="font-medium">{checkName}</p></div>
          <div><p className="text-gray-500">Started</p><p className="font-medium">{formatInTZ(incident.started_at)}</p></div>
          <div><p className="text-gray-500">Ended</p><p className="font-medium">{incident.ended_at ? formatInTZ(incident.ended_at) : '\u2014'}</p></div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500 font-medium">Root Cause</p>
            {role === 'admin' && !editingRootCause && (
              <button onClick={() => { setEditingRootCause(true); setRootCauseText(incident.root_cause ?? '') }} className="text-[10px] text-blue-600 hover:underline">Edit</button>
            )}
          </div>
          {editingRootCause ? (
            <div className="space-y-1.5">
              <textarea
                className="w-full border rounded px-2 py-1.5 text-xs"
                rows={3}
                value={rootCauseText}
                onChange={e => setRootCauseText(e.target.value)}
              />
              {saveError && <p className="text-[10px] text-red-600">{saveError}</p>}
              <div className="flex gap-1.5">
                <button onClick={handleSaveRootCause} disabled={patchRootCause.isPending} className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">Save</button>
                <button onClick={() => setEditingRootCause(false)} className="px-2.5 py-1 text-xs border rounded hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-700">{incident.root_cause ?? <span className="text-gray-400 italic">Not set</span>}</p>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Timeline</h2>
        <div className="relative pl-6 space-y-0">
          {(() => {
            const events = buildTimelineEvents(incident)
            return events.map((event, idx) => (
              <div key={idx} className="relative pb-4 last:pb-0">
                {idx < events.length - 1 && (
                  <div className="absolute left-[7px] top-3 bottom-0 w-px bg-gray-200" />
                )}
                <div className="absolute left-0 top-0.5 rounded-full p-1" style={{ backgroundColor: event.color + '20' }}>
                  <event.icon className="h-3 w-3" style={{ color: event.color }} />
                </div>
                <div className="ml-5">
                  <p className="text-[10px] font-semibold text-gray-900">{event.title}</p>
                  <p className="text-[9px] text-gray-500 mt-0.5">{event.description}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">{formatInTZ(event.timestamp)}</p>
                </div>
              </div>
            ))
          })()}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b">
          <h2 className="text-sm font-semibold text-gray-900">Associated Alerts ({(incident as any).alerts?.length ?? 0})</h2>
        </div>
        {(incident as any).alerts?.length === 0 ? (
          <p className="p-4 text-xs text-gray-500">No alerts associated with this incident.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Triggered', 'Metric', 'Value', 'Status', 'Acknowledged'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {((incident as any).alerts ?? []).map((a: any) => (
                <tr key={`${a.alert_id}-${a.triggered_at}`} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs text-gray-500">{formatInTZ(a.triggered_at)}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{a.metric_name}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{a.observed_value}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ALERT_COLORS[a.status] ?? 'bg-gray-100 text-gray-800'}`}>
                      {ALERT_STATUS[a.status] ?? a.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {a.acknowledged_at
                      ? <span className="flex items-center gap-1 text-green-600 text-[10px]"><CheckCircle className="w-3 h-3" />{formatInTZ(a.acknowledged_at)}</span>
                      : <span className="text-gray-400 text-[10px]">&mdash;</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default IncidentDetail
