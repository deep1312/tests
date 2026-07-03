import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DetailDrawer, DrawerContext } from './DetailDrawer'
import * as monitoringApi from '../../api/monitoring'

// Mock the monitoring API
vi.mock('../../api/monitoring', () => ({
  useCheckRuns: vi.fn(),
}))

describe('DetailDrawer', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  const renderDetailDrawer = (context: DrawerContext | null, onClose = vi.fn()) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <DetailDrawer context={context} onClose={onClose} />
      </QueryClientProvider>
    )
  }

  it('should be hidden when context is null', () => {
    vi.mocked(monitoringApi.useCheckRuns).mockReturnValue({
      data: {
        data: [],
        meta: { pagination: { total: 0, limit: 50, offset: 0, has_more: false } },
      },
      isLoading: false,
      isError: false,
      error: null,
      status: 'success',
      isFetching: false,
      isPending: false,
      isSuccess: true,
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      refetch: vi.fn(),
    } as any)

    renderDetailDrawer(null)
    expect(screen.queryByText('Check Run Details')).not.toBeInTheDocument()
  })

  it('should render when context is provided', () => {
    const context: DrawerContext = { serverId: 1, checkId: 2 }
    vi.mocked(monitoringApi.useCheckRuns).mockReturnValue({
      data: {
        data: [],
        meta: { pagination: { total: 0, limit: 50, offset: 0, has_more: false } },
      },
      isLoading: false,
      isError: false,
      error: null,
      status: 'success',
      isFetching: false,
      isPending: false,
      isSuccess: true,
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      refetch: vi.fn(),
    } as any)

    renderDetailDrawer(context)
    expect(screen.getByText('Check Run Details')).toBeInTheDocument()
  })

  it('should display loading state', () => {
    const context: DrawerContext = { serverId: 1, checkId: 2 }
    vi.mocked(monitoringApi.useCheckRuns).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      status: 'pending',
      isFetching: true,
      isPending: true,
      isSuccess: false,
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      refetch: vi.fn(),
    } as any)

    renderDetailDrawer(context)
    expect(screen.getByText('Loading check runs...')).toBeInTheDocument()
  })

  it('should display check runs in table', () => {
    const context: DrawerContext = { serverId: 1, checkId: 2 }
    const mockRuns = [
      {
        run_id: 1,
        started_at: '2026-05-06T10:00:00Z',
        scheduled_at: '2026-05-06T10:00:00Z',
        ended_at: '2026-05-06T10:00:01Z',
        server_id: 1,
        check_id: 2,
        status: 'SUCCESS' as const,
        execution_time_ms: 100,
        error_message: undefined,
      },
    ]

    vi.mocked(monitoringApi.useCheckRuns).mockReturnValue({
      data: {
        data: mockRuns,
        meta: { pagination: { total: 1, limit: 50, offset: 0, has_more: false } },
      },
      isLoading: false,
      isError: false,
      error: null,
      status: 'success',
      isFetching: false,
      isPending: false,
      isSuccess: true,
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      refetch: vi.fn(),
    } as any)

    renderDetailDrawer(context)
    expect(screen.getByText('SUCCESS')).toBeInTheDocument()
    expect(screen.getByText('100ms')).toBeInTheDocument()
  })

  it('should display pagination info', () => {
    const context: DrawerContext = { serverId: 1, checkId: 2 }
    const mockRuns = Array.from({ length: 50 }, (_, i) => ({
      run_id: i + 1,
      started_at: '2026-05-06T10:00:00Z',
      scheduled_at: '2026-05-06T10:00:00Z',
      ended_at: '2026-05-06T10:00:01Z',
      server_id: 1,
      check_id: 2,
      status: 'SUCCESS' as const,
      execution_time_ms: 100,
      error_message: undefined,
    }))

    vi.mocked(monitoringApi.useCheckRuns).mockReturnValue({
      data: {
        data: mockRuns,
        meta: { pagination: { total: 150, limit: 50, offset: 0, has_more: true } },
      },
      isLoading: false,
      isError: false,
      error: null,
      status: 'success',
      isFetching: false,
      isPending: false,
      isSuccess: true,
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      refetch: vi.fn(),
    } as any)

    renderDetailDrawer(context)
    expect(screen.getByText('Showing 1–50 of 150')).toBeInTheDocument()
  })

  it('should truncate error messages to 120 characters', () => {
    const context: DrawerContext = { serverId: 1, checkId: 2 }
    const longMessage = 'a'.repeat(150)
    const mockRuns = [
      {
        run_id: 1,
        started_at: '2026-05-06T10:00:00Z',
        scheduled_at: '2026-05-06T10:00:00Z',
        ended_at: '2026-05-06T10:00:01Z',
        server_id: 1,
        check_id: 2,
        status: 'FAILED' as const,
        execution_time_ms: 100,
        error_message: longMessage,
      },
    ]

    vi.mocked(monitoringApi.useCheckRuns).mockReturnValue({
      data: {
        data: mockRuns,
        meta: { pagination: { total: 1, limit: 50, offset: 0, has_more: false } },
      },
      isLoading: false,
      isError: false,
      error: null,
      status: 'success',
      isFetching: false,
      isPending: false,
      isSuccess: true,
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      refetch: vi.fn(),
    } as any)

    renderDetailDrawer(context)
    const truncatedText = screen.getByText(/^a+\.\.\.$/)
    expect(truncatedText.textContent).toHaveLength(123) // 120 'a's + '...'
  })

  it('should display status badges with correct colors', () => {
    const context: DrawerContext = { serverId: 1, checkId: 2 }
    const mockRuns = [
      {
        run_id: 1,
        started_at: '2026-05-06T10:00:00Z',
        scheduled_at: '2026-05-06T10:00:00Z',
        ended_at: '2026-05-06T10:00:01Z',
        server_id: 1,
        check_id: 2,
        status: 'SUCCESS' as const,
        execution_time_ms: 100,
        error_message: undefined,
      },
      {
        run_id: 2,
        started_at: '2026-05-06T10:01:00Z',
        scheduled_at: '2026-05-06T10:01:00Z',
        ended_at: '2026-05-06T10:01:01Z',
        server_id: 1,
        check_id: 2,
        status: 'FAILED' as const,
        execution_time_ms: 100,
        error_message: 'Connection timeout',
      },
      {
        run_id: 3,
        started_at: '2026-05-06T10:02:00Z',
        scheduled_at: '2026-05-06T10:02:00Z',
        ended_at: '2026-05-06T10:02:01Z',
        server_id: 1,
        check_id: 2,
        status: 'TIMEOUT' as const,
        execution_time_ms: 100,
        error_message: undefined,
      },
    ]

    vi.mocked(monitoringApi.useCheckRuns).mockReturnValue({
      data: {
        data: mockRuns,
        meta: { pagination: { total: 3, limit: 50, offset: 0, has_more: false } },
      },
      isLoading: false,
      isError: false,
      error: null,
      status: 'success',
      isFetching: false,
      isPending: false,
      isSuccess: true,
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      refetch: vi.fn(),
    } as any)

    renderDetailDrawer(context)
    const badges = screen.getAllByText(/SUCCESS|FAILED|TIMEOUT/)
    expect(badges).toHaveLength(3)
  })

  it('should call onClose when close button is clicked', () => {
    const context: DrawerContext = { serverId: 1, checkId: 2 }
    const onClose = vi.fn()

    vi.mocked(monitoringApi.useCheckRuns).mockReturnValue({
      data: {
        data: [],
        meta: { pagination: { total: 0, limit: 50, offset: 0, has_more: false } },
      },
      isLoading: false,
      isError: false,
      error: null,
      status: 'success',
      isFetching: false,
      isPending: false,
      isSuccess: true,
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      refetch: vi.fn(),
    } as any)

    renderDetailDrawer(context, onClose)
    const closeButton = screen.getByRole('button', { name: '' }) // The X button
    fireEvent.click(closeButton)
    expect(onClose).toHaveBeenCalled()
  })

  it('should display "No data" message when no runs found', () => {
    const context: DrawerContext = { serverId: 1, checkId: 2 }

    vi.mocked(monitoringApi.useCheckRuns).mockReturnValue({
      data: {
        data: [],
        meta: { pagination: { total: 0, limit: 50, offset: 0, has_more: false } },
      },
      isLoading: false,
      isError: false,
      error: null,
      status: 'success',
      isFetching: false,
      isPending: false,
      isSuccess: true,
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      refetch: vi.fn(),
    } as any)

    renderDetailDrawer(context)
    expect(screen.getByText('No check runs found')).toBeInTheDocument()
  })

  it('should disable Download CSV button when no runs', () => {
    const context: DrawerContext = { serverId: 1, checkId: 2 }

    vi.mocked(monitoringApi.useCheckRuns).mockReturnValue({
      data: {
        data: [],
        meta: { pagination: { total: 0, limit: 50, offset: 0, has_more: false } },
      },
      isLoading: false,
      isError: false,
      error: null,
      status: 'success',
      isFetching: false,
      isPending: false,
      isSuccess: true,
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      refetch: vi.fn(),
    } as any)

    renderDetailDrawer(context)
    const downloadButton = screen.getByRole('button', { name: /Download CSV/i })
    expect(downloadButton).toBeDisabled()
  })
})
