import { useQuery } from '@tanstack/react-query'
import apiClient from './client'
// This import will now work once you export it from monitoring.ts
import { MetricAggregatePoint } from './monitoring'

/* =========================================================
    TYPES
========================================================= */

export interface TopFailingCheck {
  check_id: number
  check_name: string
  failure_count: number
}

export interface DashboardServerSummary {
  server_id: number
  server_label: string
  env_type?: string
  server_role?: string
  last_heartbeat?: string
  open_incident_count: number
  unack_alert_count: number
  latest_run_status?: 'SUCCESS' | 'FAILED' | 'TIMEOUT'
  health_trend: 'IMPROVING' | 'DEGRADING' | 'STABLE'
  collector_state: 'ACTIVE' | 'STALE'
  retention_metrics_days: number
  retention_logs_days: number
}

export interface DashboardSummaryResponse {
  data: {
    servers: DashboardServerSummary[]
    top_failing_checks: TopFailingCheck[]
  }
}

export interface ServerHealthRow {
  check_id: number
  check_name: string
  latest_run_status?: 'SUCCESS' | 'FAILED' | 'TIMEOUT'
  execution_time_ms?: number
  last_run_at?: string
}

export interface ServerHealthResponse {
  data: ServerHealthRow[]
}

export interface MetricsChartResponse {
  data: MetricAggregatePoint[]
}

/* =========================================================
    HOOKS
========================================================= */

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const response = await apiClient.get<DashboardSummaryResponse>('/dashboard/summary')
      return response.data
    },
    refetchInterval: 30000,
  })
}

export function useServerHealth(serverId: number, n = 20) {
  return useQuery({
    queryKey: ['dashboard', 'servers', serverId, 'health', { n }],
    queryFn: async () => {
      const response = await apiClient.get<ServerHealthResponse>(
        `/dashboard/servers/${serverId}/health?n=${n}`
      )
      return response.data
    },
    enabled: !!serverId,
  })
}

export function useMetricsChart(
  serverId: number,
  metricName: string,
  bucketInterval: string,
  from: string,
  to: string
) {
  return useQuery({
    queryKey: ['dashboard', 'metrics', 'chart', { serverId, metricName, bucketInterval, from, to }],
    queryFn: async () => {
      const params = new URLSearchParams({
        server_id: serverId.toString(),
        metric_name: metricName,
        bucket_interval: bucketInterval,
        from,
        to
      })
      const response = await apiClient.get<MetricsChartResponse>(`/dashboard/metrics/chart?${params}`)
      return response.data
    },
    enabled: !!serverId && !!metricName && !!from && !!to,
  })
}