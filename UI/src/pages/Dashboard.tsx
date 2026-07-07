import { useNavigate } from 'react-router-dom'
import { Server, TrendingUp, TrendingDown, Minus, Activity, Zap, Layers, RefreshCw, ArrowRight, AlertCircle, Database, Shield } from 'lucide-react'
import { useDashboardSummary } from '../api/dashboard'
import { useLegendConfigs } from '../api/settings'
import { useServers } from '../api/servers'
import { ErrorBanner } from '../components/shared/ErrorBanner'
import { EmptyState } from '../components/shared/EmptyState'
import { Tooltip } from '../components/shared/Tooltip'

/* ── Skeleton ── */
function DashboardSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" aria-hidden="true">
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <div className="h-7 w-44 skeleton" />
          <div className="h-4 w-32 skeleton" />
        </div>
      </div>

      {/* Stats row */}
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

      {/* Server cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="h-5 w-32 skeleton" />
                <div className="h-3 w-24 skeleton" />
              </div>
              <div className="h-6 w-16 skeleton rounded-full" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((j) => <div key={j} className="h-14 skeleton rounded-xl" />)}
            </div>
            <div className="h-12 skeleton" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Helpers ── */
function HealthTrendIcon({ trend }: { trend: string }) {
  const norm = String(trend).toUpperCase()
  if (norm === 'IMPROVING') return <TrendingUp className="w-4 h-4 text-primary" />
  if (norm === 'DEGRADING') return <TrendingDown className="w-4 h-4 text-destructive" />
  return <Minus className="w-4 h-4 text-muted-foreground" />
}


/* ── Live Metrics Strip ── */
interface MetricItem { metric_name: string; metric_value: number }

function ServerLiveStats({ metrics = [] }: { metrics?: MetricItem[] }) {
  const getVal = (name: string) => {
    if (!Array.isArray(metrics)) return '--'
    const m = metrics.find((x) => x?.metric_name === name)
    if (!m || m.metric_value == null) return '--'
    return name.includes('connections') ? Math.round(m.metric_value).toLocaleString() : `${m.metric_value.toFixed(1)}%`
  }

  return (
    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/50">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
          <Zap className="w-3.5 h-3.5 text-warning" />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground font-medium">Active Conn</p>
          <p className="text-sm font-bold text-foreground tabular-nums">{getVal('active_connections')}</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-info/10 flex items-center justify-center flex-shrink-0">
          <Layers className="w-3.5 h-3.5 text-info" />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground font-medium">WAL Files</p>
          <p className="text-sm font-bold text-foreground tabular-nums">{getVal('wal_file_count')}</p>
        </div>
      </div>
    </div>
  )
}

/* ── Dashboard ── */
export function Dashboard() {
  const navigate = useNavigate()
  const { data, isLoading, error, isFetching } = useDashboardSummary()
  const { data: legends = [] } = useLegendConfigs()
  const { data: allServersMeta } = useServers(undefined, undefined, undefined, 1, 0)
  const { data: inactiveServersMeta } = useServers(undefined, false, undefined, 1, 0)

  const isLegendEnabled = (name: string) => {
    const lg = legends.find(l => l.page_name === 'Dashboard' && l.legend_name === name)
    return lg ? lg.is_enabled : true
  }

  if (isLoading) return <DashboardSkeleton />

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <ErrorBanner error={error as Error} />
      </div>
    )
  }

  const servers = Array.isArray(data?.data?.servers) ? data.data.servers : []
  const topFailing = Array.isArray(data?.data?.top_failing_checks) ? data.data.top_failing_checks : []

  const totalServerCount = allServersMeta?.meta?.pagination?.total ?? servers.length
  const inactiveServerCount = inactiveServersMeta?.meta?.pagination?.total ?? 0
  const totalIncidents = servers.reduce((acc: number, s: any) => acc + (s?.open_incident_count ?? 0), 0)
  const totalAlerts = servers.reduce((acc: number, s: any) => acc + (s?.unack_alert_count ?? 0), 0)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Fleet Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalServerCount} server{totalServerCount === 1 ? '' : 's'} registered
          </p>
        </div>

        {isFetching && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-card text-xs text-muted-foreground font-medium">
            <RefreshCw className="w-3 h-3 animate-spin text-primary" />
            Syncing
          </div>
        )}
      </div>

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <Tooltip content="Total number of registered server nodes">
              <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full cursor-help">Servers</span>
            </Tooltip>
          </div>
          {isLegendEnabled('Total Server Count') && (
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-extrabold text-foreground tabular-nums">{totalServerCount}</p>
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Total</span>
            </div>
          )}
          {isLegendEnabled('Inactive Server Count') && inactiveServerCount > 0 && (
            <div className="flex items-center gap-2 mt-2 bg-destructive/10 px-3 py-1.5 rounded-lg border border-destructive/20 w-max">
              <span className="w-2 h-2 rounded-full bg-destructive" />
              <p className="text-xs font-bold text-destructive uppercase tracking-wide">{inactiveServerCount} Inactive</p>
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-destructive" />
            </div>
            <Tooltip content="Currently open and unresolved system incidents">
              <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full cursor-help">Incidents</span>
            </Tooltip>
          </div>
          <p className="text-3xl font-bold text-foreground tabular-nums">{totalIncidents}</p>
          <p className="text-xs text-muted-foreground mt-1">open incidents</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-warning" />
            </div>
            <Tooltip content="Unacknowledged alerts requiring attention">
              <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full cursor-help">Alerts</span>
            </Tooltip>
          </div>
          <p className="text-3xl font-bold text-foreground tabular-nums">{totalAlerts}</p>
          <p className="text-xs text-muted-foreground mt-1">unacknowledged</p>
        </div>
      </div>

      {/* ── Server Cards ── */}
      {servers.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No Servers Connected"
          description="Connect your first PostgreSQL instance to begin monitoring."
          action={{ label: 'Add Server', onClick: () => navigate('/servers') }}
        />
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Server Instances</h2>
            <button
              onClick={() => navigate('/servers')}
              className="text-xs text-primary font-medium flex items-center gap-1 hover:gap-2 transition-all"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {servers.map((s: any) => {
              if (!s) return null
              return (
                <div
                  key={s.server_id}
                  className="glass-card-hover p-5 cursor-pointer group flex flex-col"
                  onClick={() => navigate('/monitoring', { state: { autoSelectServerId: s.server_id } })}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {s.server_label || `Node #${s.server_id}`}
                      </h3>
                      <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                        {s.env_type || 'unknown'} • {s.server_role || 'standalone'}
                      </p>
                    </div>
                  </div>

                  {/* Metric Pills */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="rounded-xl bg-destructive/5 border border-destructive/10 p-2.5 text-center">
                      <p className="text-lg font-bold text-destructive tabular-nums">{s.open_incident_count ?? 0}</p>
                      <p className="text-[9px] text-destructive/70 font-semibold uppercase tracking-wider mt-0.5">Incidents</p>
                    </div>
                    <div className="rounded-xl bg-warning/5 border border-warning/10 p-2.5 text-center">
                      <p className="text-lg font-bold text-warning tabular-nums">{s.unack_alert_count ?? 0}</p>
                      <p className="text-[9px] text-warning/70 font-semibold uppercase tracking-wider mt-0.5">Alerts</p>
                    </div>
                    <div className="rounded-xl bg-muted/50 border border-border p-2.5 flex flex-col items-center justify-center">
                      <HealthTrendIcon trend={s.health_trend} />
                      <p className="text-[9px] text-muted-foreground font-semibold uppercase mt-1 truncate max-w-full">
                        {s.health_trend || 'Stable'}
                      </p>
                    </div>
                  </div>

                  {/* Live Metrics */}
                  <div className="mt-auto">
                    <ServerLiveStats metrics={(s as any).latest_metrics} />

                    {s.last_heartbeat && (
                      <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/50">
                        Last sync: {new Date(s.last_heartbeat).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Top Failing Checks ── */}
      {topFailing.length > 0 && isLegendEnabled('Collector Failures') && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Activity className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Collector Failures</h2>
                <p className="text-[11px] text-muted-foreground">Checks requiring immediate attention</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-[11px] font-semibold border border-destructive/20">
              {topFailing.length} critical
            </span>
          </div>
          <div className="divide-y divide-border/50">
            {topFailing.map((c: any) => {
              if (!c) return null
              return (
                <div key={c.check_id} className="px-5 py-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-destructive" />
                    <span className="text-sm font-medium text-foreground">{c.check_name || `Check ${c.check_id}`}</span>
                  </div>
                  <span className="px-2.5 py-1 bg-destructive/10 text-destructive rounded-lg text-xs font-semibold tabular-nums">
                    {c.failure_count ?? 0} failures
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard