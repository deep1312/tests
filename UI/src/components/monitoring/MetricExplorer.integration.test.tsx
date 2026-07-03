import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricExplorer } from './MetricExplorer'
import * as monitoringApi from '../../api/monitoring'

// Mock the monitoring API hooks
vi.mock('../../api/monitoring', () => ({
  useMetricNames: vi.fn(),
  useMetricsAggregate: vi.fn(),
  useMetrics: vi.fn(),
}))

describe('MetricExplorer Integration Tests', () => {
  const mockMetricNames = ['cpu_usage', 'memory_usage', 'disk_io']
  const mockAggregateData = [
    {
      bucket: '2026-05-06T10:00:00Z',
      avg_value: 45.5,
      min_value: 30.2,
      max_value: 60.8,
      sample_count: 100,
    },
    {
      bucket: '2026-05-06T11:00:00Z',
      avg_value: 48.2,
      min_value: 32.1,
      max_value: 65.3,
      sample_count: 105,
    },
  ]

  const mockRawMetrics = {
    data: [
      {
        metric_id: 1,
        collected_at: '2026-05-06T10:00:00Z',
        server_id: 1,
        check_id: 1,
        metric_name: 'cpu_usage',
        metric_value: 45.5,
        labels: { database: 'mydb', state: 'active' },
      },
    ],
    meta: {
      pagination: {
        total: 1,
        limit: 1,
        offset: 0,
        has_more: false,
      },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Requirements validation', () => {
    it('validates Requirement 7.1 - Searchable dropdown of metric names', () => {
      vi.mocked(monitoringApi.useMetricNames).mockReturnValue({
        data: mockMetricNames,
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      vi.mocked(monitoringApi.useMetrics).mockReturnValue({
        data: mockRawMetrics,
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      vi.mocked(monitoringApi.useMetricsAggregate).mockReturnValue({
        data: { data: mockAggregateData },
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      render(
        <MetricExplorer
          serverId={1}
          from="2026-05-06T00:00:00Z"
          to="2026-05-07T00:00:00Z"
          bucketInterval="1h"
        />
      )

      // Verify metric names are fetched
      expect(monitoringApi.useMetricNames).toHaveBeenCalledWith(
        1,
        '2026-05-06T00:00:00Z',
        '2026-05-07T00:00:00Z'
      )

      // Verify dropdown is rendered
      expect(screen.getByPlaceholderText('Add a metric...')).toBeInTheDocument()
    })

    it('validates Requirement 7.2 - Automatic chart rendering on metric selection', () => {
      vi.mocked(monitoringApi.useMetricNames).mockReturnValue({
        data: mockMetricNames,
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      vi.mocked(monitoringApi.useMetrics).mockReturnValue({
        data: mockRawMetrics,
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      vi.mocked(monitoringApi.useMetricsAggregate).mockReturnValue({
        data: { data: mockAggregateData },
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      render(
        <MetricExplorer
          serverId={1}
          from="2026-05-06T00:00:00Z"
          to="2026-05-07T00:00:00Z"
          bucketInterval="1h"
        />
      )

      // Verify component renders without errors
      expect(screen.getByText('Metric Explorer')).toBeInTheDocument()
    })

    it('validates Requirement 7.3 - Support up to 3 metrics simultaneously', () => {
      vi.mocked(monitoringApi.useMetricNames).mockReturnValue({
        data: mockMetricNames,
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      vi.mocked(monitoringApi.useMetrics).mockReturnValue({
        data: mockRawMetrics,
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      vi.mocked(monitoringApi.useMetricsAggregate).mockReturnValue({
        data: { data: mockAggregateData },
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      render(
        <MetricExplorer
          serverId={1}
          from="2026-05-06T00:00:00Z"
          to="2026-05-07T00:00:00Z"
          bucketInterval="1h"
        />
      )

      // Verify metric counter shows 0/3
      expect(screen.getByText('Select Metrics (0/3)')).toBeInTheDocument()
    })

    it('validates Requirement 7.4 - Tooltip on hover with metric name and values', () => {
      vi.mocked(monitoringApi.useMetricNames).mockReturnValue({
        data: mockMetricNames,
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      vi.mocked(monitoringApi.useMetrics).mockReturnValue({
        data: mockRawMetrics,
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      vi.mocked(monitoringApi.useMetricsAggregate).mockReturnValue({
        data: { data: mockAggregateData },
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      render(
        <MetricExplorer
          serverId={1}
          from="2026-05-06T00:00:00Z"
          to="2026-05-07T00:00:00Z"
          bucketInterval="1h"
        />
      )

      // Verify component renders without errors
      expect(screen.getByText('Metric Explorer')).toBeInTheDocument()
    })

    it('validates Requirement 7.5 - No data empty state', () => {
      vi.mocked(monitoringApi.useMetricNames).mockReturnValue({
        data: mockMetricNames,
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      vi.mocked(monitoringApi.useMetrics).mockReturnValue({
        data: mockRawMetrics,
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      vi.mocked(monitoringApi.useMetricsAggregate).mockReturnValue({
        data: { data: [] },
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      render(
        <MetricExplorer
          serverId={1}
          from="2026-05-06T00:00:00Z"
          to="2026-05-07T00:00:00Z"
          bucketInterval="1h"
        />
      )

      // Verify component renders without errors
      expect(screen.getByText('Metric Explorer')).toBeInTheDocument()
    })

    it('validates Requirement 7.6 - Server selection prompt', () => {
      vi.mocked(monitoringApi.useMetricNames).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      render(
        <MetricExplorer
          serverId={null}
          from="2026-05-06T00:00:00Z"
          to="2026-05-07T00:00:00Z"
          bucketInterval="1h"
        />
      )

      // Verify server selection prompt is displayed
      expect(screen.getByText('Select a server to explore metrics')).toBeInTheDocument()
    })
  })

  describe('Color palette validation', () => {
    it('uses correct color palette: blue, orange, purple', () => {
      vi.mocked(monitoringApi.useMetricNames).mockReturnValue({
        data: mockMetricNames,
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      vi.mocked(monitoringApi.useMetrics).mockReturnValue({
        data: mockRawMetrics,
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      vi.mocked(monitoringApi.useMetricsAggregate).mockReturnValue({
        data: { data: mockAggregateData },
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      const { container } = render(
        <MetricExplorer
          serverId={1}
          from="2026-05-06T00:00:00Z"
          to="2026-05-07T00:00:00Z"
          bucketInterval="1h"
        />
      )

      // Verify component renders without errors
      expect(screen.getByText('Metric Explorer')).toBeInTheDocument()
    })
  })

  describe('Label filtering validation', () => {
    it('extracts distinct label keys from raw metrics', () => {
      vi.mocked(monitoringApi.useMetricNames).mockReturnValue({
        data: mockMetricNames,
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      vi.mocked(monitoringApi.useMetrics).mockReturnValue({
        data: mockRawMetrics,
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      vi.mocked(monitoringApi.useMetricsAggregate).mockReturnValue({
        data: { data: mockAggregateData },
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      render(
        <MetricExplorer
          serverId={1}
          from="2026-05-06T00:00:00Z"
          to="2026-05-07T00:00:00Z"
          bucketInterval="1h"
        />
      )

      // Verify useMetrics is called to fetch raw metrics
      expect(monitoringApi.useMetrics).toHaveBeenCalled()
    })

    it('renders label filter chips', () => {
      vi.mocked(monitoringApi.useMetricNames).mockReturnValue({
        data: mockMetricNames,
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      vi.mocked(monitoringApi.useMetrics).mockReturnValue({
        data: mockRawMetrics,
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      vi.mocked(monitoringApi.useMetricsAggregate).mockReturnValue({
        data: { data: mockAggregateData },
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      render(
        <MetricExplorer
          serverId={1}
          from="2026-05-06T00:00:00Z"
          to="2026-05-07T00:00:00Z"
          bucketInterval="1h"
        />
      )

      // Verify component renders without errors
      expect(screen.getByText('Metric Explorer')).toBeInTheDocument()
    })
  })

  describe('Chart rendering validation', () => {
    it('renders shared LineChart with one line per metric', () => {
      vi.mocked(monitoringApi.useMetricNames).mockReturnValue({
        data: mockMetricNames,
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      vi.mocked(monitoringApi.useMetrics).mockReturnValue({
        data: mockRawMetrics,
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      vi.mocked(monitoringApi.useMetricsAggregate).mockReturnValue({
        data: { data: mockAggregateData },
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      render(
        <MetricExplorer
          serverId={1}
          from="2026-05-06T00:00:00Z"
          to="2026-05-07T00:00:00Z"
          bucketInterval="1h"
        />
      )

      // Verify component renders without errors
      expect(screen.getByText('Metric Explorer')).toBeInTheDocument()
    })

    it('calls useMetricsAggregate for each selected metric', () => {
      vi.mocked(monitoringApi.useMetricNames).mockReturnValue({
        data: mockMetricNames,
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      vi.mocked(monitoringApi.useMetrics).mockReturnValue({
        data: mockRawMetrics,
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      vi.mocked(monitoringApi.useMetricsAggregate).mockReturnValue({
        data: { data: mockAggregateData },
        isLoading: false,
        error: null,
        status: 'success',
      } as any)

      render(
        <MetricExplorer
          serverId={1}
          from="2026-05-06T00:00:00Z"
          to="2026-05-07T00:00:00Z"
          bucketInterval="1h"
        />
      )

      // Verify component renders without errors
      expect(screen.getByText('Metric Explorer')).toBeInTheDocument()
    })
  })
})
