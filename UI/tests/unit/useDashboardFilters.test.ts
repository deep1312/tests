import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { useDashboardFilters } from '../../src/hooks/useDashboardFilters'

// Helper to render hook with router context
function renderHookWithRouter<T>(hook: () => T) {
  return renderHook(hook, {
    wrapper: BrowserRouter,
  })
}

describe('useDashboardFilters', () => {
  describe('initialization', () => {
    it('should initialize with default values when no URL params are set', () => {
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      expect(result.current.filters.serverId).toBeNull()
      expect(result.current.filters.checkId).toBeNull()
      expect(result.current.filters.rangeHours).toBe(24)
      expect(result.current.filters.bucketInterval).toBe('1h') // default for 24h
      expect(result.current.filters.refreshInterval).toBe(0)
    })

    it('should parse URL parameters correctly', () => {
      window.history.pushState({}, '', '?server=1&check=2&range=6&bucket=15m&refresh=60')
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      expect(result.current.filters.serverId).toBe(1)
      expect(result.current.filters.checkId).toBe(2)
      expect(result.current.filters.rangeHours).toBe(6)
      expect(result.current.filters.bucketInterval).toBe('15m')
      expect(result.current.filters.refreshInterval).toBe(60)
    })

    it('should ignore invalid range values and use default', () => {
      window.history.pushState({}, '', '?range=999')
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      expect(result.current.filters.rangeHours).toBe(24)
    })

    it('should ignore invalid refresh values and use default', () => {
      window.history.pushState({}, '', '?refresh=999')
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      expect(result.current.filters.refreshInterval).toBe(0)
    })
  })

  describe('bucket auto-default', () => {
    it('should default to 5m for 1h range', () => {
      window.history.pushState({}, '', '?range=1')
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      expect(result.current.filters.bucketInterval).toBe('5m')
    })

    it('should default to 15m for 6h range', () => {
      window.history.pushState({}, '', '?range=6')
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      expect(result.current.filters.bucketInterval).toBe('15m')
    })

    it('should default to 1h for 24h range', () => {
      window.history.pushState({}, '', '?range=24')
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      expect(result.current.filters.bucketInterval).toBe('1h')
    })

    it('should default to 6h for 7d (168h) range', () => {
      window.history.pushState({}, '', '?range=168')
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      expect(result.current.filters.bucketInterval).toBe('6h')
    })
  })

  describe('bucket auto-downgrade', () => {
    it('should downgrade 1h bucket to 5m when range is 1h', () => {
      window.history.pushState({}, '', '?range=1&bucket=1h')
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      expect(result.current.filters.bucketInterval).toBe('5m')
    })

    it('should downgrade 6h bucket to 1h when range is 6h', () => {
      window.history.pushState({}, '', '?range=6&bucket=6h')
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      expect(result.current.filters.bucketInterval).toBe('1h')
    })

    it('should downgrade 1d bucket to 1h when range is 24h', () => {
      window.history.pushState({}, '', '?range=24&bucket=1d')
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      expect(result.current.filters.bucketInterval).toBe('1h')
    })

    it('should keep bucket when it fits within range', () => {
      window.history.pushState({}, '', '?range=24&bucket=1h')
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      expect(result.current.filters.bucketInterval).toBe('1h')
    })

    it('should downgrade to smallest bucket when range is very small', () => {
      window.history.pushState({}, '', '?range=1&bucket=1d')
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      expect(result.current.filters.bucketInterval).toBe('5m')
    })
  })

  describe('time range derivation', () => {
    it('should derive from/to ISO strings from rangeHours', () => {
      window.history.pushState({}, '', '?range=1')
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      const { from, to } = result.current.filters
      expect(from).toBeTruthy()
      expect(to).toBeTruthy()

      // Verify they are valid ISO strings
      expect(new Date(from).toISOString()).toBe(from)
      expect(new Date(to).toISOString()).toBe(to)

      // Verify the time difference is approximately 1 hour
      const diffMs = new Date(to).getTime() - new Date(from).getTime()
      const diffHours = diffMs / (1000 * 60 * 60)
      expect(diffHours).toBeCloseTo(1, 0.1)
    })

    it('should round to nearest minute for stable query keys', () => {
      window.history.pushState({}, '', '?range=24')
      const { result: result1 } = renderHookWithRouter(() => useDashboardFilters())
      const from1 = result1.current.filters.from

      // Verify seconds are 0
      expect(new Date(from1).getSeconds()).toBe(0)
      expect(new Date(from1).getMilliseconds()).toBe(0)
    })
  })

  describe('updateFilters', () => {
    it('should update serverId in URL', () => {
      window.history.pushState({}, '', '')
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      act(() => {
        result.current.updateFilters({ serverId: 5 })
      })

      expect(result.current.filters.serverId).toBe(5)
      expect(window.location.search).toContain('server=5')
    })

    it('should update checkId in URL', () => {
      window.history.pushState({}, '', '')
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      act(() => {
        result.current.updateFilters({ checkId: 3 })
      })

      expect(result.current.filters.checkId).toBe(3)
      expect(window.location.search).toContain('check=3')
    })

    it('should update rangeHours in URL', () => {
      window.history.pushState({}, '', '')
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      act(() => {
        result.current.updateFilters({ rangeHours: 6 })
      })

      expect(result.current.filters.rangeHours).toBe(6)
      expect(window.location.search).toContain('range=6')
    })

    it('should update bucketInterval in URL', () => {
      window.history.pushState({}, '', '')
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      act(() => {
        result.current.updateFilters({ bucketInterval: '15m' })
      })

      expect(result.current.filters.bucketInterval).toBe('15m')
      expect(window.location.search).toContain('bucket=15m')
    })

    it('should update refreshInterval in URL', () => {
      window.history.pushState({}, '', '')
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      act(() => {
        result.current.updateFilters({ refreshInterval: 30 })
      })

      expect(result.current.filters.refreshInterval).toBe(30)
      expect(window.location.search).toContain('refresh=30')
    })

    it('should clear serverId when set to null', () => {
      window.history.pushState({}, '', '?server=1')
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      act(() => {
        result.current.updateFilters({ serverId: null })
      })

      expect(result.current.filters.serverId).toBeNull()
      expect(window.location.search).not.toContain('server')
    })

    it('should update multiple filters at once', () => {
      window.history.pushState({}, '', '')
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      act(() => {
        result.current.updateFilters({
          serverId: 1,
          checkId: 2,
          rangeHours: 6,
          bucketInterval: '15m',
          refreshInterval: 60,
        })
      })

      expect(result.current.filters.serverId).toBe(1)
      expect(result.current.filters.checkId).toBe(2)
      expect(result.current.filters.rangeHours).toBe(6)
      expect(result.current.filters.bucketInterval).toBe('15m')
      expect(result.current.filters.refreshInterval).toBe(60)
    })
  })

  describe('edge cases', () => {
    it('should handle empty URL params gracefully', () => {
      window.history.pushState({}, '', '?')
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      expect(result.current.filters.serverId).toBeNull()
      expect(result.current.filters.checkId).toBeNull()
      expect(result.current.filters.rangeHours).toBe(24)
    })

    it('should handle non-numeric server/check IDs gracefully', () => {
      window.history.pushState({}, '', '?server=abc&check=xyz')
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      expect(result.current.filters.serverId).toBeNaN()
      expect(result.current.filters.checkId).toBeNaN()
    })

    it('should preserve other URL params when updating filters', () => {
      window.history.pushState({}, '', '?other=value&server=1')
      const { result } = renderHookWithRouter(() => useDashboardFilters())

      act(() => {
        result.current.updateFilters({ checkId: 2 })
      })

      expect(window.location.search).toContain('server=1')
      expect(window.location.search).toContain('check=2')
    })
  })
})
