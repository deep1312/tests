import { AlertCircle, XCircle } from 'lucide-react'

interface ErrorBannerProps {
  message?: string
  error?: Error
  onDismiss?: () => void
}

export function ErrorBanner({ message, error, onDismiss }: ErrorBannerProps) {
  const displayMessage = message || error?.message || 'An unexpected error occurred.'

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 animate-slide-in">
      <div className="w-8 h-8 rounded-lg bg-destructive/20 flex items-center justify-center flex-shrink-0">
        <AlertCircle className="w-4 h-4 text-destructive" />
      </div>
      <p className="text-sm font-medium text-destructive flex-1">{displayMessage}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 rounded-lg hover:bg-destructive/20 transition-colors"
        >
          <XCircle className="w-4 h-4 text-destructive" />
        </button>
      )}
    </div>
  )
}