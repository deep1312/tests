// ui/src/components/monitoring/charts/TelemetryTable.tsx

import { TabularResult } from '../../../api/monitoring'
import { EmptyState } from '../../shared/EmptyState'
import { formatInTZ } from '../../../utils/timezone'

interface TelemetryTableProps {
  title: string
  subtitle?: string
  data?: TabularResult
  emptyMessage?: string
}

export function TelemetryTable({
  title,
  subtitle,
  data,
  emptyMessage = 'No granular log snapshots recorded within this tracking interval.'
}: TelemetryTableProps) {
  
  // Guard clause against empty or malformed data structures
  if (!data || !data.rows || data.rows.length === 0 || !data.columns || data.columns.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm flex items-center justify-center min-h-[280px]">
        <EmptyState title="No Records Found" description={emptyMessage} />
      </div>
    )
  }

  /**
   * Automatically normalizes raw column strings to readable, capital headers.
   * e.g., "table_bloat_bytes" -> "Table Bloat Bytes"
   */
  const formatHeader = (col: string): string => {
    return col
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
  }

  /**
   * Intelligently formats dynamic column values depending on data type
   */
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'object') return JSON.stringify(value)
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
    return String(value)
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Table Section Header */}
      <div className="px-5 py-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>

        {data.collected_at && (
          <div className="text-xs bg-slate-100 border border-slate-200 text-slate-600 px-2 py-1 rounded font-mono">
            Captured: {formatInTZ(data.collected_at)}
          </div>
        )}
      </div>

      {/* Responsive Dense Data Grid Wrapper */}
      <div className="overflow-x-auto flex-grow max-h-[400px] scrollbar-thin">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/30 sticky top-0 backdrop-blur-sm z-10">
              {data.columns.map((column) => (
                <th
                  key={column}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 tracking-wider uppercase whitespace-nowrap"
                >
                  {formatHeader(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-xs text-slate-700">
            {data.rows.map((row, rowIndex) => (
              <tr 
                key={rowIndex} 
                className="hover:bg-slate-50/50 transition-colors duration-150 ease-in-out odd:bg-white even:bg-slate-50/20"
              >
                {data.columns.map((column) => (
                  <td 
                    key={`${rowIndex}-${column}`} 
                    className="px-4 py-2 max-w-md truncate whitespace-nowrap"
                    title={formatValue(row[column])} // Tooltip fallback for truncated text
                  >
                    {formatValue(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}