import React, { useMemo } from 'react'
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

import { LatestPerCheckRow } from '../../api/monitoring'

interface VisualResolverProps {
  checkData: LatestPerCheckRow
}

/**
 * NAMED EXPORT: This allows CheckHealthMatrix to find the module.
 */
export const VisualResolver: React.FC<VisualResolverProps> = ({
  checkData,
}) => {
  const {
    check_name,
    metric_value,
    raw_result,
    result_metadata,
  } = checkData

  const payload = useMemo(() => {
    const source = raw_result || result_metadata

    if (!source) {
      return null
    }

    try {
      const parsed = typeof source === 'string'
        ? JSON.parse(source)
        : source
      // result_metadata is an array of row objects — unwrap the first row
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        return parsed[0]
      }
      return parsed
    } catch {
      return null
    }
  }, [raw_result, result_metadata])

  const displayValue =
    metric_value ??
    payload?.connection_pct ??
    payload?.lag_seconds ??
    payload?.value ??
    0

  if (!payload && metric_value == null) {
    return (
      <div className="flex h-full items-center justify-center text-[10px] italic text-slate-500">
        No Telemetry Payload
      </div>
    )
  }

  /* =========================================================
      TABLE-BASED VIEWS
  ========================================================= */

  if (
    [
      'Top Queries Performance',
      'Blocking Sessions',
      'Unused Indexes',
      'Table Bloat Percentage',
    ].includes(check_name)
  ) {
    const list =
      payload?.queries ||
      payload?.blockers ||
      payload?.indexes ||
      payload?.bloated_tables ||
      payload?.tables ||
      []

    return (
      <div className="flex h-full flex-col overflow-hidden p-3">
        <table className="w-full text-[11px] text-slate-500">
          <thead>
            <tr className="border-b border-slate-200 text-slate-400">
              <th className="pb-2 text-left">Target</th>

              <th className="pb-2 text-right">Value</th>
            </tr>
          </thead>

          <tbody>
            {list.slice(0, 5).map((item: any, i: number) => (
              <tr
                key={i}
                className="border-b border-slate-100 transition-colors hover:bg-slate-50"
              >
                <td className="max-w-[150px] truncate py-2 pr-2 font-mono text-slate-700">
                  {item.query ||
                    item.table ||
                    item.index ||
                    `PID: ${item.blocker_pid}`}
                </td>

                <td className="py-2 text-right font-bold text-blue-600">
                  {item.total_ms
                    ? `${Math.round(item.total_ms)}ms`
                    : item.bloat_pct
                    ? `${item.bloat_pct}%`
                    : item.size || 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  /* =========================================================
      PIE CHART VIEWS
  ========================================================= */

  if (
    check_name === 'Index Usage Percentage' ||
    check_name.includes('Size')
  ) {
    const chartData =
      payload?.low_index_tables ||
      payload?.top_tables ||
      []

    const COLORS = [
      '#3b82f6',
      '#6366f1',
      '#8b5cf6',
      '#a855f7',
    ]

    return (
      <div className="relative h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData.slice(0, 5)}
              innerRadius={40}
              outerRadius={55}
              paddingAngle={5}
              dataKey={
                payload?.top_tables
                  ? 'bytes'
                  : 'seq_scans'
              }
            >
              {chartData
                .slice(0, 5)
                .map((_: any, index: number) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      COLORS[index % COLORS.length]
                    }
                    stroke="none"
                  />
                ))}
            </Pie>

            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '10px',
                color: '#0f172a',
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black text-slate-800">
            {Math.round(Number(displayValue) || 0)}%
          </span>
        </div>
      </div>
    )
  }

  /* =========================================================
      DEFAULT TREND VIEW
  ========================================================= */

  return (
    <div className="flex h-full w-full flex-col pt-4">
      <div className="px-6">
        <span className="text-3xl font-black tracking-tighter text-slate-800">
          {typeof displayValue === 'number'
            ? displayValue.toFixed(2)
            : displayValue}

          <span className="ml-1 text-xs font-normal uppercase text-slate-400">
            {check_name.includes('Percentage')
              ? '%'
              : ''}
          </span>
        </span>
      </div>

      <div className="mt-2 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={[
              { v: 0 },
              {
                v:
                  Number(displayValue || 0) *
                  0.6,
              },
              {
                v: Number(displayValue || 0),
              },
            ]}
          >
            <defs>
              <linearGradient
                id="metricGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="#3b82f6"
                  stopOpacity={0.35}
                />

                <stop
                  offset="95%"
                  stopColor="#3b82f6"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>

            <Tooltip />

            <Area
              type="monotone"
              dataKey="v"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#metricGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default VisualResolver