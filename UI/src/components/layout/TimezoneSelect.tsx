import { useTimezoneStore, type Timezone } from '../../store/timezoneStore'
import { Globe } from 'lucide-react'

const OPTIONS: { label: string; value: Timezone }[] = [
  { label: 'IST (UTC+5:30)', value: 'IST' },
  { label: 'EST (UTC-5:00)', value: 'EST' },
]

export function TimezoneSelect({ compact }: { compact?: boolean }) {
  const timezone = useTimezoneStore((s) => s.timezone)
  const setTimezone = useTimezoneStore((s) => s.setTimezone)

  if (compact) {
    return (
      <select
        value={timezone}
        onChange={(e) => setTimezone(e.target.value as Timezone)}
        className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 outline-none"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 px-3">
        <Globe className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Timezone</span>
      </div>
      <div className="px-3">
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value as Timezone)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-400"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
