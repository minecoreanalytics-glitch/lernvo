import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Route, CheckCircle, Lock, ChevronRight, Loader2, Circle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../utils/api'
import type { CareerPath } from '../types'

export default function CareerPage() {
  const qc = useQueryClient()

  const { data: paths = [], isLoading } = useQuery<CareerPath[]>({
    queryKey: ['career-paths'],
    queryFn: () => api.get('/career/paths').then(r => r.data)
  })

  const enrollMutation = useMutation({
    mutationFn: (id: string) => api.post(`/career/paths/${id}/enroll`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['career-paths'] })
  })

  const active    = paths.filter(p => p.userEnrollment)
  const available = paths.filter(p => !p.userEnrollment)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Route size={20} className="text-primary-600" /> Parcours de carrière
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Définissez et suivez votre progression professionnelle</p>
      </div>

      {/* Active */}
      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Parcours actifs</h2>
          {active.map((path, i) => <ActivePathCard key={path.id} path={path} delay={i * 0.05} />)}
        </section>
      )}

      {/* Available */}
      {available.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Disponibles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {available.map((path, i) => (
              <motion.div key={path.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <div className="card p-5 hover:shadow-card-md transition-shadow">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="text-3xl">{path.icon || '🎯'}</div>
                    <div>
                      <h3 className="font-semibold text-gray-800 text-sm">{path.title}</h3>
                      {path.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{path.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{path._count?.modules ?? 0} modules</span>
                    <button
                      onClick={() => enrollMutation.mutate(path.id)}
                      disabled={enrollMutation.isPending}
                      className="btn-primary text-xs py-1.5 px-3"
                    >
                      {enrollMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                      S'inscrire
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-36" />)}
        </div>
      )}

      {!isLoading && paths.length === 0 && (
        <div className="card p-12 text-center">
          <Route size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-400">Aucun parcours disponible pour le moment</p>
        </div>
      )}
    </div>
  )
}

function ActivePathCard({ path, delay }: { path: CareerPath; delay: number }) {
  const { data: detail } = useQuery<CareerPath & { modules: NonNullable<CareerPath['modules']> }>({
    queryKey: ['career-path-detail', path.id],
    queryFn: () => api.get(`/career/paths/${path.id}`).then(r => r.data)
  })

  const modules = detail?.modules ?? []

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-3xl">{path.icon || '🎯'}</div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-800 text-sm">{path.title}</h3>
          <div className="progress-track mt-2">
            <div className="progress-fill" style={{ width: `${path.userEnrollment?.progressPct ?? 0}%` }} />
          </div>
          <div className="text-xs text-gray-400 mt-1">{path.userEnrollment?.progressPct ?? 0}% · {path._count?.modules} modules</div>
        </div>
      </div>

      {modules.length > 0 && (
        <div className="space-y-1 border-t border-gray-100 pt-3">
          {modules.slice(0, 5).map((pm, i) => {
            const done   = pm.userStatus?.status === 'COMPLETED'
            const active = pm.userStatus?.status === 'IN_PROGRESS'
            return (
              <Link key={pm.id} to={`/modules/${pm.moduleId}`}
                className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 transition-colors group">
                <div className={`shrink-0 ${done ? 'text-success-500' : active ? 'text-primary-600' : 'text-gray-300'}`}>
                  {done ? <CheckCircle size={15} /> : active ? <Circle size={15} /> : <Lock size={15} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium ${done ? 'text-gray-400 line-through' : active ? 'text-gray-800' : 'text-gray-400'}`}>
                    {i + 1}. {pm.module.title}
                  </div>
                  {active && pm.userStatus && (
                    <div className="progress-track mt-1 h-1">
                      <div className="progress-fill" style={{ width: `${pm.userStatus.progressPct}%` }} />
                    </div>
                  )}
                </div>
                <ChevronRight size={12} className="text-gray-300 group-hover:text-primary-500 shrink-0 transition-colors" />
              </Link>
            )
          })}
          {modules.length > 5 && (
            <p className="text-xs text-gray-400 text-center py-1">+ {modules.length - 5} autres modules</p>
          )}
        </div>
      )}
    </motion.div>
  )
}
