import { describe, it, expect } from 'vitest'
import { toLocalTime, getCurrentUTCTime, toUTCIso } from '../../utils/timezone'

describe('timezone utilities', () => {
  describe('toLocalTime', () => {
    it('should convert ISO 8601 UTC string to local time', () => {
      const utcIso = '2024-01-15T10:30:00Z'
      const result = toLocalTime(utcIso)
      expect(result).toBeTruthy()
      expect(result).toContain('Jan')
      expect(result).toContain('15')
    })

    it('should use custom format when provided', () => {
      const utcIso = '2024-01-15T10:30:00Z'
      const result = toLocalTime(utcIso, 'yyyy-MM-dd')
      expect(result).toBe('2024-01-15')
    })

    it('should handle invalid ISO strings gracefully', () => {
      const result = toLocalTime('invalid-date')
      expect(result).toBe('invalid-date')
    })

    it('should use default format when not provided', () => {
      const utcIso = '2024-01-15T10:30:00Z'
      const result = toLocalTime(utcIso)
      expect(result).toMatch(/Jan 15, 2024/)
    })
  })

  describe('getCurrentUTCTime', () => {
    it('should return current time in UTC ISO format', () => {
      const result = getCurrentUTCTime()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      expect(result).toContain('Z')
    })
  })

  describe('toUTCIso', () => {
    it('should convert Date object to UTC ISO string', () => {
      const date = new Date('2024-01-15T10:30:00Z')
      const result = toUTCIso(date)
      expect(result).toContain('2024-01-15')
      expect(result).toContain('Z')
    })
  })
})
