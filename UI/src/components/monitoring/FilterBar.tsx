
import { useState, useEffect, useCallback } from 'react'

import * as Select from '@radix-ui/react-select'

import { ChevronDown, RotateCcw, Server, Activity, Clock, RefreshCcw } from 'lucide-react'

import { useServers } from '../../api/servers'

import { useChecks } from '../../api/checks'

import { DashboardFilters } from '../../hooks/useDashboardFilters'

import { Button } from '../ui/button'


interface FilterBarProps {

  filters: DashboardFilters

  onChange: (patch: Partial<DashboardFilters>) => void

}


const RANGE_OPTIONS = [
  { label: '1H', hours: 1 },
  { label: '6H', hours: 6 },
  { label: '24H', hours: 24 },
  { label: '7D', hours: 168 },
  { label: 'Custom', hours: null },
] as const

const RANGE_LABEL_MAP: Record<number, string> = {
  1: '1H',
  6: '6H',
  24: '24H',
  168: '7D',
}

const REFRESH_OPTIONS = [

  { label: 'Off', seconds: 0 },
  { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 },
  { label: '5m', seconds: 300 },

]


function toDatetimeLocal(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(val: string): string {
  if (!val) return ''
  return new Date(val).toISOString()
}


export function FilterBar({ filters, onChange }: FilterBarProps) {

  const { data: serversData } = useServers(undefined, true, undefined, 1000)
  const { data: checksData } = useChecks(undefined, true, 1000)

  const [countdown, setCountdown] = useState<number>(filters.refreshInterval)

  const [showCustom, setShowCustom] = useState(!!(filters.customFrom && filters.customTo))
  const [localFrom, setLocalFrom] = useState(filters.customFrom ? toDatetimeLocal(filters.customFrom) : '')
  const [localTo, setLocalTo] = useState(filters.customTo ? toDatetimeLocal(filters.customTo) : '')

  useEffect(() => {
    if (filters.refreshInterval === 0) {
      setCountdown(0)
      return
    }

    setCountdown(filters.refreshInterval)
    const interval = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? filters.refreshInterval : prev - 1))
    }, 1000)

    return () => clearInterval(interval)
  }, [filters.refreshInterval])

  useEffect(() => {
    setShowCustom(!!(filters.customFrom && filters.customTo))
  }, [filters.customFrom, filters.customTo])

  useEffect(() => {
    if (filters.customFrom && filters.customTo) {
      setLocalFrom(toDatetimeLocal(filters.customFrom))
      setLocalTo(toDatetimeLocal(filters.customTo))
    }
  }, [filters.customFrom, filters.customTo])

  const handleApplyCustom = useCallback(() => {
    if (localFrom && localTo) {
      onChange({
        customFrom: fromDatetimeLocal(localFrom),
        customTo: fromDatetimeLocal(localTo),
        rangeHours: 24,
      })
    }
  }, [localFrom, localTo, onChange])

  const servers = serversData?.data || []

  const checks = checksData?.data || []

  const selectClass =
    "flex items-center justify-between gap-1 text-[11px] font-semibold text-slate-700 outline-none hover:text-blue-600 transition-colors min-w-[80px]"

  const itemClass =
    "flex items-center px-2.5 py-1.5 text-xs text-slate-600 rounded outline-none cursor-pointer data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-600"

  const groupClass =
    "flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm"

  return (

    <div className="flex flex-wrap items-center gap-1.5">

      <div className={groupClass}>
        <Server className="h-3 w-3 shrink-0 text-slate-400" />
        <Select.Root
          value={filters.serverId?.toString() || 'all'}
          onValueChange={value => onChange({ serverId: value === 'all' ? null : Number(value) })}
        >
          <Select.Trigger className={selectClass}>
            <Select.Value placeholder="Instance" />
            <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Content className="bg-white border border-slate-200 rounded-lg shadow-lg z-[100] min-w-[180px] overflow-hidden">
              <Select.Viewport className="p-0.5">
                <Select.Item value="all" className={itemClass}>
                  <Select.ItemText>All Instances</Select.ItemText>
                </Select.Item>
                {servers.map(server => (
                  <Select.Item key={server.server_id} value={server.server_id.toString()} className={itemClass}>
                    <Select.ItemText>{server.server_label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>

      <div className={groupClass}>
        <Activity className="h-3 w-3 shrink-0 text-slate-400" />
        <Select.Root
          value={filters.checkId?.toString() || 'all'}
          onValueChange={value => onChange({ checkId: value === 'all' ? null : Number(value) })}
        >
          <Select.Trigger className={selectClass}>
            <Select.Value placeholder="Metric" />
            <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Content className="bg-white border border-slate-200 rounded-lg shadow-lg z-[100] min-w-[200px] overflow-hidden">
              <Select.Viewport className="p-0.5">
                <Select.Item value="all" className={itemClass}>
                  <Select.ItemText>All Checks</Select.ItemText>
                </Select.Item>
                {checks.map(check => (
                  <Select.Item key={check.check_id} value={check.check_id.toString()} className={itemClass}>
                    <Select.ItemText>{check.check_name}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>

      <div className={groupClass}>
        <Clock className="h-3 w-3 shrink-0 text-slate-400" />
        <Select.Root
          value={showCustom ? 'Custom' : (RANGE_LABEL_MAP[filters.rangeHours] || '24H')}
          onValueChange={(value) => {
            const option = RANGE_OPTIONS.find(o => o.label === value)
            if (option && option.hours !== null) {
              onChange({ rangeHours: option.hours, customFrom: null, customTo: null })
              setShowCustom(false)
            } else {
              setShowCustom(true)
            }
          }}
        >
          <Select.Trigger className={selectClass + ' min-w-[60px]'}>
            <Select.Value />
            <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Content className="bg-white border border-slate-200 rounded-lg shadow-lg z-[100] min-w-[110px] overflow-hidden">
              <Select.Viewport className="p-0.5">
                {RANGE_OPTIONS.map(option => (
                  <Select.Item key={option.label} value={option.label} className={itemClass}>
                    <Select.ItemText>{option.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>

      {showCustom && (
        <div className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1">
          <input
            type="datetime-local"
            value={localFrom}
            onChange={e => setLocalFrom(e.target.value)}
            className="text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded px-1.5 py-0.5 outline-none focus:border-amber-400 w-36"
          />
          <span className="text-[10px] font-bold text-amber-700">to</span>
          <input
            type="datetime-local"
            value={localTo}
            onChange={e => setLocalTo(e.target.value)}
            className="text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded px-1.5 py-0.5 outline-none focus:border-amber-400 w-36"
          />
          <button
            onClick={handleApplyCustom}
            disabled={!localFrom || !localTo}
            className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-600 text-white hover:bg-amber-700 transition-all disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      )}

      <div className={groupClass}>
        <RefreshCcw className={`h-3 w-3 shrink-0 text-slate-400 ${filters.refreshInterval > 0 ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
        <Select.Root
          value={String(filters.refreshInterval)}
          onValueChange={(value) => onChange({ refreshInterval: Number(value) })}
        >
          <Select.Trigger className={selectClass + ' min-w-[50px]'}>
            <Select.Value />
            <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Content className="bg-white border border-slate-200 rounded-lg shadow-lg z-[100] min-w-[110px] overflow-hidden">
              <Select.Viewport className="p-0.5">
                {REFRESH_OPTIONS.map(option => (
                  <Select.Item key={option.seconds} value={String(option.seconds)} className={itemClass}>
                    <Select.ItemText>
                      {option.label}
                      {option.seconds > 0 && filters.refreshInterval === option.seconds && (
                        <span className="ml-1.5 font-mono text-[10px] text-slate-400">{countdown}s</span>
                      )}
                    </Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onChange({ serverId: null, checkId: null, rangeHours: 24, refreshInterval: 0 })
          setShowCustom(false)
        }}
        title="Reset All Filters"
        className="h-7 w-7 p-0 text-slate-400 hover:text-rose-500"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>

    </div>

  )

}

export default FilterBar;
