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
import { format, parseISO, isValid } from 'date-fns'

interface MetricsChartProps {
  data: any[] // Flexible to handle both Metric and Run aggregates
  metricName: string
  isLoading?: boolean
  type?: 'metrics' | 'runs'
}

/**
 * Enhanced MetricsChart
 * Requirements: 15.4 (Trending), 9.4 (Health Matrix)
 */
export function MetricsChart({
  data,
  metricName,
  isLoading = false,
  type = 'metrics',
}: MetricsChartProps) {
  
  // 1. Handle Loading State
  if (isLoading) {
    return (
      <div className="bg-card/90 backdrop-blur-sm rounded-lg border border-border p-6 h-80 flex items-center justify-center shadow-sm">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading chart data...</p>
        </div>
      </div>
    )
  }

  // 2. Handle Empty Data State
  if (!data || data.length === 0) {
    return (
      <div className="bg-card/90 backdrop-blur-sm rounded-lg border border-border p-6 h-80 flex items-center justify-center shadow-sm">
        <div className="text-center">
          <p className="text-muted-foreground italic">No data recorded for this period</p>
          <p className="text-xs text-muted-foreground/50 mt-1">Check back once the collector has run</p>
        </div>
      </div>
    )
  }

  // 3. Format data and handle potential Date parsing errors
  const chartData = data.map((point) => {
    let dateLabel = 'Unknown'
    if (point.bucket) {
      const date = parseISO(point.bucket)
      dateLabel = isValid(date) ? format(date, 'MMM d, HH:mm') : point.bucket
    }

    return {
      ...point,
      displayTime: dateLabel,
      // Ensure numeric values for Recharts even if backend returns nulls
      val: point.avg_value ?? point.success_rate_pct ?? 0,
      min: point.min_value ?? 0,
      max: point.max_value ?? 0,
    }
  })

  // 4. Determine which lines to draw based on data type
  const isRunType = type === 'runs' || (data[0] && 'success_rate_pct' in data[0])

  return (
    <div className="bg-card/90 backdrop-blur-sm rounded-lg border border-border p-6 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-foreground">{metricName}</h3>
        <span className="text-xs font-medium px-2 py-1 bg-muted text-muted-foreground rounded">
          {isRunType ? 'Success Rate %' : 'Value'}
        </span>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis 
              dataKey="displayTime" 
              fontSize={11} 
              tickMargin={10} 
              axisLine={false} 
              tickLine={false} 
            />
            <YAxis 
              fontSize={11} 
              axisLine={false} 
              tickLine={false} 
              domain={isRunType ? [0, 100] : ['auto', 'auto']}
              unit={isRunType ? '%' : ''}
            />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              formatter={(value: number) => [value.toFixed(2), isRunType ? 'Success Rate' : 'Avg Value']}
            />
            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
            
            {/* Main Trend Line */}
            <Line
              type="monotone"
              dataKey="val"
              stroke="#3b82f6"
              strokeWidth={3}
              name={isRunType ? "Success Rate" : "Average"}
              dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6 }}
              connectNulls
            />

            {/* Min/Max Lines (Only for metrics, not success rates) */}
            {!isRunType && (
              <>
                <Line
                  type="monotone"
                  dataKey="max"
                  stroke="#ef4444"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  name="Max"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="min"
                  stroke="#10b981"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  name="Min"
                  dot={false}
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default MetricsChart