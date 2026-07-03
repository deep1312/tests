import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { ThemeToggle } from '../ThemeToggle'

import {
  LayoutDashboard,
  Server,
  CheckCircle,
  AlertTriangle,
  Zap,
  FileText,
  Settings,
  LogOut,
  Activity,
  Gauge,
  Table2,
  Database,
  ChevronRight,
} from 'lucide-react'

const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/servers', label: 'Servers', icon: Server },
    ],
  },
  {
    title: 'Health Checks',
    items: [
      { path: '/checks', label: 'Checks', icon: CheckCircle },
      { path: '/thresholds', label: 'Thresholds', icon: AlertTriangle },
      { path: '/monitoring', label: 'PG Checks', icon: Activity, isLive: true },
    ],
  },
  {
    title: 'Insights',
    items: [
      { path: '/monitoring-dashboard', label: 'Sources', icon: Gauge, isLive: true },
      { path: '/table-count', label: 'Table Count', icon: Table2, isLive: true },
    ],
  },
  {
    title: 'Incidents',
    items: [
      { path: '/alerts', label: 'Alerts', icon: Zap },
      { path: '/incidents', label: 'Incidents', icon: FileText },
    ],
  },
]

export function Sidebar() {
  const location = useLocation()
  const { logout, role } = useAuth()

  const isActive = (path: string) => location.pathname === path

  return (
    <aside className="w-[260px] h-screen flex flex-col bg-sidebar-bg border-r border-sidebar-border">
      {/* ── Brand ── */}
      <div className="px-6 pt-7 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-glow-sm">
            <Database className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground tracking-tight leading-none">
              PG Insides
            </h1>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
              Database Monitoring
            </p>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 mb-1.5">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ path, label, icon: Icon, isLive }) => (
                <Link
                  key={path}
                  to={path}
                  className={`group relative flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                    isActive(path)
                      ? 'bg-primary text-primary-foreground shadow-glow-sm'
                      : 'text-sidebar-fg hover:bg-sidebar-hover hover:text-foreground'
                  }`}
                >
                  <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${
                    isActive(path) ? '' : 'text-muted-foreground group-hover:text-primary'
                  }`} />
                  <span className="flex-1">{label}</span>

                  {isLive && !isActive(path) && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                    </span>
                  )}

                  {isActive(path) && (
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* Admin Section */}
        {role === 'admin' && (
          <div className="mb-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 mb-1.5">
              Admin
            </p>
            <div className="space-y-0.5">
              <Link
                to="/audit"
                className={`group flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                  isActive('/audit')
                    ? 'bg-primary text-primary-foreground shadow-glow-sm'
                    : 'text-sidebar-fg hover:bg-sidebar-hover hover:text-foreground'
                }`}
              >
                <FileText className={`w-[18px] h-[18px] ${isActive('/audit') ? '' : 'text-muted-foreground group-hover:text-primary'}`} />
                <span>Audit Log</span>
              </Link>
              <Link
                to="/settings"
                className={`group flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                  isActive('/settings')
                    ? 'bg-primary text-primary-foreground shadow-glow-sm'
                    : 'text-sidebar-fg hover:bg-sidebar-hover hover:text-foreground'
                }`}
              >
                <Settings className={`w-[18px] h-[18px] ${isActive('/settings') ? '' : 'text-muted-foreground group-hover:text-primary'}`} />
                <span>Settings</span>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── Footer ── */}
      <div className="px-4 py-4 border-t border-sidebar-border space-y-3">
        {/* Theme Toggle */}
        <div className="flex items-center justify-between px-2">
          <span className="text-xs text-muted-foreground font-medium">Theme</span>
          <ThemeToggle />
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-3 p-2 rounded-xl bg-sidebar-hover/50">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary border border-primary/20">
            {role?.substring(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground capitalize truncate">{role}</p>
            <p className="text-[10px] text-muted-foreground truncate">Active session</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar