import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { BookOpen, Clock, Users, Search, GraduationCap, Building2, Award, ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../utils/api'
import type { Module } from '../types'

type ViewMode = 'categories' | 'general' | 'department' | 'required'

const typeCards = [
  {
    key: 'general' as ViewMode,
    title: 'Formations Générales',
    description: 'Culture d\'entreprise, service client, développement professionnel',
    icon: GraduationCap,
    color: '#2B6CB0',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  {
    key: 'department' as ViewMode,
    title: 'Formations Départementales',
    description: 'Formations spécifiques à votre département et métier',
    icon: Building2,
    color: '#16A34A',
    bg: 'bg-green-50',
    border: 'border-green-200',
  },
  {
    key: 'required' as ViewMode,
    title: 'Formations Obligatoires',
    description: 'Requises pour votre parcours carrière et promotion',
    icon: Award,
    color: '#D97706',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
]

function ModuleCard({ m, i }: { m: Module; i: number }) {
  return (
    <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
      <Link to={`/modules/${m.id}`} className="card block overflow-hidden hover:shadow-card-md transition-shadow group">
        <div className="h-28 bg-gray-100 flex items-center justify-center relative">
          {m.thumbnail
            ? <img src={m.thumbnail} className="w-full h-full object-cover" alt="" />
            : (
              <div className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: m.category?.color ? m.category.color + '20' : '#EEF4FB' }}>
                <BookOpen size={28} style={{ color: m.category?.color || '#2B6CB0' }} />
              </div>
            )}
          {m.category && (
            <span
              className="absolute top-2 left-2 chip text-[10px] font-semibold text-white"
              style={{ backgroundColor: m.category.color || '#2B6CB0' }}>
              {m.category.name}
            </span>
          )}
        </div>

        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-800 group-hover:text-primary-700 transition-colors line-clamp-2">
            {m.title}
          </h3>
          {m.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{m.description}</p>
          )}

          <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Clock size={11} /> {m.estimatedMinutes} min</span>
            <span className="flex items-center gap-1"><Users size={11} /> {m._count?.enrollments ?? 0}</span>
          </div>

          {m.userEnrollment && (
            <div className="mt-3">
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${m.userEnrollment.progressPct}%` }} />
              </div>
              <div className="text-[10px] text-gray-400 mt-1">
                {m.userEnrollment.status === 'COMPLETED'
                  ? <span className="chip-success">Complété</span>
                  : `${m.userEnrollment.progressPct}% en cours`}
              </div>
            </div>
          )}

          {!m.userEnrollment && (
            <div className="mt-3">
              <span className="chip chip-primary text-[10px]">Commencer</span>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

export default function ModulesPage() {
  const [view, setView] = useState<ViewMode>('categories')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data, isLoading, isError, refetch } = useQuery<{ modules: Module[]; total: number }>({
    queryKey: ['modules', debounced],
    queryFn: () => api.get(`/modules?limit=100${debounced ? `&search=${debounced}` : ''}`).then(r => r.data),
    staleTime: 30_000,
    retry: 2,
  })

  const { data: careerData } = useQuery<{ id: string; modules?: { moduleId: string }[] }[]>({
    queryKey: ['career-paths-modules'],
    queryFn: () => api.get('/career/my-paths').then(r => r.data).catch(() => []),
    staleTime: 60_000,
  })

  function handleSearch(v: string) {
    setSearch(v)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebounced(v), 300)
  }

  const allModules = data?.modules ?? []

  // Required module IDs from career paths
  const requiredModuleIds = new Set(
    (careerData ?? []).flatMap(p => (p.modules ?? []).map(m => m.moduleId))
  )

  // Filter by type
  const generalModules = allModules.filter(m => !m.departmentId)
  const departmentModules = allModules.filter(m => !!m.departmentId)
  const requiredModules = allModules.filter(m => requiredModuleIds.has(m.id))

  const filteredModules =
    view === 'general' ? generalModules
    : view === 'department' ? departmentModules
    : view === 'required' ? requiredModules
    : allModules

  // Category view — show categories with counts
  if (view === 'categories' && !debounced) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Formations</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.total ?? 0} modules disponibles</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-10" placeholder="Rechercher une formation..." value={search} onChange={e => handleSearch(e.target.value)} />
        </div>

        {/* 3 Type Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {typeCards.map((card, i) => {
            const count = card.key === 'general' ? generalModules.length
              : card.key === 'department' ? departmentModules.length
              : requiredModules.length
            const Icon = card.icon
            return (
              <motion.button
                key={card.key}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                onClick={() => setView(card.key)}
                className={`${card.bg} ${card.border} border-2 rounded-2xl p-5 text-left hover:shadow-card-md transition-all active:scale-[0.98] group`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: card.color + '20' }}>
                    <Icon size={22} style={{ color: card.color }} />
                  </div>
                  <div className="text-2xl font-bold" style={{ color: card.color }}>{count}</div>
                </div>
                <h3 className="text-sm font-bold text-gray-800 group-hover:text-gray-900">{card.title}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{card.description}</p>
              </motion.button>
            )
          })}
        </div>

        {/* Recent / In Progress */}
        {allModules.filter(m => m.userEnrollment && m.userEnrollment.status !== 'COMPLETED').length > 0 && (
          <>
            <h2 className="text-base font-bold text-gray-800 mt-2">En cours</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allModules
                .filter(m => m.userEnrollment && m.userEnrollment.status !== 'COMPLETED')
                .slice(0, 6)
                .map((m, i) => <ModuleCard key={m.id} m={m} i={i} />)}
            </div>
          </>
        )}

        {/* All modules preview */}
        <h2 className="text-base font-bold text-gray-800 mt-2">Toutes les formations</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-52" />)}
          </div>
        ) : isError ? (
          <div className="card p-12 text-center">
            <AlertCircle size={36} className="mx-auto mb-3 text-red-300" />
            <p className="text-sm text-red-500 mb-4">Erreur de chargement des formations</p>
            <button onClick={() => refetch()} className="inline-flex items-center gap-2 btn-primary text-sm">
              <RefreshCw size={14} /> Réessayer
            </button>
          </div>
        ) : allModules.length === 0 ? (
          <div className="card p-12 text-center">
            <BookOpen size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-400">Aucune formation disponible</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allModules.slice(0, 9).map((m, i) => <ModuleCard key={m.id} m={m} i={i} />)}
          </div>
        )}
      </div>
    )
  }

  // Filtered view (general / department / required) or search results
  const viewTitle = view === 'general' ? 'Formations Générales'
    : view === 'department' ? 'Formations Départementales'
    : view === 'required' ? 'Formations Obligatoires'
    : 'Résultats'

  return (
    <div className="space-y-5">
      {/* Header with back */}
      <div className="flex items-center gap-3">
        <button onClick={() => { setView('categories'); setSearch(''); setDebounced('') }}
          className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{viewTitle}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filteredModules.length} formations</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-10" placeholder="Rechercher..." value={search} onChange={e => handleSearch(e.target.value)} />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-52" />)}
        </div>
      ) : isError ? (
        <div className="card p-12 text-center">
          <AlertCircle size={36} className="mx-auto mb-3 text-red-300" />
          <p className="text-sm text-red-500 mb-4">Erreur de chargement des formations</p>
          <button onClick={() => refetch()} className="inline-flex items-center gap-2 btn-primary text-sm">
            <RefreshCw size={14} /> Réessayer
          </button>
        </div>
      ) : filteredModules.length === 0 ? (
        <div className="card p-12 text-center">
          <BookOpen size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-400">Aucune formation dans cette catégorie</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModules.map((m, i) => <ModuleCard key={m.id} m={m} i={i} />)}
        </div>
      )}
    </div>
  )
}
