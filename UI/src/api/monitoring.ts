// ui/src/api/monitoring.ts

import apiClient from './client'
import { useQuery, useQueries } from '@tanstack/react-query'

/* =========================================================
    TYPES & INTERFACES
========================================================= */

export interface MetricAggregatePoint {
  bucket: string
  avg_value: number
  min_value: number
  max_value: number
  sample_count: number
}

export interface TabularResult {
  columns: string[]
  rows: Record<string, any>[]
  collected_at?: string
}

export interface HistoricalDashboardResponse {
  instance: string
  time_range: string
  bucket: string
  timeseries_metrics: Record<string, MetricAggregatePoint[]>
  tabular_metrics: Record<string, TabularResult>
}

export interface CheckRun {
  run_id: number
  started_at: string
  scheduled_at: string
  ended_at: string
  server_id: number
  check_id: number
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT'
  execution_time_ms: number
  error_message?: string
}

export interface MonitoringLog {
  log_id: number
  collected_at: string
  server_id: number
  check_id: number
  check_name: string
  check_category?: string // Added fallback safely
  raw_result: Record<string, unknown> | any
  result_metadata?: Record<string, unknown> | any
  status_code: 'OK' | 'WARNING' | 'CRITICAL' | 'FAILURE'
  execution_time_ms: number
}

export interface Metric {
  metric_id: number
  collected_at: string
  server_id: number
  check_id?: number
  metric_name: string
  metric_value: number
  labels?: Record<string, unknown>
  details?: Record<string, unknown>
}

export interface RunsSummary {
  total_count: number
  success_count: number
  failed_count: number
  timeout_count: number
  avg_execution_time_ms: number
  success_rate_pct: number | null
  cpu_usage_pct?: number
  memory_usage_pct?: number
  disk_usage_pct?: number
  active_connections?: number
}

export interface RunsAggregatePoint {
  bucket: string
  success_count: number
  failed_count: number
  timeout_count: number
  total_count: number
  success_rate_pct: number | null
  avg_execution_time_ms: number | null
  server_id?: number
  server_label?: string
  check_id?: number
  check_name?: string
  status?: string | number
  started_at?: string
  metric_value?: number | string | null
}

export interface LatestPerCheckRow {
  server_id: number
  server_label: string
  check_id: number
  check_name: string
  check_category: string
  status: string | number
  started_at: string
  execution_time_ms: number | null
  metric_value?: number
  raw_result?: Record<string, unknown> | unknown[]
  result_metadata?: Record<string, unknown> | unknown[] | null
  latest_value?: number | null
}

export interface PaginationMeta {
  total: number
  limit: number
  offset: number
  has_more: boolean
}

export interface ListResponse<T> {
  data: T[]
  meta?: {
    pagination?: PaginationMeta
  }
}

/* =========================================================
    HELPERS
========================================================= */

function normalizeLatestPerCheckRow(
  row: LatestPerCheckRow
): LatestPerCheckRow {
  return {
    ...row,
    metric_value:
      row.metric_value ??
      row.latest_value ??
      (
        Array.isArray(row.result_metadata)
          ? (
              row.result_metadata[0] as Record<string, unknown>
            )?.connection_pct
          : undefined
      ) as number | undefined,
  }
}

/* =========================================================
    HOOKS
========================================================= */

/**
 * Unified query fetching multi-metric time series sets 
 * and deep tabular metrics snapshots via dashboard filters.
 */
export function useHistoricalDashboard(
  serverId?: number,
  timeRange?: '1H' | '6H' | '24H' | '7D',
  bucket?: '5M' | '15M' | '1H' | '6H' | '1D',
  metrics: string[] = []
) {
  return useQuery({
    queryKey: [
      'monitoring',
      'historical',
      'dashboard',
      { serverId, timeRange, bucket, metrics },
    ],

    queryFn: async () => {
      const params = new URLSearchParams()
      
      if (serverId) params.append('server_id', serverId.toString())
      if (timeRange) params.append('time_range', timeRange)
      if (bucket) params.append('bucket', bucket)
      
      metrics.forEach((m) => params.append('metrics', m))

      const response = await apiClient.get<{ data: HistoricalDashboardResponse }>(
        `/monitoring/historical?${params.toString()}`
      )
      return response.data.data
    },

    enabled: !!serverId && !!timeRange && !!bucket && metrics.length > 0,
    placeholderData: (previousData) => previousData,
  })
}

/**
 * FIX: Re-mapped to guarantee MonitoringLog payloads map 
 * straight into DetailDrawer.tsx layout rendering blocks.
 */
export function useCheckRuns(
  serverId?: number,
  checkId?: number,
  from?: string,
  to?: string,
  limit = 50,
  offset = 0
) {
  return useQuery({
    queryKey: [
      'monitoring',
      'logs',
      'list',
      { serverId, checkId, from, to, limit, offset },
    ],

    queryFn: async () => {
      const params = new URLSearchParams()
      if (serverId) params.append('server_id', serverId.toString())
      if (checkId) params.append('check_id', checkId.toString())
      if (from) params.append('from', from)
      if (to) params.append('to', to)
      params.append('limit', limit.toString())
      params.append('offset', offset.toString())

      // Changed from CheckRun to MonitoringLog endpoint to populate metrics
      const response = await apiClient.get<ListResponse<MonitoringLog>>(
        `/monitoring/logs?${params.toString()}`
      )
      return response.data
    },
    enabled: !!serverId && !!checkId,
  })
}

export function useMonitoringLogs(
  serverId?: number,
  checkId?: number,
  from?: string,
  to?: string,
  limit = 50,
  offset = 0
) {
  return useQuery({
    queryKey: [
      'monitoring',
      'logs',
      'details',
      { serverId, checkId, from, to, limit, offset },
    ],

    queryFn: async () => {
      const params = new URLSearchParams()
      if (serverId) params.append('server_id', serverId.toString())
      if (checkId) params.append('check_id', checkId.toString())
      if (from) params.append('from', from)
      if (to) params.append('to', to)
      params.append('limit', limit.toString())
      params.append('offset', offset.toString())

      const response = await apiClient.get<ListResponse<MonitoringLog>>(
        `/monitoring/logs?${params.toString()}`
      )
      return response.data
    },
  })
}

export function useRunsSummary(
  serverId?: number,
  checkId?: number,
  from?: string,
  to?: string
) {
  return useQuery({
    queryKey: [
      'monitoring',
      'logs',
      'summary',
      { serverId, checkId, from, to },
    ],

    queryFn: async () => {
      const params = new URLSearchParams()
      if (serverId) params.append('server_id', serverId.toString())
      if (checkId) params.append('check_id', checkId.toString())
      if (from) params.append('from', from)
      if (to) params.append('to', to)

      const response = await apiClient.get<{ data: RunsSummary }>(
        `/monitoring/logs/summary?${params.toString()}`
      )
      return response.data
    },
    enabled: !!serverId || !!checkId,
  })
}

export function useRunsAggregate(
  serverId?: number,
  checkId?: number,
  from?: string,
  to?: string,
  bucketInterval?: string
) {
  return useQuery({
    queryKey: [
      'monitoring',
      'logs',
      'aggregate',
      { serverId, checkId, from, to, bucketInterval },
    ],

    queryFn: async () => {
      const params = new URLSearchParams()
      if (serverId) params.append('server_id', serverId.toString())
      if (checkId) params.append('check_id', checkId.toString())
      if (from) params.append('from', from)
      if (to) params.append('to', to)
      if (bucketInterval) params.append('bucket_interval', bucketInterval)

      const response = await apiClient.get<{ data: RunsAggregatePoint[] }>(
        `/monitoring/logs/aggregate?${params.toString()}`
      )
      return response.data
    },
    enabled: !!from && !!to,
  })
}

export function useMetrics(
  serverId?: number,
  checkId?: number,
  name?: string,
  from?: string,
  to?: string,
  labels?: string,
  limit = 100,
  offset = 0
) {
  return useQuery({
    queryKey: [
      'monitoring',
      'metrics',
      'list',
      { serverId, checkId, name, from, to, labels, limit, offset },
    ],

    queryFn: async () => {
      const params = new URLSearchParams()
      if (serverId) params.append('server_id', serverId.toString())
      if (checkId) params.append('check_id', checkId.toString())
      if (name) params.append('metric_name', name)
      if (from) params.append('from', from)
      if (to) params.append('to', to)
      if (labels) params.append('labels', labels)
      params.append('limit', limit.toString())
      params.append('offset', offset.toString())

      const response = await apiClient.get<ListResponse<Metric>>(
        `/monitoring/metrics?${params.toString()}`
      )
      return response.data
    },
    enabled: !!serverId,
  })
}

export function useMetricsAggregate(
  serverId: number,
  name?: string,
  bucketInterval?: string,
  from?: string,
  to?: string
) {
  return useQuery({
    queryKey: [
      'monitoring',
      'metrics',
      'aggregate',
      { serverId, name, bucketInterval, from, to },
    ],

    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('server_id', serverId.toString())
      if (name) params.append('metric_name', name)
      if (from) params.append('from', from)
      if (to) params.append('to', to)
      if (bucketInterval) params.append('bucket_interval', bucketInterval)

      const response = await apiClient.get<{ data: MetricAggregatePoint[] }>(
        `/monitoring/metrics/aggregate?${params.toString()}`
      )
      return response.data
    },
    enabled: !!serverId && !!name && !!from && !!to,
  })
}

export function useHistoricalPerCheck(
  serverId?: number,
  checkId?: number,
  from?: string,
  to?: string,
  bucketInterval?: string,
  enabled = false
) {
  const effectiveBucket = bucketInterval || '5m'
  return useQuery({
    queryKey: [
      'monitoring',
      'logs',
      'historical-per-check',
      { serverId, checkId, from, to },
    ],

    queryFn: async () => {
      const params = new URLSearchParams()
      if (serverId) params.append('server_id', serverId.toString())
      if (checkId) params.append('check_id', checkId.toString())
      if (from) params.append('from', from)
      if (to) params.append('to', to)
      params.append('bucket_interval', effectiveBucket)

      const response = await apiClient.get<{ data: any[] }>(
        `/monitoring/logs/historical-per-check?${params.toString()}`
      )
      return response.data
    },
    enabled: enabled && !!from && !!to,
    placeholderData: (previousData) => previousData,
  })
}

export function useLatestPerCheck(
  serverId?: number,
  checkId?: number,
  from?: string,
  to?: string,
  enabled = true
) {
  return useQuery({
    queryKey: [
      'monitoring',
      'logs',
      'latest-per-check',
      { serverId, checkId, from, to },
    ],

    queryFn: async () => {
      const params = new URLSearchParams()
      if (serverId) params.append('server_id', serverId.toString())
      if (checkId) params.append('check_id', checkId.toString())
      if (from) params.append('from', from)
      if (to) params.append('to', to)

      const response = await apiClient.get<{ data: LatestPerCheckRow[] }>(
        `/monitoring/logs/latest-per-check?${params.toString()}`
      )
      return {
        ...response.data,
        data: response.data.data.map(normalizeLatestPerCheckRow),
      }
    },
    enabled,
  })
}

export function useLatestMetrics(
  serverId?: number,
  from?: string,
  to?: string
) {
  return useQuery({
    queryKey: [
      'monitoring',
      'metrics',
      'latest',
      { serverId, from, to },
    ],

    queryFn: async () => {
      const params = new URLSearchParams()
      if (from) params.append('from', from)
      if (to) params.append('to', to)

      const response = await apiClient.get<{ data: Metric[] }>(
        `/monitoring/servers/${serverId}/latest-metrics?${params.toString()}`
      )
      return response.data
    },
    enabled: !!serverId,
  })
}

export function useMetricNames(
  serverId: number,
  from?: string,
  to?: string
) {
  return useQuery({
    queryKey: [
      'monitoring',
      'metrics',
      'names',
      { serverId, from, to },
    ],

    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('server_id', serverId.toString())
      if (from) params.append('from', from)
      if (to) params.append('to', to)

      const response = await apiClient.get<{ data: string[] }>(
        `/monitoring/metrics/names?${params.toString()}`
      )
      return response.data
    },
    enabled: !!serverId,
  })
}

export function useTableCountData(serverIds: number[]) {
  return useQueries({
    queries: serverIds.map(sid => ({
      queryKey: ['monitoring', 'logs', 'latest-per-check', { serverId: sid, checkId: 10 }],
      queryFn: async () => {
        const response = await apiClient.get<{ data: LatestPerCheckRow[] }>(
          `/monitoring/logs/latest-per-check?server_id=${sid}&check_id=10`
        )
        return response.data.data
      },
      staleTime: 60_000,
    })),
    combine: (results) => {
      const allData = results.flatMap(r => r.data ?? [])
      return {
        data: { data: allData },
        isLoading: serverIds.length > 0 && results.some(r => r.isLoading),
        isRefetching: results.some(r => r.isRefetching),
        error: results.find(r => r.error)?.error ?? null,
        refetch: () => Promise.all(results.map(r => r.refetch())),
      }
    },
  })
}

export interface TableCountHistoryPoint {
  collected_at: string
  record_count: number | null
  status: string
}

export function useTableCountHistory(
  serverId: number,
  tableName: string,
  enabled = true
) {
  return useQuery({
    queryKey: ['monitoring', 'table-count-history', { serverId, tableName }],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('server_id', serverId.toString())
      params.append('table_name', tableName)
      const response = await apiClient.get<{ data: TableCountHistoryPoint[] }>(
        `/monitoring/logs/table-count-history?${params.toString()}`
      )
      return response.data.data
    },
    enabled: enabled && !!serverId && !!tableName,
  })
}

export interface PartitionCountResult {
  row_count: number
  rows: Record<string, any>[]
}

export function usePartitionCount(
  serverId: number | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: ['monitoring', 'partition-count', { serverId }],
    queryFn: async () => {
      const response = await apiClient.get<{ data: PartitionCountResult }>(
        `/monitoring/partition-count/${serverId}`
      )
      return response.data.data
    },
    enabled: enabled && !!serverId,
    refetchInterval: 60_000,
  })
}