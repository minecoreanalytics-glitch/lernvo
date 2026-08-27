import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, BookOpen, AlertTriangle, Flame, Award, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth'
import { api } from '../utils/api'

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

function getTodayKey(userId: string): string {
  const d = new Date().toISOString().slice(0, 10)
  return `lernvo-welcome-${userId}-${d}`
}

export default function WelcomeModal() {
  const { user } = useAuthStore()
  const [show, setShow] = useState(false)

  // Check if we already showed today
  useEffect(() => {
    if (!user) return
    let seen = false
    try { seen = !!sessionStorage.getItem(getTodayKey(user.id)) } catch { /* storage disabled */ }
    if (!seen) {
      // Small delay so dashboard loads first
      const t = setTimeout(() => setShow(true), 800)
      return () => clearTimeout(t)
    }
  }, [user])

  // Fetch summary data
  const { data: stats } = useQuery({
    queryKey: ['welcome-stats'],
    queryFn: () => api.get('/gamification/my-stats').then(r => r.data),
    enabled: show
  })

  const { data: assignments } = useQuery<{ overdue: unknown[]; today: unknown[]; upcoming: unknown[] }>({
    queryKey: ['welcome-assignments'],
    queryFn: () => api.get('/assignments').then(r => r.data),
    enabled: show
  })

  const { data: modulesData } = useQuery<{ modules: { userEnrollment?: { status: string } }[] }>({
    queryKey: ['welcome-modules'],
    queryFn: () => api.get('/modules?limit=100').then(r => r.data),
    enabled: show
  })

  function handleClose() {
    try { if (user) sessionStorage.setItem(getTodayKey(user.id), '1') } catch { /* storage disabled */ }
    setShow(false)
  }

  if (!user) return null

  const overdue = assignments?.overdue?.length ?? 0
  const todayCount = assignments?.today?.length ?? 0
  const upcoming = assignments?.upcoming?.length ?? 0
  const inProgress = modulesData?.modules?.filter(m => m.userEnrollment?.status === 'IN_PROGRESS').length ?? 0
  const completed = modulesData?.modules?.filter(m => m.userEnrollment?.status === 'COMPLETED').length ?? 0
  const streak = user.currentStreak ?? 0
  const points = user.totalPoints ?? 0
  const rank = stats?.rank ?? '—'
  const badges = stats?.badges?.length ?? 0

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={handleClose}
        >
          {/* Backdrop on its own non-interactive layer — iOS Safari lets backdrop-filter
              swallow taps meant for children, which killed the modal's buttons. */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', duration: 0.5 }}
            onClick={e => e.stopPropagation()}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            {/* Header gradient */}
            <div className="bg-gradient-to-br from-primary-700 to-primary-900 px-6 pt-6 pb-5 relative">
              <button onClick={handleClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white/70 hover:bg-white/25 transition-colors">
                <X size={16} />
              </button>
              <div className="text-3xl mb-2">👋</div>
              <h2 className="text-xl font-bold text-white">{getGreeting()}, {user.firstName} !</h2>
              <p className="text-sm text-white/60 mt-1">Voici votre résumé Lernvo</p>
            </div>

            {/* Stats grid */}
            <div className="px-6 py-4">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-primary-700">#{rank}</div>
                  <div className="text-[10px] text-gray-400 font-medium">RANG</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-yellow-500">{points.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-400 font-medium">POINTS</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-500">{streak > 0 ? `🔥 ${streak}` : '—'}</div>
                  <div className="text-[10px] text-gray-400 font-medium">JOURS</div>
                </div>
              </div>

              {/* Summary items */}
              <div className="space-y-2.5">
                {overdue > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                    <AlertTriangle size={18} className="text-red-500 shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-red-700">{overdue} formation{overdue > 1 ? 's' : ''} en retard</div>
                      <div className="text-[11px] text-red-400">À compléter rapidement</div>
                    </div>
                  </div>
                )}

                {todayCount > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 border border-orange-100">
                    <BookOpen size={18} className="text-orange-500 shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-orange-700">{todayCount} devoir{todayCount > 1 ? 's' : ''} aujourd'hui</div>
                      <div className="text-[11px] text-orange-400">À terminer avant ce soir</div>
                    </div>
                  </div>
                )}

                {overdue === 0 && todayCount === 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-100">
                    <span className="text-lg">✅</span>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-green-700">Tout est à jour !</div>
                      <div className="text-[11px] text-green-500">Aucun devoir en retard</div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <BookOpen size={18} className="text-primary-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-700">{inProgress} en cours · {completed} complétée{completed > 1 ? 's' : ''}</div>
                    {upcoming > 0 && <div className="text-[11px] text-gray-400">{upcoming} à venir</div>}
                  </div>
                </div>

                {badges > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 border border-purple-100">
                    <Award size={18} className="text-purple-500 shrink-0" />
                    <div className="text-sm font-semibold text-purple-700">{badges} badge{badges > 1 ? 's' : ''} obtenu{badges > 1 ? 's' : ''}</div>
                  </div>
                )}

                {streak >= 3 && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 border border-orange-100">
                    <Flame size={18} className="text-orange-500 shrink-0" />
                    <div className="text-sm font-semibold text-orange-700">Série de {streak} jours ! Continuez !</div>
                  </div>
                )}
              </div>
            </div>

            {/* CTA */}
            <div className="px-6 pb-6 pt-2">
              {overdue > 0 ? (
                <Link to="/modules" onClick={handleClose}
                  className="w-full btn-primary py-3 text-sm font-semibold flex items-center justify-center gap-2 rounded-xl">
                  Rattraper mes formations <ArrowRight size={16} />
                </Link>
              ) : inProgress > 0 ? (
                <Link to="/modules" onClick={handleClose}
                  className="w-full btn-primary py-3 text-sm font-semibold flex items-center justify-center gap-2 rounded-xl">
                  Continuer ma formation <ArrowRight size={16} />
                </Link>
              ) : (
                <button onClick={handleClose}
                  className="w-full btn-primary py-3 text-sm font-semibold flex items-center justify-center gap-2 rounded-xl">
                  C'est parti ! <ArrowRight size={16} />
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
