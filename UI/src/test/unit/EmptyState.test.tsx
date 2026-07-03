import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmptyState } from '../../components/shared/EmptyState'
import { Server } from 'lucide-react'

describe('EmptyState component', () => {
  it('should render title and description', () => {
    render(
      <EmptyState
        title="No data"
        description="There is no data to display"
      />
    )

    expect(screen.getByText('No data')).toBeInTheDocument()
    expect(screen.getByText('There is no data to display')).toBeInTheDocument()
  })

  it('should render icon when provided', () => {
    render(
      <EmptyState
        icon={Server}
        title="No servers"
      />
    )

    const icon = screen.getByRole('img', { hidden: true })
    expect(icon).toBeInTheDocument()
  })

  it('should render CTA button when action is provided', () => {
    const handleClick = vi.fn()
    render(
      <EmptyState
        title="No data"
        action={{
          label: 'Add Item',
          onClick: handleClick,
        }}
      />
    )

    const button = screen.getByRole('button', { name: 'Add Item' })
    expect(button).toBeInTheDocument()
  })

  it('should call action onClick when button is clicked', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(
      <EmptyState
        title="No data"
        action={{
          label: 'Add Item',
          onClick: handleClick,
        }}
      />
    )

    const button = screen.getByRole('button', { name: 'Add Item' })
    await user.click(button)

    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('should be keyboard navigable', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(
      <EmptyState
        title="No data"
        action={{
          label: 'Add Item',
          onClick: handleClick,
        }}
      />
    )

    const button = screen.getByRole('button', { name: 'Add Item' })
    button.focus()
    expect(button).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(handleClick).toHaveBeenCalledOnce()
  })
})
