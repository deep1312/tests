import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

export interface Threshold {
  threshold_id: number
  check_id: number
  metric_name: string
  comparison_operator: '>' | '<' | '=' | '!=' | '~'
  warning_value?: number
  critical_value?: number
  server_id?: number
  is_active: boolean
  created_at: string
  updated_at: string
  version: number
}

export interface ThresholdListResponse {
  data: Threshold[]
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
 * Fetch list of thresholds with optional filters and pagination
 * Validates: Requirements 3.6, 3.9
 */
export function useThresholds(
  checkId?: number,
  serverId?: number,
  limit = 50,
  offset = 0
) {
  return useQuery({
    queryKey: ['thresholds', { checkId, serverId, limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (checkId) params.append('check_id', checkId.toString())
      if (serverId) params.append('server_id', serverId.toString())
      params.append('limit', limit.toString())
      params.append('offset', offset.toString())

      const response = await apiClient.get<ThresholdListResponse>(
        `/thresholds?${params}`
      )
      return response.data
    },
  })
}

/**
 * Fetch a single threshold by ID
 */
export function useThreshold(thresholdId: number) {
  return useQuery({
    queryKey: ['thresholds', thresholdId],
    queryFn: async () => {
      const response = await apiClient.get<{ data: Threshold }>(
        `/thresholds/${thresholdId}`
      )
      return response.data.data
    },
    enabled: !!thresholdId,
  })
}

/**
 * Create a new threshold
 */
export function useCreateThreshold() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<Threshold>) => {
      const response = await apiClient.post<{ data: Threshold }>(
        '/thresholds',
        data
      )
      return response.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thresholds'] })
    },
  })
}

/**
 * Update an existing threshold
 */
export function useUpdateThreshold() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      thresholdId,
      data,
    }: {
      thresholdId: number
      data: Partial<Threshold>
    }) => {
      const response = await apiClient.put<{ data: Threshold }>(
        `/thresholds/${thresholdId}`,
        data
      )
      return response.data.data
    },
    onSuccess: (_, { thresholdId }) => {
      queryClient.invalidateQueries({ queryKey: ['thresholds'] })
      queryClient.invalidateQueries({ queryKey: ['thresholds', thresholdId] })
    },
  })
}

/**
 * Delete a threshold (hard delete)
 */
export function useDeleteThreshold() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (thresholdId: number) => {
      await apiClient.delete(`/thresholds/${thresholdId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thresholds'] })
    },
  })
}
