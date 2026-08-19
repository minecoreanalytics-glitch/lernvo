import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, AlertTriangle, CalendarCheck, Clock, CheckCircle2,
  Plus, X, Loader2, Search, Users, ChevronRight, Brain
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { api } from '../utils/api'
import type { User, Module } from '../types'

// ─── Animation variants (matching DashboardPage) ─────────────────────────────
const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } }

// ─── Types ───────────────────────────────────────────────────────────────────
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
    category?: { name: string; color?: string; icon?: string }
    quizzes: Array<{ id: string; title: string; passed: boolean }>
  }
}

type Assignments = {
  overdue: AssignedModule[]
  today: AssignedModule[]
  upcoming: AssignedModule[]
}

type CompletedModule = {
  id: string
  title: string
  thumbnail?: string
  estimatedMinutes: number
  category?: { name: string; color?: string }
  userEnrollment?: { status: string; progressPct: number; completedAt?: string } | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDueDate(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diff === 0) return "Aujourd'hui"
  if (diff === 1) return 'Demain'
  if (diff === -1) return 'Hier'
  if (diff < -1) return `Il y a ${Math.abs(diff)} jours`
  if (diff <= 7) return `Dans ${diff} jours`

  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatFullDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

// ─── Skeleton Loader ─────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="card p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-200 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-1.5 bg-gray-100 rounded w-full" />
          <div className="h-3 bg-gray-100 rounded w-1/4" />
        </div>
      </div>
    </div>
  )
}

function SectionSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-5 bg-gray-200 rounded w-40 animate-pulse" />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  )
}

// ─── Assignment Card ─────────────────────────────────────────────────────────
function AssignmentCard({
  a,
  variant
}: {
  a: AssignedModule
  variant: 'overdue' | 'today' | 'upcoming'
}) {
  const borderColor = variant === 'overdue'
    ? 'border-l-red-400'
    : variant === 'today'
      ? 'border-l-orange-400'
      : 'border-l-blue-300'

  const firstPendingQuiz = a.module.quizzes.find(q => !q.passed)

  return (
    <motion.div
      variants={item}
      className={`card overflow-hidden border-l-4 ${borderColor}`}
    >
      <div className="p-3 sm:p-4 flex items-start gap-3">
        {/* Thumbnail / icon */}
        <div
          className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center"
          style={{
            backgroundColor: a.module.category?.color
              ? a.module.category.color + '20'
              : '#EEF4FB'
          }}
        >
          {a.module.thumbnail ? (
            <img
              src={a.module.thumbnail}
              className="w-full h-full rounded-xl object-cover"
              alt=""
            />
          ) : (
            <BookOpen
              size={18}
              style={{ color: a.module.category?.color || '#2B6CB0' }}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <Link
              to={`/modules/${a.module.id}`}
              className="text-sm font-semibold text-gray-800 hover:text-primary-700 transition-colors line-clamp-1 flex-1"
            >
              {a.module.title}
            </Link>
            <span
              className={`chip shrink-0 text-[10px] font-bold ${
                variant === 'overdue'
                  ? 'bg-red-50 text-red-500'
                  : variant === 'today'
                    ? 'bg-orange-50 text-orange-500'
                    : 'bg-blue-50 text-blue-500'
              }`}
            >
              {variant === 'overdue'
                ? '!! En retard'
                : variant === 'today'
                  ? '!! ' + formatDueDate(a.dueAt)
                  : formatDueDate(a.dueAt)}
            </span>
          </div>

          {/* Category chip */}
          {a.module.category && (
            <span
              className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded mt-1"
              style={{
                backgroundColor: (a.module.category.color || '#6B7280') + '15',
                color: a.module.category.color || '#6B7280'
              }}
            >
              {a.module.category.name}
            </span>
          )}

          {/* Progress bar */}
          <div className="mt-2">
            <div className="progress-track h-1.5">
              <div
                className={`progress-fill ${variant === 'overdue' ? '!bg-red-400' : ''}`}
                style={{ width: `${a.progressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-gray-400">
                {a.progressPct}% complete
              </span>
              <span className="text-[10px] text-gray-400">
                {a.module.estimatedMinutes} min
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <Link
              to={`/modules/${a.module.id}`}
              className="btn-primary text-xs px-3 py-1.5"
            >
              {a.progressPct > 0 ? 'Continuer' : 'Commencer'}
            </Link>
            {firstPendingQuiz && (
              <Link
                to={`/modules/${a.module.id}/quiz/${firstPendingQuiz.id}`}
                className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 px-2.5 py-1.5 rounded-lg border border-primary-100 transition-colors"
              >
                <Brain size={12} /> Quiz
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Completed Card (simplified) ─────────────────────────────────────────────
function CompletedCard({ m }: { m: CompletedModule }) {
  return (
    <motion.div variants={item}>
      <Link
        to={`/modules/${m.id}`}
        className="card p-3 sm:p-4 flex items-center gap-3 hover:shadow-card-md transition-shadow group border-l-4 border-l-green-400"
      >
        <div
          className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center"
          style={{
            backgroundColor: m.category?.color
              ? m.category.color + '20'
              : '#F0FFF4'
          }}
        >
          {m.thumbnail ? (
            <img src={m.thumbnail} className="w-full h-full rounded-xl object-cover" alt="" />
          ) : (
            <CheckCircle2 size={18} className="text-green-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-800 truncate group-hover:text-primary-700 transition-colors">
            {m.title}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            {m.userEnrollment?.completedAt
              ? `Complete le ${formatFullDate(m.userEnrollment.completedAt)}`
              : '100% complete'}
          </div>
        </div>
        <span className="chip bg-green-50 text-green-600 text-[10px] font-bold shrink-0">
          Complete
        </span>
        <ChevronRight size={14} className="text-gray-300 group-hover:text-primary-500 shrink-0" />
      </Link>
    </motion.div>
  )
}

// ─── Assign Modal ────────────────────────────────────────────────────────────
type AssignMode = 'individual' | 'group'
type DeptOption = { id: string; name: string; _count?: { users: number } }

function AssignModal({ onClose, canBulk }: { onClose: () => void; canBulk: boolean }) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<AssignMode>('individual')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [selectedModule, setSelectedModule] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [note, setNote] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Bulk filters
  const [bulkDept, setBulkDept] = useState('')
  const [bulkRole, setBulkRole] = useState('')

  const { data: usersData, isLoading: loadingUsers } = useQuery<{ users: User[] }>({
    queryKey: ['assign-users', userSearch],
    queryFn: () => api.get(`/users?search=${userSearch}&limit=50`).then(r => r.data),
    enabled: mode === 'individual'
  })

  const { data: modulesData, isLoading: loadingModules } = useQuery<{ modules: Module[] }>({
    queryKey: ['assign-modules'],
    queryFn: () => api.get('/modules?limit=100').then(r => r.data)
  })

  const { data: deptData } = useQuery<DeptOption[]>({
    queryKey: ['assign-departments'],
    queryFn: () => api.get('/departments').then(r => r.data),
    enabled: mode === 'group'
  })

  const assignMutation = useMutation({
    mutationFn: (payload: { moduleId: string; userIds: string[]; dueAt: string; note?: string }) =>
      api.post('/assignments', payload).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      queryClient.invalidateQueries({ queryKey: ['assignment-summary'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-modules'] })
      queryClient.invalidateQueries({ queryKey: ['all-modules'] })
      setSuccessMsg(`Formation assignee a ${data.assigned} utilisateur${data.assigned > 1 ? 's' : ''}`)
      setTimeout(onClose, 1500)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Erreur lors de l\'assignation')
    }
  })

  const bulkMutation = useMutation({
    mutationFn: (payload: { moduleId: string; departmentId?: string; role?: string; dueAt: string; note?: string }) =>
      api.post('/assignments/bulk', payload).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      queryClient.invalidateQueries({ queryKey: ['assignment-summary'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-modules'] })
      queryClient.invalidateQueries({ queryKey: ['all-modules'] })
      setSuccessMsg(`Formation assignee a ${data.assigned} utilisateur${data.assigned > 1 ? 's' : ''}`)
      setTimeout(onClose, 1500)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Erreur lors de l\'assignation en masse')
    }
  })

  const users = usersData?.users ?? []
  const modules = modulesData?.modules ?? []
  const departments = deptData ?? []
  const isPending = assignMutation.isPending || bulkMutation.isPending

  const toggleUser = (id: string) => {
    setSelectedUsers(prev =>
      prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]
    )
  }

  const selectAll = () => {
    if (selectedUsers.length === users.length) setSelectedUsers([])
    else setSelectedUsers(users.map(u => u.id))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (!selectedModule) {
      setError('Selectionnez un module')
      return
    }
    if (!dueDate) {
      setError("Selectionnez une date d'echeance")
      return
    }

    const dueAt = new Date(dueDate).toISOString()

    if (mode === 'individual') {
      if (selectedUsers.length === 0) {
        setError('Selectionnez au moins un utilisateur')
        return
      }
      assignMutation.mutate({ moduleId: selectedModule, userIds: selectedUsers, dueAt, note: note || undefined })
    } else {
      if (!bulkDept && !bulkRole) {
        setError('Selectionnez au moins un filtre: departement ou role')
        return
      }
      bulkMutation.mutate({
        moduleId: selectedModule,
        departmentId: bulkDept || undefined,
        role: bulkRole || undefined,
        dueAt,
        note: note || undefined
      })
    }
  }

  const roleLabels: Record<string, string> = {
    PLATFORM_MANAGER: 'Platform Manager',
    HR: 'RH',
    MANAGER: 'Manager',
    SUPERVISOR: 'Superviseur',
    AGENT: 'Agent'
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Users size={18} className="text-primary-600" />
              Assigner une formation
            </h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X size={18} className="text-gray-400" />
            </button>
          </div>

          {/* Mode tabs */}
          <div className="flex border-b border-gray-100">
            <button
              type="button"
              onClick={() => setMode('individual')}
              className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors ${
                mode === 'individual'
                  ? 'text-primary-700 border-b-2 border-primary-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Individuel
            </button>
            {canBulk && (
              <button
                type="button"
                onClick={() => setMode('group')}
                className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors ${
                  mode === 'group'
                    ? 'text-primary-700 border-b-2 border-primary-600'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Groupe / Departement
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Module selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Formation
              </label>
              {loadingModules ? (
                <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                  <Loader2 size={14} className="animate-spin" /> Chargement...
                </div>
              ) : (
                <select
                  value={selectedModule}
                  onChange={e => setSelectedModule(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors"
                >
                  <option value="">-- Choisir un module --</option>
                  {modules.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.estimatedMinutes} min)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Due date */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Date d'echeance
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors"
              />
            </div>

            {/* Note (optional) */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Note (optionnel)
              </label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Instructions supplementaires..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors"
              />
            </div>

            {/* ── Individual: user selection ── */}
            {mode === 'individual' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-600">
                    Utilisateurs ({selectedUsers.length} selectionne{selectedUsers.length > 1 ? 's' : ''})
                  </label>
                  {users.length > 0 && (
                    <button
                      type="button"
                      onClick={selectAll}
                      className="text-[10px] font-medium text-primary-600 hover:text-primary-700"
                    >
                      {selectedUsers.length === users.length ? 'Tout deselectionner' : 'Tout selectionner'}
                    </button>
                  )}
                </div>
                <div className="relative mb-2">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    placeholder="Rechercher un utilisateur..."
                    className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors"
                  />
                </div>

                {loadingUsers ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 py-3 justify-center">
                    <Loader2 size={14} className="animate-spin" /> Chargement...
                  </div>
                ) : (
                  <div className="border border-gray-100 rounded-xl max-h-48 overflow-y-auto divide-y divide-gray-50">
                    {users.length === 0 ? (
                      <div className="py-4 text-center text-xs text-gray-400">
                        Aucun utilisateur trouve
                      </div>
                    ) : (
                      users.map(u => {
                        const selected = selectedUsers.includes(u.id)
                        return (
                          <label
                            key={u.id}
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                              selected ? 'bg-primary-50' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleUser(u.id)}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0">
                              {u.firstName[0]}{u.lastName[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-gray-700 truncate">
                                {u.firstName} {u.lastName}
                              </div>
                              <div className="text-[10px] text-gray-400 truncate">
                                {u.email}
                              </div>
                            </div>
                            <span className="chip text-[9px] chip-gray shrink-0">
                              {u.role.replace(/_/g, ' ')}
                            </span>
                          </label>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Group: department / role filters ── */}
            {mode === 'group' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  Assignez la formation a tous les utilisateurs correspondant aux criteres ci-dessous.
                </p>

                {/* Department */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Departement
                  </label>
                  <select
                    value={bulkDept}
                    onChange={e => setBulkDept(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors"
                  >
                    <option value="">-- Tous les departements --</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name}{d._count?.users ? ` (${d._count.users} membres)` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Role
                  </label>
                  <select
                    value={bulkRole}
                    onChange={e => setBulkRole(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors"
                  >
                    <option value="">-- Tous les roles --</option>
                    {Object.entries(roleLabels).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>

              </div>
            )}

            {/* Success */}
            {successMsg && (
              <div className="text-xs text-green-600 bg-green-50 rounded-xl px-3 py-2 border border-green-100 flex items-center gap-2">
                <CheckCircle2 size={14} /> {successMsg}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2 border border-red-100">
                {error}
              </div>
            )}

            {/* Submit */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="btn-primary text-sm px-5 py-2 flex items-center gap-2 disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                {mode === 'group' ? 'Assigner au groupe' : 'Assigner'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Section Header ──────────────────────────────────────────────────────────
function SectionHeader({
  icon: Icon,
  iconClass,
  bgClass,
  title,
  count
}: {
  icon: React.ElementType
  iconClass: string
  bgClass: string
  title: string
  count: number
}) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <div className={`w-6 h-6 rounded-lg ${bgClass} flex items-center justify-center`}>
        <Icon size={13} className={iconClass} />
      </div>
      <h2 className="text-sm font-bold text-gray-700">
        {title} <span className="text-gray-400 font-medium">({count})</span>
      </h2>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function AssignmentsPage() {
  const { user } = useAuthStore()
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  const canAssign = user?.role === 'MANAGER' || user?.role === 'SUPERVISOR' || user?.role === 'HR' || user?.role === 'PLATFORM_MANAGER'

  // Active assignments (overdue / today / upcoming)
  const { data: assignments, isLoading: loadingAssignments, isError: errorAssignments } = useQuery<Assignments>({
    queryKey: ['assignments'],
    queryFn: () => api.get('/assignments').then(r => r.data)
  })

  // Completed modules (with dueAt set = were assignments)
  const { data: modulesData, isLoading: loadingModules } = useQuery<{
    modules: CompletedModule[]
  }>({
    queryKey: ['all-modules'],
    queryFn: () => api.get('/modules').then(r => r.data)
  })

  // Assignment summary (for managers)
  const { data: summary } = useQuery<{ overdueCount: number; todayCount: number; totalAssigned: number }>({
    queryKey: ['assignment-summary'],
    queryFn: () => api.get('/assignments/summary').then(r => r.data),
    enabled: canAssign
  })

  const overdue = assignments?.overdue ?? []
  const today = assignments?.today ?? []
  const upcoming = assignments?.upcoming ?? []
  const completed = useMemo(
    () => (modulesData?.modules ?? []).filter(m => m.userEnrollment?.status === 'COMPLETED'),
    [modulesData]
  )

  const isLoading = loadingAssignments || loadingModules
  const totalActive = overdue.length + today.length + upcoming.length

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-7 bg-gray-200 rounded w-48 animate-pulse" />
          {canAssign && <div className="h-9 bg-gray-200 rounded-xl w-36 animate-pulse" />}
        </div>
        <SectionSkeleton />
        <SectionSkeleton />
      </div>
    )
  }

  if (errorAssignments) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
        <motion.div variants={item} className="card p-8 text-center">
          <AlertTriangle size={36} className="mx-auto mb-3 text-red-300" />
          <p className="text-sm font-medium text-gray-700">Erreur lors du chargement des devoirs</p>
          <p className="text-xs text-gray-400 mt-1">Veuillez rafraichir la page ou reessayer plus tard.</p>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
      {/* ── Page Header ───────────────────────────────────── */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Mes devoirs</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {totalActive} actif{totalActive > 1 ? 's' : ''} · {completed.length} complete{completed.length > 1 ? 's' : ''}
          </p>
        </div>
        {canAssign && (
          <button
            onClick={() => setShowAssignModal(true)}
            className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
          >
            <Plus size={14} />
            Assigner
          </button>
        )}
      </motion.div>

      {/* ── Manager Summary Bar ───────────────────────────── */}
      {canAssign && summary && (
        <motion.div variants={item} className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: 'En retard', value: summary.overdueCount, color: 'text-red-500', bg: 'bg-red-50' },
            { label: "Aujourd'hui", value: summary.todayCount, color: 'text-orange-500', bg: 'bg-orange-50' },
            { label: 'Total assigne', value: summary.totalAssigned, color: 'text-primary-700', bg: 'bg-primary-50' }
          ].map(s => (
            <div key={s.label} className={`card p-2.5 sm:p-3 text-center ${s.bg} border-0`}>
              <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mt-0.5">{s.label}</div>
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Overdue ───────────────────────────────────────── */}
      {overdue.length > 0 && (
        <motion.div variants={item}>
          <SectionHeader
            icon={AlertTriangle}
            iconClass="text-red-500"
            bgClass="bg-red-100"
            title="En retard"
            count={overdue.length}
          />
          <div className="space-y-2">
            {overdue.map(a => (
              <AssignmentCard key={a.id} a={a} variant="overdue" />
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Today ─────────────────────────────────────────── */}
      {today.length > 0 && (
        <motion.div variants={item}>
          <SectionHeader
            icon={CalendarCheck}
            iconClass="text-orange-500"
            bgClass="bg-orange-100"
            title="Aujourd'hui"
            count={today.length}
          />
          <div className="space-y-2">
            {today.map(a => (
              <AssignmentCard key={a.id} a={a} variant="today" />
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Upcoming ──────────────────────────────────────── */}
      {upcoming.length > 0 && (
        <motion.div variants={item}>
          <SectionHeader
            icon={Clock}
            iconClass="text-blue-500"
            bgClass="bg-blue-100"
            title="A venir"
            count={upcoming.length}
          />
          <div className="space-y-2">
            {upcoming.map(a => (
              <AssignmentCard key={a.id} a={a} variant="upcoming" />
            ))}
          </div>
        </motion.div>
      )}

      {/* ── All clear message ─────────────────────────────── */}
      {totalActive === 0 && completed.length === 0 && (
        <motion.div
          variants={item}
          className="card p-8 text-center"
        >
          <CalendarCheck size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-700">Aucun devoir assigne</p>
          <p className="text-xs text-gray-400 mt-1">
            Vous n'avez pas encore de devoirs. Explorez les formations disponibles.
          </p>
          <Link to="/modules" className="btn-primary mt-4 text-xs inline-flex items-center gap-1">
            <BookOpen size={14} /> Parcourir les formations
          </Link>
        </motion.div>
      )}

      {totalActive === 0 && completed.length > 0 && (
        <motion.div
          variants={item}
          className="card p-4 flex items-center gap-3 border-green-200 bg-green-50"
        >
          <span className="text-2xl">!!</span>
          <div>
            <div className="text-sm font-semibold text-gray-800">Tout est a jour</div>
            <div className="text-xs text-gray-500">Aucun devoir en attente. Bravo !</div>
          </div>
        </motion.div>
      )}

      {/* ── Completed ─────────────────────────────────────── */}
      {completed.length > 0 && (
        <motion.div variants={item}>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 mb-2.5 group"
          >
            <div className="w-6 h-6 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle2 size={13} className="text-green-500" />
            </div>
            <h2 className="text-sm font-bold text-gray-700">
              Completes <span className="text-gray-400 font-medium">({completed.length})</span>
            </h2>
            <ChevronRight
              size={14}
              className={`text-gray-400 transition-transform duration-200 ${
                showCompleted ? 'rotate-90' : ''
              }`}
            />
          </button>

          <AnimatePresence>
            {showCompleted && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-2 overflow-hidden"
              >
                {completed.map(m => (
                  <CompletedCard key={m.id} m={m} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Assign Modal ──────────────────────────────────── */}
      {showAssignModal && (
        <AssignModal
          onClose={() => setShowAssignModal(false)}
          canBulk={user?.role === 'PLATFORM_MANAGER' || user?.role === 'HR'}
        />
      )}
    </motion.div>
  )
}
