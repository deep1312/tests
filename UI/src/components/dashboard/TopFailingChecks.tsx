import { AlertTriangle } from 'lucide-react'
import { TopFailingCheck } from '../../api/dashboard'

interface TopFailingChecksProps {
  checks: TopFailingCheck[]
}

/**
 * Renders top 5 failing checks with check name and failure count
 * Validates: Requirements 15.8
 */
export function TopFailingChecks({ checks }: TopFailingChecksProps) {
  if (!checks || checks.length === 0) {
    return null
  }

  const maxFailures = Math.max(...checks.map((c) => c.failure_count))

  return (
    <div className="bg-card/90 backdrop-blur-sm rounded-lg border border-border p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1">
      <div className="flex items-center space-x-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-destructive" />
        <h3 className="text-lg font-semibold text-foreground">Top Failing Checks</h3>
      </div>

      <div className="space-y-4">
        {checks.map((check) => (
          <div key={check.check_id}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-foreground">
                {check.check_name}
              </span>
              <span className="text-sm font-semibold text-destructive">
                {check.failure_count} failures
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-destructive h-2 rounded-full transition-all"
                style={{
                  width: `${(check.failure_count / maxFailures) * 100}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TopFailingChecks
