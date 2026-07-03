import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

export interface Server {
  server_id: number;
  server_label: string;
  server_ip: string;
  port: number;
  db_name: string;
  username: string;
  server_role?: string;
  env_type?: string;
  ssl_mode: 'disable' | 'allow' | 'prefer' | 'require' | 'verify-ca' | 'verify-full';
  retention_metrics_days: number;
  retention_logs_days: number;
  retention_runs_days: number;
  compression_days: number;
  tags: Record<string, any>;
  is_active: boolean;
  is_di_server: boolean;
  last_heartbeat?: string;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface ServerListResponse {
  data: Server[];
  meta: {
    pagination: {
      total: number;
      limit: number;
      offset: number;
      has_more: boolean;
    };
  };
}

export function useServers(envType?: string, isActive?: boolean, isDiServer?: boolean, limit = 50, offset = 0) {
  return useQuery({
    queryKey: ['servers', { envType, isActive, isDiServer, limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (envType) params.append('env_type', envType);
      if (isActive !== undefined) params.append('is_active', isActive.toString());
      if (isDiServer !== undefined) params.append('is_di_server', isDiServer.toString());
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());
      const response = await apiClient.get<ServerListResponse>(`/servers?${params}`);
      return {
        ...response.data,
        data: response.data.data.map(s => ({
          ...s,
          tags: typeof s.tags === 'string' ? JSON.parse(s.tags) : (s.tags || {})
        }))
      };
    },
  });
}

export function useCreateServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rawData: any) => {
      // Mapping and Casting to match Pydantic ServerCreateRequest
      const payload = {
        server_label: rawData.server_label,
        server_ip: rawData.server_ip,
        port: parseInt(rawData.port || "5432", 10),
        db_name: rawData.db_name,
        username: rawData.username,
        password: rawData.password,
        server_role: rawData.server_role || null,
        env_type: rawData.env_type || null,
        ssl_mode: rawData.ssl_mode || "prefer",
        retention_metrics_days: parseInt(rawData.retention_metrics_days || "365", 10),
        retention_logs_days: parseInt(rawData.retention_logs_days || "30", 10),
        retention_runs_days: parseInt(rawData.retention_runs_days || "7", 10),
        compression_days: parseInt(rawData.compression_days || "7", 10),
        tags: (rawData.tags && typeof rawData.tags === 'object') ? rawData.tags : {},
        is_active: rawData.is_active !== undefined ? Boolean(rawData.is_active) : true,
        is_di_server: rawData.is_di_server !== undefined ? Boolean(rawData.is_di_server) : false,
      };

      // Debugging: View this in Browser Console to see why 422 happens
      console.log("POST Payload:", payload);

      // Final Logic Check for Req 1.7
      if (payload.retention_metrics_days < payload.retention_logs_days) {
        throw new Error("Metrics retention must be >= Logs retention");
      }

      const response = await apiClient.post<{ data: Server }>('/servers', payload);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });
}

export function useUpdateServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ serverId, data }: { serverId: number; data: any }) => {
      const payload = { ...data };
      if (payload.port) payload.port = parseInt(payload.port, 10);
      if (payload.version) payload.version = parseInt(payload.version, 10);
      const response = await apiClient.put<{ data: Server }>(`/servers/${serverId}`, payload);
      return response.data.data;
    },
    onSuccess: (_, { serverId }) => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['servers', serverId] });
    },
  });
}

export function useDeactivateServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (serverId: number) => {
      const response = await apiClient.patch<{ data: Server }>(`/servers/${serverId}/deactivate`, {});
      return response.data.data;
    },
    onSuccess: (_, serverId) => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['servers', serverId] });
    },
  });
}

export function useActivateServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (serverId: number) => {
      const response = await apiClient.patch<{ data: Server }>(`/servers/${serverId}/activate`, {});
      return response.data.data;
    },
    onSuccess: (_, serverId) => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['servers', serverId] });
    },
  });
}

export function useDeleteServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (serverId: number) => {
      await apiClient.delete(`/servers/${serverId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });
}