import { useMemo } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet'
import { Badge } from '../ui/badge'
import { Card } from '../ui/card'
import { formatInTZ } from '../../utils/timezone'
import { Zap, CheckCircle } from 'lucide-react'
import type { Alert } from '../../api/alerts'

interface AlertDetailSheetProps {
  alert: Alert | null
  serverName: string
  checkName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function generateAlertDescription(alert: Alert, serverName: string, checkName: string): string {
  const statusLabel = alert.status === 'CRITICAL' ? 'critical' : 'warning'
  const ackStatus = alert.acknowledged_at ? 'This alert has been acknowledged.' : 'This alert has not been acknowledged yet.'
  const incidentInfo = alert.incident_id
    ? `It is part of incident #${alert.incident_id}.`
    : 'It is not yet associated with any incident.'
  return `A ${statusLabel} alert was triggered for check "${checkName}" on server "${serverName}". The metric "${alert.metric_name}" recorded a value of ${alert.observed_value?.toLocaleString() ?? 'N/A'}, which breached the defined threshold. The alert was triggered on ${formatInTZ(alert.triggered_at)}. ${ackStatus} ${incidentInfo}`
}

function AlertTimeline({ alert }: { alert: Alert }) {
  const events = [
    { icon: Zap, label: 'Alert Created', time: alert.triggered_at, color: 'text-amber-500 bg-amber-50' },
    ...(alert.acknowledged_at
      ? [{ icon: CheckCircle, label: 'Acknowledged', time: alert.acknowledged_at, color: 'text-green-500 bg-green-50' as const }
      ] : []),
  ]

  return (
    <div className="space-y-3">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Timeline</h4>
      <div className="relative pl-5 space-y-3">
        {events.map((ev, i) => (
          <div key={ev.label} className="relative">
            {i < events.length - 1 && (
              <div className="absolute left-[7px] top-4 bottom-0 w-px bg-slate-200" />
            )}
            <div className="flex items-start gap-2.5">
              <div className={`rounded-full p-1 ${ev.color} ring-2 ring-white`}>
                <ev.icon className="h-2.5 w-2.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-700">{ev.label}</p>
                <p className="text-[10px] text-slate-400">{formatInTZ(ev.time)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AlertDetailSheet({ alert, serverName, checkName, open, onOpenChange }: AlertDetailSheetProps) {
  if (!alert) return null

  const description = useMemo(
    () => generateAlertDescription(alert, serverName, checkName),
    [alert, serverName, checkName]
  )

  const fields = [
    { label: 'Alert ID', value: `#${alert.alert_id}` },
    { label: 'Check', value: checkName },
    { label: 'Server', value: serverName },
    { label: 'Metric', value: alert.metric_name },
    { label: 'Observed Value', value: alert.observed_value?.toLocaleString() ?? '\u2014' },
    { label: 'Status', value: alert.status },
    { label: 'Triggered At', value: formatInTZ(alert.triggered_at) },
    { label: 'Acknowledged At', value: alert.acknowledged_at ? formatInTZ(alert.acknowledged_at) : '\u2014' },
    { label: 'Incident ID', value: alert.incident_id ? `#${alert.incident_id}` : '\u2014' },
  ]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            Alert Details
            <Badge
              variant={alert.status === 'CRITICAL' ? 'destructive' : 'secondary'}
              className="text-[9px] px-1.5 py-0 h-4"
            >
              {alert.status}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <Card className="mb-4 p-3 bg-blue-50 border-blue-200">
          <p className="text-[11px] leading-relaxed text-slate-700">{description}</p>
        </Card>

        <div className="mb-4">
          <AlertTimeline alert={alert} />
        </div>

        <div className="space-y-2">
          {fields.map((f) => (
            <div key={f.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-[10px] font-medium text-slate-500">{f.label}</span>
              <span className="text-[11px] font-semibold text-slate-800 text-right max-w-[60%] truncate">{f.value}</span>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
