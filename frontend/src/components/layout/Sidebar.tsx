import { NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, BookOpen, Route, BookMarked, Building2,
  Trophy, User, Users, FileText, LogOut, Award, Sparkles,
  ClipboardList, UsersRound, BarChart3, Activity, Bell, ShieldCheck, Plug, Brain
} from 'lucide-react'
import { useBranding } from '../../hooks/useBranding'
import BrandMark from '../BrandMark'
import { useAuthStore } from '../../store/auth'
import { api } from '../../utils/api'

// Employee nav (HR, MANAGER, SUPERVISOR, AGENT)
const employeeItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/modules',   icon: BookOpen,        label: 'Formations' },
  { to: '/kb',        icon: BookMarked,      label: 'Données' },
  { to: '/departments', icon: Building2,     label: 'Départements' },
  { to: '/career',    icon: Route,           label: 'Parcours carrière' },
  { to: '/certificates', icon: Award,        label: 'Certificats' },
  { to: '/leaderboard', icon: Trophy,        label: 'Classement' },
  { to: '/notifications', icon: Bell,        label: 'Notifications' },
  { to: '/profile',   icon: User,            label: 'Mon profil' },
]

// Admin-only nav (PLATFORM_MANAGER — not an employee)
const adminOnlyItems = [
  { to: '/dashboard',         icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/admin/ai',          icon: Sparkles,        label: 'Générateur IA' },
  { to: '/admin/users',       icon: Users,           label: 'Utilisateurs' },
  { to: '/departments',       icon: Building2,       label: 'Départements' },
  { to: '/admin/content',     icon: FileText,        label: 'Contenus' },
  { to: '/admin/approvals',   icon: ShieldCheck,     label: 'Approbations' },
  { to: '/admin/insights',    icon: Brain,           label: 'Signaux' },
  { to: '/admin/integrations', icon: Plug,           label: 'Intégrations RH' },
  { to: '/admin/reports',     icon: BarChart3,       label: 'Rapports' },
  { to: '/admin/analytics',   icon: Activity,        label: 'Analytics' },
  { to: '/leaderboard',       icon: Trophy,          label: 'Classement' },
  { to: '/profile',           icon: User,            label: 'Mon profil' },
]

// Manager section (MANAGER, SUPERVISOR, HR)
const managerItems = [
  { to: '/team',        icon: UsersRound,    label: 'Mon équipe' },
  { to: '/assignments', icon: ClipboardList, label: 'Devoirs' },
]

// Super-admin nav (SUPER_ADMIN — platform-level, not a tenant)
const superAdminItems = [
  { to: '/admin/tenants', icon: Building2,  label: 'Entreprises' },
  { to: '/profile',       icon: User,       label: 'Mon profil' },
]

// Admin section for HR (they're employees but also manage)
const hrAdminItems = [
  { to: '/admin/ai',         icon: Sparkles,  label: 'Générateur IA' },
  { to: '/admin/users',      icon: Users,     label: 'Utilisateurs' },
  { to: '/admin/content',    icon: FileText,  label: 'Contenus' },
  { to: '/admin/approvals',  icon: ShieldCheck, label: 'Approbations' },
  { to: '/admin/insights',   icon: Brain,     label: 'Signaux' },
  { to: '/admin/reports',    icon: BarChart3, label: 'Rapports' },
  { to: '/admin/analytics',  icon: Activity,  label: 'Analytics' },
]

export default function Sidebar() {
  const branding = useBranding()
  const { user, clearAuth, refreshToken } = useAuthStore()
  const navigate = useNavigate()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const isPlatformAdmin = user?.role === 'PLATFORM_MANAGER'
  const isHR = user?.role === 'HR'
  const isManager = ['MANAGER', 'SUPERVISOR', 'HR'].includes(user?.role || '')
  const navItems = isSuperAdmin ? superAdminItems : isPlatformAdmin ? adminOnlyItems : employeeItems

  // Fetch unread notification count
  const { data: notifResponse } = useQuery<{ notifications: Array<{ isRead: boolean }> }>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data),
    refetchInterval: 60_000, // une minute suffit ; multiplié par le nombre d'employés connectés
    refetchOnWindowFocus: true
  })
  const unreadCount = notifResponse?.notifications?.filter(n => !n.isRead).length || 0

  async function handleLogout() {
    await api.post('/auth/logout', { refreshToken }).catch(() => {})
    clearAuth()
    navigate('/login')
  }

  return (
    <div className="flex flex-col h-full p-4 gap-1">
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 py-4 mb-2">
        {branding.logoUrl ? (
          <img src={branding.logoUrl} alt={branding.displayName} className="h-9 max-w-[150px] object-contain" />
        ) : (
          <BrandMark size={36} className="rounded-2xl shadow-sm" />
        )}
        <div>
          <div className="text-sm font-bold text-gray-900 leading-tight">{branding.displayName}</div>
          {branding.isTenantHost && <div className="text-[10px] text-gray-400 leading-tight">par {branding.platformName}</div>}
        </div>
      </div>

      {/* User card */}
      <div className="mx-1 mb-4 bg-gray-50 border border-gray-200 rounded-2xl p-3">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-bold shrink-0">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-gray-800 truncate">{user?.firstName} {user?.lastName}</div>
            <div className="text-[10px] text-gray-400">{user?.role?.replace(/_/g, ' ')}</div>
          </div>
        </div>
        {/* Points & streak — only for employees, not platform/super admin */}
        {!isPlatformAdmin && !isSuperAdmin && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-white rounded-xl p-2 text-center border border-gray-200">
              <div className="text-sm font-bold text-primary-700">{(user?.totalPoints ?? 0).toLocaleString()}</div>
              <div className="text-[9px] text-gray-400 font-medium">POINTS</div>
            </div>
            <div className="bg-white rounded-xl p-2 text-center border border-gray-200">
              <div className="text-sm font-bold text-orange-500">🔥 {user?.currentStreak ?? 0}</div>
              <div className="text-[9px] text-gray-400 font-medium">JOURS</div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) =>
            isActive ? 'nav-item-active' : 'nav-item'
          }>
            <div className="flex items-center gap-2">
              <Icon size={16} />
              <span>{label}</span>
              {to === '/notifications' && unreadCount > 0 && (
                <span className="ml-auto text-xs font-bold bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
          </NavLink>
        ))}

        {isManager && !isPlatformAdmin && !isSuperAdmin && (
          <>
            <div className="section-title">Gestion</div>
            {managerItems.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) =>
                isActive ? 'nav-item-active' : 'nav-item'
              }>
                <Icon size={16} />
                <span>{label}</span>
              </NavLink>
            ))}
          </>
        )}

        {isHR && !isSuperAdmin && (
          <>
            <div className="section-title">Administration</div>
            {hrAdminItems.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) =>
                isActive ? 'nav-item-active' : 'nav-item'
              }>
                <Icon size={16} />
                <span>{label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <button
        onClick={handleLogout}
        className="nav-item text-red-400 hover:text-red-600 hover:bg-red-50 mt-2"
      >
        <LogOut size={16} />
        <span>Déconnexion</span>
      </button>
    </div>
  )
}
