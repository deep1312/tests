import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

/**
 * Reusable empty state component with icon, message, and optional CTA
 * Validates: Requirements 15.12, 16.7, 17.10
 */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      {Icon && (
        <Icon className="mx-auto h-12 w-12 text-gray-400" />
      )}
      <h3 className="mt-2 text-sm font-medium text-gray-900">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
      {action && (
        <div className="mt-6">
          <button
            onClick={action.onClick}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {action.label}
          </button>
        </div>
      )}
    </div>
  )
}

export default EmptyState
