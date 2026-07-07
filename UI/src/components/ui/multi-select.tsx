import { useState, useRef, useEffect, useMemo } from 'react'
import { Button } from './button'
import { Card } from './card'
import { Input } from './input'
import { ChevronDown, Search } from 'lucide-react'

interface Option {
  value: string
  label: string
}

interface MultiSelectProps {
  options: Option[]
  selected: Set<string>
  onChange: (selected: Set<string>) => void
  placeholder?: string
  searchable?: boolean
  showSelectAll?: boolean
  className?: string
  disabled?: boolean
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select...',
  searchable = false,
  showSelectAll = false,
  className = '',
  disabled = false,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return options
    const q = search.toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, search])

  const label =
    selected.size === options.length
      ? `All ${placeholder.toLowerCase()}`
      : selected.size === 0
        ? placeholder
        : `${selected.size} ${placeholder.toLowerCase()} selected`

  const allSelected = selected.size === options.length

  return (
    <div ref={ref} className={`relative ${className}`}>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => { setOpen(!open); if (!open) setSearch('') }}
        className="text-xs font-semibold gap-2 min-w-[130px] justify-between"
      >
        <span className="truncate max-w-[120px]">{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>
      {open && (
        <Card className="absolute top-full left-0 z-50 mt-1.5 w-64 p-2 shadow-xl max-h-[300px] flex flex-col">
          {searchable && (
            <div className="relative mb-2 shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-xs pl-8"
              />
            </div>
          )}
          {showSelectAll && options.length > 0 && (
            <div className="shrink-0 mb-1 pb-1 border-b border-border">
              <button
                onClick={() => {
                  if (allSelected) {
                    onChange(new Set())
                  } else {
                    onChange(new Set(options.map((o) => o.value)))
                  }
                }}
                className="w-full flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted cursor-pointer"
              >
                <div className={`h-4 w-4 rounded border flex items-center justify-center ${allSelected ? 'bg-primary border-primary' : 'border-input'}`}>
                  {allSelected && <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
              </button>
            </div>
          )}
          <div className="overflow-y-auto flex-1 space-y-0.5">
            {filtered.map((opt) => {
              const isChecked = selected.has(opt.value)
              return (
                <label
                  key={opt.value}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      const next = new Set(selected)
                      if (isChecked) next.delete(opt.value)
                      else next.add(opt.value)
                      onChange(next)
                    }}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary/30"
                  />
                  <span className="truncate font-medium">{opt.label}</span>
                </label>
              )
            })}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">No options match</p>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
