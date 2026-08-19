import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { BookOpen, Trophy, ChevronRight, Target, Clock, AlertTriangle, CalendarCheck, Brain, Users, Route } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { api } from '../utils/api'
import PendingAcksCard from '../components/approval/PendingAcksCard'
import type { LeaderboardEntry } from '../types'

type CareerPathEnrollment = {
  id: string
  status: string
  progress: number
  path: {
    id: string
    title: string
    icon?: string
    estimatedWeeks?: number
    _count?: { modules: number }
  }
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } }

type AssignedModule = {
  id: string
  moduleId: string
  status: string
  progressPct: number
  dueAt: string
  hasPendingQuiz: boolean
  module: {
    id: string
    title: string
    estimatedMinutes: number
    thumbnail?: string
    category?: { name: string; color?: string }
    quizzes: Array<{ id: string; title: string; passed: boolean }>
  }
}

type Assignments = {
  overdue: AssignedModule[]
  today: AssignedModule[]
  upcoming: AssignedModule[]
  noDueDate: AssignedModule[]
}

type TeamMember = {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  totalPoints: number
  currentStreak: number
  lastLoginAt: string | null
  department?: { id: string; name: string; icon?: string }
  overdueCount: number
  completedCount: number
  inProgressCount: number
  totalEnrollments: number
  totalBadges: number
}

function formatDue(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function AssignmentCard({ a, variant }: { a: AssignedModule; variant: 'overdue' | 'today' }) {
  const isOverdue = variant === 'overdue'
  const firstPendingQuiz = a.module.quizzes.find(q => !q.passed)

  return (
    <div className={`card overflow-hidden border-l-4 ${isOverdue ? 'border-l-red-400' : 'border-l-orange-400'}`}>
      <div className="p-3 sm:p-4 flex items-start gap-3">
        {/* Thumbnail / icon */}
        <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: a.module.category?.color ? a.module.category.color + '20' : '#EEF4FB' }}>
          {a.module.thumbnail
            ? <img src={a.module.thumbnail} className="w-full h-full rounded-xl object-cover" alt="" />
            : <BookOpen size={18} style={{ color: a.module.category?.color || '#2B6CB0' }} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <Link to={`/modules/${a.module.id}`}
              className="text-sm font-semibold text-gray-800 hover:text-primary-700 transition-colors line-clamp-1 flex-1">
              {a.module.title}
            </Link>
            <span className={`chip shrink-0 text-[10px] font-bold ${isOverdue ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'}`}>
              {isOverdue ? '⚠ En retard' : `⏰ ${formatDue(a.dueAt)}`}
            </span>
          </div>

          {/* Progress */}
          <div className="mt-2">
            <div className="progress-track h-1.5">
              <div className="progress-fill" style={{ width: `${a.progressPct}%` }} />
            </div>
            <div className="text-[10px] text-gray-400 mt-1">{a.progressPct}% complété</div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <Link to={`/modules/${a.module.id}`}
              className="btn-primary text-xs px-3 py-1.5">
              {a.progressPct > 0 ? 'Continuer' : 'Commencer'}
            </Link>
            {firstPendingQuiz && (
              <Link to={`/modules/${a.module.id}/quiz/${firstPendingQuiz.id}`}
                className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 px-2.5 py-1.5 rounded-lg border border-primary-100 transition-colors">
                <Brain size={12} /> Quiz
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuthStore()

  const { data: assignments } = useQuery<Assignments>({
    queryKey: ['assignments'],
    queryFn: () => api.get('/assignments').then(r => r.data)
  })

  const { data: modulesData } = useQuery<{ modules: Array<{ id: string; title: string; thumbnail?: string; estimatedMinutes: number; category?: { name: string; color?: string }; userEnrollment?: { status: string; progressPct: number } | null }> }>({
    queryKey: ['dashboard-modules'],
    queryFn: () => api.get('/modules').then(r => r.data)
  })

  const { data: stats } = useQuery({
    queryKey: ['my-stats'],
    queryFn: () => api.get('/gamification/my-stats').then(r => r.data)
  })

  const { data: leaderboard = [] } = useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard'],
    queryFn: () => api.get('/gamification/leaderboard?limit=5').then(r => r.data)
  })

  const isManagerOrSup = user?.role === 'MANAGER' || user?.role === 'SUPERVISOR' || user?.role === 'HR'
  const { data: teamData } = useQuery<{ team: TeamMember[]; count: number }>({
    queryKey: ['my-team'],
    queryFn: () => api.get('/users/my-team').then(r => r.data),
    enabled: isManagerOrSup
  })

  const { data: myPaths = [] } = useQuery<CareerPathEnrollment[]>({
    queryKey: ['my-paths'],
    queryFn: () => api.get('/career/my-paths').then(r => r.data),
    enabled: !isManagerOrSup && user?.role !== 'PLATFORM_MANAGER'
  })

  const modules = modulesData?.modules ?? []
  const inProgress = modules.filter(m => m.userEnrollment?.status === 'IN_PROGRESS')
  const completed  = modules.filter(m => m.userEnrollment?.status === 'COMPLETED').length

  const overdue    = assignments?.overdue ?? []
  const today      = assignments?.today ?? []
  const noDueDate  = assignments?.noDueDate ?? []
  const hasUrgent = overdue.length > 0 || today.length > 0

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">

      {/* ── COMPACT GREETING (inline with streak) ────────── */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">Bonjour, {user?.firstName} 👋</h1>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{user?.role?.replace(/_/g, ' ')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(user?.currentStreak ?? 0) >= 2 && (
            <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-full px-2.5 py-1 text-xs font-bold text-orange-500">
              🔥 {user?.currentStreak}j
            </div>
          )}
          <div className="flex items-center gap-1 bg-primary-50 border border-primary-200 rounded-full px-2.5 py-1 text-xs font-bold text-primary-700">
            ⭐ {(user?.totalPoints ?? 0).toLocaleString()}
          </div>
        </div>
      </motion.div>

      {/* ── À LIRE ET VALIDER (approbations) ───────────── */}
      <motion.div variants={item}>
        <PendingAcksCard />
      </motion.div>

      {/* ══════════════════════════════════════════════════ */}
      {/* ══  DEVOIRS EN RETARD — TOP PRIORITY  ════════════ */}
      {/* ══════════════════════════════════════════════════ */}
      {overdue.length > 0 && (
        <motion.div variants={item}>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-6 h-6 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle size={13} className="text-red-500" />
            </div>
            <h2 className="text-sm font-bold text-red-600">En retard ({overdue.length})</h2>
          </div>
          <div className="space-y-2">
            {overdue.map(a => <AssignmentCard key={a.id} a={a} variant="overdue" />)}
          </div>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* ══  DEVOIRS DU JOUR                   ════════════ */}
      {/* ══════════════════════════════════════════════════ */}
      {today.length > 0 && (
        <motion.div variants={item}>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-6 h-6 rounded-lg bg-orange-100 flex items-center justify-center">
              <CalendarCheck size={13} className="text-orange-500" />
            </div>
            <h2 className="text-sm font-bold text-gray-700">Aujourd'hui ({today.length})</h2>
          </div>
          <div className="space-y-2">
            {today.map(a => <AssignmentCard key={a.id} a={a} variant="today" />)}
          </div>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* ══  FORMATIONS ASSIGNÉES (sans date limite) ═════ */}
      {/* ══════════════════════════════════════════════════ */}
      {noDueDate.length > 0 && (
        <motion.div variants={item}>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
              <BookOpen size={13} className="text-blue-500" />
            </div>
            <h2 className="text-sm font-bold text-gray-700">Formations assignées ({noDueDate.length})</h2>
          </div>
          <div className="space-y-2">
            {noDueDate.map(a => {
              const firstPendingQuiz = a.module.quizzes.find(q => !q.passed)
              return (
                <div key={a.id} className="card overflow-hidden border-l-4 border-l-blue-400">
                  <div className="p-3 sm:p-4 flex items-start gap-3">
                    <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: a.module.category?.color ? a.module.category.color + '20' : '#EEF4FB' }}>
                      {a.module.thumbnail
                        ? <img src={a.module.thumbnail} className="w-full h-full rounded-xl object-cover" alt="" />
                        : <BookOpen size={18} style={{ color: a.module.category?.color || '#2B6CB0' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <Link to={`/modules/${a.module.id}`}
                          className="text-sm font-semibold text-gray-800 hover:text-primary-700 transition-colors line-clamp-1 flex-1">
                          {a.module.title}
                        </Link>
                        <span className="chip shrink-0 text-[10px] font-bold bg-blue-50 text-blue-500">
                          Assigné
                        </span>
                      </div>
                      {a.module.category && (
                        <div className="text-[10px] text-gray-400 mt-0.5">{a.module.category.name}</div>
                      )}
                      <div className="mt-2">
                        <div className="progress-track h-1.5">
                          <div className="progress-fill" style={{ width: `${a.progressPct}%` }} />
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1">{a.progressPct}% complété</div>
                      </div>
                      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                        <Link to={`/modules/${a.module.id}`} className="btn-primary text-xs px-3 py-1.5">
                          {a.progressPct > 0 ? 'Continuer' : 'Commencer'}
                        </Link>
                        {firstPendingQuiz && (
                          <Link to={`/modules/${a.module.id}/quiz/${firstPendingQuiz.id}`}
                            className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 px-2.5 py-1.5 rounded-lg border border-primary-100 transition-colors">
                            <Brain size={12} /> Quiz
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* ── All clear ───────────────────────────────────── */}
      {!hasUrgent && (
        <motion.div variants={item}
          className="card p-4 flex items-center gap-3 border-green-200 bg-green-50">
          <span className="text-2xl">✅</span>
          <div>
            <div className="text-sm font-semibold text-gray-800">Tout est à jour</div>
            <div className="text-xs text-gray-500">Aucun devoir en retard ni dû aujourd'hui.</div>
          </div>
        </motion.div>
      )}

      {/* ── Stats row (compact) ─────────────────────────── */}
      <motion.div variants={item} className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'Rang',      value: stats?.rank ? `#${stats.rank}` : '—',     emoji: '🏆', color: 'text-yellow-500' },
          { label: 'Complétés', value: completed,                                  emoji: '📚', color: 'text-success-500' },
          { label: 'Badges',    value: stats?.badges?.length ?? 0,                 emoji: '🎖️', color: 'text-primary-700' },
        ].map(s => (
          <div key={s.label} className="card p-2.5 sm:p-3 text-center overflow-hidden">
            <div className="text-base sm:text-lg">{s.emoji}</div>
            <div className={`text-sm sm:text-base font-bold mt-0.5 truncate ${s.color}`}>{s.value}</div>
            <div className="text-[9px] sm:text-[10px] text-gray-400 font-medium uppercase tracking-wide mt-0.5 truncate">{s.label}</div>
          </div>
        ))}
      </motion.div>

      {/* ══════════════════════════════════════════════════ */}
      {/* ══  MON ÉQUIPE (MANAGER / SUPERVISOR)  ══════════ */}
      {/* ══════════════════════════════════════════════════ */}
      {isManagerOrSup && (teamData?.team ?? []).length > 0 && (
        <motion.div variants={item}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Users size={15} className="text-indigo-500" /> Mon équipe ({teamData!.count})
            </h2>
            <Link to="/team" className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-0.5">
              Voir tout <ChevronRight size={12} />
            </Link>
          </div>
          <div className="card divide-y divide-gray-100">
            {teamData!.team.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-3 sm:px-4 py-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0">
                  {m.firstName[0]}{m.lastName[0]}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-800 truncate">
                    {m.firstName} {m.lastName}
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">
                    {m.department?.icon} {m.department?.name || m.role.replace(/_/g, ' ')}
                  </div>
                </div>

                {/* Stats pills */}
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end max-w-[110px] sm:max-w-none">
                  {m.overdueCount > 0 && (
                    <span className="text-[10px] font-bold bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full">
                      ⚠ {m.overdueCount}
                    </span>
                  )}
                  {m.inProgressCount > 0 && (
                    <span className="text-[10px] font-medium bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">
                      📖 {m.inProgressCount}
                    </span>
                  )}
                  <span className="text-[10px] font-medium bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full">
                    ✅ {m.completedCount}
                  </span>
                  {m.currentStreak > 0 && (
                    <span className="text-[10px] text-orange-400 font-bold">🔥{m.currentStreak}</span>
                  )}
                  <span className="text-[10px] font-bold text-yellow-500">{m.totalPoints.toLocaleString()}⭐</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* ══  MES PARCOURS (AGENT / SUPERVISOR)  ══════════ */}
      {/* ══════════════════════════════════════════════════ */}
      {myPaths.length > 0 && (
        <motion.div variants={item}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Route size={15} className="text-purple-500" /> Mes parcours
            </h2>
            <Link to="/career" className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-0.5">
              Voir tout <ChevronRight size={12} />
            </Link>
          </div>
          <div className="space-y-2">
            {myPaths.slice(0, 3).map(ep => (
              <Link key={ep.id} to="/career"
                className="card p-3 sm:p-4 flex items-center gap-3 hover:shadow-card-md transition-shadow group">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0 border border-purple-100 text-lg">
                  {ep.path.icon || '🎯'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate group-hover:text-primary-700 transition-colors">
                    {ep.path.title}
                  </div>
                  <div className="progress-track mt-1.5">
                    <div className="progress-fill bg-purple-500" style={{ width: `${ep.progress ?? 0}%` }} />
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    {ep.progress ?? 0}% · {ep.path._count?.modules ?? 0} modules
                    {ep.status === 'COMPLETED' && <span className="ml-1.5 text-green-600 font-semibold">✓ Complété</span>}
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-purple-500 transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* ── Continue learning ────────────────────────── */}
        <motion.div variants={item} className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <BookOpen size={15} className="text-primary-600" /> Continuer l'apprentissage
            </h2>
            <Link to="/modules" className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-0.5">
              Voir tout <ChevronRight size={12} />
            </Link>
          </div>

          {inProgress.length === 0 ? (
            <div className="card p-8 text-center">
              <BookOpen size={36} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-400">Aucune formation en cours</p>
              <Link to="/modules" className="btn-primary mt-4 text-xs inline-flex">Parcourir les formations</Link>
            </div>
          ) : (
            inProgress.slice(0, 3).map(m => (
              <Link key={m.id} to={`/modules/${m.id}`}
                className="card p-4 flex items-center gap-4 hover:shadow-card-md transition-shadow group">
                <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center shrink-0 border border-primary-100">
                  {m.thumbnail
                    ? <img src={m.thumbnail} className="w-full h-full rounded-xl object-cover" alt="" />
                    : <BookOpen size={20} className="text-primary-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate group-hover:text-primary-700 transition-colors">
                    {m.title}
                  </div>
                  <div className="progress-track mt-2">
                    <div className="progress-fill" style={{ width: `${m.userEnrollment?.progressPct ?? 0}%` }} />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{m.userEnrollment?.progressPct ?? 0}% · {m.estimatedMinutes} min</div>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-500 transition-colors shrink-0" />
              </Link>
            ))
          )}
        </motion.div>

        {/* ── Leaderboard mini + Badges ────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <motion.div variants={item}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Trophy size={15} className="text-yellow-500" /> Classement
              </h2>
              <Link to="/leaderboard" className="text-xs text-primary-600 font-medium flex items-center gap-0.5">
                Voir tout <ChevronRight size={12} />
              </Link>
            </div>
            <div className="card divide-y divide-gray-100">
              {leaderboard.map((e, i) => (
                <div key={e.id} className={`flex items-center gap-3 px-4 py-2.5 ${e.id === user?.id ? 'bg-primary-50' : ''}`}>
                  <span className="text-sm w-5 text-center shrink-0">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-gray-400 font-bold">{i+1}</span>}
                  </span>
                  <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {e.firstName[0]}{e.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-700 truncate">
                      {e.firstName} {e.lastName}
                      {e.id === user?.id && <span className="ml-1 chip chip-primary text-[9px]">Vous</span>}
                    </div>
                    <div className="text-[10px] text-gray-400 truncate">{e.department?.name}</div>
                  </div>
                  <div className="text-xs font-bold text-yellow-500 shrink-0">{e.totalPoints.toLocaleString()}</div>
                </div>
              ))}
              {leaderboard.length === 0 && (
                <div className="py-6 text-center text-gray-400 text-xs">Chargement...</div>
              )}
            </div>
          </motion.div>

          {/* Upcoming assignments (next 3) */}
          {(assignments?.upcoming ?? []).length > 0 && (
            <motion.div variants={item}>
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Clock size={14} className="text-gray-400" /> À venir
              </h2>
              <div className="card divide-y divide-gray-100">
                {(assignments!.upcoming).slice(0, 3).map(a => (
                  <Link key={a.id} to={`/modules/${a.module.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-700 truncate group-hover:text-primary-700">{a.module.title}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(a.dueAt).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                    {a.hasPendingQuiz && <Brain size={12} className="text-primary-400 shrink-0" />}
                    <ChevronRight size={12} className="text-gray-300 group-hover:text-primary-500 shrink-0" />
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          {/* Recent badges */}
          {stats?.badges?.length > 0 && (
            <motion.div variants={item}>
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Target size={15} className="text-primary-600" /> Mes badges
              </h2>
              <div className="flex gap-2 flex-wrap">
                {stats.badges.slice(0, 6).map((ub: { badge: { id: string; name: string; icon: string } }) => (
                  <div key={ub.badge.id} className="card p-2.5 flex flex-col items-center gap-1 min-w-[64px] text-center">
                    <span className="text-xl">{ub.badge.icon}</span>
                    <span className="text-[9px] text-gray-500 leading-tight font-medium">{ub.badge.name}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
