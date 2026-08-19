import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { Activity, Clock, Users, BookOpen, TrendingUp, LogIn, LogOut, List } from 'lucide-react'
import { api } from '../../utils/api'

const DAYS_OPTIONS = [7, 14, 30, 60, 90]

const COLORS = ['#2B6CB0', '#276749', '#553C9A', '#C05621', '#C53030', '#2C7A7B']

function StatCard({ icon, label, value, sub, color = 'text-primary-700' }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className={`text-xl font-bold ${color}`}>{value}</div>
        <div className="text-xs text-gray-500 font-medium">{label}</div>
        {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`
  return `${(seconds / 3600).toFixed(1)}h`
}

function formatEvent(event: string): string {
  return event.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30)

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['analytics-overview', days],
    queryFn: () => api.get(`/analytics/overview?days=${days}`).then(r => r.data),
    refetchInterval: 60000
  })

  const { data: pages } = useQuery({
    queryKey: ['analytics-pages', days],
    queryFn: () => api.get(`/analytics/pages?days=${days}`).then(r => r.data)
  })

  const { data: courses } = useQuery({
    queryKey: ['analytics-courses', days],
    queryFn: () => api.get(`/analytics/courses?days=${days}`).then(r => r.data)
  })

  const { data: timeline = [] } = useQuery({
    queryKey: ['analytics-timeline', days],
    queryFn: () => api.get(`/analytics/timeline?days=${days}`).then(r => r.data)
  })

  const { data: logs = [] } = useQuery({
    queryKey: ['analytics-logs'],
    queryFn: () => api.get('/analytics/logs?limit=30').then(r => r.data),
    refetchInterval: 30000
  })

  const topEvents = (overview?.topEvents ?? []).map((e: { event: string; _count: { event: number } }) => ({
    name: formatEvent(e.event),
    value: e._count.event
  }))

  const entryPages = (pages?.entryPages ?? []).map((p: { entryPage: string; _count: { entryPage: number } }) => ({
    page: p.entryPage?.replace('/dashboard', 'Dashboard').replace('/modules', 'Formations').replace('/leaderboard', 'Classement').replace('/career', 'Parcours').replace('/kb', 'Connaissances') || '/',
    count: p._count.entryPage
  }))

  const exitPages = (pages?.exitPages ?? []).map((p: { exitPage: string; _count: { exitPage: number } }) => ({
    page: p.exitPage?.replace('/dashboard', 'Dashboard').replace('/modules', 'Formations').replace('/leaderboard', 'Classement').replace('/career', 'Parcours').replace('/kb', 'Connaissances') || '/',
    count: p._count.exitPage
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Activity size={20} className="text-primary-600" /> Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Activité et comportement des utilisateurs</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {DAYS_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                days === d ? 'bg-white shadow text-primary-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {d}j
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Users size={18} className="text-primary-600" />}
          label="Utilisateurs actifs"
          value={loadingOverview ? '…' : (overview?.activeUsers ?? 0)}
          sub={`sur ${days} jours`}
          color="text-primary-700"
        />
        <StatCard
          icon={<Activity size={18} className="text-indigo-600" />}
          label="Sessions"
          value={loadingOverview ? '…' : (overview?.totalSessions ?? 0)}
          sub={`${overview?.completedSessions ?? 0} terminées`}
          color="text-indigo-700"
        />
        <StatCard
          icon={<Clock size={18} className="text-success-600" />}
          label="Durée moy. session"
          value={loadingOverview ? '…' : formatDuration(overview?.avgDurationSeconds ?? 0)}
          color="text-success-700"
        />
        <StatCard
          icon={<BookOpen size={18} className="text-orange-600" />}
          label="Cours commencés"
          value={loadingOverview ? '…' : (courses?.started ?? 0)}
          sub={courses?.abandonRate != null ? `${courses.abandonRate}% abandon` : undefined}
          color="text-orange-700"
        />
      </div>

      {/* Course funnel */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
          <TrendingUp size={15} className="text-primary-600" /> Funnel cours
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Commencés', value: courses?.started ?? 0, color: 'bg-primary-100 text-primary-700' },
            { label: 'Abandonnés', value: courses?.exited ?? 0, color: 'bg-orange-100 text-orange-700' },
            { label: 'Complétés', value: courses?.completed ?? 0, color: 'bg-green-100 text-green-700' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-4 text-center ${s.color}`}>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs font-medium mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline chart */}
      {(timeline as unknown[]).length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <Activity size={15} className="text-primary-600" /> Activité dans le temps
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={timeline as Record<string, unknown>[]}>
              <defs>
                <linearGradient id="colorPV" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2B6CB0" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2B6CB0" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCS" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#276749" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#276749" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area type="monotone" dataKey="PAGE_VIEW" name="Pages vues" stroke="#2B6CB0" fill="url(#colorPV)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="COURSE_STARTED" name="Cours commencés" stroke="#276749" fill="url(#colorCS)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Entry / Exit pages + Top events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Entry pages */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <LogIn size={14} className="text-green-600" /> Pages d'entrée
          </h2>
          {entryPages.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">Aucune donnée</p>
          ) : (
            <div className="space-y-2">
              {entryPages.slice(0, 6).map((p: { page: string; count: number }) => (
                <div key={p.page} className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 truncate flex-1 mr-2">{p.page}</span>
                  <span className="text-xs font-bold text-primary-700 shrink-0">{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Exit pages */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <LogOut size={14} className="text-red-500" /> Pages de sortie
          </h2>
          {exitPages.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">Aucune donnée</p>
          ) : (
            <div className="space-y-2">
              {exitPages.slice(0, 6).map((p: { page: string; count: number }) => (
                <div key={p.page} className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 truncate flex-1 mr-2">{p.page}</span>
                  <span className="text-xs font-bold text-red-500 shrink-0">{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top events pie */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <Activity size={14} className="text-indigo-600" /> Événements
          </h2>
          {topEvents.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">Aucune donnée</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={topEvents} cx="50%" cy="50%" outerRadius={55} dataKey="value" nameKey="name">
                  {topEvents.map((_: unknown, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [v, 'événements']} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent activity log */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <List size={14} className="text-gray-500" /> Activité récente
          </h2>
        </div>
        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {(logs as unknown[]).length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">Aucune activité enregistrée</p>
          ) : (logs as {
            id: string; event: string; page: string | null; createdAt: string;
            user: { firstName: string; lastName: string }
          }[]).map((log) => (
            <div key={log.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                {log.user.firstName[0]}{log.user.lastName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-gray-800">{log.user.firstName} {log.user.lastName}</span>
                <span className="text-xs text-gray-400 mx-1.5">·</span>
                <span className="text-xs text-primary-600 font-medium">{formatEvent(log.event)}</span>
                {log.page && <span className="text-xs text-gray-400 ml-1.5 truncate">{log.page}</span>}
              </div>
              <span className="text-[10px] text-gray-400 shrink-0 hidden sm:block">
                {new Date(log.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
