import { useState } from 'react'
import { useAuditLogs } from '../api/audit'
import { LoadingSpinner } from '../components/shared/LoadingSpinner'
import { ErrorBanner } from '../components/shared/ErrorBanner'
import { EmptyState } from '../components/shared/EmptyState'
import { FileText } from 'lucide-react'
import { formatInTZ } from '../utils/timezone'

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  CREDENTIAL_ROTATION: 'bg-purple-100 text-purple-800',
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

  return (
    <div className="p-4 space-y-3">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Audit Log</h1>
        <p className="text-[11px] text-gray-500">All configuration changes and system events</p>
      </div>

      <div className="flex gap-2">
        <input
          className="border rounded px-2 py-1.5 text-xs w-32"
          placeholder="Resource type"
          value={resourceType}
          onChange={e => { setResourceType(e.target.value); setPage(0) }}
        />
        <input
          className="border rounded px-2 py-1.5 text-xs w-32"
          placeholder="User ID"
          value={userId}
          onChange={e => { setUserId(e.target.value); setPage(0) }}
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? <div className="p-4"><LoadingSpinner /></div>
          : isError ? <div className="p-4"><ErrorBanner message="Failed to load audit log." /></div>
          : logs.length === 0 ? <EmptyState icon={FileText} title="No audit entries" description="No entries match the current filter" />
          : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Time', 'User', 'Action', 'Resource', 'ID', 'Payload'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map(l => (
                  <tr key={l.log_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{formatInTZ(l.changed_at)}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">{l.user_id}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ACTION_COLORS[l.action] ?? 'bg-gray-100 text-gray-800'}`}>
                        {l.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">{l.resource_type}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{l.resource_id}</td>
                    <td className="px-3 py-2 text-xs text-gray-500 max-w-xs">
                      <details>
                        <summary className="cursor-pointer text-blue-600 text-[10px]">View</summary>
                        <pre className="mt-1 text-[10px] bg-gray-50 p-1.5 rounded overflow-auto max-h-24">{JSON.stringify(l.payload, null, 2)}</pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        {totalPages > 1 && (
          <div className="px-3 py-2 border-t flex items-center justify-between text-xs text-gray-500">
            <span>Page {page + 1} of {totalPages} ({total} total)</span>
            <div className="flex gap-1.5">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-2 py-1 border rounded text-xs disabled:opacity-40">Prev</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="px-2 py-1 border rounded text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AuditLog
