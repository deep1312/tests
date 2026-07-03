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

interface LiveMetricPoint {
  bucket: string
  cpu?: number
  memory?: number
  disk?: number
}

interface StatusTimelineChartProps {
  data: LiveMetricPoint[]
  isLoading: boolean

  // ✅ controlled props (FIX)
  selectedMetric: 'all' | 'cpu' | 'memory' | 'disk'
  onMetricChange: (value: 'all' | 'cpu' | 'memory' | 'disk') => void
}

export function StatusTimelineChart({
  data,
  isLoading,
  selectedMetric,
  onMetricChange,
}: StatusTimelineChartProps) {

  // Custom Tooltip
  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean
    payload?: any[]
    label?: string
  }) => {
    if (!active || !payload || !label) return null

    return (
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-4">
        <p className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wide">
          {new Date(label).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </p>

        <div className="space-y-2">
          {payload.map((entry, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-6"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm font-semibold text-slate-700">
                  {entry.name}
                </span>
              </div>

              <span className="text-sm font-black text-slate-900">
                {entry.value}%
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="w-full h-[420px] bg-white border border-slate-200 rounded-2xl flex items-center justify-center">
        <div className="text-slate-400 text-sm font-medium">
          Loading live metrics...
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-[420px] bg-white border border-slate-200 rounded-2xl flex items-center justify-center">
        <div className="text-slate-400 text-sm font-medium">
          No live metrics available
        </div>
      </div>
    )
  }

  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">
            Live Metrics
          </h2>

          <p className="text-xs text-slate-400 mt-1">
            Real-time backend resource monitoring
          </p>
        </div>

        {/* METRIC SELECTOR (CONTROLLED) */}
        <select
          value={selectedMetric}
          onChange={(e) =>
            onMetricChange(
              e.target.value as 'all' | 'cpu' | 'memory' | 'disk'
            )
          }
          className="border border-slate-200 bg-white rounded-xl px-4 py-2 text-xs font-bold text-slate-600 uppercase outline-none"
        >
          <option value="all">Display All Metrics</option>
          <option value="cpu">CPU Load %</option>
          <option value="memory">Memory Usage %</option>
          <option value="disk">Disk I/O %</option>
        </select>
      </div>

      {/* CHART */}
      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#f1f5f9"
            />

            <XAxis
              dataKey="bucket"
              tickFormatter={(value) =>
                new Date(value).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              }
              tick={{
                fontSize: 10,
                fill: '#94a3b8',
                fontWeight: 700,
              }}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              domain={[0, 100]}
              tick={{
                fontSize: 10,
                fill: '#94a3b8',
                fontWeight: 700,
              }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${value}%`}
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{
                paddingBottom: '20px',
                fontSize: '12px',
                fontWeight: 'bold',
              }}
            />

            {(selectedMetric === 'cpu' ||
              selectedMetric === 'all') && (
              <Line
                type="monotone"
                dataKey="cpu"
                name="CPU"
                stroke="#6366f1"
                strokeWidth={3}
                dot={false}
                isAnimationActive={false}
              />
            )}

            {(selectedMetric === 'memory' ||
              selectedMetric === 'all') && (
              <Line
                type="monotone"
                dataKey="memory"
                name="Memory"
                stroke="#a855f7"
                strokeWidth={3}
                dot={false}
                isAnimationActive={false}
              />
            )}

            {(selectedMetric === 'disk' ||
              selectedMetric === 'all') && (
              <Line
                type="monotone"
                dataKey="disk"
                name="Disk"
                stroke="#f59e0b"
                strokeWidth={3}
                dot={false}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default StatusTimelineChart