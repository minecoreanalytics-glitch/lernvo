import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BookOpenCheck, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { api } from '../../utils/api'

type Pending = { entityId: string; version: number; approvedAt: string | null; title: string; link: string }

/** Dashboard card: approved documents the current user has not acknowledged yet. */
export default function PendingAcksCard() {
  const { data = [] } = useQuery<Pending[]>({ queryKey: ['my-pending-acks'], queryFn: () => api.get('/approvals/my-pending').then(r => r.data), refetchInterval: 60_000 })
  if (data.length === 0) return null
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-6 h-6 rounded-lg bg-primary-100 flex items-center justify-center"><BookOpenCheck size={13} className="text-primary-700" /></div>
        <h2 className="text-sm font-bold text-gray-900">À lire et valider</h2>
        <span className="chip bg-primary-50 text-primary-700 border border-primary-200 text-[10px]">{data.length}</span>
      </div>
      <div className="space-y-2">
        {data.slice(0, 5).map(p => (
          <Link key={`${p.entityId}-${p.version}`} to={p.link} className="card p-3 flex items-center gap-3 hover:shadow-card-md transition-shadow group">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-gray-800 group-hover:text-primary-700 truncate">{p.title}</div>
              <div className="text-[11px] text-gray-400">Version {p.version}{p.approvedAt ? ` · ${formatDistanceToNow(new Date(p.approvedAt), { addSuffix: true, locale: fr })}` : ''}</div>
            </div>
            <ChevronRight size={14} className="text-gray-300" />
          </Link>
        ))}
        {data.length > 5 && <div className="text-[11px] text-gray-400 px-1">+{data.length - 5} autres dans la base de connaissances</div>}
      </div>
    </div>
  )
}
