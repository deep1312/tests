import { useCallback, useMemo, useState, useEffect } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { useLocation } from 'react-router-dom'

import {

  Activity,

  Download,

  RefreshCw,

  ShieldCheck,

  Database,

  HardDrive,

  Layers,

  MousePointerClick,

  Search,

  Zap,

} from 'lucide-react'



import {

  ResponsiveContainer,

  LineChart,

  Line,

  AreaChart,

  Area,

  BarChart,

  Bar,

  Tooltip,

  XAxis,

  YAxis,

} from 'recharts'



import { useLatestPerCheck, useHistoricalPerCheck, useRunsAggregate, usePartitionCount } from '../api/monitoring'
import { useChecks } from '../api/checks'

import { FilterBar } from '../components/monitoring/FilterBar'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'

import { useAutoRefresh } from '../hooks/useAutoRefresh'

import { useDashboardFilters } from '../hooks/useDashboardFilters'

import { useServers } from '../api/servers'



import {

  DetailDrawer,

  DrawerContext,

} from '../components/monitoring/DetailDrawer'



/* =========================================================

   SHARED HELPERS

========================================================= */

/* =========================================================

   REUSABLE CARD

========================================================= */



interface MonitoringCardProps {

  title: string

  icon: any

  children: React.ReactNode

  status?: 'healthy' | 'warning' | 'critical'

  onClick?: () => void

}



function MonitoringCard({

  title,

  icon: Icon,

  children,

  status = 'healthy',

  onClick,

}: MonitoringCardProps) {

  const statusStyles = {

    healthy: 'bg-success/10 text-success border-success/20',

    warning: 'bg-warning/10 text-warning border-warning/20',

    critical: 'bg-destructive/10 text-destructive border-destructive/20',

  }



  return (

    <div

      onClick={onClick}

      className="glass-card-hover group relative flex cursor-pointer flex-col p-4 transition-all duration-200"

    >

      <div className="mb-3 flex items-center justify-between">

        <div className="flex items-center gap-2.5">

          <div className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground transition-all duration-200 group-hover:bg-primary/10 group-hover:text-primary">

            <Icon size={16} />

          </div>



          <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">

            {title}

          </h3>

        </div>



        <span

          className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase leading-none ${statusStyles[status]}`}

        >

          {status}

        </span>

      </div>



      <div className="flex-1">{children}</div>



      <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100">

        View Details →

      </div>

    </div>

  )

}



/* =========================================================

   MAIN MONITORING PAGE

========================================================= */



export function Monitoring() {

  const queryClient = useQueryClient()

  const location = useLocation()

  const { filters, updateFilters } = useDashboardFilters()

  const [drawerContext, setDrawerContext] = useState<DrawerContext | null>(null)



  // Intercept incoming historical location router states safely on node selection shifts

  useEffect(() => {

    const routingState = location.state as { autoSelectServerId?: number } | null

    if (routingState?.autoSelectServerId) {

      updateFilters({ serverId: routingState.autoSelectServerId })

      // Clear navigation tracking state container to enable natural independent page refresh cycles

      window.history.replaceState({}, document.title)

    }

  }, [location.state, updateFilters])



  const serverId =

    !filters.serverId || String(filters.serverId) === 'all'

      ? undefined

      : (filters.serverId as number)



  const fromValue = filters.from

  const isHistorical = !!(filters.customFrom && filters.customTo) || filters.rangeHours !== 24



  // Latest data — always enabled to provide detailed fields (queries, indexes, etc.)
  // even when historical mode is active for scalar metrics.
  // No time constraint — we always want the absolute most recent snapshot.

  const { data: latestResponse, isLoading: isLatestLoading } = useLatestPerCheck(

    serverId,

    undefined,

    undefined,

    undefined,

    true

  )



  // Partition Count — live query from monitored server (no persistence)
  const { data: partitionData, isLoading: isPartitionLoading } = usePartitionCount(
    serverId,
    !!serverId,
  )

  // Historical (bucketed) data — only active when in historical mode

  const { data: historicalResponse, isLoading: isHistoricalLoading } = useHistoricalPerCheck(

    serverId,

    undefined,

    fromValue,

    filters.to,

    undefined,

    isHistorical

  )

  // Group historical bucket records by check_id for the drawer
  const historicalDataMap = useMemo(() => {
    const map: Record<number, any[]> = {}
    if (historicalResponse?.data) {
      historicalResponse.data.forEach((point: any) => {
        const cid = point.check_id
        if (!map[cid]) map[cid] = []
        map[cid].push(point)
      })
      Object.values(map).forEach(arr =>
        arr.sort((a, b) => new Date(a.bucket).getTime() - new Date(b.bucket).getTime())
      )
    }
    return map
  }, [historicalResponse])

  const { data: aggregateResponse, isLoading: isAggregateLoading } = useRunsAggregate(

    serverId,

    undefined,

    fromValue,

    filters.to,

    '5m'

  )



  // Map raw data into the metrics lookup for all cards.
  // Always starts with latest-per-check data (provides detailed fields like
  // queries, indexes, etc.), then in historical mode overlays the bucketed
  // scalar metric values on top so that charts reflect the selected window.

  const metricsMap = useMemo(() => {

    const map: Record<number, any> = {}



    // 1) Always process latest-per-check data first for detailed fields

    const rawData = latestResponse?.data ?? []

    rawData.forEach((item: any) => {

      const rawRow = item?.raw_result?.rows?.[0] ?? {}

      const metadata =

        Array.isArray(item?.result_metadata) && item.result_metadata.length > 0

          ? item.result_metadata[0]

          : (item?.result_metadata && typeof item.result_metadata === 'object' ? item.result_metadata : {})



      const data = {

        ...item,

        ...rawRow,

        ...metadata,
      }

      let metricValue: number | null = null



      switch (item.check_id) {

        case 1: metricValue = data.connection_pct ?? 0; break

        case 2: metricValue = data.blocking_count ?? 0; break

        case 3: metricValue = data.bloat_pct ?? 0; break

        case 4: metricValue = data.index_usage_pct ?? 0; break

        case 5: metricValue = data.unused_count ?? 0; break

        case 6: metricValue = data.lag_seconds ?? 0; break

        case 7: metricValue = data.wal_gb_total ?? 0; break

        case 8: metricValue = data.size_gb ?? 0; break

        case 9: metricValue = data.avg_mean_ms ?? 0; break
        case 10: metricValue = data.table_count ?? 0; break
        case 11: metricValue = data.xid_age ?? 0; break
        case 12: metricValue = data.partition_count ?? 0; break

        default: metricValue = 0

      }



      map[item.check_id] = { ...data, metric_value: metricValue }

    })



    // 2) In historical mode, overlay bucket-aggregated scalar values so the
    //    displayed metric reflects the selected time window. We keep the
    //    original detailed fields (queries, indexes, etc.) from step 1.

    if (isHistorical && historicalResponse?.data) {

      const grouped: Record<number, any[]> = {}

      historicalResponse.data.forEach((point: any) => {

        const cid = point.check_id

        if (!grouped[cid]) grouped[cid] = []

        grouped[cid].push(point)

      })



      Object.entries(grouped).forEach(([cidStr, points]) => {

        const cid = Number(cidStr)

        const sorted = [...points].sort(

          (a, b) => new Date(a.bucket).getTime() - new Date(b.bucket).getTime()

        )

        const latest = sorted[sorted.length - 1]



        let metricValue: number | null = null

        switch (cid) {

          case 1: metricValue = latest.connection_pct ?? 0; break

          case 2: metricValue = latest.blocking_count ?? 0; break

          case 3: metricValue = latest.bloat_pct ?? 0; break

          case 4: metricValue = latest.index_usage_pct ?? 0; break

          case 5: metricValue = latest.unused_count ?? 0; break

          case 6: metricValue = latest.lag_seconds ?? 0; break

          case 7: metricValue = latest.wal_gb_total ?? 0; break

          case 8: metricValue = latest.size_gb ?? 0; break

          case 9: metricValue = latest.avg_mean_ms ?? 0; break
          case 10: metricValue = latest.table_count ?? 0; break
          case 11: metricValue = latest.xid_age ?? 0; break
          case 12: metricValue = latest.partition_count ?? 0; break

          default: metricValue = 0

        }



        // Merge historical scalar values into existing map entry, preserving
        // detailed fields (queries, indexes, etc.) from the latest snapshot.

        map[cid] = {

          ...(map[cid] || {}),

          ...latest,

          metric_value: metricValue,

          raw_result: map[cid]?.raw_result || { rows: [latest] },

        }

      })

    }



    return map

  }, [latestResponse, historicalResponse, isHistorical])



  // Universal normalized extraction function 

  const getMetadataValue = (

    checkId: number,

    key: string,

    fallback: any = undefined

  ) => {

    const item = metricsMap[checkId]

    if (!item) return fallback

    return item[key] ?? fallback

  }



  // Process dynamic historical datasets for Recharts trends

  const dynamicTimeSeriesData = useMemo(() => {

    const aggregateData = aggregateResponse?.data ?? []

    const groups: Record<string, { time: string; conn: number; usage: number }> = {}

      



    aggregateData.forEach((row: any) => {

      const timeStr = new Date(

        row.started_at || row.bucket

      ).toLocaleTimeString([], {

        hour: '2-digit',

        minute: '2-digit',

      })

        

      if (!groups[timeStr]) {

        groups[timeStr] = { time: timeStr, conn: 0, usage: 0 }

      }

        

      if (row.check_id === 1) groups[timeStr].conn = row.metric_value ?? 0

      if (row.check_id === 4) groups[timeStr].usage = row.metric_value ?? 0

    })



    return Object.values(groups).sort((a, b) => a.time.localeCompare(b.time))

  }, [aggregateResponse])



  // Build queries performance visualization data distribution placeholders safely matching data keys

  const queryPerfData = useMemo(() => {

    const rawResult = getMetadataValue(9, 'raw_result') || getMetadataValue(9, 'queries')

    const targetRow = Array.isArray(rawResult?.rows) ? rawResult.rows[0] : rawResult

    const queriesList = Array.isArray(targetRow?.queries) ? targetRow.queries : (Array.isArray(rawResult) ? rawResult : [])

    const avgVal = targetRow?.avg_mean_ms ?? getMetadataValue(9, 'avg_mean_ms', 0)

    

    return [

      { name: 'AVG', ms: Math.round(avgVal) },

      { name: 'Max Query', ms: queriesList.length > 0 ? Math.round(queriesList[0]?.mean_ms ?? 0) : 0 },

      { name: 'Execution', ms: metricsMap[9]?.execution_time_ms ?? 0 },

    ]

  }, [metricsMap])



  const handleRefresh = useCallback(() => {

    queryClient.invalidateQueries({ queryKey: ['monitoring'] })

  }, [queryClient])



  useAutoRefresh(filters.refreshInterval, handleRefresh)

  const { data: serversData } = useServers(undefined, true, undefined, 1000)

  const { data: checksData } = useChecks(undefined, undefined, 200, 0)
  const activeCheckIds = useMemo(() => {
    if (!checksData?.data) return null
    const active = new Set<number>()
    checksData.data.forEach(c => { if (c.is_active) active.add(c.check_id) })
    return active
  }, [checksData])

  const isActive = useCallback((checkId: number) => {
    if (!activeCheckIds) return true
    return activeCheckIds.has(checkId)
  }, [activeCheckIds])

  const isActiveOrUnknown = useCallback((checkId: number) => {
    if (!activeCheckIds) return true
    if (!activeCheckIds.has(checkId) && checksData?.data) {
      const exists = checksData.data.some(c => c.check_id === checkId)
      if (!exists) return true
    }
    return activeCheckIds.has(checkId)
  }, [activeCheckIds, checksData])

  const openDrawer = useCallback((checkId: number) => {
    const sid = serverId ?? 1
    const serverInfo = serversData?.data?.find((s) => s.server_id === sid)
    setDrawerContext({
      serverId: sid,
      serverLabel: serverInfo?.server_label,
      serverIp: serverInfo?.server_ip,
      checkId,
      ...(isHistorical && historicalDataMap[checkId]
        ? { data: historicalDataMap[checkId], from: filters.from, to: filters.to, isHistorical: true }
        : {}),
    })
  }, [serverId, isHistorical, historicalDataMap, filters.from, filters.to, serversData])

  const getStatus = (checkId: number, warningThresh: number, criticalThresh: number) => {

    const item = metricsMap[checkId]

    if (!item) return 'healthy'

    

    // Fall back directly to the string status_code returned by your backend API engine if present

    if (item.status_code === 'WARNING') return 'warning'

    if (item.status_code === 'CRITICAL' || item.status === 'FAILED') return 'critical'



    const val = item.metric_value

    if (val === undefined || val === null) return 'healthy'

    if (val >= criticalThresh) return 'critical'

    if (val >= warningThresh) return 'warning'

    return 'healthy'

  }

  const handleExportCSV = useCallback(() => {
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const rangeLabel = isHistorical ? `${filters.rangeHours}h` : '24H'
    const esc = (s: any) => `"${String(s ?? '').replace(/"/g, '""')}"`

    const items = latestResponse?.data ?? []

    const rows: string[] = []
    rows.push(`Report Generated Date,${dateStr}`)
    rows.push(`Report Generated Time,${timeStr}`)
    rows.push(`Report Generated Timestamp,${now.toISOString()}`)
    rows.push(`Time Range,${rangeLabel}`)
    rows.push('')

    /* ──────────────────────────────────────────────
       Helper: write a detail section
       ────────────────────────────────────────────── */
    const addSection = (title: string, headers: string[], dataRows: string[][]) => {
      if (dataRows.length === 0) return
      rows.push(`"=== ${title} ==="`)
      rows.push(headers.join(','))
      dataRows.forEach(r => rows.push(r.join(',')))
      rows.push('')
    }

    const ts = (item: any) => item.collected_at || item.started_at || now.toISOString()
    const src = (item: any) => `${esc(item.server_label)}${item.server_ip ? ` (${item.server_ip})` : ''}`

    /* ──────────────────────────────────────────────
       Check 1 — Connections
       ────────────────────────────────────────────── */
    {
      const section: string[][] = []
      items.filter((i: any) => i.check_id === 1).forEach((item: any) => {
        const m = metricsMap[1] || item
        section.push([
          m.active_connections ?? '', m.idle_connections ?? '', m.idle_in_txn_connections ?? '',
          m.max_connections ?? '', m.connection_pct ?? '', m.datname ?? '',
          src(item), ts(item),
        ].map(esc))
      })
      addSection('Connections Details', [
        'Active Connections','Idle Connections','Idle In Transaction',
        'Max Connections','Usage %','Database Name','Source','Timestamp',
      ], section)
    }

    /* ──────────────────────────────────────────────
       Check 2 — Blocking
       ────────────────────────────────────────────── */
    {
      const section: string[][] = []
      items.filter((i: any) => i.check_id === 2).forEach((item: any) => {
        const m = metricsMap[2] || item
        const blockers: any[] = m.blockers ?? []
        if (blockers.length === 0) {
          section.push([
            '','','','','','','No blocking sessions', src(item), ts(item),
          ].map(esc))
        } else {
          blockers.forEach((b: any) => {
            section.push([
              b.blocker_pid ?? '', b.blocker_user ?? '', b.blocker_state ?? '',
              b.blocker_query ?? '', b.blocker_txn_age_s ?? b.blocker_duration_s ?? '',
              b.waiting_count ?? '', b.database ?? '',
              src(item), ts(item),
            ].map(esc))
          })
        }
      })
      addSection('Blocking Details', [
        'Blocker PID','User','State','Query','Duration (s)','Waiting Count','Database',
        'Source','Timestamp',
      ], section)
    }

    /* ──────────────────────────────────────────────
       Check 3 — Table Bloat
       ────────────────────────────────────────────── */
    {
      const section: string[][] = []
      items.filter((i: any) => i.check_id === 3).forEach((item: any) => {
        const m = metricsMap[3] || item
        const tables: any[] = m.bloated_tables ?? m.tables ?? []
        if (tables.length === 0) {
          section.push([
            m.table_schema ?? '', m.table_name ?? '', m.table_size ?? '',
            m.bloat_pct ?? '', m.bloat_size ?? '',
            src(item), ts(item),
          ].map(esc))
        } else {
          tables.forEach((t: any) => {
            section.push([
              t.schema ?? t.table_schema ?? '', t.table ?? t.table_name ?? '',
              t.size ?? t.table_size ?? '', t.bloat_pct ?? t.table_bloat_pct ?? '',
              t.bloat_size ?? t.dead_tuple_size ?? '',
              src(item), ts(item),
            ].map(esc))
          })
        }
      })
      addSection('Table Bloat Details', [
        'Schema','Table','Size','Bloat %','Bloat Size',
        'Source','Timestamp',
      ], section)
    }

    /* ──────────────────────────────────────────────
       Check 4 — Index Usage
       ────────────────────────────────────────────── */
    {
      const section: string[][] = []
      items.filter((i: any) => i.check_id === 4).forEach((item: any) => {
        const m = metricsMap[4] || item
        const tables: any[] = m.low_index_tables ?? []
        if (tables.length === 0) {
          section.push([m.index_usage_pct ?? '', '', '', '', src(item), ts(item)].map(esc))
        } else {
          tables.forEach((t: any) => {
            section.push([
              t.table ?? t.table_name ?? '', t.schema ?? '',
              t.seq_pct ?? '', t.idx_scans ?? '', t.seq_scans ?? '',
              src(item), ts(item),
            ].map(esc))
          })
        }
      })
      addSection('Index Usage Details', [
        'Table','Schema','Seq Scan %','Index Scans','Seq Scans',
        'Source','Timestamp',
      ], section)
    }

    /* ──────────────────────────────────────────────
       Check 5 — Unused Indexes
       ────────────────────────────────────────────── */
    {
      const section: string[][] = []
      items.filter((i: any) => i.check_id === 5).forEach((item: any) => {
        const m = metricsMap[5] || item
        const idxList: any[] = m.indexes ?? []
        if (idxList.length === 0) {
          section.push([m.total_size ?? '', '0', '', '', '', src(item), ts(item)].map(esc))
        } else {
          idxList.forEach((idx: any) => {
            section.push([
              idx.index ?? '', idx.table ?? '',
              idx.size ?? '', idx.bytes ?? '', idx.scans ?? 0,
              m.total_size ?? '',
              src(item), ts(item),
            ].map(esc))
          })
        }
      })
      addSection('Unused Index Details', [
        'Index Name','Table','Index Size','Bytes','Scans','Total Size',
        'Source','Timestamp',
      ], section)
    }

    /* ──────────────────────────────────────────────
       Check 6 — Replication Lag
       ────────────────────────────────────────────── */
    {
      const section: string[][] = []
      items.filter((i: any) => i.check_id === 6).forEach((item: any) => {
        const m = metricsMap[6] || item
        section.push([
          m.is_replica ? 'Replica' : 'Primary',
          m.lag_seconds ?? '', m.replay_lag ?? '', m.write_lag ?? '',
          m.flush_lag ?? '', m.sync_state ?? '', m.sync_priority ?? '',
          src(item), ts(item),
        ].map(esc))
      })
      addSection('Replication Lag Details', [
        'Role','Lag (s)','Replay Lag','Write Lag','Flush Lag','Sync State','Sync Priority',
        'Source','Timestamp',
      ], section)
    }

    /* ──────────────────────────────────────────────
       Check 7 — WAL Production
       ────────────────────────────────────────────── */
    {
      const section: string[][] = []
      items.filter((i: any) => i.check_id === 7).forEach((item: any) => {
        const m = metricsMap[7] || item
        section.push([
          m.wal_gb_total ?? '', m.wal_gb_total_display ?? '',
          m.wal_file_count ?? '',
          src(item), ts(item),
        ].map(esc))
      })
      addSection('WAL Production Details', [
        'Total WAL (GB)','Total WAL (display)','File Count',
        'Source','Timestamp',
      ], section)
    }

    /* ──────────────────────────────────────────────
       Check 8 — Database Size
       ────────────────────────────────────────────── */
    {
      const section: string[][] = []
      items.filter((i: any) => i.check_id === 8).forEach((item: any) => {
        const m = metricsMap[8] || item
        const topTables: any[] = m.top_tables ?? []
        if (topTables.length === 0) {
          section.push([m.datname ?? '', m.size_human ?? `${m.size_gb ?? ''} GB`, src(item), ts(item)].map(esc))
        } else {
          topTables.forEach((t: any) => {
            section.push([
              t.datname ?? m.datname ?? '', t.table ?? '', t.size ?? '',
              t.size_gb ?? '', t.n_live_tup ?? '',
              src(item), ts(item),
            ].map(esc))
          })
        }
      })
      addSection('Database Size Details', [
        'Database','Table','Size','Size (GB)','Live Tuples',
        'Source','Timestamp',
      ], section)
    }

    /* ──────────────────────────────────────────────
       Check 9 — Slow Queries
       ────────────────────────────────────────────── */
    {
      const section: string[][] = []
      items.filter((i: any) => i.check_id === 9).forEach((item: any) => {
        const m = metricsMap[9] || item
        const queries: any[] = m.queries ?? []
        if (queries.length === 0) {
          section.push([m.avg_mean_ms ?? '', '', '', '', '', src(item), ts(item)].map(esc))
        } else {
          queries.forEach((q: any) => {
            section.push([
              q.datname ?? q.database ?? '', q.query ?? '',
              q.total_ms ?? '', q.calls ?? '', q.mean_ms ?? '',
              q.cache_hit_pct ?? '',
              src(item), ts(item),
            ].map(esc))
          })
        }
      })
      addSection('Slow Query Details', [
        'Database','Query','Total Time (ms)','Calls','Mean Time (ms)','Cache Hit %',
        'Source','Timestamp',
      ], section)
    }

    /* ──────────────────────────────────────────────
       Check 10 — Table Count
       ────────────────────────────────────────────── */
    {
      const section: string[][] = []
      items.filter((i: any) => i.check_id === 10).forEach((item: any) => {
        const meta = item.result_metadata
        const tableRows: any[] = Array.isArray(meta) ? meta : (Array.isArray(meta?.rows) ? meta.rows : [])
        if (tableRows.length === 0) {
          section.push([item.server_label, '', '', '', '', src(item), ts(item)].map(esc))
        } else {
          tableRows.forEach((r: any) => {
            section.push([
              r.table_name ?? r.table ?? '', r.schema_name ?? r.schema ?? '',
              r.record_count ?? '', r.status ?? '',
              src(item), ts(item),
            ].map(esc))
          })
        }
      })
      addSection('Table Count Details', [
        'Table Name','Schema','Record Count','Status',
        'Source','Timestamp',
      ], section)
    }

    /* ──────────────────────────────────────────────
       Check 11 — Database Age
       ────────────────────────────────────────────── */
    {
      const section: string[][] = []
      items.filter((i: any) => i.check_id === 11).forEach((item: any) => {
        const m = metricsMap[11] || item
        section.push([
          m.datname ?? '', m.datid ?? '',
          m.xid_age != null ? Number(m.xid_age).toLocaleString() : '',
          m.xid_wraparound_pct ?? m.xid_age_pct ?? '',
          src(item), ts(item),
        ].map(esc))
      })
      addSection('Database Age Details', [
        'Database','Database ID','XID Age','Wraparound %',
        'Source','Timestamp',
      ], section)
    }

    /* ──────────────────────────────────────────────
       Check 12 — Partition Count
       ────────────────────────────────────────────── */
    {
      const section: string[][] = []
      items.filter((i: any) => i.check_id === 12).forEach((item: any) => {
        const meta = item.result_metadata
        let partRows: any[] = Array.isArray(meta) ? meta : []
        if (partitionData && partRows.length === 0) {
          partRows = partitionData.rows ?? []
        }
        if (partRows.length === 0) {
          section.push([item.server_label, '', '', '', src(item), ts(item)].map(esc))
        } else {
          partRows.forEach((r: any) => {
            section.push([
              r.schema_name ?? r.schema ?? '', r.parent_table ?? '',
              r.partition_name ?? '', r.partition_size ?? r.size ?? '',
              r.partition_count ?? '',
              src(item), ts(item),
            ].map(esc))
          })
        }
      })
      addSection('Partition Details', [
        'Schema','Parent Table','Partition Name','Partition Size','Count',
        'Source','Timestamp',
      ], section)
    }

    /* ──────────────────────────────────────────────
       Sources Summary
       ────────────────────────────────────────────── */
    {
      const seen = new Set<number>()
      const section: string[][] = []
      items.forEach((item: any) => {
        if (seen.has(item.server_id)) return
        seen.add(item.server_id)
        section.push([
          esc(item.server_label || ''), esc(item.server_ip || ''),
          esc(String(item.server_id)), item.status_code ?? '',
          ts(item),
        ])
      })
      if (section.length > 0) {
        addSection('Sources Details', [
          'Stack Name','Stack IP','Server ID','Status','Timestamp',
        ], section)
      }
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `monitoring-report-${now.toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [latestResponse, metricsMap, partitionData, isHistorical, filters.rangeHours])



  return (

    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ── Page Header ── */}

      <div className="flex items-center justify-between">

        <div className="flex items-center gap-3">

          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">

            <Database className="w-5 h-5 text-primary" />

          </div>

          <div>

            <h1 className="text-2xl font-bold text-foreground tracking-tight">

              Fleet Monitor

            </h1>

            <p className={`flex items-center gap-1.5 text-sm mt-0.5 ${isHistorical ? 'text-warning' : 'text-success'}`}>

              <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${isHistorical ? 'bg-warning' : 'bg-success'}`} />

              {isHistorical ? `Historical • ${filters.rangeHours}h` : 'Live System Metrics'}

            </p>

          </div>

        </div>



        <div className="flex items-center gap-2">

          <Badge variant="secondary" className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold">
            <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${isHistorical ? 'bg-warning' : 'bg-info'}`} />
            {isLatestLoading || isHistoricalLoading || isAggregateLoading
              ? 'Syncing...'
              : isHistorical
                ? `Historical • ${filters.rangeHours}h`
                : 'System Online'}
          </Badge>

          <Button variant="outline" size="sm" onClick={handleExportCSV} title="Export CSV" className="h-8 w-8 p-0 rounded-xl">
            <Download className="h-3.5 w-3.5" />
          </Button>

          <Button variant="outline" size="sm" onClick={handleRefresh} className="h-8 w-8 p-0 rounded-xl">
            <RefreshCw className={`h-3.5 w-3.5 ${isLatestLoading || isHistoricalLoading || isAggregateLoading ? 'animate-spin' : ''}`} />
          </Button>

        </div>

      </div>



      {/* ── Filters ── */}

      <div className="glass-card p-3">

        <FilterBar filters={filters} onChange={updateFilters} />

      </div>



      {/* ── ROW 1: Top Metrics ── */}

      <section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">

          {/* CONNECTIONS (Check ID: 1) */}

          {isActive(1) && <MonitoringCard

            title="Connections"

            icon={Activity}

            status={getStatus(1, 80, 95)}

            onClick={() => openDrawer(1)}

          >

            <div className="flex h-full flex-col justify-between">



              <div className="h-14 w-full mt-2 glass-card overflow-hidden rounded-xl border border-border/50 bg-background/30 p-1">

                <ResponsiveContainer width="100%" height="100%">

                  <LineChart data={dynamicTimeSeriesData}>

                    <Line type="monotone" dataKey="conn" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} strokeOpacity={0.8} />

                  </LineChart>

                </ResponsiveContainer>

              </div>

            </div>

          </MonitoringCard>}



          {/* BLOCKING (Check ID: 2) */}

          {isActive(2) && <MonitoringCard

            title="Blocking"

            icon={ShieldCheck}

            status={getStatus(2, 1, 5)}

            onClick={() => openDrawer(2)}

          >

            <div className="flex flex-col h-full justify-center items-center py-4">

              <div className="relative mb-2">

                <div className={`absolute inset-0 blur-xl opacity-30 rounded-full ${getMetadataValue(2, 'blocking_count', 0) > 0 ? 'bg-destructive' : 'bg-success'}`}></div>

                <div className={`text-5xl font-black tabular-nums tracking-tighter drop-shadow-md relative ${getMetadataValue(2, 'blocking_count', 0) > 0 ? 'text-destructive' : 'text-success'}`}>

                  {getMetadataValue(2, 'blocking_count', 0)}

                </div>

              </div>

              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-2 bg-muted/50 px-3 py-1 rounded-full border border-border/50">

                Active Blockers

              </div>

            </div>

          </MonitoringCard>}



          {/* REPLICATION (Check ID: 6) */}

          {isActive(6) && <MonitoringCard

            title="Replication Lag"

            icon={RefreshCw}

            status={getStatus(6, 5, 30)}

            onClick={() => openDrawer(6)}

          >

            <div className="text-center">

              <div className="text-[10px] font-semibold uppercase text-muted-foreground">

                {getMetadataValue(6, 'is_replica') ? 'Replica Lag' : 'Cluster Primary'}

              </div>



              <div className="text-lg font-bold text-primary truncate tabular-nums">

                {getMetadataValue(6, 'lag_seconds') !== undefined 
                  ? `${getMetadataValue(6, 'lag_seconds')}s` 
                  : '0s'}

              </div>

            </div>

          </MonitoringCard>}

          {/* WAL (Check ID: 7) */}

          {isActive(7) && <MonitoringCard

            title="WAL Production"

            icon={HardDrive}

            status={getStatus(7, 500, 1000)}

            onClick={() => openDrawer(7)}

          >

            <div className="grid grid-cols-2 gap-3 mt-2">

              <div className="glass-card bg-muted/20 p-3 flex flex-col items-center justify-center text-center rounded-xl border border-border/40">

                <div className="text-2xl font-bold text-foreground tabular-nums">

                  {getMetadataValue(7, 'wal_gb_total') ?? '—'}

                </div>

                <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1 font-semibold">

                  Total Size (GB)

                </div>

              </div>

              <div className="glass-card bg-muted/20 p-3 flex flex-col items-center justify-center text-center rounded-xl border border-border/40">

                <div className="text-2xl font-bold text-info tabular-nums">

                  {getMetadataValue(7, 'wal_file_count', '—')}

                </div>

                <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1 font-semibold">

                  WAL Files

                </div>

              </div>

            </div>

          </MonitoringCard>}



          {/* DATABASE SIZE (Check ID: 8) */}

          {isActive(8) && <MonitoringCard

            title="Database Size"

            icon={Database}

            status={getStatus(8, 100, 500)}

            onClick={() => openDrawer(8)}

          >

            <div className="flex flex-col items-center justify-center h-full py-4 relative group-hover:scale-105 transition-transform duration-300">

              <div className="absolute inset-0 bg-primary/5 blur-2xl rounded-full"></div>

              <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-foreground to-muted-foreground tabular-nums drop-shadow-sm">

                {getMetadataValue(8, 'size_human') !== undefined

                  ? getMetadataValue(8, 'size_human')

                  : `${Number(getMetadataValue(8, 'size_gb', 0)).toFixed(1)} GB`}

              </div>

              <div className="mt-2 text-xs font-semibold text-muted-foreground bg-muted/50 px-4 py-1 rounded-full border border-border/30">

                Total Allocated Space

              </div>

            </div>

          </MonitoringCard>}

        </div>

      </section>



      {/* ── ROW 2: Queries + Index Usage ── */}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">

        {/* QUERIES (Check ID: 9) */}

        {isActive(9) && <div className="xl:col-span-2">

          <MonitoringCard

            title="Slow Queries"

            icon={Zap}

            status={getStatus(9, 1000, 5000)}

            onClick={() => openDrawer(9)}

          >

            <div className="flex items-center h-full gap-4">

              <div className="w-2/5 space-y-3">

                {(() => {

                  const rawResult = getMetadataValue(9, 'raw_result') || getMetadataValue(9, 'queries');

                  const targetRow = Array.isArray(rawResult?.rows) ? rawResult.rows[0] : rawResult;

                  const queriesList = Array.isArray(targetRow?.queries) ? targetRow.queries : (Array.isArray(rawResult) ? rawResult : [])

                  const globalAvgMean = targetRow?.avg_mean_ms ?? getMetadataValue(9, 'avg_mean_ms', 0);



                  return (

                    <>

                      <div className="glass-card bg-muted/20 p-2.5 rounded-xl border-border/40">

                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Avg Mean Time</p>

                        <p className="text-lg font-extrabold text-warning tabular-nums shadow-glow-sm">

                          {globalAvgMean > 0 ? `${Math.round(globalAvgMean).toLocaleString()}ms` : '—'}

                        </p>

                      </div>



                      <div className="glass-card bg-muted/20 p-2.5 rounded-xl border-border/40">

                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Active Logged</p>

                        <p className="text-lg font-extrabold text-foreground tabular-nums">

                          {queriesList.length}

                        </p>

                      </div>

                    </>

                  );

                })()}

              </div>



              <div className="h-24 w-3/5 glass-card bg-background/40 rounded-xl p-2 border-border/30">

                <ResponsiveContainer width="100%" height="100%">

                  <BarChart data={queryPerfData}>

                    <Tooltip cursor={{ fill: 'hsl(var(--muted)/0.5)' }} contentStyle={{ borderRadius: '12px', backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />

                    <Bar dataKey="ms" fill="hsl(var(--primary))" radius={[6, 6, 6, 6]} />

                  </BarChart>

                </ResponsiveContainer>

              </div>

            </div>

          </MonitoringCard>

        </div>}



        {/* INDEX USAGE (Check ID: 4) */}

        {isActive(4) && <div>

          <MonitoringCard

            title="Index Usage"

            icon={MousePointerClick}

            status={getMetadataValue(4, 'index_usage_pct', 100) < 90 ? 'warning' : 'healthy'}

            onClick={() => openDrawer(4)}

          >

            <div className="flex h-full flex-col justify-between">

              <div className="flex items-center justify-between mb-2 px-1">

                <div className="text-sm font-semibold text-muted-foreground">Overall Usage</div>

                <div className="text-3xl font-extrabold text-primary tabular-nums drop-shadow-sm">

                  {getMetadataValue(4, 'index_usage_pct') !== undefined

                    ? `${Number(getMetadataValue(4, 'index_usage_pct')).toFixed(1)}%`

                    : '—'}

                </div>

              </div>



              <div className="h-16 w-full glass-card rounded-xl border-border/40 bg-background/20 overflow-hidden">

                <ResponsiveContainer width="100%" height="100%">

                  <AreaChart data={dynamicTimeSeriesData}>

                    <defs>

                      <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">

                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />

                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />

                      </linearGradient>

                    </defs>

                    <XAxis hide dataKey="time" />

                    <YAxis hide />

                    <Area type="monotone" dataKey="usage" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#usageGradient)" />

                  </AreaChart>

                </ResponsiveContainer>

              </div>

            </div>

          </MonitoringCard>

        </div>}

      </section>



      {/* ── ROW 3: Bloat + Unused Indexes ── */}

      <section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

          {/* TABLE BLOAT (Check ID: 3) */}

          {isActive(3) && <MonitoringCard

            title="Table Bloat"

            icon={Layers}

            status={getStatus(3, 20, 50)}

            onClick={() => openDrawer(3)}

          >

            <div className="flex flex-col h-full gap-3">

              <div className="glass-card bg-muted/20 px-4 py-3 rounded-xl border border-border/40 flex items-center justify-between">

                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Bloat</span>

                <span className="text-2xl font-black text-warning tabular-nums shadow-glow-sm">

                  {getMetadataValue(3, 'bloat_pct') !== undefined

                    ? `${Number(getMetadataValue(3, 'bloat_pct')).toFixed(1)}%`

                    : '—'}

                </span>

              </div>

              {(() => {

                const rawResult = getMetadataValue(3, 'raw_result')

                const allRows: any[] = Array.isArray(rawResult?.rows) ? rawResult.rows : []

                const top = allRows.slice(0, 3)

                return top.length > 0 ? (

                  <div className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">

                    {top.map((t: any, i: number) => (

                      <div key={i} className="glass-card rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-border/40 p-2.5">

                        <div className="flex justify-between items-center mb-1.5">

                          <div className="font-mono text-xs font-bold text-foreground truncate max-w-[150px]">

                            {t.table || t.table_name || 'Unknown Table'}

                          </div>

                          <Badge variant="outline" className="text-[9px] h-4 text-warning border-warning/30 bg-warning/10 px-1.5">

                            {t.bloat_pct ?? t.table_bloat_pct ?? 0}%

                          </Badge>

                        </div>

                        <div className="flex gap-4 text-[10px] text-muted-foreground font-medium">

                          <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-destructive/60"></div>Dead: {t.dead_tuples ?? 0}</div>

                          <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-success/60"></div>Live: {t.live_tuples ?? 0}</div>

                        </div>

                      </div>

                    ))}

                  </div>

                ) : (

                  <div className="flex-1 flex items-center justify-center glass-card bg-muted/10 rounded-xl border-dashed border-border/40">

                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-2">

                      <span className="w-2 h-2 rounded-full bg-success"></span>

                      No bloated tables detected

                    </p>

                  </div>

                )

              })()}

            </div>

          </MonitoringCard>}



          {/* UNUSED INDEXES (Check ID: 5) */}

          {isActive(5) && <MonitoringCard

            title="Unused Indexes"

            icon={Search}

            status={getStatus(5, 5, 15)}

            onClick={() => openDrawer(5)}

          >

            <div className="flex flex-col h-full gap-3">

              <div className="glass-card bg-muted/20 px-4 py-3 rounded-xl border border-border/40 flex items-center justify-between">

                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Unused Count</span>

                <span className="text-2xl font-black text-destructive tabular-nums shadow-glow-sm">

                  {getMetadataValue(5, 'unused_count', 0)}

                </span>

              </div>

              {(() => {

                const indexes = getMetadataValue(5, 'indexes') ?? []

                const top = Array.isArray(indexes) ? indexes.slice(0, 3) : []

                return top.length > 0 ? (

                  <div className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">

                    {top.map((idx: any, i: number) => (

                      <div key={i} className="glass-card rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-border/40 p-2.5 flex flex-col justify-center">

                        <div className="font-mono text-[11px] font-bold text-foreground truncate mb-1">

                          {idx.index || idx.index_name || 'Unnamed Index'}

                        </div>

                        <div className="flex items-center justify-between text-[10px] font-medium">

                          <span className="text-muted-foreground truncate max-w-[120px] bg-muted px-1.5 py-0.5 rounded-md">

                            {idx.table || idx.table_name || '—'}

                          </span>

                          {idx.size && (

                            <span className="font-mono text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded-md">

                              {idx.size}

                            </span>

                          )}

                        </div>

                      </div>

                    ))}

                  </div>

                ) : (

                  <div className="flex-1 flex items-center justify-center glass-card bg-muted/10 rounded-xl border-dashed border-border/40">

                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-2">

                      <span className="w-2 h-2 rounded-full bg-success"></span>

                      No unused indexes detected

                    </p>

                  </div>

                )

              })()}

            </div>

          </MonitoringCard>}

        </div>

      </section>

      {/* ── ROW 4: Additional Metrics ── */}

      <section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

          {/* TABLE COUNT (Check ID: 10) */}

          {isActive(10) && <MonitoringCard

            title="Table Count"

            icon={Database}

            status={getStatus(10, 0, 0)}

            onClick={() => openDrawer(10)}

          >

            <div className="flex items-center justify-between h-full px-2">

              <div>

                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">

                  Active Tables

                </p>

                <div className="text-4xl font-extrabold text-foreground tabular-nums drop-shadow-sm">

                  {getMetadataValue(10, 'table_count') ?? '—'}

                </div>

              </div>

              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shadow-glow-sm">

                <Database size={20} className="text-primary" />

              </div>

            </div>

          </MonitoringCard>}



          {/* DATABASE AGE (Check ID: 11) */}

          {isActive(11) && <MonitoringCard

            title="Database Age"

            icon={ShieldCheck}

            status={getStatus(11, 500000000, 1000000000)}

            onClick={() => openDrawer(11)}

          >

            <div className="flex items-center justify-between h-full px-2">

              <div>

                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">

                  XID Age

                </p>

                <div className="text-4xl font-extrabold text-info tabular-nums drop-shadow-sm">

                  {getMetadataValue(11, 'xid_age') != null

                    ? `${Math.round(Number(getMetadataValue(11, 'xid_age')) / 1000000)}M`

                    : '—'}

                </div>

              </div>

              <div className="text-[10px] font-semibold px-3 py-1.5 rounded-full bg-muted/40 border border-border/50 text-muted-foreground">

                Wraparound Risk

              </div>

            </div>

          </MonitoringCard>}

          {/* PARTITION COUNT (Check ID: 12) — live query, no persistence */}

          {isActiveOrUnknown(12) && <MonitoringCard

            title="Partition Count"

            icon={Layers}

            status={isPartitionLoading ? undefined : 'healthy'}

            onClick={() => openDrawer(12)}

          >

            <div className="flex items-center justify-between h-full px-2">

              <div>

                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">

                  Total Partitions

                </p>

                <div className="text-4xl font-extrabold text-success tabular-nums drop-shadow-sm">

                  {isPartitionLoading ? (

                    <span className="inline-block w-12 h-8 skeleton rounded-lg"></span>

                  ) : (

                    partitionData?.row_count ?? '—'

                  )}

                </div>

              </div>

              <div className="w-12 h-12 rounded-full bg-success/10 border border-success/20 flex items-center justify-center shadow-glow-sm">

                <Layers size={20} className="text-success" />

              </div>

            </div>

          </MonitoringCard>}

        </div>

      </section>



      {/* ── Footer ── */}

      <footer className="flex items-center justify-between gap-2 border-t border-border/50 pt-6 text-muted-foreground">

        <p className="text-[10px] font-semibold uppercase tracking-wider">

          © 2026 PG Utility Hub • v2.4.0

        </p>



        <div className="flex gap-4 text-[10px] font-semibold uppercase tracking-wider">

          <span className="cursor-pointer transition-colors hover:text-primary">Documentation</span>

          <span className="cursor-pointer transition-colors hover:text-primary">API Status</span>

          <span className="cursor-pointer transition-colors hover:text-primary">Support</span>

        </div>

      </footer>



      {/* ── Drawer ── */}

      <DetailDrawer context={drawerContext} onClose={() => setDrawerContext(null)} />

    </div>

  )

}



export default Monitoring 