import { useMemo, createContext, useContext } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  X,
  AlertTriangle,
  Info,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

import {
  useCheckRuns,
  usePartitionCount,
} from '../../api/monitoring'
import { formatInTZ } from '../../utils/timezone'


/* =============================================================================
   HEALTH CHECK PAYLOAD TYPES
============================================================================= */

export interface HealthCheckPayload {
  check_id?: number
  check_name?: string
  check_category?: string
  status?: string
  status_code?: string
  raw_result?: any
  result_metadata?: any
  collected_at?: string
  [key: string]: any
}

/* =============================================================================
   DRAWER CONTEXT TYPES
============================================================================= */

export interface DrawerContext {
  serverId?: number
  serverLabel?: string
  serverIp?: string
  checkId?: number
  bucket?: string
  status?: string
  data?: any
  from?: string
  to?: string
  isHistorical?: boolean
}

export interface DrawerContextType {
  isOpen: boolean
  activeCheckData: HealthCheckPayload | null
  openDrawer: (data: HealthCheckPayload) => void
  closeDrawer: () => void
}

/* =============================================================================
   CONTEXT EXPORTS
============================================================================= */

export const DrawerReactContext = createContext<
  DrawerContextType | undefined
>(undefined)

export const useDrawer = () => {
  const context = useContext(DrawerReactContext)

  if (!context) {
    throw new Error(
      'useDrawer must be used inside a DetailDrawerProvider wrapper'
    )
  }

  return context
}

/* =============================================================================
   DETAIL DRAWER PROPS
============================================================================= */

interface DetailDrawerProps {
  context: DrawerContext | null
  onClose: () => void
}

/* =============================================================================
   HEALTH CHECK DETAILS CONTAINER
============================================================================= */

function HealthCheckDetailsContainer({
  checkData,
  partitionLive,
}: {
  checkData: HealthCheckPayload
  partitionLive?: { row_count: number; rows: Record<string, any>[] }
}) {
  // Extract all rows — try raw_result first, then result_metadata
  const allRows = Array.isArray(checkData?.raw_result?.rows) 
    ? checkData.raw_result.rows 
    : (checkData?.raw_result?.rows ? [checkData.raw_result.rows] 
    : Array.isArray(checkData?.result_metadata) && checkData.result_metadata.length > 0
    ? checkData.result_metadata
    : []);

  // rawRow merges first row data + top-level fields spread from metadata
  const rowFromMeta = Array.isArray(checkData?.result_metadata) && checkData.result_metadata.length > 0
    ? checkData.result_metadata[0]
    : (checkData?.result_metadata && typeof checkData.result_metadata === 'object' ? checkData.result_metadata : {});
  const rawRow = { ...rowFromMeta, ...(allRows[0] ?? {}), ...checkData };
  delete rawRow.result_metadata;

  // Keep original metadata for check-specific nested lookups (e.g. indexes, queries)
  const metadata = checkData?.result_metadata ?? {};

  const renderJsonBlock = (data: any) => (
    <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-[10px] text-emerald-400">
      {JSON.stringify(data, null, 2)}
    </pre>
  )

  return (
    <div className="space-y-3">
      {checkData?.check_name && (
        <div className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {checkData.check_name}
        </div>
      )}

      {(() => {
        switch (checkData?.check_id) {
          /* =========================================================================
             CHECK 1 — CONNECTIONS
          ========================================================================= */
          case 1:
            // Build chart data from historical buckets (if available) or from individual runs
            const connChartData = useMemo(() => {
              const buckets = (checkData as any)?._historicalBuckets
              if (Array.isArray(buckets) && buckets.length >= 2) {
                return buckets.map((b: any) => ({
                  time: formatInTZ(b.bucket, {
                    month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  }),
                  connection_pct: b.connection_pct ?? 0,
                  total_connections: b.total_connections ?? 0,
                  active_connections: b.active_connections ?? 0,
                  idle_connections: b.idle_connections ?? 0,
                  idle_in_txn_connections: b.idle_in_txn_connections ?? 0,
                }))
              }
              const runs = (checkData as any)?._runs
              if (Array.isArray(runs) && runs.length >= 2) {
                return runs.map((r: any) => {
                  const row = r?.raw_result?.rows?.[0] || r?.raw_result || r
                  return {
                    time: formatInTZ(r.collected_at || r.bucket, {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    }),
                    connection_pct: row.connection_pct ?? 0,
                    total_connections: row.total_connections ?? 0,
                    active_connections: row.active_connections ?? 0,
                    idle_connections: row.idle_connections ?? 0,
                    idle_in_txn_connections: row.idle_in_txn_connections ?? 0,
                  }
                })
              }
              return null
            }, [checkData])

            const maxConn = rawRow.max_connections ?? 0
            const totalConn = rawRow.total_connections ?? 0
            const maxVal = maxConn || totalConn || 100

            const connBar = (val: number, label: string, color: string) => (
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="w-14 font-bold text-slate-500 uppercase tracking-wide">{label}</span>
                <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((val / maxVal) * 100, 100)}%`, backgroundColor: color }} />
                </div>
                <span className="w-12 text-right font-bold tabular-nums text-slate-700">{val}</span>
              </div>
            )

            return (
              <div className="space-y-3">
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <MetricCard title="Usage" value={`${rawRow.connection_pct ?? 0}%`} />
                  <MetricCard title="Total" value={totalConn} />
                  <MetricCard title="Max" value={maxConn} />
                  <MetricCard title="Active" value={rawRow.active_connections ?? 0} />
                  <MetricCard title="Idle" value={rawRow.idle_connections ?? 0} />
                  <MetricCard title="IdleTxn" value={rawRow.idle_in_txn_connections ?? 0} />
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <p className="mb-2 text-[9px] font-black uppercase tracking-wider text-slate-400">
                    Connection Breakdown
                  </p>
                  <div className="space-y-1">
                    {connBar(rawRow.active_connections ?? 0, 'Active', '#3b82f6')}
                    {connBar(rawRow.idle_connections ?? 0, 'Idle', '#94a3b8')}
                    {connBar(rawRow.idle_in_txn_connections ?? 0, 'IdleTxn', '#f59e0b')}
                    {connBar(totalConn, 'Total', '#6366f1')}
                    {connBar(maxConn, 'Max', '#ef4444')}
                  </div>
                </div>

                {/* Trend Graph — always visible */}
                {connChartData && connChartData.length >= 2 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="mb-2 text-[9px] font-black uppercase tracking-wider text-slate-400">
                      Connection Metrics Over Time
                    </p>
                    <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={connChartData} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis
                            dataKey="time"
                            tick={{ fontSize: 9, fill: '#64748b' }}
                            tickLine={false}
                            interval="preserveStartEnd"
                          />
                          <YAxis
                            tick={{ fontSize: 9, fill: '#64748b' }}
                            tickLine={false}
                            axisLine={false}
                            domain={[0, 'auto']}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: '8px',
                              border: '1px solid #e2e8f0',
                              fontSize: '11px',
                            }}
                          />
                          <Line type="monotone" dataKey="connection_pct" name="Connection %" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                          <Line type="monotone" dataKey="total_connections" name="Total" stroke="#6366f1" strokeWidth={1.5} dot={false} />
                          <Line type="monotone" dataKey="active_connections" name="Active" stroke="#10b981" strokeWidth={1.5} dot={false} />
                          <Line type="monotone" dataKey="idle_connections" name="Idle" stroke="#94a3b8" strokeWidth={1.5} dot={false} />
                          <Line type="monotone" dataKey="idle_in_txn_connections" name="IdleTxn" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {renderJsonBlock(allRows)}
              </div>
            )
          /* =========================================================================
             CHECK 2 — BLOCKING
          ========================================================================= */
          case 2:
            return (
              <div className="space-y-3">
                <MetricCard title="Blocking Count" value={rawRow.blocking_count ?? 0} />

                <div className="space-y-2">
                  {(rawRow.blockers ?? []).map(
                    (blocker: any, idx: number) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-red-100 bg-red-50 p-3"
                  >
                    <div className="text-xs font-bold text-red-700">
                      PID: {blocker.blocker_pid}
                    </div>

                    <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-700">
                          {blocker.blocker_user && (
                            <div>
                              <span className="font-semibold text-slate-500">User:</span> {blocker.blocker_user}
                            </div>
                          )}
                          {blocker.blocker_state && (
                            <div>
                              <span className="font-semibold text-slate-500">State:</span> {blocker.blocker_state}
                            </div>
                          )}
                          <div>
                            <span className="font-semibold text-slate-500">Waiting:</span> {blocker.waiting_count}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-500">Txn Age:</span> {blocker.blocker_txn_age_s ?? blocker.blocker_duration_s ?? 0}s
                          </div>
                        </div>

                        <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-2 text-[10px] text-emerald-400">
                          {blocker.blocker_query}
                        </pre>
                      </div>
                    )
                  )}
                </div>
              </div>
            )

          /* =========================================================================
             CHECK 3 — TABLE BLOAT
          ========================================================================= */
          case 3:
            const bloatedList = rawRow.bloated_tables ?? rawRow.tables ?? [];
            return (
              <div className="space-y-3">
                <MetricCard title="Bloat %" value={`${rawRow.bloat_pct ?? 0}%`} />

                {Array.isArray(bloatedList) && bloatedList.length > 0 ? (
                  <div className="space-y-1.5">
                    {bloatedList.map((t: any, idx: number) => (
                      <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="font-mono text-[11px] font-bold text-slate-800 break-all">
                          {t.table}
                        </div>
                        <div className="mt-1.5 grid grid-cols-3 gap-2 text-[11px]">
                          <div className="bg-slate-50 p-1.5 rounded-lg">
                            <span className="text-gray-400 block text-[9px] uppercase font-bold">Bloat %</span>
                            <span className="font-bold text-amber-600">{t.bloat_pct ?? t.table_bloat_pct ?? 0}%</span>
                          </div>
                          <div className="bg-slate-50 p-1.5 rounded-lg">
                            <span className="text-gray-400 block text-[9px] uppercase font-bold">Dead Tuples</span>
                            <span className="font-bold text-slate-700">{t.dead_tuples ?? 0}</span>
                          </div>
                          <div className="bg-slate-50 p-1.5 rounded-lg">
                            <span className="text-gray-400 block text-[9px] uppercase font-bold">Live Tuples</span>
                            <span className="font-bold text-slate-700">{t.live_tuples ?? 0}</span>
                          </div>
                        </div>
                        {(t.last_vacuum || t.last_autovacuum) && (
                          <div className="mt-1 flex gap-3 text-[10px] text-gray-400">
                            {t.last_vacuum && <span>Vacuum: {new Date(t.last_vacuum).toLocaleDateString()}</span>}
                            {t.last_autovacuum && <span>Auto: {new Date(t.last_autovacuum).toLocaleDateString()}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-400">
                    No bloated tables detected
                  </div>
                )}
              </div>
            )

          /* =========================================================================
             CHECK 4 — INDEX USAGE / SEQUENCE SCANS
          ========================================================================= */
          case 4:
            const indexTables = rawRow.low_index_tables ?? [];
            return (
              <div className="space-y-3">
                <MetricCard title="Index Usage" value={`${rawRow.index_usage_pct ?? 0}%`} />

                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Table Scan Methods ({Array.isArray(indexTables) ? indexTables.length : 0} tables)
                </p>

                <div className="space-y-1.5">
                  {Array.isArray(indexTables) && indexTables.length > 0 ? (
                    indexTables.map((tableRow: any, idx: number) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-slate-200 bg-white p-3 hover:border-blue-300 transition-all shadow-sm"
                    >
                      <div className="font-mono text-[11px] font-bold text-slate-800 break-all select-all">
                        {tableRow.table || "Unknown Object/Chunk"}
                      </div>

                      <div className="mt-1.5 grid grid-cols-4 gap-2 text-[11px]">
                        <div className="bg-slate-50 p-1.5 rounded-lg">
                          <span className="text-gray-400 block text-[9px] uppercase font-bold">Seq %</span>
                          <span className="font-bold text-slate-700">{tableRow.seq_pct ?? 0}%</span>
                        </div>

                        <div className="bg-slate-50 p-1.5 rounded-lg">
                          <span className="text-gray-400 block text-[9px] uppercase font-bold">IDX</span>
                          <span className="font-bold text-slate-700">{tableRow.idx_scans ?? 0}</span>
                        </div>

                        <div className="bg-slate-50 p-1.5 rounded-lg">
                          <span className="text-gray-400 block text-[9px] uppercase font-bold">Seq</span>
                          <span className="font-bold text-amber-600">{tableRow.seq_scans ?? 0}</span>
                        </div>

                        <div className="bg-slate-50 p-1.5 rounded-lg">
                          <span className="text-gray-400 block text-[9px] uppercase font-bold">Rows</span>
                          <span className="font-bold text-slate-700">{tableRow.row_count ?? tableRow.n_live_tup ?? 0}</span>
                        </div>
                      </div>
                    </div>
                    ))
                  ) : (
                    <div className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-400">
                      No tables with low index usage
                    </div>
                  )}
                </div>
              </div>
            )
          /* =========================================================================
             CHECK 5 — UNUSED INDEXES
          ========================================================================= */
          case 5:
            const unusedIndexesData =
              metadata.indexes ||
              rawRow.indexes ||
              checkData?.indexes ||
              []

            const totalSize =
              rawRow.total_size ??
              checkData?.raw_result?.rows?.[0]?.total_size ??
              checkData?.raw_result?.total_size ??
              ''

            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <MetricCard title="Unused Indexes" value={rawRow.unused_count ?? 0} />
                  {totalSize && <MetricCard title="Total Size" value={totalSize} />}
                </div>

                <div className="flex items-start gap-2 rounded-lg border border-amber-500/10 bg-amber-50/60 p-3 text-amber-900">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    These structural indexes have logged zero scan queries. Dropping redundant indexes optimizes write performance.
                  </p>
                </div>

                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Indexes ({unusedIndexesData.length})
                </p>

                {Array.isArray(unusedIndexesData) && unusedIndexesData.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="px-3 py-2">Index</th>
                          <th className="px-3 py-2">Table</th>
                          <th className="px-3 py-2 text-right">Size</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {unusedIndexesData.map((indexItem: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-3 py-2 font-mono text-[11px] text-slate-800 break-all select-all max-w-[300px]">
                              <div className="truncate" title={indexItem?.index}>{indexItem?.index || 'Unnamed Index'}</div>
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px] text-slate-600 max-w-[200px]">
                              <div className="truncate" title={indexItem?.table}>{indexItem?.table || '—'}</div>
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-[11px] text-slate-700">{indexItem?.size || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 py-8 text-center bg-white">
                    <Info className="h-5 w-5 text-emerald-500 mb-1" />
                    <p className="text-xs font-bold text-gray-700">Perfect Index Optimization!</p>
                  </div>
                )}
              </div>
            )

          /* =========================================================================
             CHECK 6 — REPLICATION
          ========================================================================= */
          case 6:
            return (
              <div className="grid grid-cols-3 gap-2">
                <MetricCard title="Replica" value={rawRow.is_replica ? 'YES' : 'NO'} />
                <MetricCard title="Lag Seconds" value={rawRow.lag_seconds ?? 0} />
                <MetricCard title="Last Replay" value={rawRow.last_replay ?? '—'} />
              </div>
            )

          /* =========================================================================
             CHECK 7 — WAL
          ========================================================================= */
           case 7:
            return (
              <div className="grid grid-cols-2 gap-2">
                <MetricCard title="Total WAL" value={rawRow.wal_gb_total ?? '—'} />
                <MetricCard title="WAL Files" value={rawRow.wal_file_count ?? 0} />
              </div>
            )

          /* =========================================================================
             CHECK 8 — DATABASE SIZE
          ========================================================================= */
          case 8:
            return (
              <div className="space-y-3">
                <MetricCard title="Database Size" value={rawRow.size_human ?? '—'} />

                <div className="space-y-1.5">
                  {(rawRow.top_tables ?? []).map(
                    (table: any, idx: number) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-slate-200 bg-white p-3"
                      >
                        <div className="font-bold text-slate-800 text-xs">
                          {table.table}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {table.size}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )

          /* =========================================================================
             CHECK 9 — QUERY PERFORMANCE
          ========================================================================= */
          case 9:
            return (
              <div className="space-y-3">
                <MetricCard title="Avg Query Time" value={`${rawRow.avg_mean_ms ?? 0} ms`} />

                {(rawRow.queries ?? []).map(
                  (query: any, idx: number) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-slate-200 bg-white p-3"
                    >
                      <div className="grid grid-cols-4 gap-3 text-[11px]">
                        <div>
                          Calls
                          <div className="font-bold">{query.calls}</div>
                        </div>
                        <div>
                          Mean
                          <div className="font-bold">{query.mean_ms}ms</div>
                        </div>
                        <div>
                          Total
                          <div className="font-bold">{query.total_ms}ms</div>
                        </div>
                        <div>
                          Hit %
                          <div className="font-bold">{query.cache_hit_pct}%</div>
                        </div>
                      </div>

                      <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-2 text-[10px] text-emerald-400">
                        {query.query}
                      </pre>
                    </div>
                  )
                )}
              </div>
            )

          /* =========================================================================
             CHECK 10 — TABLE COUNT
          ========================================================================= */
          case 10:
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <MetricCard title="Tables" value={allRows.length} />
                  <MetricCard title="Total Records" value={allRows.reduce((s: number, r: any) => s + (Number(r.record_count) || 0), 0)} />
                  <MetricCard title="Servers" value={1} />
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Table</th>
                        <th className="px-3 py-2 text-right">Record Count</th>
                        <th className="px-3 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allRows.map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2 font-mono text-slate-800 text-[11px]">
                            {row.table_name}
                          </td>
                          <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-700">
                            {Number(row.record_count || 0).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                              row.status === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {row.status || 'UNKNOWN'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )

          /* =========================================================================
             CHECK 11 — DATABASE AGE
          ========================================================================= */
          case 11:
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <MetricCard title="XID Age" value={rawRow.xid_age != null ? Number(rawRow.xid_age).toLocaleString() : '—'} />
                  <MetricCard title="Database" value={rawRow.datname ?? '—'} />
                </div>
              </div>
            )

          /* =========================================================================
              CHECK 12 — PARTITION COUNT (live query)
          ========================================================================= */
          case 12: {
            const partitionRows = partitionLive?.rows ?? allRows
            const partitionCount = partitionLive?.row_count ?? partitionRows.length
            const partitionColumns = partitionRows.length > 0 ? Object.keys(partitionRows[0]) : []
            const partitionColumnLabel: Record<string, string> = {
              total_partition: 'Total Partition Tables',
              schtype: 'Table Name',
              tblcnt: 'Partition Count',
              tblspcstr: 'Table Space',
            }
            const label = (key: string) => partitionColumnLabel[key] ?? key.replace(/_/g, ' ')
            return (
              <div className="space-y-3">
                <MetricCard title="Total Partitions" value={partitionCount} />

                {partitionRows.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        <tr>
                          {partitionColumns.map((key) => (
                            <th key={key} className="px-3 py-2">{label(key)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {partitionRows.map((row: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            {partitionColumns.map((key) => (
                              <td key={key} className="px-3 py-2 font-mono text-slate-800 text-[11px]">
                                {String(row[key] ?? '—')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-400">
                    No partition data available
                  </div>
                )}
              </div>
            )
          }

          default:
            return renderJsonBlock(checkData)
        }
      })()}
    </div>
  )
}

/* =============================================================================
   METRIC CARD
============================================================================= */

function MetricCard({
  title,
  value,
}: {
  title: string
  value: any
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
        {title}
      </div>

      <div className="mt-1 text-lg font-black text-slate-900">
        {value}
      </div>
    </div>
  )
}

/* =============================================================================
   BUCKET RECORD CARD — renders a single historical bucket as a small card
============================================================================= */

function getBucketStatus(bucket: any, checkId?: number): 'healthy' | 'warning' | 'critical' {
  const val = getPrimaryMetric(bucket, checkId)
  if (val === null || val === undefined) return 'healthy'
  switch (checkId) {
    case 1: return val >= 95 ? 'critical' : val >= 80 ? 'warning' : 'healthy'
    case 2: return val >= 5 ? 'critical' : val >= 1 ? 'warning' : 'healthy'
    case 3: return val >= 50 ? 'critical' : val >= 20 ? 'warning' : 'healthy'
    case 4: return val < 50 ? 'critical' : val < 80 ? 'warning' : 'healthy'
    case 5: return val >= 15 ? 'critical' : val >= 5 ? 'warning' : 'healthy'
    case 6: return val >= 30 ? 'critical' : val >= 5 ? 'warning' : 'healthy'
    case 7: return val >= 1000 ? 'critical' : val >= 500 ? 'warning' : 'healthy'
    case 8: return val >= 500 ? 'critical' : val >= 100 ? 'warning' : 'healthy'
    case 9: return val >= 5000 ? 'critical' : val >= 1000 ? 'warning' : 'healthy'
    case 10: return val > 0 ? 'healthy' : 'warning'
    case 11: return val >= 1000000000 ? 'critical' : val >= 500000000 ? 'warning' : 'healthy'
    case 12: return val > 0 ? 'healthy' : 'warning'
    default: return 'healthy'
  }
}

function getPrimaryMetric(bucket: any, checkId?: number): number | null {
  switch (checkId) {
    case 1: return bucket.connection_pct ?? null
    case 2: return bucket.blocking_count ?? null
    case 3: return bucket.bloat_pct ?? null
    case 4: return bucket.index_usage_pct ?? null
    case 5: return bucket.unused_count ?? null
    case 6: return bucket.lag_seconds ?? null
    case 7: return bucket.wal_gb_total ?? null
    case 8: return bucket.size_gb ?? null
    case 9: return bucket.avg_mean_ms ?? null
    case 10: return bucket.table_count ?? null
    case 11: return bucket.xid_age ?? null
    case 12: return bucket.partition_count ?? null
    default: return null
  }
}

function BucketRecordCard({ bucket, checkId, runs, partitionLive }: { bucket: any; checkId?: number; runs?: any[]; partitionLive?: { row_count: number; rows: Record<string, any>[] } }) {
  const dt = new Date(bucket.bucket)
  const dateStr = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const timeStr = dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const status = getBucketStatus(bucket, checkId)

  const statusColors: Record<string, string> = {
    healthy: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    critical: 'bg-red-100 text-red-700 border-red-200',
  }

  const detailChecks = [3, 4, 5, 8, 9, 10]

  if (checkId && detailChecks.includes(checkId)) {
    const firstRun = runs?.[0] as any
    const mergedCheckData: any = {
      ...bucket,
      ...firstRun,
      raw_result: firstRun?.raw_result ?? bucket.raw_result,
      check_id: checkId,
      collected_at: bucket.bucket,
      check_name: firstRun?.check_name ?? 'Health Check Details',
      check_category: firstRun?.check_category ?? 'System Metrics',
    }

    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold text-slate-500">{dateStr}</p>
            <p className="text-[11px] font-mono font-bold text-slate-800">{timeStr}</p>
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${statusColors[status]}`}>
            {status}
          </span>
        </div>
        <HealthCheckDetailsContainer checkData={mergedCheckData} partitionLive={partitionLive} />
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-bold text-slate-500">{dateStr}</p>
          <p className="text-[11px] font-mono font-bold text-slate-800">{timeStr}</p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${statusColors[status]}`}>
          {status}
        </span>
      </div>
      {renderBucketFields(bucket, checkId)}
    </div>
  )
}

function renderBucketFields(bucket: any, checkId?: number) {
  switch (checkId) {
    case 1:
      return (
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <Field label="Connection %" value={`${(bucket.connection_pct ?? 0).toFixed(1)}%`} highlight />
          <Field label="Active" value={bucket.active_connections ?? 0} />
          <Field label="Idle" value={bucket.idle_connections ?? 0} />
          <Field label="IdleTxn" value={bucket.idle_in_txn_connections ?? 0} />
          <Field label="Total" value={bucket.total_connections ?? 0} />
          <Field label="Max" value={bucket.max_connections ?? '—'} />
        </div>
      )
    case 2:
      return (
        <div className="grid grid-cols-1 gap-1.5 text-[11px]">
          <Field label="Blocking Count" value={bucket.blocking_count ?? 0} highlight />
        </div>
      )
    case 3:
      return (
        <div className="grid grid-cols-1 gap-1.5 text-[11px]">
          <Field label="Bloat %" value={`${(bucket.bloat_pct ?? 0).toFixed(2)}%`} highlight />
        </div>
      )
    case 4:
      return (
        <div className="grid grid-cols-1 gap-1.5 text-[11px]">
          <Field label="Index Usage %" value={`${(bucket.index_usage_pct ?? 0).toFixed(2)}%`} highlight />
        </div>
      )
    case 5:
      return (
        <div className="grid grid-cols-1 gap-1.5 text-[11px]">
          <Field label="Unused Indexes" value={bucket.unused_count ?? 0} highlight />
        </div>
      )
    case 6:
      return (
        <div className="grid grid-cols-1 gap-1.5 text-[11px]">
          <Field label="Lag (s)" value={bucket.lag_seconds ?? 0} highlight />
        </div>
      )
    case 7:
      return (
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <Field label="WAL Total" value={bucket.wal_gb_total_display ?? bucket.wal_gb_total ?? '—'} highlight />
          <Field label="Files" value={bucket.wal_file_count ?? '—'} />
        </div>
      )
    case 8:
      return (
        <div className="grid grid-cols-1 gap-1.5 text-[11px]">
          <Field label="DB Size" value={bucket.size_human ?? `${(bucket.size_gb ?? 0).toFixed(1)} GB`} highlight />
        </div>
      )
    case 9:
      return (
        <div className="grid grid-cols-1 gap-1.5 text-[11px]">
          <Field label="Avg Mean (ms)" value={bucket.avg_mean_ms ?? 0} highlight />
        </div>
      )
    case 10:
      return (
        <div className="grid grid-cols-1 gap-1.5 text-[11px]">
          <Field label="Tables" value={bucket.table_count ?? 0} highlight />
        </div>
      )
    case 11:
      return (
        <div className="grid grid-cols-1 gap-1.5 text-[11px]">
          <Field label="XID Age" value={bucket.xid_age != null ? Number(bucket.xid_age).toLocaleString() : '—'} highlight />
        </div>
      )
    case 12:
      return (
        <div className="grid grid-cols-1 gap-1.5 text-[11px]">
          <Field label="Partitions" value={bucket.partition_count ?? 0} highlight />
        </div>
      )
    default:
      return (
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-2 text-[10px] text-emerald-400 max-h-32">
          {JSON.stringify(bucket, null, 2)}
        </pre>
      )
  }
}

function Field({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
      <span className="font-semibold text-slate-400">{label}</span>
      <span className={`font-bold ${highlight ? 'text-blue-600' : 'text-slate-700'}`}>{value}</span>
    </div>
  )
}

/* =============================================================================
   MAIN DETAIL DRAWER
============================================================================= */

export function DetailDrawer({
  context,
  onClose,
}: DetailDrawerProps) {
  const rowsPerPage = 50
  const isOpen = context !== null
  const historicalBuckets = ((context?.data ?? []) as any[])
  const hasRealBuckets = !!context?.data && historicalBuckets.length > 0

  // Use the filter's effective time range when available (live & historical).
  // Falls back to a narrow 1h window around the card's bucket timestamp.
  const timeRange = useMemo(() => {
    if (hasRealBuckets) {
      return { from: context?.from, to: context?.to }
    }
    if (context?.from && context?.to) {
      return { from: context?.from, to: context?.to }
    }
    if (!context?.bucket) return { from: undefined, to: undefined }
    const bucketDate = new Date(context.bucket)
    const from = new Date(bucketDate.getTime() - 15 * 60 * 1000).toISOString()
    const to = new Date(bucketDate.getTime() + 45 * 60 * 1000).toISOString()
    return { from, to }
  }, [context?.bucket, context?.from, context?.to, context?.data])

  // Fetch log entries for nested raw_result data.
  // In historical mode with buckets: fetch multiple entries within filter range.
  // In fallback/live mode: fetch entries around the card's bucket or latest.
  // Partition Count live data (check 12 only)
  const { data: partitionLive } = usePartitionCount(
    context?.serverId,
    !!(context?.checkId === 12 && context?.serverId && !hasRealBuckets),
  )

  const {
    data: runsData,
    isLoading: isLogsLoading,
  } = useCheckRuns(
    context ? context.serverId : undefined,
    context ? context.checkId : undefined,
    timeRange.from,
    timeRange.to,
    rowsPerPage,
    0
  )

  const runs = useMemo(() => {
    if (!runsData?.data) return []
    const bucketList = Array.isArray(runsData.data)
      ? runsData.data
      : (Array.isArray((runsData.data as any)?.runs) ? (runsData.data as any).runs : [])
    if (context?.bucket && !hasRealBuckets) {
      const targetBucketISO = new Date(context.bucket).toISOString()
      const matched = bucketList.filter((b: any) => {
        if (!b?.bucket) return false
        return new Date(b.bucket).toISOString() === targetBucketISO
      })
      if (matched.length > 0) return matched
    }
    return bucketList
  }, [runsData?.data, context?.bucket, hasRealBuckets])

  // Build a combined record for the detailed nested-data section (uses latest bucket + first run)
  const detailViewRecord = useMemo(() => {
    const baseServer = {
      server_id: context?.serverId,
      server_label: context?.serverLabel,
      server_ip: context?.serverIp,
    }
    if (hasRealBuckets) {
      const latestBucket = historicalBuckets[historicalBuckets.length - 1] ?? {}
      const matchedBucket = runs.length > 0 ? (runs[0] as any) : {}
      return {
        ...matchedBucket,
        ...latestBucket,
        ...baseServer,
        _historicalBuckets: historicalBuckets,
        _totalBuckets: historicalBuckets.length,
        raw_result: matchedBucket.raw_result ?? latestBucket.raw_result,
        check_id: context?.checkId,
        check_name: matchedBucket.check_name ?? 'Health Check Details',
        check_category: matchedBucket.check_category ?? 'System Metrics',
        collected_at: latestBucket.bucket ?? context?.bucket ?? matchedBucket.bucket ?? matchedBucket.collected_at,
      }
    }
    if (runs.length === 0) return null
    const matchedBucket = runs[0] as any
    return {
      ...matchedBucket,
      ...baseServer,
      _runs: runs,
      check_id: context?.checkId,
      check_name: matchedBucket.check_name ?? 'Health Check Details',
      check_category: matchedBucket.check_category ?? 'System Metrics',
      collected_at: context?.bucket ?? matchedBucket.bucket ?? matchedBucket.collected_at,
    }
  }, [runs, context, historicalBuckets, hasRealBuckets])

  const isLoading = isLogsLoading
  const missingServerId = !hasRealBuckets && !context?.serverId && !context?.isHistorical

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />

        <Dialog.Content className="fixed right-0 top-0 z-50 h-screen w-full max-w-4xl overflow-y-auto bg-slate-50 shadow-2xl outline-none">
          {/* HEADER */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-3 text-white shadow-lg">
            <div>
              <Dialog.Title className="text-lg font-black">
                Health Check Details
              </Dialog.Title>
              <div className="mt-0.5 flex items-center gap-1 text-[10px]">
                {context?.serverLabel && (
                  <span className="font-bold text-blue-300">
                    {context.serverLabel}{context?.serverIp ? ` (${context.serverIp})` : ''}
                    {' | '}
                    {hasRealBuckets ? 'Historical' : 'Live'}
                    {detailViewRecord?.collected_at && (
                      <>
                        {' | '}
                        {formatInTZ(detailViewRecord.collected_at, { dateStyle: 'short', timeStyle: 'short' })}
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 transition hover:bg-slate-800">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* CONTENT */}
          <div className="p-4">
            {missingServerId ? (
              <div className="flex h-32 items-center justify-center text-slate-500 text-xs">
                Select a specific server from the filter to view live details
              </div>
            ) : isLoading ? (
              <div className="flex h-32 items-center justify-center text-slate-500 text-xs">
                Loading details...
              </div>
            ) : hasRealBuckets ? (
              <div className="space-y-4">
                {/* All historical bucket records as individual cards */}
                <div className="flex items-center justify-between">
                  <h3 className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                    Historical Buckets ({historicalBuckets.length})
                  </h3>
                  {context?.from && context?.to && (
                    <p className="text-[10px] font-mono text-slate-400">
                      {formatInTZ(context.from, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {' — '}
                      {formatInTZ(context.to, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>

                {context?.checkId === 1 && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <h4 className="mb-2 text-[9px] font-black uppercase tracking-wider text-slate-400">
                      Connection Trend
                    </h4>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={historicalBuckets.map(b => ({
                        time: new Date(b.bucket).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
                        pct: b.connection_pct ?? 0,
                        active: b.active_connections ?? 0,
                        idle: b.idle_connections ?? 0,
                        idleTxn: b.idle_in_txn_connections ?? 0,
                        total: b.total_connections ?? 0,
                        max: b.max_connections ?? 0,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="time" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 9 }} stroke="#94a3b8" />
                        <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6 }} />
                        <Line type="monotone" dataKey="pct" name="Connection %" stroke="#ef4444" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="active" name="Active" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="idle" name="Idle" stroke="#94a3b8" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="idleTxn" name="IdleTxn" stroke="#f59e0b" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="total" name="Total" stroke="#6366f1" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="space-y-2">
                  {historicalBuckets.map((bucket: any, idx: number) => (
                    <BucketRecordCard key={idx} bucket={bucket} checkId={context?.checkId} runs={runs} partitionLive={partitionLive} />
                  ))}
                </div>
              </div>
            ) : context?.checkId === 12 && partitionLive ? (
              <HealthCheckDetailsContainer
                checkData={{
                  raw_result: { rows: partitionLive.rows, row_count: partitionLive.row_count },
                  check_id: 12,
                  check_name: 'Partition Count',
                  check_category: 'admin',
                }}
                partitionLive={partitionLive}
              />
            ) : !detailViewRecord ? (
              <div className="flex h-32 items-center justify-center text-slate-500 text-xs">
                No data found for this check
              </div>
            ) : (
              /* Live mode / fallback: show single record */
              <HealthCheckDetailsContainer checkData={detailViewRecord} partitionLive={partitionLive} />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default DetailDrawer
