import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FilterBar } from './FilterBar'
import { DashboardFilters } from '../../hooks/useDashboardFilters'
import * as serversApi from '../../api/servers'
import * as checksApi from '../../api/checks'

// Mock the API hooks
vi.mock('../../api/servers', () => ({
  useServers: vi.fn(),
}))

vi.mock('../../api/checks', () => ({
  useChecks: vi.fn(),
}))

const mockServers = [
  {
    server_id: 1,
    server_label: 'prod-db-01',
    server_ip: '192.168.1.1',
    port: 5432,
    db_name: 'postgres',
    username: 'admin',
    env_type: 'prod',
    is_active: true,
    retention_metrics_days: 30,
    retention_logs_days: 7,
    retention_runs_days: 30,
    compression_days: 7,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    version: 1,
  },
  {
    server_id: 2,
    server_label: 'staging-db-01',
    server_ip: '192.168.1.2',
    port: 5432,
    db_name: 'postgres',
    username: 'admin',
    env_type: 'staging',
    is_active: true,
    retention_metrics_days: 30,
    retention_logs_days: 7,
    retention_runs_days: 30,
    compression_days: 7,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    version: 1,
  },
]

const mockChecks = [
  {
    check_id: 1,
    check_code: 'conn_usage',
    category: 'PERF',
    check_name: 'Connection Usage',
    query_text: 'SELECT ...',
    timeout_ms: 5000,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    version: 1,
  },
  {
    check_id: 2,
    check_code: 'repl_lag',
    category: 'AVAIL',
    check_name: 'Replication Lag',
    query_text: 'SELECT ...',
    timeout_ms: 5000,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    version: 1,
  },
]

const mockFilters: DashboardFilters = {
  serverId: null,
  checkId: null,
  rangeHours: 24,
  bucketInterval: '1h',
  refreshInterval: 0,
  from: '2024-01-01T00:00:00Z',
  to: '2024-01-02T00:00:00Z',
}

describe('FilterBar', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    vi.mocked(serversApi.useServers).mockReturnValue({
      data: { data: mockServers, meta: { pagination: { total: 2, limit: 50, offset: 0, has_more: false } } },
      isLoading: false,
      isError: false,
      error: null,
      status: 'success',
      fetchStatus: 'idle',
      dataUpdatedAt: Date.now(),
      errorUpdatedAt: 0,
      isFetching: false,
      isRefetching: false,
      isLoadingError: false,
      isPaused: false,
      isPlaceholderData: false,
      isPending: false,
      isRefetchError: false,
      isStale: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any)

    vi.mocked(checksApi.useChecks).mockReturnValue({
      data: { data: mockChecks, meta: { pagination: { total: 2, limit: 50, offset: 0, has_more: false } } },
      isLoading: false,
      isError: false,
      error: null,
      status: 'success',
      fetchStatus: 'idle',
      dataUpdatedAt: Date.now(),
      errorUpdatedAt: 0,
      isFetching: false,
      isRefetching: false,
      isLoadingError: false,
      isPaused: false,
      isPlaceholderData: false,
      isPending: false,
      isRefetchError: false,
      isStale: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any)
  })

  it('renders all filter controls', () => {
    const onChange = vi.fn()

    render(
      <QueryClientProvider client={queryClient}>
        <FilterBar filters={mockFilters} onChange={onChange} />
      </QueryClientProvider>
    )

    expect(screen.getByText('Server:')).toBeInTheDocument()
    expect(screen.getByText('Check:')).toBeInTheDocument()
    expect(screen.getByText('Range:')).toBeInTheDocument()
    expect(screen.getByText('Bucket:')).toBeInTheDocument()
    expect(screen.getByText('Refresh:')).toBeInTheDocument()
  })

  it('renders time range buttons', () => {
    const onChange = vi.fn()

    render(
      <QueryClientProvider client={queryClient}>
        <FilterBar filters={mockFilters} onChange={onChange} />
      </QueryClientProvider>
    )

    expect(screen.getByText('Last 1h')).toBeInTheDocument()
    expect(screen.getByText('Last 6h')).toBeInTheDocument()
    expect(screen.getByText('Last 24h')).toBeInTheDocument()
    expect(screen.getByText('Last 7d')).toBeInTheDocument()
  })

  it('renders bucket interval buttons', () => {
    const onChange = vi.fn()

    render(
      <QueryClientProvider client={queryClient}>
        <FilterBar filters={mockFilters} onChange={onChange} />
      </QueryClientProvider>
    )

    expect(screen.getByText('5m')).toBeInTheDocument()
    expect(screen.getByText('15m')).toBeInTheDocument()
    expect(screen.getByText('1h')).toBeInTheDocument()
    expect(screen.getByText('6h')).toBeInTheDocument()
    expect(screen.getByText('1d')).toBeInTheDocument()
  })

  it('renders refresh interval buttons', () => {
    const onChange = vi.fn()

    render(
      <QueryClientProvider client={queryClient}>
        <FilterBar filters={mockFilters} onChange={onChange} />
      </QueryClientProvider>
    )

    expect(screen.getByText('Off')).toBeInTheDocument()
    expect(screen.getByText('30s')).toBeInTheDocument()
    expect(screen.getByText('1m')).toBeInTheDocument()
    expect(screen.getByText('5m')).toBeInTheDocument()
  })

  it('highlights the selected time range', () => {
    const onChange = vi.fn()
    const filters = { ...mockFilters, rangeHours: 6 }

    render(
      <QueryClientProvider client={queryClient}>
        <FilterBar filters={filters} onChange={onChange} />
      </QueryClientProvider>
    )

    const button = screen.getByText('Last 6h')
    expect(button).toHaveClass('bg-blue-500', 'text-white')
  })

  it('highlights the selected bucket interval', () => {
    const onChange = vi.fn()
    const filters = { ...mockFilters, bucketInterval: '15m' }

    render(
      <QueryClientProvider client={queryClient}>
        <FilterBar filters={filters} onChange={onChange} />
      </QueryClientProvider>
    )

    const button = screen.getByText('15m')
    expect(button).toHaveClass('bg-blue-500', 'text-white')
  })

  it('highlights the auto-suggested default bucket', () => {
    const onChange = vi.fn()
    const filters = { ...mockFilters, rangeHours: 1, bucketInterval: '5m' }

    render(
      <QueryClientProvider client={queryClient}>
        <FilterBar filters={filters} onChange={onChange} />
      </QueryClientProvider>
    )

    // The 5m button should be highlighted as selected
    const button = screen.getByText('5m')
    expect(button).toHaveClass('bg-blue-500', 'text-white')
  })

  it('calls onChange when time range button is clicked', async () => {
    const onChange = vi.fn()

    render(
      <QueryClientProvider client={queryClient}>
        <FilterBar filters={mockFilters} onChange={onChange} />
      </QueryClientProvider>
    )

    const button = screen.getByText('Last 1h')
    fireEvent.click(button)

    expect(onChange).toHaveBeenCalledWith({ rangeHours: 1 })
  })

  it('calls onChange when bucket interval button is clicked', async () => {
    const onChange = vi.fn()

    render(
      <QueryClientProvider client={queryClient}>
        <FilterBar filters={mockFilters} onChange={onChange} />
      </QueryClientProvider>
    )

    const button = screen.getByText('15m')
    fireEvent.click(button)

    expect(onChange).toHaveBeenCalledWith({ bucketInterval: '15m' })
  })

  it('calls onChange when refresh interval button is clicked', async () => {
    const onChange = vi.fn()

    render(
      <QueryClientProvider client={queryClient}>
        <FilterBar filters={mockFilters} onChange={onChange} />
      </QueryClientProvider>
    )

    const button = screen.getByText('30s')
    fireEvent.click(button)

    expect(onChange).toHaveBeenCalledWith({ refreshInterval: 30 })
  })

  it('displays countdown when auto-refresh is active', async () => {
    const onChange = vi.fn()
    const filters = { ...mockFilters, refreshInterval: 60 }

    render(
      <QueryClientProvider client={queryClient}>
        <FilterBar filters={filters} onChange={onChange} />
      </QueryClientProvider>
    )

    // Should show the countdown badge
    await waitFor(() => {
      expect(screen.getByText('↻')).toBeInTheDocument()
    })
  })

  it('highlights the selected refresh interval', () => {
    const onChange = vi.fn()
    const filters = { ...mockFilters, refreshInterval: 60 }

    render(
      <QueryClientProvider client={queryClient}>
        <FilterBar filters={filters} onChange={onChange} />
      </QueryClientProvider>
    )

    // The 1m button should be highlighted
    const buttons = screen.getAllByText(/1m|↻/)
    const oneMinButton = buttons.find(btn => btn.textContent?.includes('↻'))
    expect(oneMinButton?.parentElement).toHaveClass('bg-blue-500', 'text-white')
  })
})
