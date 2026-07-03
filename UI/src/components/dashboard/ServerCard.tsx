import { TrendingDown, TrendingUp, AlertTriangle, Zap, Activity, HardDrive } from 'lucide-react'
import { DashboardServerSummary } from '../../api/dashboard'
import { TimestampCell } from '../shared/TimestampCell'
import { useLatestMetrics } from '../../api/monitoring' // Import our new hook

interface ServerCardProps {
  server: DashboardServerSummary
}

/**
 * Server card displaying health status, incidents, alerts, and trends
 * Updated: Now includes Real-Time numerical metrics (CPU/RAM)
 */
export function ServerCard({ server }: ServerCardProps) {
  // Fetch real-time metrics for this specific server
  // Auto-refresh every 30 seconds
  const { data: latestMetrics } = useLatestMetrics(server.server_id, undefined, undefined);

  // Helper to find specific metric values from the array
  const getMetricValue = (name: string) => {
    const metric = latestMetrics?.data?.find(m => m.metric_name === name);
    return metric ? `${metric.metric_value.toFixed(1)}%` : '--';
  };

  const hasIncidents = server.open_incident_count > 0
  const hasUnackAlerts = server.unack_alert_count > 0 && !hasIncidents
  const isStale = server.collector_state === 'STALE'

  const borderColor = hasIncidents
    ? 'border-red-500'
    : hasUnackAlerts
      ? 'border-yellow-500'
      : 'border-gray-200'

  const bgColor = hasIncidents
    ? 'bg-red-50'
    : hasUnackAlerts
      ? 'bg-yellow-50'
      : 'bg-white'

  const getTrendIcon = () => {
    switch (server.health_trend) {
      case 'IMPROVING':
        return <TrendingUp className="w-5 h-5 text-green-600" />
      case 'DEGRADING':
        return <TrendingDown className="w-5 h-5 text-red-600" />
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-600" />
    }
  }

  return (
    <div
      className={`border-l-4 rounded-lg p-6 ${borderColor} ${bgColor} shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {server.server_label}
          </h3>
          <div className="flex items-center space-x-2 mt-1">
            {server.env_type && (
              <span className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded">
                {server.env_type}
              </span>
            )}
            {server.server_role && (
              <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">
                {server.server_role}
              </span>
            )}
            {isStale && (
              <span className="text-xs bg-amber-200 text-amber-800 px-2 py-1 rounded flex items-center space-x-1">
                <Zap className="w-3 h-3" />
                <span>Stale</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getTrendIcon()}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        {hasIncidents && (
          <div className="bg-red-100 rounded p-3">
            <div className="text-xs text-red-600 font-semibold">Open Incidents</div>
            <div className="text-2xl font-bold text-red-900">
              {server.open_incident_count}
            </div>
          </div>
        )}
        {hasUnackAlerts && (
          <div className="bg-yellow-100 rounded p-3">
            <div className="text-xs text-yellow-600 font-semibold">Unack Alerts</div>
            <div className="text-2xl font-bold text-yellow-900">
              {server.unack_alert_count}
            </div>
          </div>
        )}
        {!hasIncidents && !hasUnackAlerts && (
          <div className="bg-green-100 rounded p-3">
            <div className="text-xs text-green-600 font-semibold">Status</div>
            <div className="text-lg font-bold text-green-900">Healthy</div>
          </div>
        )}
      </div>

      {/* NEW: Real-Time Metrics Section */}
      <div className="grid grid-cols-2 gap-4 mb-6 border-t border-gray-100 pt-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <Activity className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <div className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">CPU Usage</div>
            <div className="text-sm font-semibold text-gray-900">{getMetricValue('cpu_usage')}</div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-50 rounded-lg">
            <HardDrive className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <div className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Memory</div>
            <div className="text-sm font-semibold text-gray-900">{getMetricValue('memory_usage')}</div>
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-600 space-y-1">
        {server.last_heartbeat && (
          <div>
            Last heartbeat:{' '}
            <TimestampCell utcIso={server.last_heartbeat} format="MMM d, HH:mm" />
          </div>
        )}
        <div>
          Retention: {server.retention_metrics_days}d metrics,{' '}
          {server.retention_logs_days}d logs
        </div>
      </div>
    </div>
  )
}

export default ServerCard