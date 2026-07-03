import { useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  PieChart,
  Pie
} from 'recharts'
import { useMonitoringLogs } from '../../api/monitoring'

interface AdaptiveInsightsPanelProps {
  serverId: number | null
  checkId: number | null
  from: string
  to: string
}

const LINE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// --- Utility Components ---

const SectionHeader = ({ title }: { title: string }) => (
  <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">{title}</h4>
);

const GaugeWidget = ({ value, label, color = "#3b82f6" }: { value: number, label: string, color?: string }) => {
  const data = [{ value: value }, { value: 100 - value }];
  return (
    <div className="flex flex-col items-center">
      <div className="h-32 w-full">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="80%"
              startAngle={180}
              endAngle={0}
              innerRadius={40}
              outerRadius={60}
              dataKey="value"
            >
              <Cell fill={color} />
              <Cell fill="#e5e7eb" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center -mt-6">
        <p className="text-2xl font-bold text-foreground">{value}%</p>
        <p className="text-xs text-muted-foreground uppercase">{label}</p>
      </div>
    </div>
  );
};

// --- Specialized View Components ---

const ConnectionUsageView = ({ logs }: { logs: any[] }) => {
  const latest = logs[0]?.raw_result || {};
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
        <GaugeWidget value={latest.usage_pct || 0} label="Current Usage" color={latest.usage_pct > 85 ? '#ef4444' : '#3b82f6'} />
      </div>
      <div className="space-y-4">
        <div className="p-4 bg-card/90 backdrop-blur-sm border rounded-lg shadow-sm">
          <p className="text-xs text-muted-foreground">Active Connections</p>
          <p className="text-xl font-bold">{latest.active_connections || 0}</p>
        </div>
        <div className="p-4 bg-card/90 backdrop-blur-sm border rounded-lg shadow-sm">
          <p className="text-xs text-muted-foreground">Max Configured</p>
          <p className="text-xl font-bold">{latest.max_connections || 0}</p>
        </div>
      </div>
    </div>
  );
};

const TopQueriesView = ({ rows }: { rows: any[] }) => (
  <div className="space-y-6">
    <div className="h-64 w-full">
      <SectionHeader title="Execution Time by Query (ms)" />
      <ResponsiveContainer>
        <BarChart data={rows.slice(0, 8)}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="queryid" tick={{ fontSize: 10 }} hide />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="total_exec_time" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    <div className="overflow-x-auto border rounded-lg">
      <table className="min-w-full text-xs">
        <thead className="bg-muted">
          <tr>
            <th className="p-2 border-b">Query Snippet</th>
            <th className="p-2 border-b">Calls</th>
            <th className="p-2 border-b text-right">Total Time</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 10).map((row, i) => (
            <tr key={i} className="hover:bg-muted">
              <td className="p-2 border-b font-mono text-blue-600 truncate max-w-xs">{row.query || row.queryid}</td>
              <td className="p-2 border-b">{row.calls}</td>
              <td className="p-2 border-b text-right font-bold">{Math.round(row.total_exec_time)}ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const BloatView = ({ rows }: { rows: any[] }) => (
  <div className="space-y-4">
    <SectionHeader title="Table Bloat Heatmap" />
    <div className="flex flex-wrap gap-2">
      {rows.map((row, i) => (
        <div 
          key={i}
          className="group relative h-12 w-24 rounded border flex items-center justify-center text-[10px] font-bold overflow-hidden"
          style={{ 
            backgroundColor: row.bloat_ratio > 40 ? `rgba(239, 68, 68, ${row.bloat_ratio / 100})` : '#f0fdf4',
            borderColor: row.bloat_ratio > 40 ? '#f87171' : '#bbf7d0'
          }}
        >
          <span className={row.bloat_ratio > 50 ? 'text-white' : 'text-foreground'}>{row.bloat_ratio}%</span>
          <div className="absolute inset-0 bg-black bg-opacity-80 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center">
             <p className="truncate">{row.table_name}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// --- Main Component ---

export function AdaptiveInsightsPanel({ serverId, checkId, from, to }: AdaptiveInsightsPanelProps) {
  const { data, isLoading } = useMonitoringLogs(
    serverId ?? undefined,
    checkId ?? undefined,
    from,
    to,
    50,
    0
  );

  const logs = data?.data ?? [];
  const latestLog = logs[0];
  const checkName = latestLog?.check_name || "";

  // Logic to determine if we show a table or a trend chart
  const isTabular = useMemo(() => {
    const raw = latestLog?.raw_result;
    if (Array.isArray(raw)) return true;
    if (typeof raw === 'object' && Object.values(raw || {}).some(v => Array.isArray(v))) return true;
    return false;
  }, [latestLog]);

  const rows = useMemo(() => {
    const raw = latestLog?.raw_result;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'object') {
      const arrayKey = Object.keys(raw).find(k => Array.isArray(raw[k]));
      return arrayKey ? (raw[arrayKey] as any[]) : [];
    }
    return [];
  }, [latestLog]);

  if (!checkId) return (
    <div className="bg-muted rounded-xl border-2 border-dashed border-border p-12 text-center">
      <p className="text-muted-foreground">Select a health check to load dynamic metrics</p>
    </div>
  );

  if (isLoading) return <div className="p-8 text-center animate-pulse text-muted-foreground">Analyzing database metrics...</div>;

  return (
    <div className="bg-card/90 backdrop-blur-sm rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="bg-muted px-6 py-4 border-b flex justify-between items-center">
        <h3 className="font-bold text-foreground">{checkName || 'Metric Insights'}</h3>
        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold uppercase tracking-tighter">
          Live Data
        </span>
      </div>

      <div className="p-6">
        {/* STRATEGY SWITCHER */}
        {checkName === "Connection Usage Percentage" ? (
          <ConnectionUsageView logs={logs} />
        ) : checkName === "Top Queries Performance" ? (
          <TopQueriesView rows={rows} />
        ) : checkName === "Table Bloat Percentage" ? (
          <BloatView rows={rows} />
        ) : isTabular ? (
          /* Default Table View */
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full text-xs text-left">
              <thead className="bg-muted sticky top-0">
                <tr>
                  {rows[0] && Object.keys(rows[0]).map(k => <th key={k} className="p-2 border-b uppercase">{k.replace(/_/g, ' ')}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="hover:bg-blue-50 border-b">
                    {Object.values(row).map((v: any, j) => <td key={j} className="p-2">{String(v)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Default Line Chart View for scalars */
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <LineChart data={logs.slice().reverse().map(l => ({
                time: new Date(l.collected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                ... (typeof l.raw_result === 'object' ? l.raw_result : { value: l.raw_result })
              }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="time" fontSize={10} tickMargin={10} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Legend iconType="circle" />
                {Object.keys(logs[0]?.raw_result || {}).filter(k => typeof logs[0].raw_result[k] === 'number').map((k, i) => (
                  <Line key={k} type="monotone" dataKey={k} stroke={LINE_COLORS[i % 5]} strokeWidth={3} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdaptiveInsightsPanel;