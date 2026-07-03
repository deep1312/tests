import { useNavigate } from 'react-router-dom'
import { Server, TrendingUp, TrendingDown, Minus, Activity, Zap, Layers, RefreshCw } from 'lucide-react'
import { useDashboardSummary } from '../api/dashboard'
import { ErrorBanner } from '../components/shared/ErrorBanner'
import { EmptyState } from '../components/shared/EmptyState'

/* =========================================================
   PRODUCTION-GRADE LOADING SKELETONS (Prevents Layout Shift)
========================================================= */
function DashboardSkeleton() {
  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto animate-pulse" aria-hidden="true">
      <div className="flex justify-between items-end mb-2">
        <div className="space-y-1">
          <div className="h-6 w-40 bg-slate-200 rounded-lg" />
          <div className="h-3 w-32 bg-slate-200 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3].map((idx) => (
          <div key={idx} className="bg-white rounded-xl border border-slate-100 p-3 space-y-2">
            <div className="flex justify-between">
              <div className="space-y-1">
                <div className="h-4 w-28 bg-slate-200 rounded" />
                <div className="h-2.5 w-16 bg-slate-200 rounded" />
              </div>
              <div className="h-4 w-12 bg-slate-200 rounded-full" />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[1, 2, 3].map((b) => (
                <div key={b} className="h-8 bg-slate-100 rounded-lg" />
              ))}
            </div>
            <div className="h-8 bg-slate-50 rounded border-t pt-1" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* =========================================================
   PURE COMPONENT LIVE METRICS (Eliminates API N+1 Polling)
========================================================= */
interface MetricItem {
  metric_name: string
  metric_value: number
}

interface ServerLiveStatsProps {
  metrics?: MetricItem[]
}

function ServerLiveStats({ metrics = [] }: ServerLiveStatsProps) {
  const getMetricValue = (name: string): string => {
    if (!Array.isArray(metrics)) return '--'
    const match = metrics.find((m) => m?.metric_name === name)
    if (!match || match.metric_value === undefined || match.metric_value === null) {
      return '--'
    }

    if (name.includes('connections')) {
      return Math.round(match.metric_value).toLocaleString()
    }
    return `${match.metric_value.toFixed(1)}%`
  }

  return (
    <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-100">
      <div className="flex items-center gap-1.5">
        <Zap className="w-3 h-3 text-amber-500 flex-shrink-0" />
        <div className="min-w-0 leading-tight">
          <p className="text-[9px] text-slate-400 uppercase font-black tracking-wider truncate leading-tight">Active Conn</p>
          <p className="text-[11px] font-bold text-slate-700 leading-tight">{getMetricValue('active_connections')}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Layers className="w-3 h-3 text-blue-500 flex-shrink-0" />
        <div className="min-w-0 leading-tight">
          <p className="text-[9px] text-slate-400 uppercase font-black tracking-wider truncate leading-tight">WAL Files</p>
          <p className="text-[11px] font-bold text-slate-700 leading-tight">{getMetricValue('wal_file_count')}</p>
        </div>
      </div>
    </div>
  )
}

/* =========================================================
   PRESENTATIONAL BADGES & HELPERS
========================================================= */
function HealthTrendIcon({ trend }: { trend: string }) {
  const norm = String(trend).toUpperCase()
  if (norm === 'IMPROVING') return <TrendingUp className="w-4 h-4 text-emerald-500" />
  if (norm === 'DEGRADING') return <TrendingDown className="w-4 h-4 text-rose-500" />
  return <Minus className="w-4 h-4 text-slate-400" />
}

function StatusBadge({ status }: { status: string }) {
  const norm = String(status).toUpperCase()
  const colors: Record<string, string> = {
    ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    STALE: 'border-amber-200 bg-amber-50 text-amber-700',
    OFFLINE: 'border-rose-200 bg-rose-50 text-rose-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${colors[norm] ?? 'border-slate-200 bg-slate-50 text-slate-600'}`}>
      {norm || 'UNKNOWN'}
    </span>
  )
}

/* =========================================================
   CORE DASHBOARD WRAPPER
========================================================= */
export function Dashboard() {
  const navigate = useNavigate()
  
  const { data, isLoading, error, isFetching } = useDashboardSummary()

  if (isLoading) {
    return <DashboardSkeleton />
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <ErrorBanner error={error as Error} />
      </div>
    )
  }

  const servers = Array.isArray(data?.data?.servers) ? data.data.servers : []
  const topFailing = Array.isArray(data?.data?.top_failing_checks) ? data.data.top_failing_checks : []

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto text-slate-900">
      
      {/* FLEET HEADER */}
      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Fleet Overview</h1>
          <p className="text-[11px] text-slate-400 font-medium">
            {servers.length} node{servers.length === 1 ? '' : 's'}
          </p>
        </div>

        {isFetching && (
          <div className="flex items-center gap-1.5 text-slate-400 text-[9px] font-black uppercase tracking-widest bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full">
            <RefreshCw className="w-2.5 h-2.5 animate-spin text-blue-500" />
            Syncing
          </div>
        )}
      </div>

      {/* COMPONENT BODY FLOW */}
      {servers.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No Active Instances Found"
          description="Incorporate your initial production PostgreSQL deployment link to activate live performance telemetry logs."
          action={{ label: 'Configure Instance', onClick: () => navigate('/servers') }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {servers.map((s) => {
            if (!s) return null
            
            const rawServerData = s as any;

            return (
              <div
                key={s.server_id}
                className="bg-white rounded-xl border border-slate-200/80 p-3 space-y-2 hover:border-blue-400 hover:shadow-md transition-all duration-200 cursor-pointer group flex flex-col justify-between"
                onClick={() => navigate('/monitoring', { state: { autoSelectServerId: s.server_id } })}
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                        {s.server_label || `Node #${s.server_id}`}
                      </h2>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                        {s.env_type || 'UNKNOWN'} • {s.server_role || 'STANDALONE'}
                      </p>
                    </div>
                    <StatusBadge status={s.collector_state} />
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="bg-rose-50/40 rounded-lg p-1.5 border border-rose-100/50 text-center">
                      <p className="text-sm font-black text-rose-600">{s.open_incident_count ?? 0}</p>
                      <p className="text-[8px] text-rose-400 uppercase font-black tracking-tight">Incidents</p>
                    </div>
                    
                    <div className="bg-amber-50/40 rounded-lg p-1.5 border border-amber-100/50 text-center">
                      <p className="text-sm font-black text-amber-600">{s.unack_alert_count ?? 0}</p>
                      <p className="text-[8px] text-amber-400 uppercase font-black tracking-tight">Alerts</p>
                    </div>

                    <div className="bg-slate-50/70 rounded-lg p-1.5 border border-slate-100 flex flex-col items-center justify-center text-center">
                      <HealthTrendIcon trend={s.health_trend} />
                      <p className="text-[7px] text-slate-400 uppercase font-black tracking-tight truncate max-w-full">
                        {s.health_trend || 'STABLE'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1.5">
                  <ServerLiveStats metrics={rawServerData.latest_metrics} />

                  {s.last_heartbeat && (
                    <div className="text-[8px] text-slate-400 font-medium pt-1 border-t border-slate-50">
                      Sync: {new Date(s.last_heartbeat).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* TOP DEGRADED CHECK MATRIX */}
      {topFailing.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <h2 className="font-black text-slate-700 flex items-center gap-1.5 text-[10px] uppercase tracking-widest">
              <Activity className="w-3.5 h-3.5 text-rose-500" />
              Top Failures
            </h2>
            <span className="bg-rose-50 border border-rose-100 text-rose-700 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider">
              Action Required
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {topFailing.map((c) => {
              if (!c) return null
              return (
                <div 
                  key={c.check_id} 
                  className="px-4 py-2 flex items-center justify-between hover:bg-rose-50/20 transition-colors"
                >
                  <span className="text-[11px] font-bold text-slate-700">{c.check_name || `Check ${c.check_id}`}</span>
                  <span className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-[9px] font-black tracking-wider">
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