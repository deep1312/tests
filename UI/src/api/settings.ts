import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export interface LegendConfig {
  id: number
  page_name: string
  legend_name: string
  is_enabled: boolean
  admin_only: boolean
}

export const useLegendConfigs = () => {
  return useQuery({
    queryKey: ['legend_configs'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: LegendConfig[] }>('/settings/legends')
      return data.data
    },
  })
}

export const useUpdateLegendConfig = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { page_name: string; legend_name: string; is_enabled: boolean }) => {
      const { data } = await apiClient.post<{ data: LegendConfig }>('/settings/legend', payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legend_configs'] })
    },
  })
}
