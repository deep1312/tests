import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutoRefresh } from '../../src/hooks/useAutoRefresh'

describe('useAutoRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('basic functionality', () => {
    it('should call onRefresh at the specified interval', () => {
      const onRefresh = vi.fn()
      renderHook(() => useAutoRefresh(1, onRefresh))

      // Advance time by 1 second
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(onRefresh).toHaveBeenCalledTimes(1)

      // Advance time by another 1 second
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(onRefresh).toHaveBeenCalledTimes(2)
    })

    it('should not call onRefresh when intervalSec is 0', () => {
      const onRefresh = vi.fn()
      renderHook(() => useAutoRefresh(0, onRefresh))

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(onRefresh).not.toHaveBeenCalled()
    })

    it('should not call onRefresh when intervalSec is negative', () => {
      const onRefresh = vi.fn()
      renderHook(() => useAutoRefresh(-1, onRefresh))

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(onRefresh).not.toHaveBeenCalled()
    })

    it('should respect different interval values', () => {
      const onRefresh = vi.fn()
      renderHook(() => useAutoRefresh(2, onRefresh))

      // Advance time by 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      expect(onRefresh).toHaveBeenCalledTimes(1)

      // Advance time by 1 more second (not enough for another call)
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(onRefresh).toHaveBeenCalledTimes(1)

      // Advance time by 1 more second (now 2 seconds total)
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(onRefresh).toHaveBeenCalledTimes(2)
    })
  })

  describe('Page Visibility API', () => {
    it('should skip callback when document.hidden is true', () => {
      const onRefresh = vi.fn()
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      })

      renderHook(() => useAutoRefresh(1, onRefresh))

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(onRefresh).not.toHaveBeenCalled()
    })

    it('should call callback when document.hidden is false', () => {
      const onRefresh = vi.fn()
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => false,
      })

      renderHook(() => useAutoRefresh(1, onRefresh))

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(onRefresh).toHaveBeenCalledTimes(1)
    })

    it('should resume calling callback when document becomes visible again', () => {
      const onRefresh = vi.fn()
      let isHidden = true

      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => isHidden,
      })

      renderHook(() => useAutoRefresh(1, onRefresh))

      // First interval with document hidden
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(onRefresh).not.toHaveBeenCalled()

      // Make document visible
      isHidden = false

      // Second interval with document visible
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(onRefresh).toHaveBeenCalledTimes(1)

      // Third interval with document still visible
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(onRefresh).toHaveBeenCalledTimes(2)
    })
  })

  describe('cleanup', () => {
    it('should clear interval on unmount', () => {
      const onRefresh = vi.fn()
      const { unmount } = renderHook(() => useAutoRefresh(1, onRefresh))

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(onRefresh).toHaveBeenCalledTimes(1)

      // Unmount the hook
      unmount()

      // Advance time further
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Should still be 1 call (no new calls after unmount)
      expect(onRefresh).toHaveBeenCalledTimes(1)
    })

    it('should clear interval when intervalSec changes to 0', () => {
      const onRefresh = vi.fn()
      const { rerender } = renderHook(
        ({ interval }) => useAutoRefresh(interval, onRefresh),
        { initialProps: { interval: 1 } }
      )

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(onRefresh).toHaveBeenCalledTimes(1)

      // Change interval to 0
      rerender({ interval: 0 })

      // Advance time further
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Should still be 1 call (no new calls after interval set to 0)
      expect(onRefresh).toHaveBeenCalledTimes(1)
    })

    it('should clear old interval and set new one when intervalSec changes', () => {
      const onRefresh = vi.fn()
      const { rerender } = renderHook(
        ({ interval }) => useAutoRefresh(interval, onRefresh),
        { initialProps: { interval: 2 } }
      )

      act(() => {
        vi.advanceTimersByTime(2000)
      })

      expect(onRefresh).toHaveBeenCalledTimes(1)

      // Change interval to 1 second
      rerender({ interval: 1 })

      // Advance time by 1 second
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Should be called again (new interval is 1 second)
      expect(onRefresh).toHaveBeenCalledTimes(2)
    })

    it('should clear old interval and set new one when onRefresh callback changes', () => {
      const onRefresh1 = vi.fn()
      const onRefresh2 = vi.fn()

      const { rerender } = renderHook(
        ({ callback }) => useAutoRefresh(1, callback),
        { initialProps: { callback: onRefresh1 } }
      )

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(onRefresh1).toHaveBeenCalledTimes(1)
      expect(onRefresh2).not.toHaveBeenCalled()

      // Change callback
      rerender({ callback: onRefresh2 })

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // First callback should still be 1, second callback should be 1
      expect(onRefresh1).toHaveBeenCalledTimes(1)
      expect(onRefresh2).toHaveBeenCalledTimes(1)
    })
  })

  describe('edge cases', () => {
    it('should handle very small intervals', () => {
      const onRefresh = vi.fn()
      renderHook(() => useAutoRefresh(0.1, onRefresh))

      act(() => {
        vi.advanceTimersByTime(100)
      })

      expect(onRefresh).toHaveBeenCalledTimes(1)
    })

    it('should handle very large intervals', () => {
      const onRefresh = vi.fn()
      renderHook(() => useAutoRefresh(3600, onRefresh))

      act(() => {
        vi.advanceTimersByTime(3600000)
      })

      expect(onRefresh).toHaveBeenCalledTimes(1)
    })

    it('should handle multiple rapid rerenders', () => {
      const onRefresh = vi.fn()
      const { rerender } = renderHook(
        ({ interval }) => useAutoRefresh(interval, onRefresh),
        { initialProps: { interval: 1 } }
      )

      // Rapidly change interval multiple times
      rerender({ interval: 2 })
      rerender({ interval: 1 })
      rerender({ interval: 3 })

      act(() => {
        vi.advanceTimersByTime(3000)
      })

      expect(onRefresh).toHaveBeenCalledTimes(1)
    })
  })
})
