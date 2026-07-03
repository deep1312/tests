import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SummaryPanel } from './SummaryPanel'
import { RunsSummary } from '../../api/monitoring'

describe('SummaryPanel', () => {
  const mockSummary: RunsSummary = {
    total_count: 1000,
    success_count: 950,
    failed_count: 30,
    timeout_count: 20,
    avg_execution_time_ms: 142,
    success_rate_pct: 95.0,
  }

  it('renders all five KPI cards', () => {
    render(<SummaryPanel summary={mockSummary} isLoading={false} />)

    expect(screen.getByText('Total Runs')).toBeInTheDocument()
    expect(screen.getByText('Success')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('Timeout')).toBeInTheDocument()
    expect(screen.getByText('Success Rate')).toBeInTheDocument()
  })

  it('displays correct values for all KPI cards', () => {
    render(<SummaryPanel summary={mockSummary} isLoading={false} />)

    expect(screen.getByText('1000')).toBeInTheDocument()
    expect(screen.getByText('950')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('95.0%')).toBeInTheDocument()
  })

  it('applies green color to success rate when >= 95%', () => {
    const summary: RunsSummary = {
      ...mockSummary,
      success_rate_pct: 95.0,
    }

    const { container } = render(<SummaryPanel summary={summary} isLoading={false} />)

    const successRateCard = container.querySelector('[class*="text-green-700"]')
    expect(successRateCard).toBeInTheDocument()
    expect(successRateCard).toHaveClass('bg-green-50')
  })

  it('applies amber color to success rate when 80-94.9%', () => {
    const summary: RunsSummary = {
      ...mockSummary,
      success_rate_pct: 85.5,
    }

    const { container } = render(<SummaryPanel summary={summary} isLoading={false} />)

    const successRateCard = container.querySelector('[class*="text-amber-700"]')
    expect(successRateCard).toBeInTheDocument()
    expect(successRateCard).toHaveClass('bg-amber-50')
  })

  it('applies red color to success rate when < 80%', () => {
    const summary: RunsSummary = {
      ...mockSummary,
      success_rate_pct: 75.0,
    }

    const { container } = render(<SummaryPanel summary={summary} isLoading={false} />)

    const successRateCard = container.querySelector('[class*="text-red-700"]')
    expect(successRateCard).toBeInTheDocument()
    expect(successRateCard).toHaveClass('bg-red-50')
  })

  it('displays "—" for success rate when summary is undefined', () => {
    render(<SummaryPanel summary={undefined} isLoading={false} />)

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('displays "0" for all counts when summary is undefined', () => {
    render(<SummaryPanel summary={undefined} isLoading={false} />)

    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBeGreaterThanOrEqual(4) // At least 4 zeros for counts
  })

  it('displays "—" for success rate when total_count is 0', () => {
    const summary: RunsSummary = {
      ...mockSummary,
      total_count: 0,
      success_count: 0,
      failed_count: 0,
      timeout_count: 0,
      success_rate_pct: null,
    }

    render(<SummaryPanel summary={summary} isLoading={false} />)

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('displays "0" for all counts when total_count is 0', () => {
    const summary: RunsSummary = {
      ...mockSummary,
      total_count: 0,
      success_count: 0,
      failed_count: 0,
      timeout_count: 0,
      success_rate_pct: null,
    }

    render(<SummaryPanel summary={summary} isLoading={false} />)

    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBeGreaterThanOrEqual(4)
  })

  it('displays loading skeleton when isLoading is true', () => {
    const { container } = render(<SummaryPanel summary={mockSummary} isLoading={true} />)

    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('displays correct success rate with one decimal place', () => {
    const summary: RunsSummary = {
      ...mockSummary,
      success_rate_pct: 95.123,
    }

    render(<SummaryPanel summary={summary} isLoading={false} />)

    expect(screen.getByText('95.1%')).toBeInTheDocument()
  })

  it('handles null success_rate_pct gracefully', () => {
    const summary: RunsSummary = {
      ...mockSummary,
      success_rate_pct: null,
    }

    render(<SummaryPanel summary={summary} isLoading={false} />)

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('applies responsive grid classes', () => {
    const { container } = render(<SummaryPanel summary={mockSummary} isLoading={false} />)

    const grid = container.querySelector('.grid')
    expect(grid).toHaveClass('grid-cols-2', 'sm:grid-cols-3', 'lg:grid-cols-5')
  })

  it('renders KPI cards with correct background colors', () => {
    const { container } = render(<SummaryPanel summary={mockSummary} isLoading={false} />)

    const cards = container.querySelectorAll('[class*="bg-"]')
    expect(cards.length).toBeGreaterThanOrEqual(5)
  })
})
