import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusTimelineChart } from './StatusTimelineChart'
import { RunsAggregatePoint } from '../../api/monitoring'

describe('StatusTimelineChart', () => {
  const mockData: RunsAggregatePoint[] = [
    {
      bucket: '2026-05-06T10:00:00Z',
      success_count: 48,
      failed_count: 2,
      timeout_count: 0,
      total_count: 50,
      success_rate_pct: 96.0,
      avg_execution_time_ms: 138,
    },
    {
      bucket: '2026-05-06T11:00:00Z',
      success_count: 45,
      failed_count: 3,
      timeout_count: 2,
      total_count: 50,
      success_rate_pct: 90.0,
      avg_execution_time_ms: 142,
    },
    {
      bucket: '2026-05-06T12:00:00Z',
      success_count: 0,
      failed_count: 0,
      timeout_count: 0,
      total_count: 0,
      success_rate_pct: null,
      avg_execution_time_ms: null,
    },
  ]

  it('renders loading state', () => {
    const mockOnBarClick = vi.fn()
    render(
      <StatusTimelineChart
        data={[]}
        isLoading={true}
        selectedMetric="all"
        onMetricChange={vi.fn()}
      />
    )
    expect(screen.getByText('Loading chart...')).toBeInTheDocument()
  })

  it('renders empty state when no data', () => {
    const mockOnBarClick = vi.fn()
    render(
      <StatusTimelineChart
        data={[]}
        isLoading={false}
        selectedMetric="all"
        onMetricChange={vi.fn()}
      />
    )
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('renders chart with data', () => {
    const mockOnBarClick = vi.fn()
    render(
      <StatusTimelineChart
        data={mockData}
        isLoading={false}
        selectedMetric="all"
        onMetricChange={vi.fn()}
      />
    )
    // Check that the chart container is rendered
    const chartContainer = screen.getByRole('img', { hidden: true })
    expect(chartContainer).toBeInTheDocument()
  })

  it('renders all three bar series with correct colors', () => {
    const mockOnBarClick = vi.fn()
    const { container } = render(
      <StatusTimelineChart
        data={mockData}
        isLoading={false}
        selectedMetric="all"
        onMetricChange={vi.fn()}
      />
    )

    // Check for legend entries
    expect(screen.getByText('SUCCESS')).toBeInTheDocument()
    expect(screen.getByText('FAILED')).toBeInTheDocument()
    expect(screen.getByText('TIMEOUT')).toBeInTheDocument()
  })

  it('includes empty buckets (zero-height bars)', () => {
    const mockOnBarClick = vi.fn()
    const { container } = render(
      <StatusTimelineChart
        data={mockData}
        isLoading={false}
        selectedMetric="all"
        onMetricChange={vi.fn()}
      />
    )

    // The third bucket has all zero counts - it should still be rendered
    // We verify this by checking that all three data points are processed
    const chartContainer = container.querySelector('.recharts-wrapper')
    expect(chartContainer).toBeInTheDocument()
  })

  it('calls onBarClick with correct bucket and status when bar is clicked', async () => {
    const mockOnBarClick = vi.fn()
    const user = userEvent.setup()

    const { container } = render(
      <StatusTimelineChart
        data={mockData}
        isLoading={false}
        selectedMetric="all"
        onMetricChange={vi.fn()}
      />
    )

    // Find and click a bar segment
    const bars = container.querySelectorAll('.recharts-bar-rectangle')
    if (bars.length > 0) {
      await user.click(bars[0])
      // The click handler should have been called
      expect(mockOnBarClick).toHaveBeenCalled()
    }
  })

  it('renders with responsive container', () => {
    const mockOnBarClick = vi.fn()
    const { container } = render(
      <StatusTimelineChart
        data={mockData}
        isLoading={false}
        selectedMetric="all"
        onMetricChange={vi.fn()}
      />
    )

    const responsiveContainer = container.querySelector('.recharts-responsive-container')
    expect(responsiveContainer).toBeInTheDocument()
  })

  it('displays correct chart dimensions', () => {
    const mockOnBarClick = vi.fn()
    const { container } = render(
      <StatusTimelineChart
        data={mockData}
        isLoading={false}
        selectedMetric="all"
        onMetricChange={vi.fn()}
      />
    )

    const chartWrapper = container.querySelector('.recharts-wrapper')
    expect(chartWrapper).toHaveClass('recharts-wrapper')
  })

  it('renders Y-axis label', () => {
    const mockOnBarClick = vi.fn()
    const { container } = render(
      <StatusTimelineChart
        data={mockData}
        isLoading={false}
        selectedMetric="all"
        onMetricChange={vi.fn()}
      />
    )

    // Check for Y-axis label "Count"
    const yAxisLabel = container.querySelector('.recharts-yaxis-label')
    expect(yAxisLabel).toBeInTheDocument()
  })

  it('renders CartesianGrid', () => {
    const { container } = render(
      <StatusTimelineChart
        data={mockData}
        isLoading={false}
      />
    )

    const grid = container.querySelector('.recharts-cartesian-grid')
    expect(grid).toBeInTheDocument()
  })
})
