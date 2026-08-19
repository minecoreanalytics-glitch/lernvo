import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Trophy, Flame } from 'lucide-react'
import { useAuthStore } from '../store/auth'
import { api } from '../utils/api'
import type { LeaderboardEntry } from '../types'

export default function LeaderboardPage() {
  const { user } = useAuthStore()

  const { data: leaderboard = [], isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard-full'],
    queryFn: () => api.get('/gamification/leaderboard?limit=50').then(r => r.data)
  })

  const myRank = leaderboard.findIndex(e => e.id === user?.id) + 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Trophy size={20} className="text-yellow-500" /> Classement
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Top apprenants du mois</p>
      </div>

      {/* Podium top 3 */}
      {leaderboard.length >= 3 && (
        <div className="card p-4 sm:p-6 flex items-end justify-center gap-2 sm:gap-4">
          {/* 2nd */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="flex flex-col items-center gap-2">
            <span className="text-2xl">🥈</span>
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-700 border-2 border-gray-300">
              {leaderboard[1].firstName[0]}{leaderboard[1].lastName[0]}
            </div>
            <div className="text-center">
              <div className="text-xs font-semibold text-gray-700">{leaderboard[1].firstName}</div>
              <div className="text-xs font-bold text-yellow-500">{leaderboard[1].totalPoints.toLocaleString()}</div>
            </div>
            <div className="w-14 h-16 bg-gray-100 border border-gray-200 rounded-t-xl flex items-center justify-center text-gray-400 font-bold text-sm">2</div>
          </motion.div>

          {/* 1st */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-2">
            <span className="text-3xl">👑</span>
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-xl font-bold text-primary-700 border-2 border-primary-400 shadow-card-md">
              {leaderboard[0].firstName[0]}{leaderboard[0].lastName[0]}
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-gray-800">{leaderboard[0].firstName} {leaderboard[0].lastName}</div>
              <div className="text-sm font-bold text-yellow-500">{leaderboard[0].totalPoints.toLocaleString()} pts</div>
            </div>
            <div className="w-16 h-24 bg-primary-700 rounded-t-xl flex items-center justify-center text-white font-bold">1</div>
          </motion.div>

          {/* 3rd */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="flex flex-col items-center gap-2">
            <span className="text-2xl">🥉</span>
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 border-2 border-gray-200">
              {leaderboard[2].firstName[0]}{leaderboard[2].lastName[0]}
            </div>
            <div className="text-center">
              <div className="text-xs font-semibold text-gray-700">{leaderboard[2].firstName}</div>
              <div className="text-xs font-bold text-yellow-500">{leaderboard[2].totalPoints.toLocaleString()}</div>
            </div>
            <div className="w-14 h-12 bg-gray-100 border border-gray-200 rounded-t-xl flex items-center justify-center text-gray-400 font-bold text-sm">3</div>
          </motion.div>
        </div>
      )}

      {/* My position highlight */}
      {myRank > 0 && (
        <div className="card p-3 border-primary-200 bg-primary-50 flex items-center gap-3">
          <div className="text-xl font-bold text-primary-700 w-8 text-center">#{myRank}</div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-800">Votre position</div>
            <div className="text-xs text-gray-500">{(user?.totalPoints ?? 0).toLocaleString()} points</div>
          </div>
          {(user?.currentStreak ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-orange-500 text-sm font-bold">
              <Flame size={14} /> {user?.currentStreak}
            </div>
          )}
        </div>
      )}

      {/* Full list */}
      <div className="card divide-y divide-gray-100">
        {isLoading && (
          <div className="py-8 text-center text-gray-400 text-sm">Chargement...</div>
        )}
        {leaderboard.map((entry, i) => (
          <motion.div key={entry.id}
            initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.015 }}
            className={`flex items-center gap-3 px-4 py-3 ${entry.id === user?.id ? 'bg-primary-50' : ''}`}
          >
            <div className="w-6 text-center">
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉'
                : <span className="text-xs text-gray-400 font-bold">{i + 1}</span>}
            </div>
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
              {entry.firstName[0]}{entry.lastName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-800 truncate">
                {entry.firstName} {entry.lastName}
                {entry.id === user?.id && <span className="ml-2 chip chip-primary text-[9px]">Vous</span>}
              </div>
              <div className="text-xs text-gray-400 truncate">{entry.department?.name}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-yellow-500">{entry.totalPoints.toLocaleString()}</div>
              {entry.currentStreak > 0 && (
                <div className="text-[10px] text-orange-400">🔥 {entry.currentStreak}</div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
