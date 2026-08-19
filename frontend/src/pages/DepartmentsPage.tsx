import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Building2, Users, BookOpen, ChevronRight, ArrowLeft, Clock, User, Network, LayoutGrid } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../utils/api'
import type { Module } from '../types'
import OrgChart, { type FlatDept } from '../components/OrgChart'

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } }
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }

type DeptChild = {
  id: string; name: string; icon?: string; color?: string; managerName?: string
  _count: { users: number; modules: number }
}

type Department = {
  id: string; name: string; description?: string; mission?: string
  icon?: string; color?: string; managerName?: string; order: number
  parentId?: string | null
  parent?: { id: string; name: string; icon?: string }
  children: DeptChild[]
  modules?: Module[]
  _count: { users: number; children: number; modules: number }
}

export default function DepartmentsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<'tree' | 'all'>('tree')

  const { data: flat = [] } = useQuery<FlatDept[]>({
    queryKey: ['departments-flat'],
    queryFn: () => api.get('/departments?flat=true').then(r => r.data)
  })

  // Fetch detail when a department is selected
  const { data: detail } = useQuery<Department>({
    queryKey: ['department-detail', selectedId],
    queryFn: () => api.get(`/departments/${selectedId}`).then(r => r.data),
    enabled: !!selectedId
  })

  // ─── Department Detail View ─────────────────────────
  if (selectedId && detail) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
        <motion.div variants={item}>
          <button onClick={() => setSelectedId(null)} className="btn-ghost text-sm flex items-center gap-1 mb-2">
            <ArrowLeft size={14} /> Tous les départements
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm"
              style={{ backgroundColor: (detail.color || '#3B82F6') + '20' }}>
              {detail.icon || '🏛️'}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{detail.name}</h1>
              {detail.managerName && (
                <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                  <User size={13} /> Responsable : <span className="font-medium text-gray-700">{detail.managerName}</span>
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Mission */}
        {detail.mission && (
          <motion.div variants={item} className="card p-4 border-l-4" style={{ borderLeftColor: detail.color || '#3B82F6' }}>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Mission</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{detail.mission}</p>
          </motion.div>
        )}

        {/* Stats */}
        <motion.div variants={item} className="grid grid-cols-3 gap-3">
          <div className="card p-3 text-center">
            <div className="text-lg font-bold" style={{ color: detail.color || '#3B82F6' }}>{detail._count.users}</div>
            <div className="text-[10px] text-gray-400 font-medium uppercase">Membres</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-lg font-bold" style={{ color: detail.color || '#3B82F6' }}>{detail._count.modules}</div>
            <div className="text-[10px] text-gray-400 font-medium uppercase">Formations</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-lg font-bold" style={{ color: detail.color || '#3B82F6' }}>{detail._count.children}</div>
            <div className="text-[10px] text-gray-400 font-medium uppercase">Sous-depts</div>
          </div>
        </motion.div>

        {/* Sub-departments */}
        {detail.children.length > 0 && (
          <motion.div variants={item}>
            <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Building2 size={15} /> Sous-départements
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {detail.children.map(child => (
                <button key={child.id} onClick={() => setSelectedId(child.id)}
                  className="card p-3 text-left hover:shadow-card-md transition-shadow group flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor: (child.color || '#3B82F6') + '15' }}>
                    {child.icon || '📂'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-800 group-hover:text-primary-700 transition-colors truncate">{child.name}</h3>
                    {child.managerName && <p className="text-[10px] text-gray-400">{child.managerName}</p>}
                    <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
                      <span className="flex items-center gap-0.5"><Users size={9} /> {child._count.users}</span>
                      <span className="flex items-center gap-0.5"><BookOpen size={9} /> {child._count.modules}</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 shrink-0" />
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Back to parent */}
        {detail.parent && (
          <motion.div variants={item}>
            <button onClick={() => setSelectedId(detail.parent!.id)}
              className="btn-ghost text-xs flex items-center gap-1.5">
              <ArrowLeft size={12} /> {detail.parent.icon} Retour à {detail.parent.name}
            </button>
          </motion.div>
        )}

        {/* Formations in this department */}
        {detail.modules && detail.modules.length > 0 && (
          <motion.div variants={item}>
            <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <BookOpen size={15} /> Formations du département
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {detail.modules.map(m => (
                <Link key={m.id} to={`/modules/${m.id}`}
                  className="card block overflow-hidden hover:shadow-card-md transition-shadow group">
                  <div className="h-20 flex items-center justify-center"
                    style={{ backgroundColor: (m.category?.color || detail.color || '#3B82F6') + '15' }}>
                    <BookOpen size={24} style={{ color: m.category?.color || detail.color || '#3B82F6' }} />
                  </div>
                  <div className="p-3">
                    <h3 className="text-xs font-semibold text-gray-800 group-hover:text-primary-700 transition-colors line-clamp-2">{m.title}</h3>
                    {m.description && <p className="text-[10px] text-gray-400 mt-1 line-clamp-2">{m.description}</p>}
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                      <span className="flex items-center gap-0.5"><Clock size={9} /> {m.estimatedMinutes} min</span>
                      <span className="flex items-center gap-0.5"><Users size={9} /> {m._count?.enrollments ?? 0}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* Empty state for modules */}
        {detail.modules && detail.modules.length === 0 && detail.children.length === 0 && (
          <motion.div variants={item} className="card p-8 text-center">
            <BookOpen size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-400">Aucune formation disponible pour ce département</p>
            <p className="text-xs text-gray-300 mt-1">Les formations seront ajoutées prochainement</p>
          </motion.div>
        )}
      </motion.div>
    )
  }

  // ─── Main Grid View ─────────────────────────────────
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Building2 size={20} className="text-primary-600" /> Départements
        </h1>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-gray-500 mt-0.5">
            Explorez les formations par département
          </p>
          <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs shrink-0">
            <button onClick={() => setView('all')} className={`px-3 py-1.5 flex items-center gap-1 ${view === 'all' ? 'bg-primary-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}><LayoutGrid size={12} /> Tous les départements</button>
            <button onClick={() => setView('tree')} className={`px-3 py-1.5 flex items-center gap-1 ${view === 'tree' ? 'bg-primary-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}><Network size={12} /> Hiérarchie</button>
          </div>
        </div>
      </motion.div>

      <motion.div variants={item}>
        <OrgChart flat={flat} onSelect={setSelectedId} mode={view} />
      </motion.div>

    </motion.div>
  )
}
