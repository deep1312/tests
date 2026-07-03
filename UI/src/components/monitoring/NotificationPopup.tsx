import { useEffect, useState } from 'react'
import { Card } from '../ui/card'
import { Badge } from '../ui/badge'
import { X, Zap, Flame } from 'lucide-react'
import { formatInTZ } from '../../utils/timezone'

interface NotificationPopupProps {
  type: 'alert' | 'incident'
  title: string
  checkName: string
  serverName: string
  timestamp: string
  onClick: () => void
  onDismiss: () => void
  autoHideDuration?: number
}

export function NotificationPopup({
  type,
  title,
  checkName,
  serverName,
  timestamp,
  onClick,
  onDismiss,
  autoHideDuration = 8000,
}: NotificationPopupProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 50)
    const hideTimer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300)
    }, autoHideDuration)
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer) }
  }, [autoHideDuration, onDismiss])

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <Card
        className="w-[320px] cursor-pointer shadow-xl border-l-4 hover:shadow-2xl transition-shadow"
        style={{ borderLeftColor: type === 'alert' ? '#f59e0b' : '#ef4444' }}
        onClick={onClick}
      >
        <div className="p-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {type === 'alert' ? (
                <Zap className="h-4 w-4 text-amber-500" />
              ) : (
                <Flame className="h-4 w-4 text-red-500" />
              )}
              <Badge
                variant={type === 'alert' ? 'secondary' : 'destructive'}
                className="text-[9px] px-1.5 py-0 h-4"
              >
                {type === 'alert' ? 'Alert' : 'Incident'} Generated
              </Badge>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setVisible(false); setTimeout(onDismiss, 300) }}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-2 space-y-0.5">
            <p className="text-[11px] font-semibold text-slate-800">{title}</p>
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
              <span className="font-medium text-slate-600">Check:</span>
              <span>{checkName}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
              <span className="font-medium text-slate-600">Server:</span>
              <span>{serverName}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className="font-medium text-slate-500">Time:</span>
              <span>{formatInTZ(timestamp)}</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
