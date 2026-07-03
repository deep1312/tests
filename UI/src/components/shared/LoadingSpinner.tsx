import { Loader2 } from 'lucide-react'

export function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div className="relative">
        <div className="w-10 h-10 rounded-full border-2 border-muted" />
        <Loader2 className="w-10 h-10 text-primary animate-spin absolute inset-0" />
      </div>
      <p className="text-xs text-muted-foreground font-medium">Loading...</p>
    </div>
  )
}
