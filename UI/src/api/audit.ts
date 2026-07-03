import { useQuery } from '@tanstack/react-query'
import apiClient from './client'

export interface AuditLogEntry {
  log_id: number
  user_id: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'CREDENTIAL_ROTATION'
  resource_type: string
  resource_id: string
  changed_at: string
  payload: Record<string, any>
}

export interface AuditLogListResponse {
  data: AuditLogEntry[]
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
 * Fetch audit log entries with optional filters and pagination
 * Validates: Requirements 18.4, 18.5, 18.6
 */
export function useAuditLogs(
  resourceType?: string,
  resourceId?: string,
  userId?: string,
  from?: string,
  to?: string,
  limit = 50,
  offset = 0
) {
  return useQuery({
    queryKey: [
      'audit-logs',
      { resourceType, resourceId, userId, from, to, limit, offset },
    ],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (resourceType) params.append('resource_type', resourceType)
      if (resourceId) params.append('resource_id', resourceId)
      if (userId) params.append('user_id', userId)
      if (from) params.append('from', from)
      if (to) params.append('to', to)
      params.append('limit', limit.toString())
      params.append('offset', offset.toString())

      const response = await apiClient.get<AuditLogListResponse>(
        `/audit-logs?${params}`
      )
      return response.data
    },
  })
}
