import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, LogOut, User, Building2, Award, FileText, Route, Search } from 'lucide-react'
import { useBranding } from '../../hooks/useBranding'
import BrandMark from '../BrandMark'
import { useAuthStore } from '../../store/auth'
import { api } from '../../utils/api'
import type { Notification } from '../../types'
import GlobalSearch from '../GlobalSearch'

export default function TopBar() {
  const branding = useBranding()
  const { user, clearAuth, refreshToken } = useAuthStore()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // CMD+K / Ctrl+K shortcut
  const handleSearchShortcut = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setShowSearch(prev => !prev)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleSearchShortcut)
    return () => document.removeEventListener('keydown', handleSearchShortcut)
  }, [handleSearchShortcut])

  useEffect(() => {
    api.get('/notifications').then(r => setNotifications(r.data)).catch(() => {})
  }, [])

  const unread = notifications.filter(n => !n.isRead).length

  async function markAllRead() {
    await api.patch('/notifications/read-all').catch(() => {})
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  async function handleLogout() {
    await api.post('/auth/logout', { refreshToken }).catch(() => {})
    clearAuth()
    navigate('/login')
  }

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    if (showUserMenu) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showUserMenu])

  return (
    <>
    <header className="flex items-center justify-between px-4 py-3 min-h-[64px] bg-white border-b border-gray-200 shrink-0 min-w-0 pwa-safe-header" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
      {/* Mobile logo */}
      <div className="flex items-center gap-2.5 lg:hidden min-w-0">
        {branding.logoUrl ? (
          <img src={branding.logoUrl} alt={branding.displayName} className="h-9 max-w-[140px] object-contain shrink-0" />
        ) : (
          <BrandMark size={36} className="rounded-xl shrink-0" />
        )}
        <span className="text-base font-bold text-gray-900 truncate">{branding.displayName}</span>
      </div>
      <div className="hidden lg:block" />

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Streak */}
        {(user?.currentStreak ?? 0) >= 2 && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-full text-xs font-semibold text-orange-500">
            🔥 {user?.currentStreak} jours
          </div>
        )}

        {/* Points */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 border border-primary-200 rounded-full text-xs font-semibold text-primary-700">
          ⭐ {(user?.totalPoints ?? 0).toLocaleString()}
        </div>

        {/* Search */}
        <button
          onClick={() => { setShowSearch(true); setShowNotifs(false); setShowUserMenu(false) }}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
          title="Rechercher (Ctrl+K)"
        >
          <Search size={18} />
        </button>

        {/* Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-12 w-[min(320px,calc(100vw-2rem))] card shadow-card-lg z-50 overflow-hidden animate-slide-up">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-800">Notifications</span>
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                    Tout lire
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                {notifications.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Aucune notification</p>
                ) : notifications.slice(0, 10).map(n => (
                  <div
                    key={n.id}
                    onClick={() => { if (n.link) navigate(n.link); setShowNotifs(false) }}
                    className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${!n.isRead ? 'bg-primary-50/50' : ''}`}
                  >
                    <div className="text-xs font-semibold text-gray-800">{n.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{n.body}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Avatar + Dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifs(false) }}
            className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold hover:bg-primary-200 transition-colors"
          >
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-12 w-[min(224px,calc(100vw-2rem))] card shadow-card-lg z-50 overflow-hidden animate-slide-up">
              {/* User info */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="text-sm font-semibold text-gray-800">{user?.firstName} {user?.lastName}</div>
                <div className="text-xs text-gray-400 truncate">{user?.email}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{user?.role?.replace(/_/g, ' ')}</div>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <button onClick={() => { navigate('/career'); setShowUserMenu(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors lg:hidden">
                  <Route size={15} className="text-gray-400" />
                  Parcours carrière
                </button>
                <button onClick={() => { navigate('/profile'); setShowUserMenu(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <User size={15} className="text-gray-400" />
                  Mon profil
                </button>
                <button onClick={() => { navigate('/certificates'); setShowUserMenu(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors lg:hidden">
                  <Award size={15} className="text-gray-400" />
                  Certificats
                </button>
                <button onClick={() => { navigate('/departments'); setShowUserMenu(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors lg:hidden">
                  <Building2 size={15} className="text-gray-400" />
                  Départements
                </button>
                {['PLATFORM_MANAGER', 'HR'].includes(user?.role || '') && (
                  <button onClick={() => { navigate('/admin/content'); setShowUserMenu(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors lg:hidden">
                    <FileText size={15} className="text-gray-400" />
                    Contenus
                  </button>
                )}
              </div>

              {/* Logout */}
              <div className="border-t border-gray-100 py-1">
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors">
                  <LogOut size={15} />
                  Déconnexion
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>

    {showSearch && <GlobalSearch onClose={() => setShowSearch(false)} />}
    </>
  )
}
