import { useState } from 'react'
import { useAuditLogs } from '../api/audit'

import { ErrorBanner } from '../components/shared/ErrorBanner'
import { EmptyState } from '../components/shared/EmptyState'
import { FileText, Search } from 'lucide-react'
import { formatInTZ } from '../utils/timezone'

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-success/10 text-success border-success/20',
  UPDATE: 'bg-info/10 text-info border-info/20',
  DELETE: 'bg-destructive/10 text-destructive border-destructive/20',
  CREDENTIAL_ROTATION: 'bg-primary/10 text-primary border-primary/20',
}

/* ── Skeleton ── */
function AuditLogSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" aria-hidden="true">
      <div className="space-y-2">
        <div className="h-7 w-32 skeleton" />
        <div className="h-4 w-64 skeleton" />
      </div>
      <div className="flex gap-3">
        <div className="h-10 w-40 skeleton rounded-xl" />
        <div className="h-10 w-40 skeleton rounded-xl" />
      </div>
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3 bg-muted/50">
          <div className="h-4 w-full skeleton" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="px-5 py-3 border-t border-border/50">
            <div className="h-4 w-full skeleton" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function AuditLog() {
  const [page, setPage] = useState(0)
  const [resourceType, setResourceType] = useState('')
  const [userId, setUserId] = useState('')
  const limit = 25

  const { data, isLoading, isError } = useAuditLogs(
    resourceType || undefined,
    undefined,
    userId || undefined,
    undefined,
    undefined,
    limit,
    page * limit
  )

  const logs = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = Math.ceil(total / limit)

  if (isLoading) return <AuditLogSkeleton />

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-1">All configuration changes and system events</p>
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="h-10 pl-9 pr-3 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:ring-2 focus:ring-ring focus:outline-none w-44 transition-all duration-200"
            placeholder="Resource type"
            value={resourceType}
            onChange={e => { setResourceType(e.target.value); setPage(0) }}
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="h-10 pl-9 pr-3 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:ring-2 focus:ring-ring focus:outline-none w-44 transition-all duration-200"
            placeholder="User ID"
            value={userId}
            onChange={e => { setUserId(e.target.value); setPage(0) }}
          />
        </div>
      </div>

      {/* ── Audit Table ── */}
      <div className="glass-card overflow-hidden">
        {isError ? (
          <div className="p-6"><ErrorBanner message="Failed to load audit log." /></div>
        ) : logs.length === 0 ? (
          <EmptyState icon={FileText} title="No audit entries" description="No entries match the current filter" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-muted/50">
                    {['Time', 'User', 'Action', 'Resource', 'ID', 'Payload'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {logs.map(l => (
                    <tr key={l.log_id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatInTZ(l.changed_at)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{l.user_id}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-semibold ${ACTION_COLORS[l.action] ?? 'bg-muted text-muted-foreground border-border'}`}>
                          {l.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{l.resource_type}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground tabular-nums">{l.resource_id}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs">
                        <details className="group">
                          <summary className="cursor-pointer text-primary text-xs font-medium hover:text-primary/80 transition-colors">
                            View payload
                          </summary>
                          <pre className="mt-2 text-xs bg-muted/50 border border-border rounded-xl p-3 overflow-auto max-h-32 text-foreground">{JSON.stringify(l.payload, null, 2)}</pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Page {page + 1} of {totalPages} <span className="text-muted-foreground/60">({total} total)</span>
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                    className="px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-medium hover:bg-muted/80 transition-all duration-200 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                    className="px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-medium hover:bg-muted/80 transition-all duration-200 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default AuditLog
