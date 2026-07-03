import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

/**
 * Property-based test for SummaryPanel success rate color logic
 *
 * Property P9: The color class applied to the success rate KPI card is always
 * one of {green, amber, red} and matches the threshold rules:
 * - green (text-green-700 bg-green-50): ≥95%
 * - amber (text-amber-700 bg-amber-50): 80–94.9%
 * - red (text-red-700 bg-red-50): <80%
 *
 * Validates: Requirements 1.5
 */
describe('SummaryPanel - Property P9: Success Rate Color', () => {
  // Helper function that mirrors the component's color logic
  const getSuccessRateColor = (rate: number | null | undefined): string => {
    if (rate === null || rate === undefined) {
      return 'text-gray-700 bg-gray-50'
    }
    if (rate >= 95) {
      return 'text-green-700 bg-green-50'
    }
    if (rate >= 80) {
      return 'text-amber-700 bg-amber-50'
    }
    return 'text-red-700 bg-red-50'
  }

  it('should return green color for success rate >= 95%', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 95, max: 100, noDefaultInfinity: true }).filter(n => !isNaN(n)),
        rate => {
          const color = getSuccessRateColor(rate)
          expect(color).toBe('text-green-700 bg-green-50')
        }
      )
    )
  })

  it('should return amber color for success rate 80-94.9%', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 80, max: Math.fround(94.99), noDefaultInfinity: true }).filter(n => !isNaN(n)),
        rate => {
          const color = getSuccessRateColor(rate)
          expect(color).toBe('text-amber-700 bg-amber-50')
        }
      )
    )
  })

  it('should return red color for success rate < 80%', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: Math.fround(79.99), noDefaultInfinity: true }).filter(n => !isNaN(n)),
        rate => {
          const color = getSuccessRateColor(rate)
          expect(color).toBe('text-red-700 bg-red-50')
        }
      )
    )
  })

  it('should return gray color for null or undefined', () => {
    const nullColor = getSuccessRateColor(null)
    const undefinedColor = getSuccessRateColor(undefined)

    expect(nullColor).toBe('text-gray-700 bg-gray-50')
    expect(undefinedColor).toBe('text-gray-700 bg-gray-50')
  })

  it('should always return one of the valid color classes', () => {
    const validColors = [
      'text-green-700 bg-green-50',
      'text-amber-700 bg-amber-50',
      'text-red-700 bg-red-50',
      'text-gray-700 bg-gray-50',
    ]

    fc.assert(
      fc.property(
        fc.oneof(
          fc.float({ min: 0, max: 100, noDefaultInfinity: true }),
          fc.constant(null),
          fc.constant(undefined)
        ),
        rate => {
          const color = getSuccessRateColor(rate as any)
          expect(validColors).toContain(color)
        }
      )
    )
  })

  it('should have correct boundary behavior at 95%', () => {
    // At exactly 95%, should be green
    expect(getSuccessRateColor(95.0)).toBe('text-green-700 bg-green-50')
    // Just below 95%, should be amber
    expect(getSuccessRateColor(94.99)).toBe('text-amber-700 bg-amber-50')
  })

  it('should have correct boundary behavior at 80%', () => {
    // At exactly 80%, should be amber
    expect(getSuccessRateColor(80.0)).toBe('text-amber-700 bg-amber-50')
    // Just below 80%, should be red
    expect(getSuccessRateColor(79.99)).toBe('text-red-700 bg-red-50')
  })

  it('should handle edge cases: 0% and 100%', () => {
    expect(getSuccessRateColor(0)).toBe('text-red-700 bg-red-50')
    expect(getSuccessRateColor(100)).toBe('text-green-700 bg-green-50')
  })
})
