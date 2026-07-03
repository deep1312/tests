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
import { RunsAggregatePoint } from '../../api/monitoring'
import { formatInTZ } from '../../utils/timezone'

interface ExecutionTimeChartProps {
  data: RunsAggregatePoint[]
  isLoading: boolean
}

export function ExecutionTimeChart({
  data,
  isLoading,
}: ExecutionTimeChartProps) {
  // Custom tooltip component
  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean
    payload?: Array<{
      name: string
      value: number | null
      dataKey: string
      color: string
    }>
    label?: string
  }) => {
    if (!active || !payload || !label) return null

    return (
      <div className="bg-card/90 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-semibold text-gray-700 mb-2">
          {formatInTZ(label)}
        </p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value !== null ? `${entry.value}ms` : 'N/A'}
          </p>
        ))}
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
        <LineChart
          data={data}
          margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
        >
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
            label={{ value: 'ms', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="avg_execution_time_ms"
            stroke="#3b82f6"
            strokeWidth={2}
            name="Average"
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="min_execution_time_ms"
            stroke="#22c55e"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            name="Minimum"
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="max_execution_time_ms"
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            name="Maximum"
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ExecutionTimeChart
