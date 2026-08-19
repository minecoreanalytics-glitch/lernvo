import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Search, Flame, BookOpen, AlertTriangle,
  CheckCircle2, Clock, ChevronDown, ChevronUp, X
} from 'lucide-react'
import { api, cn } from '../utils/api'
import type { EnrollmentStatus } from '../types'

// ── Types ────────────────────────────────────────────────────────────

interface TeamEnrollment {
  id: string
  status: EnrollmentStatus
  progressPct: number
  dueAt: string | null
  module: { id: string; title: string }
}

interface TeamMember {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl: string | null
  role: string
  totalPoints: number
  currentStreak: number
  lastLoginAt: string | null
  department: { id: string; name: string; icon?: string } | null
  overdueCount: number
  completedCount: number
  inProgressCount: number
  totalEnrollments: number
  totalQuizAttempts: number
  totalBadges: number
  recentEnrollments: TeamEnrollment[]
}

interface TeamResponse {
  team: TeamMember[]
  count: number
}

type FilterKey = 'all' | 'behind' | 'on_track' | 'completed'

// ── Helpers ──────────────────────────────────────────────────────────

function getOverallProgress(member: TeamMember): number {
  if (member.totalEnrollments === 0) return 0
  return Math.round((member.completedCount / member.totalEnrollments) * 100)
}

function getProgressColor(pct: number): string {
  if (pct < 30) return 'text-red-500'
  if (pct <= 70) return 'text-orange-500'
  return 'text-emerald-500'
}

function getProgressBg(pct: number): string {
  if (pct < 30) return 'bg-red-500'
  if (pct <= 70) return 'bg-orange-500'
  return 'bg-emerald-500'
}

function getProgressRingBg(pct: number): string {
  if (pct < 30) return 'bg-red-100'
  if (pct <= 70) return 'bg-orange-100'
  return 'bg-emerald-100'
}

function matchesFilter(member: TeamMember, filter: FilterKey): boolean {
  const pct = getOverallProgress(member)
  switch (filter) {
    case 'behind':
      return member.overdueCount > 0 || pct < 30
    case 'on_track':
      return member.overdueCount === 0 && pct >= 30 && pct < 100
    case 'completed':
      return pct === 100 && member.totalEnrollments > 0
    default:
      return true
  }
}

function getStatusChip(enrollment: TeamEnrollment) {
  switch (enrollment.status) {
    case 'COMPLETED':
      return <span className="chip bg-emerald-100 text-emerald-700 text-[10px]">Termine</span>
    case 'IN_PROGRESS':
      return <span className="chip bg-blue-100 text-blue-700 text-[10px]">En cours</span>
    case 'FAILED':
      return <span className="chip bg-red-100 text-red-700 text-[10px]">Echoue</span>
    default:
      return <span className="chip bg-gray-100 text-gray-500 text-[10px]">Non commence</span>
  }
}

// ── Filter chips config ──────────────────────────────────────────────

const FILTERS: { key: FilterKey; label: string; icon: typeof Users }[] = [
  { key: 'all', label: 'Tous', icon: Users },
  { key: 'behind', label: 'En retard', icon: AlertTriangle },
  { key: 'on_track', label: 'A jour', icon: Clock },
  { key: 'completed', label: 'Complete', icon: CheckCircle2 },
]

// ── Skeleton ─────────────────────────────────────────────────────────

function MemberCardSkeleton() {
  return (
    <div className="card p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-32" />
          <div className="h-3 bg-gray-100 rounded w-24" />
        </div>
        <div className="h-8 w-14 bg-gray-200 rounded-lg" />
      </div>
      <div className="mt-3 h-2 bg-gray-100 rounded-full" />
      <div className="mt-3 flex gap-4">
        <div className="h-3 bg-gray-100 rounded w-20" />
        <div className="h-3 bg-gray-100 rounded w-20" />
        <div className="h-3 bg-gray-100 rounded w-16" />
      </div>
    </div>
  )
}

// ── Member Card ──────────────────────────────────────────────────────

function MemberCard({ member, index }: { member: TeamMember; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const pct = getOverallProgress(member)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="card overflow-hidden"
    >
      {/* Main row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className={cn(
            'w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 border-2',
            pct < 30 ? 'bg-red-50 text-red-700 border-red-200'
              : pct <= 70 ? 'bg-orange-50 text-orange-700 border-orange-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          )}>
            {member.firstName[0]}{member.lastName[0]}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-800 truncate">
              {member.firstName} {member.lastName}
            </div>
            <div className="text-xs text-gray-400 truncate">
              {member.department?.name ?? 'Sans departement'} · {member.role.replace(/_/g, ' ')}
            </div>
          </div>

          {/* Progress badge */}
          <div className={cn(
            'flex flex-col items-center justify-center w-14 h-14 rounded-xl',
            getProgressRingBg(pct)
          )}>
            <span className={cn('text-base font-bold leading-none', getProgressColor(pct))}>
              {pct}%
            </span>
            <span className="text-[9px] text-gray-400 mt-0.5">progres</span>
          </div>

          {/* Expand icon */}
          {expanded
            ? <ChevronUp size={16} className="text-gray-400 shrink-0" />
            : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', getProgressBg(pct))}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, delay: index * 0.04 }}
          />
        </div>

        {/* Stats row */}
        <div className="mt-2.5 flex items-center gap-4 text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <BookOpen size={12} />
            {member.completedCount}/{member.totalEnrollments} modules
          </span>
          {member.currentStreak > 0 && (
            <span className="flex items-center gap-1 text-orange-500 font-semibold">
              <Flame size={12} /> {member.currentStreak}j
            </span>
          )}
          {member.overdueCount > 0 && (
            <span className="flex items-center gap-1 text-red-500 font-semibold">
              <AlertTriangle size={12} /> {member.overdueCount} en retard
            </span>
          )}
        </div>
      </button>

      {/* Expanded: recent enrollments */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/60 space-y-2">
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                Modules recents
              </div>
              {member.recentEnrollments.length === 0 && (
                <div className="text-xs text-gray-400 py-2">Aucun module assigne</div>
              )}
              {member.recentEnrollments.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="flex items-center gap-3 py-1.5"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-700 truncate">
                      {enrollment.module.title}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden max-w-[120px]">
                        <div
                          className={cn('h-full rounded-full', getProgressBg(enrollment.progressPct))}
                          style={{ width: `${enrollment.progressPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400">{enrollment.progressPct}%</span>
                    </div>
                  </div>
                  {getStatusChip(enrollment)}
                  {enrollment.dueAt && new Date(enrollment.dueAt) < new Date() && enrollment.status !== 'COMPLETED' && (
                    <span className="text-[10px] text-red-500 font-medium whitespace-nowrap">
                      Echeance depassee
                    </span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────

export default function TeamPage() {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery<TeamResponse>({
    queryKey: ['my-team'],
    queryFn: () => api.get('/users/my-team').then(r => r.data),
  })

  const team = data?.team ?? []

  const filtered = useMemo(() => {
    let result = team

    // Filter
    if (filter !== 'all') {
      result = result.filter(m => matchesFilter(m, filter))
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(m =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
      )
    }

    return result
  }, [team, filter, search])

  // Stats
  const stats = useMemo(() => {
    const total = team.length
    const behind = team.filter(m => matchesFilter(m, 'behind')).length
    const completed = team.filter(m => matchesFilter(m, 'completed')).length
    const avgProgress = total > 0
      ? Math.round(team.reduce((sum, m) => sum + getOverallProgress(m), 0) / total)
      : 0
    return { total, behind, completed, avgProgress }
  }, [team])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Users size={20} className="text-primary-600" /> Mon equipe
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Suivi de la progression de votre equipe
        </p>
      </div>

      {/* Stats cards */}
      {!isLoading && team.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Membres', value: stats.total, color: 'text-primary-600', bg: 'bg-primary-50' },
            { label: 'Progression moy.', value: `${stats.avgProgress}%`, color: getProgressColor(stats.avgProgress), bg: getProgressRingBg(stats.avgProgress) },
            { label: 'En retard', value: stats.behind, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Completes', value: stats.completed, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn('card p-3 text-center', stat.bg)}
            >
              <div className={cn('text-lg font-bold', stat.color)}>{stat.value}</div>
              <div className="text-[11px] text-gray-500">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Search + filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un membre..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map(f => {
            const Icon = f.icon
            const isActive = filter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'chip flex items-center gap-1.5 whitespace-nowrap text-xs px-3 py-1.5 transition-colors',
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                <Icon size={12} />
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Team list */}
      <div className="space-y-3">
        {isLoading && (
          <>
            <MemberCardSkeleton />
            <MemberCardSkeleton />
            <MemberCardSkeleton />
            <MemberCardSkeleton />
          </>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="card p-8 text-center">
            <Users size={32} className="mx-auto text-gray-300 mb-2" />
            <div className="text-sm text-gray-500">
              {team.length === 0
                ? 'Aucun membre dans votre equipe'
                : 'Aucun resultat pour ce filtre'}
            </div>
          </div>
        )}

        {filtered.map((member, i) => (
          <MemberCard key={member.id} member={member} index={i} />
        ))}
      </div>

      {/* Count footer */}
      {!isLoading && filtered.length > 0 && (
        <div className="text-center text-xs text-gray-400 pb-4">
          {filtered.length} membre{filtered.length > 1 ? 's' : ''} affiche{filtered.length > 1 ? 's' : ''}
          {filter !== 'all' && ` sur ${team.length}`}
        </div>
      )}
    </div>
  )
}
