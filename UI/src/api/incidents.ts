import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'
import { Alert } from './alerts'

export interface Incident {
  incident_id: number
  server_id: number
  check_id: number
  status: 'OPEN' | 'RESOLVED'
  started_at: string
  ended_at?: string
  root_cause?: string
  duration_seconds?: number
  first_alert_at?: string
  last_alert_at?: string
}

export interface IncidentDetail extends Incident {
  alerts: Alert[]
}

export interface IncidentListResponse {
  data: Incident[]
  meta: {
    pagination: {
      total: number
      limit: number
      offset: number
      has_more: boolean
    }
  }
}

/**
 * Fetch list of incidents with optional filters and pagination
 * Validates: Requirements 8.1, 8.7
 */
export function useIncidents(
  serverId?: number,
  checkId?: number,
  status?: 'OPEN' | 'RESOLVED',
  limit = 50,
  offset = 0
) {
  return useQuery({
    queryKey: ['incidents', { serverId, checkId, status, limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (serverId) params.append('server_id', serverId.toString())
      if (checkId) params.append('check_id', checkId.toString())
      if (status) params.append('status', status)
      params.append('limit', limit.toString())
      params.append('offset', offset.toString())

      const response = await apiClient.get<IncidentListResponse>(
        `/incidents?${params}`
      )
      return response.data
    },
  })
}

/**
 * Fetch a single incident with associated alerts
 * Validates: Requirements 8.4, 8.11
 */
export function useIncident(incidentId: number) {
  return useQuery({
    queryKey: ['incidents', incidentId],
    queryFn: async () => {
      const response = await apiClient.get<{ data: IncidentDetail }>(
        `/incidents/${incidentId}`
      )
      return response.data.data
    },
    enabled: !!incidentId,
  })
}

/**
 * Update incident root cause
 * Validates: Requirements 8.10
 */
export function usePatchIncidentRootCause() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      incidentId,
      rootCause,
    }: {
      incidentId: number
      rootCause: string
    }) => {
      const response = await apiClient.patch<{ data: Incident }>(
        `/incidents/${incidentId}`,
        { root_cause: rootCause }
      )
      return response.data.data
    },
    onSuccess: (_, { incidentId }) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      queryClient.invalidateQueries({ queryKey: ['incidents', incidentId] })
    },
  })
}
