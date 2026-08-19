import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Users, BookOpen, Trophy, AlertTriangle, CheckCircle, Clock,
  TrendingUp, BarChart3, Activity, ChevronRight, Target, Brain
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { api } from '../../utils/api'

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } }

type AdminStats = {
  overview: {
    totalUsers: number
    activeUsers: number
    totalModules: number
    publishedModules: number
    departmentCount: number
    recentLogins: number
  }
  training: {
    totalEnrollments: number
    completedEnrollments: number
    completionRate: number
    overdueEnrollments: number
    todayDue: number
    recentCompletions: number
  }
  quizzes: {
    totalAttempts: number
    passRate: number
  }
  gamification: {
    totalPointsAwarded: number
    totalBadgesEarned: number
  }
  enrollmentsByStatus: Array<{ status: string; count: number }>
  topUsers: Array<{
    id: string; firstName: string; lastName: string
    totalPoints: number; currentStreak: number
    department?: { name: string; icon?: string }
  }>
  departments: Array<{
    id: string; name: string; icon?: string; color?: string; userCount: number
  }>
  recentActivity: Array<{
    id: string; userName: string; moduleTitle: string
    status: string; progressPct: number; updatedAt: string
  }>
}

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: React.ElementType; color: string; sub?: string
}) {
  return (
    <motion.div variants={item} className="card p-3 sm:p-4 overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs text-gray-400 font-medium uppercase tracking-wide truncate">{label}</p>
          <p className={`text-lg sm:text-2xl font-bold mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{sub}</p>}
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color.replace('text-', 'bg-').replace('500', '50').replace('600', '50').replace('700', '50')}`}>
          <Icon size={18} className={color} />
        </div>
      </div>
    </motion.div>
  )
}

function statusLabel(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    NOT_STARTED: { label: 'Non commencé', color: 'bg-gray-100 text-gray-500' },
    IN_PROGRESS: { label: 'En cours', color: 'bg-blue-50 text-blue-600' },
    COMPLETED: { label: 'Terminé', color: 'bg-green-50 text-green-600' },
    FAILED: { label: 'Échoué', color: 'bg-red-50 text-red-500' },
  }
  return map[status] || { label: status, color: 'bg-gray-100 text-gray-500' }
}

export default function AdminDashboardPage() {
  const { user } = useAuthStore()

  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then(r => r.data),
  })

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">

      {/* ── Header ──────────────────────────────────────── */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">Tableau de bord 📊</h1>
          <p className="text-xs text-gray-500 mt-0.5">Bonjour {user?.firstName} · Vue d'ensemble de la plateforme</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link to="/admin/users" className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1">
            <Users size={13} /> Utilisateurs
          </Link>
          <Link to="/admin/content" className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1">
            <BookOpen size={13} /> Contenu
          </Link>
        </div>
      </motion.div>

      <motion.div variants={item}>
      </motion.div>

      {/* ── Alerts: Overdue + Today ──────────────────────── */}
      {(stats.training.overdueEnrollments > 0 || stats.training.todayDue > 0) && (
        <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stats.training.overdueEnrollments > 0 && (
            <div className="card p-3 sm:p-4 border-l-4 border-l-red-400 bg-red-50/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-red-600">{stats.training.overdueEnrollments} devoirs en retard</p>
                <p className="text-[10px] text-red-400 mt-0.5">Formations non complétées après la date limite</p>
              </div>
            </div>
          )}
          {stats.training.todayDue > 0 && (
            <div className="card p-3 sm:p-4 border-l-4 border-l-orange-400 bg-orange-50/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                <Clock size={18} className="text-orange-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-800">{stats.training.todayDue} devoirs dus aujourd'hui</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Formations avec échéance aujourd'hui</p>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── KPI Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <StatCard label="Utilisateurs" value={stats.overview.activeUsers} icon={Users} color="text-blue-600"
          sub={`${stats.overview.recentLogins} actifs cette semaine`} />
        <StatCard label="Formations" value={stats.overview.publishedModules} icon={BookOpen} color="text-green-600"
          sub={`${stats.overview.totalModules} total`} />
        <StatCard label="Taux complétion" value={`${stats.training.completionRate}%`} icon={TrendingUp} color="text-primary-600"
          sub={`${stats.training.completedEnrollments} terminées`} />
        <StatCard label="Quiz réussi" value={`${stats.quizzes.passRate}%`} icon={Brain} color="text-purple-600"
          sub={`${stats.quizzes.totalAttempts} tentatives`} />
      </div>

      {/* ── Second row KPIs ─────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <StatCard label="Départements" value={stats.overview.departmentCount} icon={BarChart3} color="text-indigo-500" />
        <StatCard label="Inscriptions" value={stats.training.totalEnrollments} icon={Target} color="text-teal-600"
          sub={`${stats.training.recentCompletions} complétées cette semaine`} />
        <StatCard label="Points distribués" value={(stats.gamification.totalPointsAwarded).toLocaleString()} icon={Trophy} color="text-yellow-500" />
        <StatCard label="Badges gagnés" value={stats.gamification.totalBadgesEarned} icon={CheckCircle} color="text-emerald-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* ── Left: Enrollment breakdown + Recent activity ── */}
        <div className="lg:col-span-3 space-y-5">

          {/* Enrollment by status */}
          <motion.div variants={item}>
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <BarChart3 size={15} className="text-primary-600" /> Répartition des inscriptions
            </h2>
            <div className="card p-4">
              {stats.enrollmentsByStatus.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Aucune inscription</p>
              ) : (
                <div className="space-y-3">
                  {stats.enrollmentsByStatus.map(e => {
                    const { label, color } = statusLabel(e.status)
                    const pct = stats.training.totalEnrollments > 0
                      ? Math.round((e.count / stats.training.totalEnrollments) * 100) : 0
                    return (
                      <div key={e.status}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>{label}</span>
                          <span className="text-xs text-gray-500 font-medium">{e.count} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: e.status === 'COMPLETED' ? '#10B981'
                                : e.status === 'IN_PROGRESS' ? '#3B82F6'
                                : e.status === 'FAILED' ? '#EF4444' : '#9CA3AF'
                            }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>

          {/* Recent activity */}
          <motion.div variants={item}>
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Activity size={15} className="text-primary-600" /> Activité récente
            </h2>
            <div className="card divide-y divide-gray-100">
              {stats.recentActivity.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">Aucune activité récente</p>
              ) : (
                stats.recentActivity.map(a => {
                  const { label, color } = statusLabel(a.status)
                  return (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {a.userName.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-700 truncate">{a.userName}</div>
                        <div className="text-[10px] text-gray-400 truncate">{a.moduleTitle}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${color}`}>{label}</span>
                        <span className="text-[10px] text-gray-400">{a.progressPct}%</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </motion.div>
        </div>

        {/* ── Right: Top users + Departments ──────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Top performers */}
          <motion.div variants={item}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Trophy size={15} className="text-yellow-500" /> Top performeurs
              </h2>
              <Link to="/leaderboard" className="text-xs text-primary-600 font-medium flex items-center gap-0.5">
                Voir tout <ChevronRight size={12} />
              </Link>
            </div>
            <div className="card divide-y divide-gray-100">
              {stats.topUsers.map((u, i) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-sm w-5 text-center shrink-0">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-gray-400 font-bold">{i + 1}</span>}
                  </span>
                  <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {u.firstName[0]}{u.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-700 truncate">{u.firstName} {u.lastName}</div>
                    <div className="text-[10px] text-gray-400 truncate">{u.department?.icon} {u.department?.name}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-yellow-500">{u.totalPoints.toLocaleString()}</div>
                    {u.currentStreak > 0 && (
                      <div className="text-[10px] text-orange-400">🔥 {u.currentStreak}j</div>
                    )}
                  </div>
                </div>
              ))}
              {stats.topUsers.length === 0 && (
                <div className="py-6 text-center text-gray-400 text-xs">Aucun utilisateur</div>
              )}
            </div>
          </motion.div>

          {/* Departments */}
          <motion.div variants={item}>
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Users size={15} className="text-indigo-500" /> Départements ({stats.departments.length})
            </h2>
            <div className="card divide-y divide-gray-100 max-h-[320px] overflow-y-auto">
              {stats.departments.filter(d => d.userCount > 0 || true).slice(0, 15).map(d => (
                <div key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-base shrink-0">{d.icon || '🏢'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-700 truncate">{d.name}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Users size={11} className="text-gray-300" />
                    <span className="text-xs text-gray-500 font-medium">{d.userCount}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Quick actions */}
          <motion.div variants={item}>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Actions rapides</h2>
            <div className="grid grid-cols-2 gap-2">
              <Link to="/admin/users" className="card p-3 text-center hover:shadow-card-md transition-shadow group">
                <Users size={20} className="mx-auto text-blue-500 mb-1.5" />
                <div className="text-xs font-medium text-gray-700 group-hover:text-primary-700">Gérer utilisateurs</div>
              </Link>
              <Link to="/admin/content" className="card p-3 text-center hover:shadow-card-md transition-shadow group">
                <BookOpen size={20} className="mx-auto text-green-500 mb-1.5" />
                <div className="text-xs font-medium text-gray-700 group-hover:text-primary-700">Gérer contenu</div>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
