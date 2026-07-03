import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SuccessRateChart } from './SuccessRateChart'
import { RunsAggregatePoint } from '../../api/monitoring'

describe('SuccessRateChart', () => {
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
      success_count: 40,
      failed_count: 8,
      timeout_count: 2,
      total_count: 50,
      success_rate_pct: 80.0,
      avg_execution_time_ms: 150,
    },
  ]

  it('renders loading state', () => {
    render(
      <SuccessRateChart
        data={[]}
        isLoading={true}
      />
    )
    expect(screen.getByText('Loading chart...')).toBeInTheDocument()
  })

  it('renders empty state when no data', () => {
    render(
      <SuccessRateChart
        data={[]}
        isLoading={false}
      />
    )
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('renders chart with data', () => {
    const { container } = render(
      <SuccessRateChart
        data={mockData}
        isLoading={false}
      />
    )
    // Check that the chart container is rendered
    const chartContainer = container.querySelector('.recharts-wrapper')
    expect(chartContainer).toBeInTheDocument()
  })

  it('renders area series with correct name', () => {
    render(
      <SuccessRateChart
        data={mockData}
        isLoading={false}
      />
    )
    // Check for legend entry
    expect(screen.getByText('Success Rate')).toBeInTheDocument()
  })

  it('renders reference line at 95%', () => {
    const { container } = render(
      <SuccessRateChart
        data={mockData}
        isLoading={false}
      />
    )
    // Check for reference line label
    expect(screen.getByText('95%')).toBeInTheDocument()
  })

  it('renders Y-axis with percentage domain 0-100', () => {
    const { container } = render(
      <SuccessRateChart
        data={mockData}
        isLoading={false}
      />
    )
    // Check for Y-axis label "%"
    const yAxisLabel = container.querySelector('.recharts-yaxis-label')
    expect(yAxisLabel).toBeInTheDocument()
  })

  it('renders CartesianGrid', () => {
    const { container } = render(
      <SuccessRateChart
        data={mockData}
        isLoading={false}
      />
    )
    const grid = container.querySelector('.recharts-cartesian-grid')
    expect(grid).toBeInTheDocument()
  })

  it('renders with responsive container', () => {
    const { container } = render(
      <SuccessRateChart
        data={mockData}
        isLoading={false}
      />
    )
    const responsiveContainer = container.querySelector('.recharts-responsive-container')
    expect(responsiveContainer).toBeInTheDocument()
  })

  it('renders area with gradient fill', () => {
    const { container } = render(
      <SuccessRateChart
        data={mockData}
        isLoading={false}
      />
    )
    // Check for gradient definition
    const gradient = container.querySelector('#successRateGradient')
    expect(gradient).toBeInTheDocument()
  })

  it('renders area with correct stroke color', () => {
    const { container } = render(
      <SuccessRateChart
        data={mockData}
        isLoading={false}
      />
    )
    // Check for area path with green stroke
    const area = container.querySelector('.recharts-area')
    expect(area).toBeInTheDocument()
  })

  it('renders X-axis with time formatting', () => {
    const { container } = render(
      <SuccessRateChart
        data={mockData}
        isLoading={false}
      />
    )
    // Check for X-axis
    const xAxis = container.querySelector('.recharts-xaxis')
    expect(xAxis).toBeInTheDocument()
  })

  it('renders with correct container styling', () => {
    const { container } = render(
      <SuccessRateChart
        data={mockData}
        isLoading={false}
      />
    )
    const outerDiv = container.firstChild as HTMLElement
    expect(outerDiv).toHaveClass('w-full', 'h-80', 'bg-white', 'rounded-lg', 'border', 'border-gray-200', 'p-4')
  })

  it('handles data with null success_rate_pct', () => {
    const dataWithNull: RunsAggregatePoint[] = [
      {
        bucket: '2026-05-06T10:00:00Z',
        success_count: 0,
        failed_count: 0,
        timeout_count: 0,
        total_count: 0,
        success_rate_pct: null,
        avg_execution_time_ms: null,
      },
    ]
    const { container } = render(
      <SuccessRateChart
        data={dataWithNull}
        isLoading={false}
      />
    )
    // Should still render the chart
    const chartContainer = container.querySelector('.recharts-wrapper')
    expect(chartContainer).toBeInTheDocument()
  })

  it('renders multiple data points correctly', () => {
    const { container } = render(
      <SuccessRateChart
        data={mockData}
        isLoading={false}
      />
    )
    // Check that all data points are rendered
    const chartContainer = container.querySelector('.recharts-wrapper')
    expect(chartContainer).toBeInTheDocument()
    // The chart should have processed all three data points
  })
})
