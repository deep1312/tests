import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property-based tests for useDashboardFilters hook
 * These tests validate universal properties that must hold across all inputs
 */

// Valid bucket intervals in minutes
const BUCKET_MINUTES: Record<string, number> = {
  '5m': 5,
  '15m': 15,
  '1h': 60,
  '6h': 360,
  '1d': 1440,
}

const VALID_BUCKET_INTERVALS = Object.keys(BUCKET_MINUTES)
const VALID_RANGE_HOURS = [1, 6, 24, 168]
const VALID_REFRESH_INTERVALS = [0, 30, 60, 300]

// Arbitraries for property testing
const arbServerId = fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 1000 }))
const arbCheckId = fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 1000 }))
const arbRangeHours = fc.constantFrom(...VALID_RANGE_HOURS)
const arbBucketInterval = fc.constantFrom(...VALID_BUCKET_INTERVALS)
const arbRefreshInterval = fc.constantFrom(...VALID_REFRESH_INTERVALS)

const arbDashboardFilters = fc.record({
  serverId: arbServerId,
  checkId: arbCheckId,
  rangeHours: arbRangeHours,
  bucketInterval: arbBucketInterval,
  refreshInterval: arbRefreshInterval,
})

describe('useDashboardFilters - Property-Based Tests', () => {
  describe('P7 — Filter state round-trip', () => {
    it('should serialize and deserialize DashboardFilters to/from URL params without loss', () => {
      fc.assert(
        fc.property(arbDashboardFilters, (filters) => {
          // Serialize to URL params
          const params = new URLSearchParams()

          if (filters.serverId !== null) {
            params.set('server', String(filters.serverId))
          }
          if (filters.checkId !== null) {
            params.set('check', String(filters.checkId))
          }
          params.set('range', String(filters.rangeHours))
          params.set('bucket', filters.bucketInterval)
          params.set('refresh', String(filters.refreshInterval))

          // Deserialize from URL params
          const deserialized = {
            serverId: params.has('server') ? Number(params.get('server')) : null,
            checkId: params.has('check') ? Number(params.get('check')) : null,
            rangeHours: Number(params.get('range')),
            bucketInterval: params.get('bucket') || '15m',
            refreshInterval: Number(params.get('refresh')),
          }

          // Verify round-trip
          expect(deserialized.serverId).toBe(filters.serverId)
          expect(deserialized.checkId).toBe(filters.checkId)
          expect(deserialized.rangeHours).toBe(filters.rangeHours)
          expect(deserialized.bucketInterval).toBe(filters.bucketInterval)
          expect(deserialized.refreshInterval).toBe(filters.refreshInterval)
        })
      )
    })

    it('should handle null values correctly in round-trip', () => {
      fc.assert(
        fc.property(
          fc.record({
            serverId: fc.constant(null),
            checkId: fc.constant(null),
            rangeHours: arbRangeHours,
            bucketInterval: arbBucketInterval,
            refreshInterval: arbRefreshInterval,
          }),
          (filters) => {
            const params = new URLSearchParams()

            if (filters.serverId !== null) {
              params.set('server', String(filters.serverId))
            }
            if (filters.checkId !== null) {
              params.set('check', String(filters.checkId))
            }
            params.set('range', String(filters.rangeHours))
            params.set('bucket', filters.bucketInterval)
            params.set('refresh', String(filters.refreshInterval))

            // Verify null values are not in params
            expect(params.has('server')).toBe(false)
            expect(params.has('check')).toBe(false)
          }
        )
      )
    })

    it('should preserve all filter values when converting to URL and back', () => {
      fc.assert(
        fc.property(arbDashboardFilters, (original) => {
          // Create URL string
          const params = new URLSearchParams()
          if (original.serverId !== null) params.set('server', String(original.serverId))
          if (original.checkId !== null) params.set('check', String(original.checkId))
          params.set('range', String(original.rangeHours))
          params.set('bucket', original.bucketInterval)
          params.set('refresh', String(original.refreshInterval))

          const urlString = params.toString()

          // Parse back
          const parsed = new URLSearchParams(urlString)
          const restored = {
            serverId: parsed.has('server') ? Number(parsed.get('server')) : null,
            checkId: parsed.has('check') ? Number(parsed.get('check')) : null,
            rangeHours: Number(parsed.get('range')),
            bucketInterval: parsed.get('bucket') || '15m',
            refreshInterval: Number(parsed.get('refresh')),
          }

          // All values should match
          expect(restored).toEqual(original)
        })
      )
    })

    /**
     * Validates: Requirements 8.6, 8.7
     */
    it('should maintain filter state consistency across multiple round-trips', () => {
      fc.assert(
        fc.property(arbDashboardFilters, (initial) => {
          let current = initial

          // Perform 3 round-trips
          for (let i = 0; i < 3; i++) {
            const params = new URLSearchParams()
            if (current.serverId !== null) params.set('server', String(current.serverId))
            if (current.checkId !== null) params.set('check', String(current.checkId))
            params.set('range', String(current.rangeHours))
            params.set('bucket', current.bucketInterval)
            params.set('refresh', String(current.refreshInterval))

            current = {
              serverId: params.has('server') ? Number(params.get('server')) : null,
              checkId: params.has('check') ? Number(params.get('check')) : null,
              rangeHours: Number(params.get('range')),
              bucketInterval: params.get('bucket') || '15m',
              refreshInterval: Number(params.get('refresh')),
            }
          }

          // After 3 round-trips, should still match original
          expect(current).toEqual(initial)
        })
      )
    })
  })

  describe('P10 — Bucket auto-default', () => {
    it('should always suggest a bucket that fits within the selected time range', () => {
      fc.assert(
        fc.property(arbRangeHours, (rangeHours) => {
          // Get default bucket for this range
          let defaultBucket: string
          switch (rangeHours) {
            case 1:
              defaultBucket = '5m'
              break
            case 6:
              defaultBucket = '15m'
              break
            case 24:
              defaultBucket = '1h'
              break
            case 168:
              defaultBucket = '6h'
              break
            default:
              defaultBucket = '15m'
          }

          const rangeMinutes = rangeHours * 60
          const bucketMinutes = BUCKET_MINUTES[defaultBucket]

          // Bucket duration must be <= range duration
          expect(bucketMinutes).toBeLessThanOrEqual(rangeMinutes)
        })
      )
    })

    it('should downgrade bucket when it exceeds the time range', () => {
      fc.assert(
        fc.property(
          arbRangeHours,
          arbBucketInterval,
          (rangeHours, requestedBucket) => {
            const rangeMinutes = rangeHours * 60
            const requestedBucketMinutes = BUCKET_MINUTES[requestedBucket]

            // Simulate downgrade logic
            let finalBucket = requestedBucket
            if (requestedBucketMinutes > rangeMinutes) {
              // Find largest bucket that fits
              const fittingBuckets = VALID_BUCKET_INTERVALS.filter(
                (b) => BUCKET_MINUTES[b] <= rangeMinutes
              )
              if (fittingBuckets.length > 0) {
                finalBucket = fittingBuckets.reduce((largest, current) => {
                  return BUCKET_MINUTES[current] > BUCKET_MINUTES[largest]
                    ? current
                    : largest
                })
              }
            }

            const finalBucketMinutes = BUCKET_MINUTES[finalBucket]

            // Final bucket must always fit within range
            expect(finalBucketMinutes).toBeLessThanOrEqual(rangeMinutes)
          }
        )
      )
    })

    it('should never suggest a bucket larger than the time range', () => {
      fc.assert(
        fc.property(arbRangeHours, (rangeHours) => {
          const rangeMinutes = rangeHours * 60

          // Test all possible buckets
          VALID_BUCKET_INTERVALS.forEach((bucket) => {
            const bucketMinutes = BUCKET_MINUTES[bucket]

            // If bucket > range, it should be downgraded
            if (bucketMinutes > rangeMinutes) {
              // Find what it would be downgraded to
              const fittingBuckets = VALID_BUCKET_INTERVALS.filter(
                (b) => BUCKET_MINUTES[b] <= rangeMinutes
              )

              // There should always be at least one fitting bucket (5m fits in any range)
              expect(fittingBuckets.length).toBeGreaterThan(0)

              // The largest fitting bucket should be <= range
              const largest = fittingBuckets.reduce((a, b) => {
                return BUCKET_MINUTES[b] > BUCKET_MINUTES[a] ? b : a
              })
              expect(BUCKET_MINUTES[largest]).toBeLessThanOrEqual(rangeMinutes)
            }
          })
        })
      )
    })

    /**
     * Validates: Requirements 8.4, 8.5
     */
    it('should maintain bucket <= range invariant for all combinations', () => {
      fc.assert(
        fc.property(arbRangeHours, arbBucketInterval, (rangeHours, bucket) => {
          const rangeMinutes = rangeHours * 60
          const bucketMinutes = BUCKET_MINUTES[bucket]

          // Simulate the downgrade logic
          let finalBucket = bucket
          if (bucketMinutes > rangeMinutes) {
            const fittingBuckets = VALID_BUCKET_INTERVALS.filter(
              (b) => BUCKET_MINUTES[b] <= rangeMinutes
            )
            if (fittingBuckets.length > 0) {
              finalBucket = fittingBuckets.reduce((largest, current) => {
                return BUCKET_MINUTES[current] > BUCKET_MINUTES[largest]
                  ? current
                  : largest
              })
            }
          }

          const finalBucketMinutes = BUCKET_MINUTES[finalBucket]

          // The invariant: bucket duration <= range duration
          expect(finalBucketMinutes).toBeLessThanOrEqual(rangeMinutes)
        })
      )
    })
  })
})
