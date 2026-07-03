import { useState, useMemo } from 'react'
import { useFormatInTZ } from '../../utils/timezone'

interface TimestampCellProps {
  utcIso: string | null | undefined
  format?: string
}

export function TimestampCell({ utcIso, format: _format }: TimestampCellProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const fmt = useFormatInTZ()

  const { localTime, isValid, sanitizedIso } = useMemo(() => {
    if (!utcIso || typeof utcIso !== 'string' || utcIso.trim() === '') {
      return { localTime: '—', isValid: false, sanitizedIso: '' }
    }

    try {
      let sanitized = utcIso.trim()
      if (!sanitized.includes('T') && sanitized.includes(' ')) {
        sanitized = sanitized.replace(' ', 'T')
      }
      if (!sanitized.endsWith('Z') && !sanitized.includes('+') && !sanitized.includes('-')) {
        sanitized += 'Z'
      }

      const date = new Date(sanitized)
      if (isNaN(date.getTime())) {
        return { localTime: '—', isValid: false, sanitizedIso: utcIso }
      }

      const formatted = fmt(sanitized, { dateStyle: 'medium', timeStyle: 'short' } as Intl.DateTimeFormatOptions)
      return { localTime: formatted, isValid: true, sanitizedIso: sanitized }
    } catch (e) {
      return { localTime: '—', isValid: false, sanitizedIso: utcIso }
    }
  }, [utcIso, _format, fmt])

  if (!isValid) {
    return <span className="text-gray-400 italic font-mono text-sm">{localTime}</span>
  }

  return (
    <div className="relative inline-block">
      <span
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="cursor-help font-mono text-sm whitespace-nowrap hover:text-blue-400 transition-colors"
      >
        {localTime}
      </span>
      
      {showTooltip && (
        <div className="absolute block z-[9999] bg-gray-900 text-white text-[10px] font-mono rounded py-1 px-2 whitespace-nowrap bottom-full left-1/2 transform -translate-x-1/2 mb-2 shadow-xl border border-gray-700">
          <div className="flex flex-col gap-1">
            <span>Raw: {utcIso}</span>
            <span className="opacity-60 text-[9px]">ISO: {sanitizedIso}</span>
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  )
}

export default TimestampCell