import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

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
} from 'lucide-react'

export function Sidebar() {
  const location = useLocation()
  const { logout, role } = useAuth()

  const isActive = (path: string) => location.pathname === path

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/servers', label: 'Servers', icon: Server },
    { path: '/checks', label: 'Checks', icon: CheckCircle },
    { path: '/thresholds', label: 'Thresholds', icon: AlertTriangle },
    { path: '/monitoring', label: 'PG Checks', icon: Activity, isLive: true },
    { path: '/monitoring-dashboard', label: 'Sources', icon: Gauge, isLive: true },
    { path: '/table-count', label: 'Table Count', icon: Table2, isLive: true },
    { path: '/alerts', label: 'Alerts', icon: Zap },
    { path: '/incidents', label: 'Incidents', icon: FileText },
  ]

  return (
    <div className="w-64 bg-[#0f172a] text-slate-300 h-screen flex flex-col border-r border-slate-800/50">
      {/* Branding - Updated to PG Monitoring */}
      <div className="p-8">
        <h1 className="text-xl font-bold text-white tracking-tight uppercase italic">
          PG <span className="text-blue-500">Monitoring</span>
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
            Control Plane
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 space-y-1">
        {navItems.map(({ path, label, icon: Icon, isLive }) => (
          <Link
            key={path}
            to={path}
            className={`group flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 ${
              isActive(path)
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Icon className={`w-4 h-4 ${isActive(path) ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'}`} />
              <span className="text-sm font-semibold tracking-tight">{label}</span>
            </div>
            
            {isLive && !isActive(path) && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </Link>
        ))}

        {/* Admin Links */}
        {role === 'admin' && (
          <div className="mt-6 pt-6 border-t border-slate-800/50">
            <Link
              to="/audit"
              className={`group flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all ${
                isActive('/audit') ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span className="text-sm font-semibold tracking-tight">Audit Log</span>
            </Link>
            <Link
              to="/settings"
              className={`group flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all ${
                isActive('/settings') ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm font-semibold tracking-tight">Settings</span>
            </Link>
          </div>
        )}
      </nav>

      {/* Footer User Profile */}
      <div className="p-4 mt-auto bg-slate-950/30 border-t border-slate-800/50">
        <div className="flex items-center gap-3 px-4 py-3 mb-2">
          <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-black text-blue-400 border border-slate-700">
            {role?.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Role</p>
            <p className="text-xs font-bold text-slate-200 capitalize tracking-tight">{role}</p>
          </div>
        </div>
        {/* TimezoneSelect removed — UI hidden, functionality preserved */}
        <button
          onClick={logout}
          className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-semibold">Logout</span>
        </button>
      </div>
    </div>
  )
}

export default Sidebar;