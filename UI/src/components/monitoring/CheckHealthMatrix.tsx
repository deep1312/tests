import { formatDistanceToNow } from 'date-fns'
import {
  Activity,
  Clock,
  Server,
} from 'lucide-react'

import { LatestPerCheckRow } from '../../api/monitoring'
import { VisualResolver } from './VisualResolver'

interface CheckHealthMatrixProps {
  data: LatestPerCheckRow[]
  isLoading: boolean
  onCellClick: (
    serverId: number,
    checkId: number
  ) => void
  selectedCheckId?: number
}

export function CheckHealthMatrix({
  data,
  isLoading,
  onCellClick,
  selectedCheckId,
}: CheckHealthMatrixProps) {
  /* =========================================================
      LOADING STATE
  ========================================================= */

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="h-[400px] animate-pulse rounded-[2.5rem] border border-border bg-card/90 backdrop-blur-sm"
          />
        ))}
      </div>
    )
  }

  /* =========================================================
      EMPTY STATE
  ========================================================= */

  if (!data || data.length === 0) {
    return (
      <div className="rounded-[2.5rem] border border-border bg-card/90 backdrop-blur-sm py-20 text-center shadow-sm">
        <div className="mb-4 text-5xl opacity-20">
          📊
        </div>

        <p className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">
          No Active Telemetry Found
        </p>
      </div>
    )
  }

  /* =========================================================
      STATUS HELPER
  ========================================================= */

  const isHealthyStatus = (
    status: string | number | null | undefined
  ) => {
    if (status === null || status === undefined) {
      return false
    }

    if (typeof status === 'number') {
      return status === 1
    }

    const normalized =
      status.toString().toUpperCase()

    return (
      normalized === 'SUCCESS' ||
      normalized === 'OK' ||
      normalized === 'HEALTHY'
    )
  }

  /* =========================================================
      UI
  ========================================================= */

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.map((row) => {
        const isOnline = isHealthyStatus(
          row.status
        )

        const isSelected =
          selectedCheckId === row.check_id

        return (
          <div
            key={`${row.server_id}-${row.check_id}`}
            onClick={() =>
              onCellClick(
                row.server_id,
                row.check_id
              )
            }
            className={`group flex h-[400px] cursor-pointer flex-col overflow-hidden rounded-[2.5rem] border transition-all duration-300
              ${
                isSelected
                  ? 'scale-[1.02] border-blue-600 bg-card/90 backdrop-blur-sm shadow-2xl ring-4 ring-blue-50'
                  : 'border-border bg-card/90 backdrop-blur-sm shadow-sm hover:border-blue-300 hover:shadow-xl'
              }`}
          >
            {/* HEADER */}

            <div className="flex items-start justify-between p-6 pb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-2xl p-2.5 ${
                    isOnline
                      ? 'bg-emerald-50'
                      : 'bg-rose-50'
                  }`}
                >
                  <Activity
                    className={`h-4 w-4 ${
                      isOnline
                        ? 'text-emerald-500'
                        : 'text-rose-500'
                    }`}
                  />
                </div>

                <div>
                  <h4 className="max-w-[150px] truncate text-xs font-black uppercase tracking-wider text-foreground transition-colors group-hover:text-blue-600">
                    {row.check_name}
                  </h4>

                  <div className="mt-0.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-tight text-muted-foreground">
                    <Server className="h-3 w-3" />

                    <span>
                      {row.server_label ||
                        'Default DB'}
                    </span>
                  </div>
                </div>
              </div>

              <div
                className={`rounded-full px-2.5 py-1 text-[8px] font-black tracking-tighter ${
                  isOnline
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {isOnline
                  ? 'ONLINE'
                  : 'ALERT'}
              </div>
            </div>

            {/* VISUAL AREA */}

            <div className="relative mx-4 flex-1 overflow-hidden rounded-[1.5rem] border border-slate-100 bg-muted/40">
              <VisualResolver
                checkData={row}
              />
            </div>

            {/* FOOTER */}

            <div className="flex items-center justify-between px-7 py-5">
              <div className="flex items-center gap-2 text-[9px] font-bold uppercase text-muted-foreground">
                <Clock className="h-3 w-3 text-slate-300" />

                <span>
                  {row.started_at
                    ? formatDistanceToNow(
                        new Date(
                          row.started_at
                        ),
                        {
                          addSuffix: true,
                        }
                      )
                    : 'Just now'}
                </span>
              </div>

              <div className="rounded-md bg-muted/80 px-2 py-0.5 text-[9px] font-black text-slate-300">
                CID-{row.check_id}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default CheckHealthMatrix