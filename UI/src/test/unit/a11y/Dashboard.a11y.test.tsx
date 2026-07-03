import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Dashboard } from '../../../pages/Dashboard'

expect.extend(toHaveNoViolations)

describe('Dashboard accessibility', () => {
  it('should not have any accessibility violations', async () => {
    const { container } = render(<Dashboard />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should have proper heading hierarchy', () => {
    const { container } = render(<Dashboard />)
    const h1 = container.querySelector('h1')
    expect(h1).toBeInTheDocument()
    expect(h1?.textContent).toContain('Dashboard')
  })

  it('should have descriptive text for empty state', () => {
    const { container } = render(<Dashboard />)
    const text = container.textContent
    expect(text).toContain('No servers found')
  })
})
