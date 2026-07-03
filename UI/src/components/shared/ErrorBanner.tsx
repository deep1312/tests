import { AxiosError } from 'axios'
import { AlertCircle, X } from 'lucide-react'
import { useState } from 'react'

interface ErrorBannerProps {
  error?: AxiosError | Error | null
  message?: string
  onDismiss?: () => void
}

/**
 * ErrorBanner
 * Supports:
 * 1. API error object (AxiosError / Error)
 * 2. Simple string message
 */
export function ErrorBanner({
  error,
  message,
  onDismiss,
}: ErrorBannerProps) {
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible) return null

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
  }

  let statusCode: string = 'Error'
  let finalMessage: string = 'An error occurred'
  let requestId: string | null = null

  // CASE 1: string message (your Servers.tsx usage)
  if (message) {
    finalMessage = message
  }

  // CASE 2: Axios / Error object
  if (error) {
    const isAxiosError = (err: any): err is AxiosError => {
      return err?.response !== undefined
    }

    if (isAxiosError(error)) {
      statusCode = error.response?.status?.toString() || 'Unknown'

      const data = error.response?.data as any
      finalMessage =
        data?.error?.message ||
        error.message ||
        'An error occurred'

      requestId =
        error.response?.headers?.['x-request-id'] || null
    } else {
      finalMessage = error.message || finalMessage
    }
  }

  return (
    <div className="rounded-md bg-red-50 p-4 mb-4 border border-red-200">
      <div className="flex items-start">
        <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />

        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            Error {statusCode}
          </h3>

          <div className="mt-2 text-sm text-red-700">
            <p>{finalMessage}</p>

            {requestId && (
              <p className="mt-1 text-xs text-red-600">
                Request ID: {requestId}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="ml-3 inline-flex text-red-400 hover:text-red-500 focus:outline-none"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

export default ErrorBanner