import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Award, Star, Flame, Shield, KeyRound, Loader2, Check } from 'lucide-react'
import { useAuthStore } from '../store/auth'
import { api } from '../utils/api'
import OrgBrandingCard from '../components/OrgBrandingCard'

export default function ProfilePage() {
  const { user } = useAuthStore()
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwStatus, setPwStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [pwError, setPwError] = useState('')

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    if (pwForm.next !== pwForm.confirm) {
      setPwError('Les mots de passe ne correspondent pas')
      return
    }
    if (pwForm.next.length < 6) {
      setPwError('Minimum 6 caractères')
      return
    }
    setPwStatus('loading')
    try {
      await api.post('/auth/change-password', { currentPassword: pwForm.current, newPassword: pwForm.next })
      setPwStatus('success')
      setPwForm({ current: '', next: '', confirm: '' })
      setTimeout(() => setPwStatus('idle'), 3000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setPwError(msg || 'Erreur lors du changement')
      setPwStatus('error')
    }
  }

  const { data: stats } = useQuery({
    queryKey: ['my-stats'],
    queryFn: () => api.get('/gamification/my-stats').then(r => r.data)
  })

  const { data: allBadges = [] } = useQuery<Array<{ id: string; name: string; icon: string; description: string; points: number }>>({
    queryKey: ['all-badges'],
    queryFn: () => api.get('/gamification/badges').then(r => r.data)
  })

  const earnedIds = new Set(stats?.badges?.map((b: { badge: { id: string } }) => b.badge.id) ?? [])

  return (
    <div className="space-y-5">
      {/* Profile header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="card overflow-hidden">
        {/* Banner */}
        <div className="h-20 bg-gradient-to-r from-primary-700 to-primary-500" />
        <div className="px-5 pb-5">
          <div className="flex items-end gap-4 -mt-8 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-white border-2 border-white shadow-card-md flex items-center justify-center text-xl font-bold text-primary-700">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="pb-1">
              <h1 className="text-lg font-bold text-gray-900">{user?.firstName} {user?.lastName}</h1>
              <p className="text-xs text-gray-500">{user?.role?.replace(/_/g, ' ')} · {user?.department?.name}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Points totaux', value: (user?.totalPoints ?? 0).toLocaleString(), icon: <Star size={16} className="text-yellow-500" />, sub: 'pts' },
              { label: 'Classement',    value: stats?.rank ? `#${stats.rank}` : '—',        icon: <Shield size={16} className="text-primary-600" />, sub: 'global' },
              { label: 'Streak actuel', value: user?.currentStreak ?? 0,                    icon: <Flame size={16} className="text-orange-500" />, sub: 'jours' },
              { label: 'Record',        value: user?.longestStreak ?? 0,                    icon: <Flame size={16} className="text-red-400" />, sub: 'jours' },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                <div className="flex justify-center mb-1">{s.icon}</div>
                <div className="text-lg font-bold text-gray-900">{s.value}</div>
                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Recent activity */}
      {stats?.recentPoints?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Activité récente</h2>
          <div className="card divide-y divide-gray-100">
            {stats.recentPoints.map((p: { id: string; reason: string; points: number }) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-600 capitalize">{p.reason.replace(/_/g, ' ')}</span>
                <span className="chip chip-primary font-bold">+{p.points} pts</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Badges */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Award size={15} className="text-primary-600" /> Badges
          </h2>
          <span className="chip chip-primary text-xs">{earnedIds.size}/{allBadges.length}</span>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {allBadges.map(badge => {
            const earned = earnedIds.has(badge.id)
            return (
              <div key={badge.id}
                className={`card p-3 flex flex-col items-center gap-1.5 text-center transition-all ${!earned ? 'opacity-35 grayscale' : 'hover:shadow-card-md'}`}
                title={badge.description}>
                <span className="text-2xl">{badge.icon}</span>
                <span className="text-[10px] text-gray-600 leading-tight font-medium">{badge.name}</span>
                <span className="chip chip-primary text-[9px]">{badge.points} pts</span>
              </div>
            )
          })}
        </div>
      </motion.div>
      {/* Change password */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
          <KeyRound size={15} className="text-primary-600" /> Changer mon mot de passe
        </h2>
        <div className="card p-4">
          {pwStatus === 'success' ? (
            <div className="flex items-center gap-3 py-2 text-green-600">
              <Check size={18} />
              <span className="text-sm font-medium">Mot de passe mis à jour avec succès</span>
            </div>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Mot de passe actuel</label>
                <input
                  type="password"
                  value={pwForm.current}
                  onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Nouveau mot de passe</label>
                <input
                  type="password"
                  value={pwForm.next}
                  onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
                  placeholder="Minimum 6 caractères"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Confirmer le nouveau mot de passe</label>
                <input
                  type="password"
                  value={pwForm.confirm}
                  onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
                />
              </div>
              {pwError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{pwError}</div>
              )}
              <button
                type="submit"
                disabled={pwStatus === 'loading'}
                className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {pwStatus === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                Mettre à jour
              </button>
            </form>
          )}
        </div>
      </motion.div>

      {user?.role === 'PLATFORM_MANAGER' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <OrgBrandingCard />
        </motion.div>
      )}
    </div>
  )
}
