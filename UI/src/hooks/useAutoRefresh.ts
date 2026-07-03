import { useEffect } from 'react'

/**
 * Custom hook for managing auto-refresh functionality with Page Visibility API support
 *
 * Accepts an interval in seconds and a callback function. When the interval is > 0,
 * sets up a recurring timer that calls the callback at the specified interval.
 * The callback is skipped when the browser tab is hidden (document.hidden).
 * The interval is cleared on cleanup and when intervalSec changes to 0.
 *
 * Validates: Requirements 9.1, 9.2, 9.4
 *
 * @param intervalSec - Interval in seconds (0 to disable)
 * @param onRefresh - Callback function to invoke on each interval
 */
export function useAutoRefresh(intervalSec: number, onRefresh: () => void): void {
  useEffect(() => {
    // If interval is 0 or negative, don't set up the interval
    if (intervalSec <= 0) {
      return
    }

    // Set up the interval
    const intervalId = setInterval(() => {
      // Skip callback if the page is hidden (Page Visibility API)
      if (!document.hidden) {
        onRefresh()
      }
    }, intervalSec * 1000)

    // Cleanup: clear the interval on unmount or when dependencies change
    return () => {
      clearInterval(intervalId)
    }
  }, [intervalSec, onRefresh])
}
