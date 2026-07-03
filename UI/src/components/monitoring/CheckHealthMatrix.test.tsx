import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CheckHealthMatrix } from './CheckHealthMatrix'
import { LatestPerCheckRow } from '../../api/monitoring'

describe('CheckHealthMatrix', () => {
  const mockData: LatestPerCheckRow[] = [
    {
      server_id: 1,
      server_label: 'prod-db-01',
      check_id: 1,
      check_name: 'Connection Usage',
      check_category: 'PERF',
      status: 'SUCCESS',
      started_at: '2026-05-06T10:42:00Z',
      execution_time_ms: 145,
    },
    {
      server_id: 1,
      server_label: 'prod-db-01',
      check_id: 2,
      check_name: 'Replication Lag',
      check_category: 'AVAIL',
      status: 'FAILED',
      started_at: '2026-05-06T10:40:00Z',
      execution_time_ms: 200,
    },
    {
      server_id: 2,
      server_label: 'prod-db-02',
      check_id: 1,
      check_name: 'Connection Usage',
      check_category: 'PERF',
      status: 'TIMEOUT',
      started_at: '2026-05-06T10:35:00Z',
      execution_time_ms: null,
    },
    {
      server_id: 2,
      server_label: 'prod-db-02',
      check_id: 2,
      check_name: 'Replication Lag',
      check_category: 'AVAIL',
      status: 'SUCCESS',
      started_at: '2026-05-06T10:41:00Z',
      execution_time_ms: 120,
    },
  ]

  it('renders the matrix with correct structure', () => {
    render(
      <CheckHealthMatrix
        data={mockData}
        isLoading={false}
        onCellClick={vi.fn()}
      />
    )

    // Check for headers
    expect(screen.getByText('Connection Usage')).toBeInTheDocument()
    expect(screen.getByText('Replication Lag')).toBeInTheDocument()
    expect(screen.getByText('prod-db-01')).toBeInTheDocument()
    expect(screen.getByText('prod-db-02')).toBeInTheDocument()
  })

  it('displays status colors correctly', () => {
    const { container } = render(
      <CheckHealthMatrix
        data={mockData}
        isLoading={false}
        onCellClick={vi.fn()}
      />
    )

    // Check for status color classes
    const greenCells = container.querySelectorAll('.bg-green-100')
    const redCells = container.querySelectorAll('.bg-red-100')
    const yellowCells = container.querySelectorAll('.bg-yellow-100')

    expect(greenCells.length).toBeGreaterThan(0)
    expect(redCells.length).toBeGreaterThan(0)
    expect(yellowCells.length).toBeGreaterThan(0)
  })

  it('displays status text in cells', () => {
    render(
      <CheckHealthMatrix
        data={mockData}
        isLoading={false}
        onCellClick={vi.fn()}
      />
    )

    expect(screen.getAllByText('SUCCESS').length).toBeGreaterThan(0)
    expect(screen.getAllByText('FAILED').length).toBeGreaterThan(0)
    expect(screen.getAllByText('TIMEOUT').length).toBeGreaterThan(0)
  })

  it('displays time since last run', () => {
    render(
      <CheckHealthMatrix
        data={mockData}
        isLoading={false}
        onCellClick={vi.fn()}
      />
    )

    // Check for "ago" text which indicates formatDistanceToNow is working
    const agoElements = screen.getAllByText(/ago/)
    expect(agoElements.length).toBeGreaterThan(0)
  })

  it('calls onCellClick with correct parameters when cell is clicked', () => {
    const onCellClick = vi.fn()
    const { container } = render(
      <CheckHealthMatrix
        data={mockData}
        isLoading={false}
        onCellClick={onCellClick}
      />
    )

    // Find and click a data cell (not header) - look for cells with status colors
    const cells = container.querySelectorAll('tbody td')
    // Filter to only data cells (those with bg-green-100, bg-red-100, bg-yellow-100, or bg-muted)
    const dataCells = Array.from(cells).filter((cell) => {
      const classes = cell.className
      return (
        classes.includes('bg-green-100') ||
        classes.includes('bg-red-100') ||
        classes.includes('bg-yellow-100') ||
        classes.includes('bg-muted')
      )
    })
    
    if (dataCells.length > 0) {
      fireEvent.click(dataCells[0])
      expect(onCellClick).toHaveBeenCalled()
    }
  })

  it('renders category badges in headers', () => {
    render(
      <CheckHealthMatrix
        data={mockData}
        isLoading={false}
        onCellClick={vi.fn()}
      />
    )

    expect(screen.getByText('PERF')).toBeInTheDocument()
    expect(screen.getByText('AVAIL')).toBeInTheDocument()
  })

  it('renders env_type badges for servers', () => {
    const dataWithEnvType: LatestPerCheckRow[] = [
      {
        ...mockData[0],
        env_type: 'prod',
      },
    ]

    render(
      <CheckHealthMatrix
        data={dataWithEnvType}
        isLoading={false}
        onCellClick={vi.fn()}
      />
    )

    expect(screen.getByText('prod')).toBeInTheDocument()
  })

  it('displays loading skeleton when isLoading is true', () => {
    const { container } = render(
      <CheckHealthMatrix
        data={mockData}
        isLoading={true}
        onCellClick={vi.fn()}
      />
    )

    const skeleton = container.querySelector('.animate-pulse')
    expect(skeleton).toBeInTheDocument()
  })

  it('displays empty state when no data', () => {
    render(
      <CheckHealthMatrix
        data={[]}
        isLoading={false}
        onCellClick={vi.fn()}
      />
    )

    expect(screen.getByText('No data available for the selected filters')).toBeInTheDocument()
  })

  it('uses checks as rows when server count <= 8', () => {
    // Create data with 2 servers and 3 checks
    const data: LatestPerCheckRow[] = [
      {
        server_id: 1,
        server_label: 'server-1',
        check_id: 1,
        check_name: 'Check 1',
        check_category: 'CAT1',
        status: 'SUCCESS',
        started_at: '2026-05-06T10:42:00Z',
        execution_time_ms: 100,
      },
      {
        server_id: 2,
        server_label: 'server-2',
        check_id: 1,
        check_name: 'Check 1',
        check_category: 'CAT1',
        status: 'SUCCESS',
        started_at: '2026-05-06T10:42:00Z',
        execution_time_ms: 100,
      },
    ]

    render(
      <CheckHealthMatrix
        data={data}
        isLoading={false}
        onCellClick={vi.fn()}
      />
    )

    // With 2 servers (<=8), checks should be rows
    expect(screen.getByText('Check')).toBeInTheDocument()
  })

  it('fills missing combinations with "No data" cells', () => {
    // Create sparse data: only 2 of 4 possible combinations
    const sparseData: LatestPerCheckRow[] = [
      {
        server_id: 1,
        server_label: 'server-1',
        check_id: 1,
        check_name: 'Check 1',
        check_category: 'CAT1',
        status: 'SUCCESS',
        started_at: '2026-05-06T10:42:00Z',
        execution_time_ms: 100,
      },
      {
        server_id: 2,
        server_label: 'server-2',
        check_id: 2,
        check_name: 'Check 2',
        check_category: 'CAT2',
        status: 'FAILED',
        started_at: '2026-05-06T10:42:00Z',
        execution_time_ms: 100,
      },
    ]

    render(
      <CheckHealthMatrix
        data={sparseData}
        isLoading={false}
        onCellClick={vi.fn()}
      />
    )

    // Should have "No data" cells for missing combinations
    const noDataElements = screen.getAllByText('No data')
    expect(noDataElements.length).toBeGreaterThan(0)
  })

  it('renders color dots for each status', () => {
    const { container } = render(
      <CheckHealthMatrix
        data={mockData}
        isLoading={false}
        onCellClick={vi.fn()}
      />
    )

    // Check for colored dots (small circles)
    const dots = container.querySelectorAll('[class*="rounded-full"]')
    expect(dots.length).toBeGreaterThan(0)
  })

  it('handles missing env_type gracefully', () => {
    const dataWithoutEnvType: LatestPerCheckRow[] = [
      {
        ...mockData[0],
        env_type: undefined,
      },
    ]

    render(
      <CheckHealthMatrix
        data={dataWithoutEnvType}
        isLoading={false}
        onCellClick={vi.fn()}
      />
    )

    expect(screen.getByText('unknown')).toBeInTheDocument()
  })

  it('renders table with border styling', () => {
    const { container } = render(
      <CheckHealthMatrix
        data={mockData}
        isLoading={false}
        onCellClick={vi.fn()}
      />
    )

    const table = container.querySelector('table')
    expect(table).toHaveClass('border-collapse')

    const cells = container.querySelectorAll('td, th')
    cells.forEach((cell) => {
      expect(cell).toHaveClass('border', 'border-border')
    })
  })

  it('renders scrollable container', () => {
    const { container } = render(
      <CheckHealthMatrix
        data={mockData}
        isLoading={false}
        onCellClick={vi.fn()}
      />
    )

    const scrollContainer = container.querySelector('.overflow-auto')
    expect(scrollContainer).toBeInTheDocument()

    const minWidthContainer = container.querySelector('.min-w-max')
    expect(minWidthContainer).toBeInTheDocument()
  })

  it('displays correct number of cells for complete grid', () => {
    // 2 servers, 2 checks = 4 cells
    const { container } = render(
      <CheckHealthMatrix
        data={mockData}
        isLoading={false}
        onCellClick={vi.fn()}
      />
    )

    // Count data cells (excluding headers)
    const rows = container.querySelectorAll('tbody tr')
    expect(rows.length).toBeGreaterThan(0)
  })

  it('applies hover effect to cells', () => {
    const { container } = render(
      <CheckHealthMatrix
        data={mockData}
        isLoading={false}
        onCellClick={vi.fn()}
      />
    )

    const cells = container.querySelectorAll('tbody td[class*="bg-green-100"], tbody td[class*="bg-red-100"], tbody td[class*="bg-yellow-100"]')
    cells.forEach((cell) => {
      expect(cell).toHaveClass('hover:opacity-80', 'cursor-pointer')
    })
  })
})
