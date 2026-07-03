import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

export interface Alert {
  alert_id: number
  triggered_at: string
  incident_id?: number
  server_id: number
  check_id: number
  metric_name: string
  observed_value: number
  status: 'WARNING' | 'CRITICAL'
  acknowledged_at?: string
}

export interface AlertListResponse {
  data: Alert[]
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
 * Fetch list of alerts with optional filters and pagination
 * Validates: Requirements 7.1, 7.4, 7.7
 */
export function useAlerts(
  serverId?: number,
  checkId?: number,
  status?: 'WARNING' | 'CRITICAL',
  ackState?: 'unacknowledged' | 'acknowledged' | 'all',
  from?: string,
  to?: string,
  limit = 50,
  offset = 0
) {
  return useQuery({
    queryKey: [
      'alerts',
      { serverId, checkId, status, ackState, from, to, limit, offset },
    ],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (serverId) params.append('server_id', serverId.toString())
      if (checkId) params.append('check_id', checkId.toString())
      if (status) params.append('status', status)
      if (ackState) params.append('ack_state', ackState)
      if (from) params.append('from', from)
      if (to) params.append('to', to)
      params.append('limit', limit.toString())
      params.append('offset', offset.toString())

      const response = await apiClient.get<AlertListResponse>(`/alerts?${params}`)
      return response.data
    },
  })
}

/**
 * Acknowledge an alert
 * Validates: Requirements 7.8, 7.9
 */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      alertId,
      triggeredAt,
    }: {
      alertId: number
      triggeredAt: string
    }) => {
      const response = await apiClient.post<{ data: Alert }>(
        `/alerts/${alertId}/acknowledge`,
        { triggered_at: triggeredAt }
      )
      return response.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })
}
