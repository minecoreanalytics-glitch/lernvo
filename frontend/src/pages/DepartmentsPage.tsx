import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Building2, Users, BookOpen, ChevronRight, ArrowLeft, Clock, User, Network,
  LayoutGrid, Plus, X, Search, Trash2, Sparkles
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../utils/api'
import { useAuthStore } from '../store/auth'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('departmentId')
  const [view, setView] = useState<'tree' | 'all'>('tree')
  const [showAddModal, setShowAddModal] = useState(false)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const { user } = useAuthStore()
  const canManage = ['PLATFORM_MANAGER', 'HR', 'MANAGER', 'SUPERVISOR'].includes(user?.role || '')
  const qc = useQueryClient()

  const { data: flat = [] } = useQuery<FlatDept[]>({
    queryKey: ['departments-flat'],
    queryFn: () => api.get('/departments?flat=true').then(r => r.data)
  })

  const { data: detail, isLoading: detailLoading } = useQuery<Department>({
    queryKey: ['department-detail', selectedId],
    queryFn: () => api.get(`/departments/${selectedId}`).then(r => r.data),
    enabled: !!selectedId
  })

  const removeMutation = useMutation({
    mutationFn: (moduleId: string) => api.delete(`/departments/${selectedId}/modules/${moduleId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['department-detail', selectedId] })
      qc.invalidateQueries({ queryKey: ['departments-flat'] })
      setConfirmRemoveId(null)
    }
  })

  function openDepartment(id: string) {
    setSearchParams({ departmentId: id })
  }

  function closeDepartment() {
    setSearchParams({})
    setShowAddModal(false)
    setConfirmRemoveId(null)
  }

  if (selectedId) {
    if (detailLoading || !detail) {
      return (
        <div className="space-y-5">
          <div className="skeleton h-8 w-40" />
          <div className="skeleton h-20" />
          <div className="skeleton h-24" />
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20" />)}
          </div>
        </div>
      )
    }

    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
        <motion.div variants={item}>
          <button onClick={closeDepartment} className="btn-ghost text-sm flex items-center gap-1 mb-2">
            <ArrowLeft size={14} /> Tous les départements
          </button>
          <div className="flex items-center justify-between gap-4">
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
            {canManage && (
              <div className="flex items-center gap-2 shrink-0">
                <Link to={`/admin/ai?departmentId=${selectedId}`}
                  className="btn-secondary flex items-center gap-1.5 text-sm">
                  <Sparkles size={14} /> Ajouter une formation
                </Link>
                <button onClick={() => setShowAddModal(true)}
                  className="btn-primary flex items-center gap-1.5 text-sm">
                  <Plus size={14} /> Assigner à une formation
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {detail.mission && (
          <motion.div variants={item} className="card p-4 border-l-4" style={{ borderLeftColor: detail.color || '#3B82F6' }}>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Mission</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{detail.mission}</p>
          </motion.div>
        )}

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

        {detail.children.length > 0 && (
          <motion.div variants={item}>
            <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Building2 size={15} /> Sous-départements
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {detail.children.map(child => (
                <button key={child.id} onClick={() => openDepartment(child.id)}
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

        {detail.parent && (
          <motion.div variants={item}>
            <button onClick={() => openDepartment(detail.parent!.id)}
              className="btn-ghost text-xs flex items-center gap-1.5">
              <ArrowLeft size={12} /> {detail.parent.icon} Retour à {detail.parent.name}
            </button>
          </motion.div>
        )}

        {detail.modules && detail.modules.length > 0 && (
          <motion.div variants={item}>
            <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <BookOpen size={15} /> Formations du département ({detail.modules.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {detail.modules.map(m => (
                <div key={m.id} className="card overflow-hidden group relative">
                  <Link to={`/modules/${m.id}`} className="block hover:shadow-card-md transition-shadow">
                    <div className="h-20 flex items-center justify-center"
                      style={{ backgroundColor: (m.category?.color || detail.color || '#3B82F6') + '15' }}>
                      <BookOpen size={24} style={{ color: m.category?.color || detail.color || '#3B82F6' }} />
                    </div>
                    <div className="p-3 pb-2">
                      <h3 className="text-xs font-semibold text-gray-800 group-hover:text-primary-700 transition-colors line-clamp-2">{m.title}</h3>
                      {m.description && <p className="text-[10px] text-gray-400 mt-1 line-clamp-2">{m.description}</p>}
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                        <span className="flex items-center gap-0.5"><Clock size={9} /> {m.estimatedMinutes} min</span>
                        <span className="flex items-center gap-0.5"><Users size={9} /> {m._count?.enrollments ?? 0} inscrits</span>
                      </div>
                    </div>
                  </Link>
                  {canManage && (
                    <div className="px-3 pb-3">
                      {confirmRemoveId === m.id ? (
                        <div className="flex gap-2">
                          <button onClick={() => removeMutation.mutate(m.id)} disabled={removeMutation.isPending}
                            className="flex-1 text-[10px] font-semibold bg-red-500 text-white py-1.5 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50">
                            Confirmer le retrait
                          </button>
                          <button onClick={() => setConfirmRemoveId(null)}
                            className="text-[10px] text-gray-400 hover:text-gray-600 px-2 py-1.5">
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmRemoveId(m.id)}
                          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={10} /> Retirer du département
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {detail.modules && detail.modules.length === 0 && (
          <motion.div variants={item} className="card p-8 text-center">
            <BookOpen size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-400">Aucune formation assignée à ce département</p>
            {canManage && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                <Link to={`/admin/ai?departmentId=${selectedId}`}
                  className="btn-secondary text-sm inline-flex items-center gap-1.5">
                  <Sparkles size={14} /> Ajouter une formation
                </Link>
                <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm inline-flex items-center gap-1.5">
                  <Plus size={14} /> Assigner à une formation
                </button>
              </div>
            )}
          </motion.div>
        )}

        {showAddModal && (
          <AddModuleModal
            deptId={selectedId}
            deptName={detail.name}
            existingModuleIds={new Set((detail.modules ?? []).map(m => m.id))}
            onClose={() => setShowAddModal(false)}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ['department-detail', selectedId] })
              qc.invalidateQueries({ queryKey: ['departments-flat'] })
              setShowAddModal(false)
            }}
          />
        )}
      </motion.div>
    )
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
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
        <OrgChart flat={flat} onSelect={openDepartment} mode={view} />
      </motion.div>
    </motion.div>
  )
}

function AddModuleModal({ deptId, deptName, existingModuleIds, onClose, onSuccess }: {
  deptId: string
  deptName: string
  existingModuleIds: Set<string>
  onClose: () => void
  onSuccess: () => void
}) {
  const [search, setSearch] = useState('')
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const { data } = useQuery<{ modules: Module[] }>({
    queryKey: ['all-modules-for-dept'],
    queryFn: () => api.get('/modules?limit=200').then(r => r.data)
  })

  const addMutation = useMutation({
    mutationFn: () => api.post(`/departments/${deptId}/modules`, { moduleId: selectedModuleId }),
    onSuccess,
    onError: () => setError("Erreur lors de l'assignation")
  })

  const available = (data?.modules ?? []).filter(m =>
    !existingModuleIds.has(m.id) &&
    (!search || m.title.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">Assigner à une formation</h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[280px]">{deptName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Rechercher une formation..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="input pl-9 text-sm" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {available.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-8">Aucune formation disponible</p>
          ) : available.map(m => (
            <button key={m.id} onClick={() => setSelectedModuleId(m.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                selectedModuleId === m.id ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50'
              }`}>
              <BookOpen size={14} className={selectedModuleId === m.id ? 'text-primary-600' : 'text-gray-400'} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{m.title}</div>
                <div className="text-[10px] text-gray-400">{m.estimatedMinutes} min</div>
              </div>
            </button>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-gray-100 space-y-2">
          {error && <p className="text-xs text-red-500">{error}</p>}
          <p className="text-[10px] text-gray-400">Tous les membres actifs du département seront inscrits automatiquement.</p>
          <button onClick={() => addMutation.mutate()} disabled={!selectedModuleId || addMutation.isPending}
            className="btn-primary w-full disabled:opacity-50">
            {addMutation.isPending ? 'Assignation...' : 'Assigner au département'}
          </button>
        </div>
      </div>
    </div>
  )
}
