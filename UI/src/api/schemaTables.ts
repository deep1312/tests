import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

export interface SchemaTable {
  id: number
  schema_name: string
  table_name: string
  display_name?: string
  is_active: boolean
  created_on: string
}

export interface SchemaTableListResponse {
  data: SchemaTable[]
  meta: {
    pagination: { total: number; limit: number; offset: number; has_more: boolean }
  }
}

export function useSchemaTables() {
  return useQuery({
    queryKey: ['schema-tables'],
    queryFn: async () => {
      const response = await apiClient.get<SchemaTableListResponse>('/schema-tables?limit=1000')
      return response.data.data
    },
  })
}

export function useCreateSchemaTable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { schema_name: string; table_name: string }) => {
      const response = await apiClient.post<{ data: SchemaTable }>('/schema-tables', data)
      return response.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schema-tables'] })
    },
  })
}

export function useUpdateSchemaTable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number; schema_name?: string; table_name?: string }) => {
      const response = await apiClient.put<{ data: SchemaTable }>(`/schema-tables/${id}`, data)
      return response.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schema-tables'] })
    },
  })
}

export function useDeleteSchemaTable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/schema-tables/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schema-tables'] })
    },
  })
}
