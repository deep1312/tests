import { format, parseISO } from 'date-fns'
import { useTimezoneStore, TIMEZONE_MAP } from '../store/timezoneStore'

/**
 * Convert UTC ISO 8601 timestamp to local timezone
 * Validates: Requirements 14.9
 */
export function toLocalTime(utcIso: string, formatStr?: string): string {
  try {
    const date = parseISO(utcIso)
    const defaultFormat = 'MMM d, yyyy HH:mm'
    return format(date, formatStr || defaultFormat)
  } catch (error) {
    console.error('Failed to parse timestamp:', utcIso, error)
    return utcIso
  }
}

/**
 * Get current time in UTC ISO format
 */
export function getCurrentUTCTime(): string {
  return new Date().toISOString()
}

/**
 * Format a date object as UTC ISO string
 */
export function toUTCIso(date: Date): string {
  return date.toISOString()
}

/**
 * Format a timestamp value in the app-selected timezone.
 * Accepts ISO string, Date, or number. Returns formatted string.
 * For invalid/missing values, returns '—'.
 */
function formatDateInTZ(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: tz,
  }).formatToParts(d)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return `${get('month')}-${get('day')}-${get('year')} ${get('hour')}:${get('minute')} ${get('dayPeriod')}`
}

export function formatInTZ(
  val: string | number | Date | null | undefined,
  _options?: Intl.DateTimeFormatOptions,
): string {
  if (val == null) return '—'
  let d: Date
  if (val instanceof Date) d = val
  else if (typeof val === 'number') d = new Date(val)
  else {
    d = new Date(val.includes(' ') ? val.replace(' ', 'T') : val)
  }
  if (isNaN(d.getTime())) return String(val)

  const tz = TIMEZONE_MAP[useTimezoneStore.getState().timezone]
  return formatDateInTZ(d, tz)
}

export function useFormatInTZ() {
  const timezone = useTimezoneStore((s) => s.timezone)
  const tz = TIMEZONE_MAP[timezone]
  return (val: string | number | Date | null | undefined, _options?: Intl.DateTimeFormatOptions) => {
    if (val == null) return '—'
    let d: Date
    if (val instanceof Date) d = val
    else if (typeof val === 'number') d = new Date(val)
    else {
      d = new Date(val.includes(' ') ? val.replace(' ', 'T') : val)
    }
    if (isNaN(d.getTime())) return String(val)
    return formatDateInTZ(d, tz)
  }
}
