import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShieldCheck, ChevronRight, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { api } from '../../utils/api'
import { StatusChip } from '../../components/approval/ApprovalPanel'

type Item = {
  id: string; entityType: 'KB_ARTICLE' | 'MODULE'; entityId: string
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED'; currentVersion: number
  submittedAt: string | null; approvedAt: string | null; updatedAt: string
  title: string; link: string; submitter: string | null
  coverage: { acked: number; total: number; pct: number } | null
}

const TYPE_LABEL = { KB_ARTICLE: 'Article', MODULE: 'Formation' }

/** Admin queue: what awaits approval, and how well approved documents are acknowledged. */
export default function ApprovalsPage() {
  const { data = [], isLoading } = useQuery<Item[]>({ queryKey: ['approvals-pending'], queryFn: () => api.get('/approvals/pending').then(r => r.data), refetchInterval: 60_000 })
  const queue = data.filter(i => i.status === 'IN_REVIEW')
  const approved = data.filter(i => i.status === 'APPROVED').sort((a, b) => (a.coverage?.pct ?? 100) - (b.coverage?.pct ?? 100))
  const others = data.filter(i => i.status === 'DRAFT' || i.status === 'REJECTED')

  const Row = ({ i }: { i: Item }) => (
    <Link to={i.link} className="card p-3 flex items-center gap-3 hover:shadow-card-md transition-shadow group">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-gray-400">{TYPE_LABEL[i.entityType]}</span>
          <StatusChip status={i.status} version={i.currentVersion} />
        </div>
        <div className="text-sm font-semibold text-gray-800 group-hover:text-primary-700 truncate">{i.title}</div>
        <div className="text-[11px] text-gray-400 flex items-center gap-1">
          {i.status === 'IN_REVIEW' && <><Clock size={10} /> soumis {i.submittedAt ? formatDistanceToNow(new Date(i.submittedAt), { addSuffix: true, locale: fr }) : ''}{i.submitter ? ` par ${i.submitter}` : ''}</>}
          {i.status === 'APPROVED' && i.approvedAt && <>approuvé {formatDistanceToNow(new Date(i.approvedAt), { addSuffix: true, locale: fr })}</>}
          {(i.status === 'DRAFT' || i.status === 'REJECTED') && <>modifié {formatDistanceToNow(new Date(i.updatedAt), { addSuffix: true, locale: fr })}</>}
        </div>
        {i.coverage && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="progress-track h-1.5 flex-1"><div className="progress-fill" style={{ width: `${i.coverage.pct}%` }} /></div>
            <span className="text-[11px] text-gray-500 shrink-0">{i.coverage.acked}/{i.coverage.total} · {i.coverage.pct}%</span>
          </div>
        )}
      </div>
      <ChevronRight size={14} className="text-gray-300 shrink-0" />
    </Link>
  )

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><ShieldCheck size={20} className="text-primary-600" /> Approbations</h1>
        <p className="text-sm text-gray-500 mt-0.5">Ce qui attend une validation, et qui a lu la version en vigueur.</p>
      </div>
      {isLoading ? <div className="skeleton h-24" /> : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-gray-800">En attente d'approbation <span className="chip chip-gray text-[10px] ml-1">{queue.length}</span></h2>
            {queue.length === 0 ? <div className="card p-4 text-sm text-gray-400">Rien en attente.</div> : queue.map(i => <Row key={i.id} i={i} />)}
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-gray-800">Approuvés — couverture « lu et compris »</h2>
            {approved.length === 0 ? <div className="card p-4 text-sm text-gray-400">Aucun document approuvé.</div> : approved.map(i => <Row key={i.id} i={i} />)}
          </section>
          {others.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-gray-800">Brouillons & refusés</h2>
              {others.map(i => <Row key={i.id} i={i} />)}
            </section>
          )}
        </>
      )}
    </motion.div>
  )
}
