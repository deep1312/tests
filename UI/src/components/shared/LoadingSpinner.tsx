/**
 * Accessible loading indicator shown while API requests are in flight
 * Validates: Requirements 14.6
 */
export function LoadingSpinner() {
  return (
    <div
      className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
}

export default LoadingSpinner
