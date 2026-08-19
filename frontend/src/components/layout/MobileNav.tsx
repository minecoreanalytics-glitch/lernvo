import { NavLink } from 'react-router-dom'
import { LayoutDashboard, BookOpen, BookMarked, Trophy, Users, Sparkles, Building2, User } from 'lucide-react'
import clsx from 'clsx'
import { useAuthStore } from '../../store/auth'

const employeeTabs = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Accueil'     },
  { to: '/modules',       icon: BookOpen,         label: 'Formations'  },
  { to: '/kb',            icon: BookMarked,       label: 'Données'     },
  { to: '/leaderboard',   icon: Trophy,           label: 'Top'         },
]

const hrTabs = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Accueil'     },
  { to: '/modules',       icon: BookOpen,         label: 'Formations'  },
  { to: '/kb',            icon: BookMarked,       label: 'Données'     },
  { to: '/admin/users',   icon: Users,            label: 'Users'       },
  { to: '/leaderboard',   icon: Trophy,           label: 'Top'         },
]

const adminTabs = [
  { to: '/dashboard',      icon: LayoutDashboard, label: 'Accueil'    },
  { to: '/admin/ai',       icon: Sparkles,        label: 'IA'         },
  { to: '/kb',             icon: BookMarked,       label: 'Données'   },
  { to: '/admin/users',    icon: Users,           label: 'Users'      },
  { to: '/leaderboard',    icon: Trophy,          label: 'Top'        },
]

const superAdminTabs = [
  { to: '/admin/tenants',  icon: Building2,       label: 'Entreprises' },
  { to: '/profile',        icon: User,            label: 'Profil'      },
]

export default function MobileNav() {
  const user = useAuthStore(s => s.user)
  const tabs = user?.role === 'SUPER_ADMIN' ? superAdminTabs
    : user?.role === 'PLATFORM_MANAGER' ? adminTabs
    : user?.role === 'HR' ? hrTabs
    : employeeTabs
  return (
    <nav className="lg:hidden fixed z-50 bottom-3 left-0 right-0 px-4">
      <div className="bg-primary-800/95 backdrop-blur-lg rounded-[28px] flex items-center px-1.5 py-1.5 shadow-card-lg max-w-sm mx-auto">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) =>
            clsx(
              'flex-1 flex flex-col items-center gap-0.5 py-2 rounded-[22px] transition-all duration-200 touch-target',
              'min-h-[44px] justify-center',
              isActive
                ? 'bg-white/15'
                : 'active:bg-white/10 active:scale-95'
            )
          }>
            {({ isActive }) => (
              <>
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={clsx('transition-all duration-200', isActive ? 'text-white' : 'text-white/45')}
                />
                <span className={clsx(
                  'text-[10px] font-semibold transition-all duration-200 whitespace-nowrap',
                  isActive ? 'text-white' : 'text-white/40'
                )}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
