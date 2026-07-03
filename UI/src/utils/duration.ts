/**
 * Format seconds as human-readable duration (e.g., "2h 14m")
 * Validates: Requirements 17.3
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0) return '0s'
  if (seconds === 0) return '0s'

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (secs > 0 && hours === 0) parts.push(`${secs}s`)

  return parts.join(' ') || '0s'
}

/**
 * Format milliseconds as human-readable duration
 */
export function formatDurationMs(ms: number): string {
  return formatDuration(Math.round(ms / 1000))
}
