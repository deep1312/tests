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
    ? 'border-destructive'
    : hasUnackAlerts
      ? 'border-amber-500'
      : 'border-border'

  const bgColor = hasIncidents
    ? 'bg-destructive/5'
    : hasUnackAlerts
      ? 'bg-amber-500/5'
      : 'bg-card/90 backdrop-blur-sm'

  const getTrendIcon = () => {
    switch (server.health_trend) {
      case 'IMPROVING':
        return <TrendingUp className="w-5 h-5 text-emerald-500" />
      case 'DEGRADING':
        return <TrendingDown className="w-5 h-5 text-destructive" />
      default:
        return <AlertTriangle className="w-5 h-5 text-muted-foreground" />
    }
  }

  return (
    <div
      className={`border-l-4 rounded-lg p-6 ${borderColor} ${bgColor} shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-1`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground">
            {server.server_label}
          </h3>
          <div className="flex items-center space-x-2 mt-1">
            {server.env_type && (
              <span className="text-xs bg-muted text-foreground px-2 py-1 rounded">
                {server.env_type}
              </span>
            )}
            {server.server_role && (
              <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                {server.server_role}
              </span>
            )}
            {isStale && (
              <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-1 rounded flex items-center space-x-1">
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
          <div className="bg-destructive/10 rounded p-3">
            <div className="text-xs text-destructive font-semibold">Open Incidents</div>
            <div className="text-2xl font-bold text-destructive">
              {server.open_incident_count}
            </div>
          </div>
        )}
        {hasUnackAlerts && (
          <div className="bg-amber-500/10 rounded p-3">
            <div className="text-xs text-amber-500 font-semibold">Unack Alerts</div>
            <div className="text-2xl font-bold text-amber-500">
              {server.unack_alert_count}
            </div>
          </div>
        )}
        {!hasIncidents && !hasUnackAlerts && (
          <div className="bg-emerald-500/10 rounded p-3">
            <div className="text-xs text-emerald-500 font-semibold">Status</div>
            <div className="text-lg font-bold text-emerald-600">Healthy</div>
          </div>
        )}
      </div>

      {/* NEW: Real-Time Metrics Section */}
      <div className="grid grid-cols-2 gap-4 mb-6 border-t border-border/50 pt-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">CPU Usage</div>
            <div className="text-sm font-semibold text-foreground">{getMetricValue('cpu_usage')}</div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <HardDrive className="w-4 h-4 text-purple-500" />
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Memory</div>
            <div className="text-sm font-semibold text-foreground">{getMetricValue('memory_usage')}</div>
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
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