import { 
  Cpu, 
  Database, 
  HardDrive, 
  Users, 
  Zap 
} from 'lucide-react'

/* =========================================================
    TYPES
========================================================= */

interface LiveMetricsSummary {
  cpu_usage?: number
  memory_usage?: number
  disk_usage?: number
  active_connections?: number
  query_latency_ms?: number
}

interface SummaryPanelProps {
  summary: LiveMetricsSummary | undefined
  isLoading: boolean
}

/* =========================================================
    MAIN COMPONENT
========================================================= */

export function SummaryPanel({
  summary,
  isLoading,
}: SummaryPanelProps) {

  // Logic to determine color based on severity
  const getUsageColor = (value: number | null | undefined): string => {
    if (value === null || value === undefined) {
      return 'text-gray-700 bg-muted border-border'
    }
    if (value >= 90) return 'text-red-700 bg-red-50 border-red-100'
    if (value >= 70) return 'text-amber-700 bg-amber-50 border-amber-100'
    return 'text-green-700 bg-green-50 border-green-100'
  }

  const showPlaceholder = !summary

  /* =========================================================
      SUB-COMPONENT: KPI CARD
  ========================================================= */
  const KPICard = ({
    label,
    value,
    icon: Icon,
    colorClass = 'text-gray-700 bg-muted border-border',
  }: {
    label: string
    value: string | number
    icon: any
    colorClass?: string
  }) => (
    <div className={`rounded-xl border p-4 transition-all duration-300 ${colorClass}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
          {label}
        </p>
        <Icon className="w-4 h-4 opacity-70" />
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
    </div>
  )

  // Skeleton Loading State
  if (isLoading) {
    return (
      <div className="px-6 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-100 p-4 bg-muted animate-pulse"
            >
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">

        <KPICard
          label="CPU Usage"
          icon={Cpu}
          value={showPlaceholder ? '0%' : `${summary?.cpu_usage ?? 0}%`}
          colorClass={getUsageColor(summary?.cpu_usage)}
        />

        <KPICard
          label="Memory"
          icon={Database}
          value={showPlaceholder ? '0%' : `${summary?.memory_usage ?? 0}%`}
          colorClass={getUsageColor(summary?.memory_usage)}
        />

        <KPICard
          label="Disk Space"
          icon={HardDrive}
          value={showPlaceholder ? '0%' : `${summary?.disk_usage ?? 0}%`}
          colorClass={getUsageColor(summary?.disk_usage)}
        />

        <KPICard
          label="Connections"
          icon={Users}
          value={showPlaceholder ? '0' : (summary?.active_connections ?? 0).toLocaleString()}
          colorClass="text-blue-700 bg-blue-50 border-blue-100"
        />

        <KPICard
          label="Latency"
          icon={Zap}
          value={showPlaceholder ? '0 ms' : `${summary?.query_latency_ms ?? 0} ms`}
          colorClass="text-purple-700 bg-purple-50 border-purple-100"
        />

      </div>
    </div>
  )
}

export default SummaryPanel