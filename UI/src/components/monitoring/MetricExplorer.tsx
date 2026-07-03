import { useState, useMemo } from 'react'
import { X, LayoutGrid, Activity, Database, Users, HardDrive, Table as TableIcon } from 'lucide-react'
import * as Select from '@radix-ui/react-select'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  useMetricNames,
  useMetricsAggregate,
  useMetrics,
  MetricAggregatePoint,
  Metric
} from '../../api/monitoring'

// --- Explicit interfaces for payload extractions ---
interface IndexDetail {
  table_name: string;
  index_name: string;
  index_size?: string;
  size?: string;
}

interface DatabaseDetail {
  db_name?: string;
  name?: string;
  size_gb?: number;
  size?: number;
}

interface ConnectionDetail {
  connection_pct?: number;
  usage_pct?: number;
  max_connections?: number | string;
}

// --- 1. TABLE COMPONENT FOR INDEXES ---
const UnusedIndexTable = ({ data }: { data: Metric }) => {
  // Explicitly casting the shape to resolve {} type issues
  const indexes: IndexDetail[] = (data.details as any)?.indexes || (data.labels as any)?.indexes || []
  
  return (
    <div className="bg-card/90 backdrop-blur-sm border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 bg-muted border-b flex justify-between items-center">
        <span className="font-bold text-sm flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-600" /> Unused Index Report
        </span>
        <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-bold">
          Count: {data.metric_value}
        </span>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted sticky top-0 border-b">
            <tr>
              <th className="p-3 text-[10px] font-black uppercase text-muted-foreground tracking-wider">Table</th>
              <th className="p-3 text-[10px] font-black uppercase text-muted-foreground tracking-wider">Index Name</th>
              <th className="p-3 text-[10px] font-black uppercase text-muted-foreground tracking-wider text-right">Size</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {indexes.length > 0 ? indexes.map((idx, i) => (
              <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                <td className="p-3 font-semibold text-foreground">{idx.table_name}</td>
                <td className="p-3 text-muted-foreground font-mono text-xs">{idx.index_name}</td>
                <td className="p-3 text-right font-mono text-blue-600 font-medium">{idx.index_size || idx.size}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={3} className="p-10 text-center text-muted-foreground italic text-xs">
                  No unused indexes found in this sample.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- 2. TABLE COMPONENT FOR DB SIZE / USAGE ---
const DatabaseUsageTable = ({ data }: { data: Metric }) => {
  const dbData: DatabaseDetail[] = (data.details as any)?.databases || (data.labels as any)?.databases || []
  
  return (
    <div className="bg-card/90 backdrop-blur-sm border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 bg-muted border-b flex justify-between items-center">
        <span className="font-bold text-sm flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-indigo-600" /> Storage Breakdown
        </span>
        <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-bold">
          Total: {data.metric_value} GB
        </span>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted sticky top-0 border-b">
            <tr>
              <th className="p-3 text-[10px] font-black uppercase text-muted-foreground tracking-wider">Database</th>
              <th className="p-3 text-[10px] font-black uppercase text-muted-foreground tracking-wider text-right">Size (GB)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {dbData.length > 0 ? dbData.map((db, i) => (
              <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                <td className="p-3 font-bold text-foreground">{db.db_name || db.name}</td>
                <td className="p-3 text-right font-mono text-indigo-600 font-bold">{db.size_gb || db.size} GB</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={2} className="p-10 text-center text-muted-foreground italic text-xs">
                  No detailed usage breakdown available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- 3. CONNECTION GAUGE ---
const ConnectionGauge = ({ data }: { data: Metric }) => {
  const details: ConnectionDetail = (data.details || data.labels || {}) as ConnectionDetail;
  const pct = details.connection_pct ?? details.usage_pct ?? 0;
  const val = data.metric_value;
  const max = details.max_connections ?? '—';
  
  const color = pct > 80 ? 'text-red-500' : pct > 50 ? 'text-orange-500' : 'text-green-500';
  const barColor = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-orange-500' : 'bg-green-500';

  return (
    <div className="bg-card/90 backdrop-blur-sm border border-border rounded-xl p-8 flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden">
      <Users className="w-8 h-8 mb-2 text-gray-300" />
      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Active Connections</h4>
      <div className={`text-7xl font-black font-mono my-2 tracking-tighter ${color}`}>
        {Math.round(pct)}%
      </div>
      <div className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full border border-gray-100">
        Active: <strong className="text-foreground">{val}</strong> / Max: {max}
      </div>
      <div className="w-full max-w-xs bg-muted h-3 rounded-full mt-8 overflow-hidden border">
        <div 
          className={`h-full transition-all duration-1000 ease-out ${barColor}`} 
          style={{ width: `${Math.min(pct, 100)}%` }} 
        />
      </div>
    </div>
  )
}

interface MetricExplorerProps {
  serverId: number | null
  from: string
  to: string
  bucketInterval: string
}

const METRIC_COLORS = ['#3b82f6', '#10b981', '#f59e0b']

export function MetricExplorer({ serverId, from, to, bucketInterval }: MetricExplorerProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<{name: string, color: string}[]>([])
  const [viewMode, setViewMode] = useState<'chart' | 'dashboard'>('dashboard')

  const { data: metricNamesResponse } = useMetricNames(serverId || 0, from, to)
  const metricNames = metricNamesResponse?.data ?? []

  const { data: rawMetricsData, isLoading: isRawLoading } = useMetrics(
    serverId || undefined,
    undefined,
    selectedMetrics.length === 1 ? selectedMetrics[0].name : undefined,
    from,
    to,
    undefined,
    1,
    0
  )

  const aggregateQueries = selectedMetrics.map(metric =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMetricsAggregate(serverId || 0, metric.name, bucketInterval, from, to)
  )

  // Cleaned up warning 6133 by keeping it ready or safely leaving it evaluated
  const isAggLoading = aggregateQueries.some(q => q.isLoading)

  const combinedData = useMemo(() => {
    if (aggregateQueries.length === 0 || !aggregateQueries[0].data) return []
    const baseData = aggregateQueries[0].data?.data || []
    return baseData.map((bucket: MetricAggregatePoint) => {
      const merged: Record<string, any> = { bucket: bucket.bucket }
      aggregateQueries.forEach((query, index) => {
        const metricData = query.data?.data || []
        const matchingBucket = metricData.find(b => b.bucket === bucket.bucket)
        if (matchingBucket) merged[`${selectedMetrics[index].name}_avg`] = matchingBucket.avg_value
      })
      return merged
    })
  }, [aggregateQueries, selectedMetrics])

  const renderDashboard = () => {
    if (selectedMetrics.length !== 1) {
      return (
        <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-xl text-muted-foreground bg-muted/30">
          <TableIcon className="w-10 h-10 mb-2 opacity-10" />
          <p className="text-sm font-medium">Select a metric to view detailed table</p>
        </div>
      )
    }

    const latest = rawMetricsData?.data?.[0]
    if (!latest) return <div className="p-10 text-center text-muted-foreground italic">Fetching latest data...</div>

    const mName = selectedMetrics[0].name.toLowerCase()

    if (mName.includes('index')) {
      return <UnusedIndexTable data={latest} />
    }
    
    if (mName.includes('size') || mName.includes('usage')) {
      return <DatabaseUsageTable data={latest} />
    }

    if (mName.includes('connection')) {
      return <ConnectionGauge data={latest} />
    }

    return (
      <div className="p-8 border rounded-xl bg-card/90 backdrop-blur-sm shadow-sm">
        <h4 className="text-xs font-black text-muted-foreground uppercase mb-4 tracking-tighter">{selectedMetrics[0].name}</h4>
        <div className="text-5xl font-mono font-bold text-blue-600 mb-6 tracking-tight">
          {latest.metric_value}
        </div>
        <div className="text-[11px] bg-background text-green-400 p-4 rounded-lg overflow-auto font-mono max-h-48 border-4 border-gray-800">
          <pre>{JSON.stringify(latest.details || latest.labels || {}, null, 2)}</pre>
        </div>
      </div>
    )
  }

  if (!serverId) {
    return (
      <div className="p-12 border-2 border-dashed rounded-2xl text-center text-muted-foreground bg-muted/50 font-medium">
        Select a database server to start monitoring.
      </div>
    )
  }

  return (
    <div className="bg-card/90 backdrop-blur-sm border border-gray-100 rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-foreground flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          Metric Explorer
          {isAggLoading && <span className="text-[9px] text-blue-400 animate-pulse font-normal">Syncing...</span>}
        </h3>
        <div className="flex bg-muted p-1 rounded-xl border border-border shadow-inner">
          <button 
            onClick={() => setViewMode('dashboard')} 
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${viewMode === 'dashboard' ? 'bg-card/90 backdrop-blur-sm shadow-sm text-blue-600' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <LayoutGrid className="w-3.5 h-3.5"/> Dashboard View
          </button>
          <button 
            onClick={() => setViewMode('chart')} 
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${viewMode === 'chart' ? 'bg-card/90 backdrop-blur-sm shadow-sm text-blue-600' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Activity className="w-3.5 h-3.5"/> Trend Chart
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Choose Metrics</label>
          <Select.Root onValueChange={(val) => {
            if (selectedMetrics.length < 3 && !selectedMetrics.some(m => m.name === val)) {
              setSelectedMetrics([...selectedMetrics, { name: val, color: METRIC_COLORS[selectedMetrics.length] }])
            }
          }} value="">
            <Select.Trigger className="w-full px-4 py-3 text-sm border border-border rounded-xl flex justify-between items-center bg-muted hover:bg-card/90 backdrop-blur-sm hover:border-blue-400 transition-all outline-none focus:ring-2 focus:ring-blue-100">
              <Select.Value placeholder="Search database metrics..." />
              <span className="text-gray-300 text-xs">▼</span>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className="bg-card/90 backdrop-blur-sm border border-border rounded-xl shadow-2xl z-[100] overflow-hidden min-w-[240px]">
                <Select.Viewport className="p-1">
                  {metricNames.map(n => (
                    <Select.Item key={n} value={n} className="px-8 py-2.5 text-sm cursor-pointer hover:bg-blue-50 outline-none rounded-lg flex items-center transition-colors">
                      <Select.ItemText>{n}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          {selectedMetrics.map(m => (
            <div key={m.name} className="px-3 py-2 bg-card/90 backdrop-blur-sm border border-border rounded-xl text-xs flex items-center gap-2 shadow-sm hover:border-red-200 transition-all">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
              <span className="font-bold text-gray-700 uppercase tracking-tighter">{m.name}</span>
              <button 
                onClick={() => setSelectedMetrics(selectedMetrics.filter(x => x.name !== m.name))}
                className="text-gray-300 hover:text-red-500"
              >
                <X className="w-3.5 h-3.5"/>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-[450px] bg-muted/20 rounded-2xl border border-gray-100 p-4">
        {viewMode === 'dashboard' ? (
          isRawLoading ? (
            <div className="flex flex-col items-center justify-center h-[350px]">
               <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
               <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Loading Telemetry...</span>
            </div>
          ) : renderDashboard()
        ) : (
          <div className="h-[400px] w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combinedData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="bucket" 
                  tick={{fontSize: 10, fill: '#9ca3af'}} 
                  tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{fontSize: 10, fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }} />
                {selectedMetrics.map(m => (
                  <Line 
                    key={m.name} 
                    type="monotone" 
                    dataKey={`${m.name}_avg`} 
                    stroke={m.color} 
                    strokeWidth={2.5} 
                    dot={false} 
                    connectNulls 
                    animationDuration={600} 
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

export default MetricExplorer