import { type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
        <Icon className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-6 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-glow-sm hover:shadow-glow-md transition-all duration-300"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
