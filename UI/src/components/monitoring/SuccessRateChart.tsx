import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { RunsAggregatePoint } from '../../api/monitoring'
import { formatInTZ } from '../../utils/timezone'

interface SuccessRateChartProps {
  data: RunsAggregatePoint[]
  isLoading: boolean
}

export function SuccessRateChart({
  data,
  isLoading,
}: SuccessRateChartProps) {
  // Custom tooltip component
  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean
    payload?: Array<{
      name: string
      value: number
      dataKey: string
      color: string
    }>
    label?: string
  }) => {
    if (!active || !payload || !label) return null

    const dataPoint = data.find((d) => d.bucket === label)
    const successRate = payload[0]?.value ?? 0
    const sampleCount = dataPoint?.total_count ?? 0

    return (
      <div className="bg-card/90 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-semibold text-gray-700 mb-2">
          {formatInTZ(label)}
        </p>
        <p className="text-sm text-gray-700">
          Success Rate: <span className="font-semibold">{successRate.toFixed(1)}%</span>
        </p>
        <p className="text-sm text-gray-700">
          Sample Count: <span className="font-semibold">{sampleCount}</span>
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="w-full h-80 bg-muted rounded-lg border border-border flex items-center justify-center">
        <div className="text-muted-foreground">Loading chart...</div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-80 bg-muted rounded-lg border border-border flex items-center justify-center">
        <div className="text-muted-foreground">No data available</div>
      </div>
    )
  }

  return (
    <div className="w-full h-80 bg-card/90 backdrop-blur-sm rounded-lg border border-border p-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
        >
          <defs>
            <linearGradient id="successRateGradient" x1="0" y1="0" x2="0" y2="1">
              {/* Green above 95%, amber below */}
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.8} />
              <stop offset="50%" stopColor="#22c55e" stopOpacity={0.6} />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="bucket"
            tickFormatter={(value) => new Date(value).toLocaleTimeString()}
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            domain={[0, 100]}
            label={{ value: '%', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <ReferenceLine
            y={95}
            stroke="#22c55e"
            strokeDasharray="4 2"
            label={{ value: '95%', position: 'right', fill: '#22c55e', fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="success_rate_pct"
            fill="url(#successRateGradient)"
            stroke="#22c55e"
            strokeWidth={2}
            name="Success Rate"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default SuccessRateChart
