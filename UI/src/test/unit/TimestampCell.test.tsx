import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimestampCell } from '../../components/shared/TimestampCell'

describe('TimestampCell component', () => {
  it('should render UTC timestamp converted to local time', () => {
    render(<TimestampCell utcIso="2024-01-15T10:30:00Z" />)

    const cell = screen.getByText(/Jan 15, 2024/)
    expect(cell).toBeInTheDocument()
  })

  it('should use custom format when provided', () => {
    render(
      <TimestampCell
        utcIso="2024-01-15T10:30:00Z"
        format="yyyy-MM-dd"
      />
    )

    expect(screen.getByText('2024-01-15')).toBeInTheDocument()
  })

  it('should show UTC value in tooltip on hover', async () => {
    const user = userEvent.setup()
    render(<TimestampCell utcIso="2024-01-15T10:30:00Z" />)

    const cell = screen.getByText(/Jan 15, 2024/)
    await user.hover(cell)

    expect(screen.getByText(/UTC: 2024-01-15T10:30:00Z/)).toBeInTheDocument()
  })

  it('should hide tooltip when mouse leaves', async () => {
    const user = userEvent.setup()
    render(<TimestampCell utcIso="2024-01-15T10:30:00Z" />)

    const cell = screen.getByText(/Jan 15, 2024/)
    await user.hover(cell)
    expect(screen.getByText(/UTC: 2024-01-15T10:30:00Z/)).toBeInTheDocument()

    await user.unhover(cell)
    expect(screen.queryByText(/UTC: 2024-01-15T10:30:00Z/)).not.toBeInTheDocument()
  })
})
