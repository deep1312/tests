import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ExecutionTimeChart } from './ExecutionTimeChart'
import { RunsAggregatePoint } from '../../api/monitoring'

describe('ExecutionTimeChart', () => {
  const mockData: RunsAggregatePoint[] = [
    {
      bucket: '2026-05-06T10:00:00Z',
      success_count: 48,
      failed_count: 2,
      timeout_count: 0,
      total_count: 50,
      success_rate_pct: 96.0,
      avg_execution_time_ms: 138,
      min_execution_time_ms: 45,
      max_execution_time_ms: 250,
    },
    {
      bucket: '2026-05-06T11:00:00Z',
      success_count: 45,
      failed_count: 3,
      timeout_count: 2,
      total_count: 50,
      success_rate_pct: 90.0,
      avg_execution_time_ms: 142,
      min_execution_time_ms: 50,
      max_execution_time_ms: 280,
    },
    {
      bucket: '2026-05-06T12:00:00Z',
      success_count: 40,
      failed_count: 8,
      timeout_count: 2,
      total_count: 50,
      success_rate_pct: 80.0,
      avg_execution_time_ms: 150,
      min_execution_time_ms: 55,
      max_execution_time_ms: 300,
    },
  ]

  it('renders loading state', () => {
    render(
      <ExecutionTimeChart
        data={[]}
        isLoading={true}
      />
    )
    expect(screen.getByText('Loading chart...')).toBeInTheDocument()
  })

  it('renders empty state when no data', () => {
    render(
      <ExecutionTimeChart
        data={[]}
        isLoading={false}
      />
    )
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('renders chart container with data', () => {
    const { container } = render(
      <ExecutionTimeChart
        data={mockData}
        isLoading={false}
      />
    )
    // Check that the outer container is rendered with correct styling
    const outerDiv = container.firstChild as HTMLElement
    expect(outerDiv).toHaveClass('w-full', 'h-80', 'bg-card/90 backdrop-blur-sm', 'rounded-lg', 'border', 'border-border', 'p-4')
  })

  it('renders responsive container', () => {
    const { container } = render(
      <ExecutionTimeChart
        data={mockData}
        isLoading={false}
      />
    )
    const responsiveContainer = container.querySelector('.recharts-responsive-container')
    expect(responsiveContainer).toBeInTheDocument()
  })

  it('renders with correct container styling', () => {
    const { container } = render(
      <ExecutionTimeChart
        data={mockData}
        isLoading={false}
      />
    )
    const outerDiv = container.firstChild as HTMLElement
    expect(outerDiv).toHaveClass('w-full', 'h-80', 'bg-card/90 backdrop-blur-sm', 'rounded-lg', 'border', 'border-border', 'p-4')
  })

  it('handles data with null execution time values', () => {
    const dataWithNull: RunsAggregatePoint[] = [
      {
        bucket: '2026-05-06T10:00:00Z',
        success_count: 0,
        failed_count: 0,
        timeout_count: 0,
        total_count: 0,
        success_rate_pct: null,
        avg_execution_time_ms: null,
        min_execution_time_ms: null,
        max_execution_time_ms: null,
      },
    ]
    const { container } = render(
      <ExecutionTimeChart
        data={dataWithNull}
        isLoading={false}
      />
    )
    // Should still render the chart container
    const outerDiv = container.firstChild as HTMLElement
    expect(outerDiv).toHaveClass('w-full', 'h-80', 'bg-card/90 backdrop-blur-sm', 'rounded-lg', 'border', 'border-border', 'p-4')
  })

  it('renders multiple data points correctly', () => {
    const { container } = render(
      <ExecutionTimeChart
        data={mockData}
        isLoading={false}
      />
    )
    // Check that the chart container is rendered
    const responsiveContainer = container.querySelector('.recharts-responsive-container')
    expect(responsiveContainer).toBeInTheDocument()
  })

  it('does not render loading state when isLoading is false', () => {
    render(
      <ExecutionTimeChart
        data={mockData}
        isLoading={false}
      />
    )
    expect(screen.queryByText('Loading chart...')).not.toBeInTheDocument()
  })

  it('does not render empty state when data is provided', () => {
    render(
      <ExecutionTimeChart
        data={mockData}
        isLoading={false}
      />
    )
    expect(screen.queryByText('No data available')).not.toBeInTheDocument()
  })

  it('renders with correct height class', () => {
    const { container } = render(
      <ExecutionTimeChart
        data={mockData}
        isLoading={false}
      />
    )
    const outerDiv = container.firstChild as HTMLElement
    expect(outerDiv).toHaveClass('h-80')
  })

  it('renders with correct background color class', () => {
    const { container } = render(
      <ExecutionTimeChart
        data={mockData}
        isLoading={false}
      />
    )
    const outerDiv = container.firstChild as HTMLElement
    expect(outerDiv).toHaveClass('bg-card/90 backdrop-blur-sm')
  })

  it('renders with correct border classes', () => {
    const { container } = render(
      <ExecutionTimeChart
        data={mockData}
        isLoading={false}
      />
    )
    const outerDiv = container.firstChild as HTMLElement
    expect(outerDiv).toHaveClass('border', 'border-border')
  })
})
