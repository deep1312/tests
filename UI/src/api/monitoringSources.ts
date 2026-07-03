import { useQuery } from '@tanstack/react-query'
import apiClient from './client'

export interface MonitoringSource {
  di_name: string
  latest_pulltimestamp: string | null
  frequency: string
  status: string
  server_id: number
  server_label: string
}

export interface MonitoringSourcesResponse {
  data: MonitoringSource[]
}

export interface MonitoringSourceDetail {
  pulltimestamp?: string
  record_count?: number
  [key: string]: unknown
}

export function useMonitoringSources(serverIds: number[] = [16]) {
  return useQuery({
    queryKey: ['dashboard', 'sources', serverIds],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (serverIds.length > 0) {
        params.append('server_ids', serverIds.join(','))
      }
      const response = await apiClient.get<MonitoringSourcesResponse>(
        `/dashboard/sources?${params}`
      )
      return response.data
    },
    refetchInterval: 30000,
  })
}

export function useMonitoringSourceDetails(diName: string | null, serverId: number = 16) {
  return useQuery({
    queryKey: ['dashboard', 'sources', diName, serverId],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('server_id', serverId.toString())
      const response = await apiClient.get<{ data: MonitoringSourceDetail[] }>(
        `/dashboard/sources/${encodeURIComponent(diName!)}?${params}`
      )
      return response.data
    },
    enabled: !!diName,
  })
}

export interface MultiServerDetailRecord {
  server_id: number
  server_label: string
  records: MonitoringSourceDetail[]
}

/* =============================================================================
   SPEED MONITORING (monitoring_dashboard.speed_monitoring_summary / speed_source_details)
============================================================================= */

export interface SpeedMonitoringSource {
  di_name: string
  latest_pulltimestamp: string | null
  frequency: string
  status: string
  server_id: number
  server_label: string
}

export interface SpeedMonitoringSourcesResponse {
  data: SpeedMonitoringSource[]
}

export interface SpeedMonitoringSourceDetail {
  pulltime?: string
  record_count?: number
  [key: string]: unknown
}

export function useSpeedMonitoringSources(serverIds: number[] = [16], enabled = true) {
  return useQuery({
    queryKey: ['dashboard', 'speed-sources', serverIds],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (serverIds.length > 0) {
        params.append('server_ids', serverIds.join(','))
      }
      const response = await apiClient.get<SpeedMonitoringSourcesResponse>(
        `/dashboard/speed-sources?${params}`
      )
      return response.data
    },
    refetchInterval: enabled ? 30000 : undefined,
    enabled,
  })
}

export function useSpeedMonitoringSourceDetails(diName: string | null, serverId: number = 16) {
  return useQuery({
    queryKey: ['dashboard', 'speed-sources', diName, serverId],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('server_id', serverId.toString())
      const response = await apiClient.get<{ data: SpeedMonitoringSourceDetail[] }>(
        `/dashboard/speed-sources/${encodeURIComponent(diName!)}?${params}`
      )
      return response.data
    },
    enabled: !!diName,
  })
}

export function useMultiServerSpeedSourceDetails(diName: string | null, serverIds: number[]) {
  return useQuery({
    queryKey: ['dashboard', 'speed-sources', diName, 'multi', ...serverIds],
    queryFn: async () => {
      const results = await Promise.all(
        serverIds.map(async (sid) => {
          const params = new URLSearchParams()
          params.append('server_id', sid.toString())
          const response = await apiClient.get<{ data: SpeedMonitoringSourceDetail[] }>(
            `/dashboard/speed-sources/${encodeURIComponent(diName!)}?${params}`
          )
          return response.data.data
        })
      )
      return results
    },
    enabled: !!diName && serverIds.length > 0,
  })
}

export function useMultiServerSourceDetails(diName: string | null, serverIds: number[]) {
  return useQuery({
    queryKey: ['dashboard', 'sources', diName, 'multi', ...serverIds],
    queryFn: async () => {
      const results = await Promise.all(
        serverIds.map(async (sid) => {
          const params = new URLSearchParams()
          params.append('server_id', sid.toString())
          const response = await apiClient.get<{ data: MonitoringSourceDetail[] }>(
            `/dashboard/sources/${encodeURIComponent(diName!)}?${params}`
          )
          return response.data.data
        })
      )
      return results
    },
    enabled: !!diName && serverIds.length > 0,
  })
}
