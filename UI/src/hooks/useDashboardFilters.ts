import { useSearchParams } from 'react-router-dom'
import {
  useCallback,
  useMemo,
  useEffect,
} from 'react'


/* =========================================================
    API NORMALIZATION MAPS
========================================================= */

export const RANGE_HOURS_TO_API = {
  1: '1H',
  6: '6H',
  24: '24H',
  168: '7D',
} as const;

export interface DashboardFilters {
  serverId: number | null
  checkId: number | null
  rangeHours: number
  refreshInterval: number
  from: string
  to: string
  customFrom?: string | null
  customTo?: string | null
}

/* =========================================================
    STORAGE KEYS
========================================================= */

const STORAGE_KEYS = {
  SERVER: 'pg_monitor_serverId',
  RANGE: 'pg_monitor_rangeHours',
  REFRESH: 'pg_monitor_refreshInterval',
  CUSTOM_FROM: 'pg_monitor_customFrom',
  CUSTOM_TO: 'pg_monitor_customTo',
}

const VALID_RANGE_HOURS = [1, 6, 24, 168]

const VALID_REFRESH_INTERVALS = [
  0,
  30,
  60,
  300,
]

/* =========================================================
    HELPERS
========================================================= */

function makeTimeRange(rangeHours: number): {
  from: string
  to: string
} {
  const to = new Date()

  const seconds = to.getSeconds()

  to.setSeconds(
    Math.floor(seconds / 10) * 10,
    0
  )

  const from = new Date(
    to.getTime() - rangeHours * 3600_000
  )

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  }
}

/* =========================================================
    MAIN HOOK
========================================================= */

export function useDashboardFilters() {
  const [searchParams, setSearchParams] =
    useSearchParams()

  /* =========================================================
      HYDRATION
  ========================================================= */

  const serverId = useMemo(() => {
    const value =
      searchParams.get('server') ||
      localStorage.getItem(STORAGE_KEYS.SERVER)

    return value && value !== 'null'
      ? Number(value)
      : null
  }, [searchParams])

  const rangeHours = useMemo(() => {
    const value =
      searchParams.get('range') ||
      localStorage.getItem(STORAGE_KEYS.RANGE)

    const parsed = value ? Number(value) : 24

    return VALID_RANGE_HOURS.includes(parsed)
      ? parsed
      : 24
  }, [searchParams])

  const refreshInterval = useMemo(() => {
    const value =
      searchParams.get('refresh') ||
      localStorage.getItem(
        STORAGE_KEYS.REFRESH
      )

    const parsed = value ? Number(value) : 0

    return VALID_REFRESH_INTERVALS.includes(
      parsed
    )
      ? parsed
      : 0
  }, [searchParams])

  const checkId = useMemo(() => {
    const value = searchParams.get('check')

    return value ? Number(value) : null
  }, [searchParams])

  const customFrom = useMemo(() => {
    return searchParams.get('cf') || localStorage.getItem(STORAGE_KEYS.CUSTOM_FROM) || null
  }, [searchParams])

  const customTo = useMemo(() => {
    return searchParams.get('ct') || localStorage.getItem(STORAGE_KEYS.CUSTOM_TO) || null
  }, [searchParams])

  /* =========================================================
      URL SYNC
  ========================================================= */

  useEffect(() => {
    const newParams = new URLSearchParams(
      searchParams
    )

    let changed = false

    const persistedServer =
      localStorage.getItem(
        STORAGE_KEYS.SERVER
      )

    if (
      !searchParams.has('server') &&
      persistedServer &&
      persistedServer !== 'null'
    ) {
      newParams.set(
        'server',
        persistedServer
      )

      changed = true
    }

    if (!searchParams.has('range')) {
      newParams.set(
        'range',
        String(rangeHours)
      )

      changed = true
    }

    if (!searchParams.has('refresh')) {
      newParams.set(
        'refresh',
        String(refreshInterval)
      )

      changed = true
    }

    if (changed) {
      setSearchParams(newParams, {
        replace: true,
      })
    }
  }, [
    searchParams,
    setSearchParams,
    rangeHours,
    refreshInterval,
  ])

  /* =========================================================
      TIME RANGE
  ========================================================= */

  const isCustom = !!customFrom && !!customTo

  const { from, to } = useMemo(() => {
    if (isCustom) {
      return { from: customFrom!, to: customTo! }
    }
    return makeTimeRange(rangeHours)
  }, [rangeHours, customFrom, customTo, isCustom])

  /* =========================================================
      UPDATE FILTERS
  ========================================================= */

  const updateFilters = useCallback(
    (patch: Partial<DashboardFilters>) => {
      const newParams = new URLSearchParams(
        searchParams
      )

      /* SERVER */

      if (patch.serverId !== undefined) {
        if (patch.serverId === null) {
          newParams.delete('server')

          localStorage.removeItem(
            STORAGE_KEYS.SERVER
          )
        } else {
          const value = String(
            patch.serverId
          )

          newParams.set('server', value)

          localStorage.setItem(
            STORAGE_KEYS.SERVER,
            value
          )
        }
      }

      /* RANGE */

      if (patch.rangeHours !== undefined) {
        const value = String(
          patch.rangeHours
        )

        newParams.set('range', value)

        localStorage.setItem(
          STORAGE_KEYS.RANGE,
          value
        )
      }

      /* REFRESH */

      if (
        patch.refreshInterval !== undefined
      ) {
        const value = String(
          patch.refreshInterval
        )

        newParams.set('refresh', value)

        localStorage.setItem(
          STORAGE_KEYS.REFRESH,
          value
        )
      }

      /* CHECK */

      if (patch.checkId !== undefined) {
        if (patch.checkId === null) {
          newParams.delete('check')
        } else {
          newParams.set(
            'check',
            String(patch.checkId)
        )
        }
      }

      /* CUSTOM FROM / TO */

      if (patch.customFrom !== undefined) {
        if (patch.customFrom) {
          newParams.set('cf', patch.customFrom)
          localStorage.setItem(STORAGE_KEYS.CUSTOM_FROM, patch.customFrom)
        } else {
          newParams.delete('cf')
          localStorage.removeItem(STORAGE_KEYS.CUSTOM_FROM)
        }
      }

      if (patch.customTo !== undefined) {
        if (patch.customTo) {
          newParams.set('ct', patch.customTo)
          localStorage.setItem(STORAGE_KEYS.CUSTOM_TO, patch.customTo)
        } else {
          newParams.delete('ct')
          localStorage.removeItem(STORAGE_KEYS.CUSTOM_TO)
        }
      }

      // When preset range is selected (without explicit custom dates in the same patch), clear custom dates
      if (patch.rangeHours !== undefined && patch.customFrom === undefined && patch.customTo === undefined) {
        newParams.delete('cf')
        newParams.delete('ct')
        localStorage.removeItem(STORAGE_KEYS.CUSTOM_FROM)
        localStorage.removeItem(STORAGE_KEYS.CUSTOM_TO)
      }

      // When custom dates are set, also set rangeHours to keep URL consistent

      setSearchParams(newParams)
    },
    [searchParams, setSearchParams]
  )

  /* =========================================================
      CLEAR FILTERS
  ========================================================= */

  const clearFilters = useCallback(() => {
    Object.values(STORAGE_KEYS).forEach(
      (key) => {
        localStorage.removeItem(key)
      }
    )

    setSearchParams(new URLSearchParams(), {
      replace: true,
    })
  }, [setSearchParams])

  /* =========================================================
      FINAL FILTER OBJECT
  ========================================================= */

  const filters: DashboardFilters = {
    serverId,
    checkId,
    rangeHours,
    refreshInterval,
    from,
    to,
    customFrom,
    customTo,
  }

  

  return {
    filters,
    updateFilters,
    clearFilters,
  }
}