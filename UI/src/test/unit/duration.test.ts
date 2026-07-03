import { describe, it, expect } from 'vitest'
import { formatDuration, formatDurationMs } from '../../utils/duration'

describe('duration utilities', () => {
  describe('formatDuration', () => {
    it('should format 0 seconds as "0s"', () => {
      expect(formatDuration(0)).toBe('0s')
    })

    it('should format seconds only', () => {
      expect(formatDuration(30)).toBe('30s')
      expect(formatDuration(59)).toBe('59s')
    })

    it('should format minutes and seconds', () => {
      expect(formatDuration(60)).toBe('1m')
      expect(formatDuration(90)).toBe('1m')
      expect(formatDuration(125)).toBe('2m')
    })

    it('should format hours and minutes', () => {
      expect(formatDuration(3600)).toBe('1h')
      expect(formatDuration(3660)).toBe('1h 1m')
      expect(formatDuration(7200)).toBe('2h')
      expect(formatDuration(7920)).toBe('2h 12m')
    })

    it('should format complex durations', () => {
      expect(formatDuration(3661)).toBe('1h 1m')
      expect(formatDuration(7384)).toBe('2h 3m')
    })

    it('should handle negative seconds', () => {
      expect(formatDuration(-10)).toBe('0s')
    })

    it('should handle large durations', () => {
      expect(formatDuration(86400)).toBe('24h')
      expect(formatDuration(90061)).toBe('25h 1m')
    })
  })

  describe('formatDurationMs', () => {
    it('should convert milliseconds to duration format', () => {
      expect(formatDurationMs(1000)).toBe('1s')
      expect(formatDurationMs(60000)).toBe('1m')
      expect(formatDurationMs(3600000)).toBe('1h')
    })

    it('should round milliseconds correctly', () => {
      expect(formatDurationMs(1500)).toBe('2s')
      expect(formatDurationMs(1400)).toBe('1s')
    })
  })
})
