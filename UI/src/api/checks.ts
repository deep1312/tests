import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

export interface Check {
  check_id: number
  check_code: string
  category: string
  check_name: string
  query_text: string
  timeout_ms?: number
  default_frequency_sec?: number
  is_active: boolean
  created_at: string
  updated_at: string
  version: number
}

export interface Mapping {
  mapping_id: number
  server_id: number
  check_id: number
  custom_frequency_sec?: number | null
  is_enabled: boolean
  consecutive_failures: number
  backoff_until?: string
  created_at: string
  updated_at: string
}

export interface CheckHealthSummary {
  server_id: number
  check_id: number
  last_success_at?: string
  consecutive_failures: number
  failure_rate_pct: number
  health_state: 'HEALTHY' | 'FLAKY' | 'FAILING'
}

export interface CheckListResponse {
  data: Check[]
  meta: {
    pagination: {
      total: number
      limit: number
      offset: number
      has_more: boolean
    }
  }
}

export interface MappingListResponse {
  data: Mapping[]
  meta: {
    pagination: {
      total: number
      limit: number
      offset: number
      has_more: boolean
    }
  }
}

export interface HealthSummaryResponse {
  data: CheckHealthSummary[]
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
 * Fetch list of checks with optional filters and pagination
 * Validates: Requirements 2.7, 2.9
 */
export function useChecks(
  category?: string,
  isActive?: boolean,
  limit = 50,
  offset = 0
) {
  return useQuery({
    queryKey: ['checks', { category, isActive, limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (category) params.append('category', category)
      if (isActive !== undefined) params.append('is_active', isActive.toString())
      params.append('limit', limit.toString())
      params.append('offset', offset.toString())

      const response = await apiClient.get<CheckListResponse>(`/checks?${params}`)
      return response.data
    },
  })
}

/**
 * Fetch a single check by ID
 */
export function useCheck(checkId: number) {
  return useQuery({
    queryKey: ['checks', checkId],
    queryFn: async () => {
      const response = await apiClient.get<{ data: Check }>(`/checks/${checkId}`)
      return response.data.data
    },
    enabled: !!checkId,
  })
}

/**
 * Create a new check
 */
export function useCreateCheck() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<Check>) => {
      const response = await apiClient.post<{ data: Check }>('/checks', data)
      return response.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checks'] })
    },
  })
}

/**
 * Update an existing check
 */
export function useUpdateCheck() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      checkId,
      data,
    }: {
      checkId: number
      data: Partial<Check>
    }) => {
      const response = await apiClient.put<{ data: Check }>(
        `/checks/${checkId}`,
        data
      )
      return response.data.data
    },
    onSuccess: (_, { checkId }) => {
      queryClient.invalidateQueries({ queryKey: ['checks'] })
      queryClient.invalidateQueries({ queryKey: ['checks', checkId] })
    },
  })
}

/**
 * Delete a check (hard delete)
 */
export function useDeleteCheck() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (checkId: number) => {
      await apiClient.delete(`/checks/${checkId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checks'] })
    },
  })
}

/**
 * Fetch list of mappings with optional filters and pagination
 * Validates: Requirements 2.8, 2.9
 */
export function useMappings(
  serverId?: number,
  isEnabled?: boolean,
  limit = 50,
  offset = 0,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['mappings', { serverId, isEnabled, limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (serverId) params.append('server_id', serverId.toString())
      if (isEnabled !== undefined) params.append('is_enabled', isEnabled.toString())
      params.append('limit', limit.toString())
      params.append('offset', offset.toString())

      const response = await apiClient.get<MappingListResponse>(`/mappings?${params}`)
      return response.data
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!serverId,
  })
}

/**
 * Create a new mapping
 */
export function useCreateMapping() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<Mapping>) => {
      const response = await apiClient.post<{ data: Mapping }>('/mappings', data)
      return response.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mappings'] })
    },
  })
}

/**
 * Update an existing mapping
 */
export function useUpdateMapping() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      mappingId,
      data,
    }: {
      mappingId: number
      data: Partial<Mapping>
    }) => {
      const response = await apiClient.put<{ data: Mapping }>(
        `/mappings/${mappingId}`,
        data
      )
      return response.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mappings'] })
    },
  })
}

/**
 * Delete a mapping
 */
export function useDeleteMapping() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (mappingId: number) => {
      await apiClient.delete(`/mappings/${mappingId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mappings'] })
    },
  })
}

/**
 * Fetch check health summary with optional filters
 * Validates: Requirements 4a.1, 4a.4
 */
export function useCheckHealth(
  serverId?: number,
  healthState?: 'HEALTHY' | 'FLAKY' | 'FAILING',
  limit = 50,
  offset = 0
) {
  return useQuery({
    queryKey: ['checks', 'health', { serverId, healthState, limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (serverId) params.append('server_id', serverId.toString())
      if (healthState) params.append('health_state', healthState)
      params.append('limit', limit.toString())
      params.append('offset', offset.toString())

      const response = await apiClient.get<HealthSummaryResponse>(
        `/checks/health?${params}`
      )
      return response.data
    },
  })
}
