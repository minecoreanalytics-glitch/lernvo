import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Download, Users, Building2, BookOpen, Activity,
  Calendar, Filter, FileSpreadsheet, Eye, Loader2
} from 'lucide-react'
import { api } from '../../utils/api'
import type { Department } from '../../types'

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } }

type ReportType = 'users' | 'departments' | 'modules' | 'activity'

interface ReportCard {
  type: ReportType
  title: string
  description: string
  icon: React.ElementType
  color: string
  columns: string[]
}

const REPORTS: ReportCard[] = [
  {
    type: 'users',
    title: 'Utilisateurs',
    description: 'Export de tous les utilisateurs avec leur progression, points et activite.',
    icon: Users,
    color: 'text-blue-600',
    columns: ['firstName', 'lastName', 'email', 'role', 'department', 'modulesCompleted', 'modulesInProgress', 'totalPoints', 'currentStreak', 'lastLoginAt'],
  },
  {
    type: 'departments',
    title: 'Departements',
    description: 'Statistiques par departement : nombre d\'utilisateurs, progression moyenne, devoirs en retard.',
    icon: Building2,
    color: 'text-indigo-600',
    columns: ['department', 'totalUsers', 'avgProgress', 'completedModules', 'overdueAssignments'],
  },
  {
    type: 'modules',
    title: 'Formations',
    description: 'Statistiques par module : inscriptions, completions, score moyen.',
    icon: BookOpen,
    color: 'text-green-600',
    columns: ['moduleTitle', 'category', 'enrollments', 'completions', 'avgScore', 'avgTimeMinutes'],
  },
  {
    type: 'activity',
    title: 'Activite recente',
    description: 'Journal des dernieres activites : quiz, scores, modules termines.',
    icon: Activity,
    color: 'text-purple-600',
    columns: ['date', 'user', 'action', 'module', 'score'],
  },
]

function parseCSV(csv: string): string[][] {
  const lines = csv.trim().split('\n')
  return lines.map(line => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"'
          i++
        } else if (ch === '"') {
          inQuotes = false
        } else {
          current += ch
        }
      } else {
        if (ch === '"') {
          inQuotes = true
        } else if (ch === ',') {
          result.push(current)
          current = ''
        } else {
          current += ch
        }
      }
    }
    result.push(current)
    return result
  })
}

export default function ReportsPage() {
  const [department, setDepartment] = useState<string>('')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [previewType, setPreviewType] = useState<ReportType | null>(null)
  const [previewData, setPreviewData] = useState<string[][] | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const { data: departments } = useQuery<Department[]>({
    queryKey: ['departments-list'],
    queryFn: () => api.get('/departments').then(r => r.data),
  })

  const buildParams = useCallback(() => {
    const params = new URLSearchParams()
    if (department) params.set('department', department)
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)
    return params.toString()
  }, [department, dateFrom, dateTo])

  const handleDownload = useCallback(async (type: ReportType) => {
    const qs = buildParams()
    const url = `/api/reports/${type}${qs ? `?${qs}` : ''}`
    const token = (await import('../../store/auth')).useAuthStore.getState().accessToken
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `report-${type}-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  }, [buildParams])

  const handlePreview = useCallback(async (type: ReportType) => {
    if (previewType === type) {
      setPreviewType(null)
      setPreviewData(null)
      return
    }
    setPreviewLoading(true)
    setPreviewType(type)
    try {
      const qs = buildParams()
      const url = `/reports/${type}${qs ? `?${qs}` : ''}`
      const response = await api.get(url, { responseType: 'text' })
      const rows = parseCSV(response.data as string)
      setPreviewData(rows.slice(0, 6)) // header + 5 rows
    } catch {
      setPreviewData(null)
    } finally {
      setPreviewLoading(false)
    }
  }, [previewType, buildParams])

  // Flatten departments for dropdown (only sub-departments)
  const deptOptions = (departments ?? []).filter(d => d.parentId)

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">

      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-lg font-bold text-gray-900">Rapports & Analytiques</h1>
        <p className="text-xs text-gray-500 mt-0.5">Exportez les donnees de la plateforme en CSV</p>
      </motion.div>

      {/* Filters */}
      <motion.div variants={item} className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={15} className="text-primary-600" />
          <h2 className="text-sm font-semibold text-gray-700">Filtres</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Department */}
          <div>
            <label className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1 block">Departement</label>
            <select
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
            >
              <option value="">Tous les departements</option>
              {deptOptions.map(d => (
                <option key={d.id} value={d.id}>{d.icon ? `${d.icon} ` : ''}{d.name}</option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <div>
            <label className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1 block flex items-center gap-1">
              <Calendar size={10} /> Date debut
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
            />
          </div>

          {/* Date to */}
          <div>
            <label className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1 block flex items-center gap-1">
              <Calendar size={10} /> Date fin
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
            />
          </div>
        </div>
      </motion.div>

      {/* Report cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORTS.map(report => {
          const Icon = report.icon
          const isPreviewOpen = previewType === report.type
          return (
            <motion.div key={report.type} variants={item} className="card overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${report.color.replace('text-', 'bg-').replace('600', '50')}`}>
                    <Icon size={20} className={report.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-gray-800">{report.title}</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{report.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {report.columns.map(col => (
                        <span key={col} className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md font-mono">
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handlePreview(report.type)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {previewLoading && isPreviewOpen ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Eye size={13} />
                    )}
                    {isPreviewOpen ? 'Masquer' : 'Apercu'}
                  </button>
                  <button
                    onClick={() => handleDownload(report.type)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                  >
                    <Download size={13} />
                    Telecharger CSV
                  </button>
                </div>
              </div>

              {/* Preview table */}
              {isPreviewOpen && previewData && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-3 overflow-x-auto">
                  <div className="flex items-center gap-1.5 mb-2">
                    <FileSpreadsheet size={12} className="text-gray-400" />
                    <span className="text-[10px] text-gray-400 font-medium">
                      Apercu ({Math.max(0, previewData.length - 1)} premieres lignes)
                    </span>
                  </div>
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr>
                        {previewData[0]?.map((h, i) => (
                          <th key={i} className="text-left px-2 py-1 font-semibold text-gray-600 bg-gray-100 whitespace-nowrap first:rounded-l-lg last:rounded-r-lg">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.slice(1).map((row, ri) => (
                        <tr key={ri} className="border-t border-gray-100">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-2 py-1.5 text-gray-500 whitespace-nowrap max-w-[150px] truncate">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previewData.length <= 1 && (
                    <p className="text-[10px] text-gray-400 text-center py-3">Aucune donnee</p>
                  )}
                </div>
              )}
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
