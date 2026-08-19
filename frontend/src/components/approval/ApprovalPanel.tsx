import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, Send, XCircle, ShieldCheck, History, Loader2, BookOpenCheck } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { api } from '../../utils/api'
import { useAuthStore } from '../../store/auth'

export type ApprovalEntityKey = 'kb' | 'module'
type Status = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED'
type ApprovalState = {
  status: Status; currentVersion: number; myAck: boolean
  coverage: { acked: number; total: number; pct: number } | null
  submitter?: { id: string; firstName: string; lastName: string } | null
  approver?: { id: string; firstName: string; lastName: string } | null
  approvedAt?: string | null; submittedAt?: string | null; rejectedReason?: string | null
}
type Version = { id: string; version: number; changeNote: string | null; createdAt: string; author: string | null }

const APPROVERS = ['PLATFORM_MANAGER', 'HR']
const SUBMITTERS = ['PLATFORM_MANAGER', 'HR', 'MANAGER', 'SUPERVISOR']

export const STATUS_LABEL: Record<Status, { label: string; cls: string }> = {
  DRAFT: { label: 'Brouillon', cls: 'chip-gray' },
  IN_REVIEW: { label: 'En relecture', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  APPROVED: { label: 'Approuvé', cls: 'chip-success' },
  REJECTED: { label: 'Refusé', cls: 'bg-red-50 text-red-700 border border-red-200' },
}

export function StatusChip({ status, version }: { status: Status; version?: number }) {
  const s = STATUS_LABEL[status]
  return <span className={`chip text-[10px] ${s.cls}`}>{s.label}{status === 'APPROVED' && version ? ` v${version}` : ''}</span>
}

/**
 * Approval workflow panel for one governed entity (KB article or module).
 * Employees: "J'ai lu et compris" on the current version. Admins: submit / approve / reject,
 * coverage bar and version history. Fully role-driven; no company-specific logic.
 */
export default function ApprovalPanel({ entityType, entityId, allowAck = true }: { entityType: ApprovalEntityKey; entityId: string; allowAck?: boolean }) {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const role = user?.role ?? ''
  const canApprove = APPROVERS.includes(role)
  const canSubmit = SUBMITTERS.includes(role)
  const [showHistory, setShowHistory] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')

  const key = ['approval', entityType, entityId]
  const { data: st } = useQuery<ApprovalState>({ queryKey: key, queryFn: () => api.get(`/approvals/${entityType}/${entityId}`).then(r => r.data), enabled: !!entityId })
  const { data: history = [] } = useQuery<Version[]>({ queryKey: [...key, 'history'], queryFn: () => api.get(`/approvals/${entityType}/${entityId}/history`).then(r => r.data), enabled: showHistory })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key })
    qc.invalidateQueries({ queryKey: ['approvals-pending'] })
    qc.invalidateQueries({ queryKey: ['my-pending-acks'] })
    qc.invalidateQueries({ queryKey: ['kb'] }); qc.invalidateQueries({ queryKey: ['kb-article'] })
    qc.invalidateQueries({ queryKey: ['module', entityId] })
  }
  const act = (action: string, body?: unknown) => api.post(`/approvals/${entityType}/${entityId}/${action}`, body ?? {})
  const submit = useMutation({ mutationFn: () => act('submit'), onSuccess: invalidate })
  const approve = useMutation({ mutationFn: () => act('approve', { note: note.trim() || undefined }), onSuccess: () => { setNote(''); invalidate() } })
  const reject = useMutation({ mutationFn: () => act('reject', { reason: reason.trim() }), onSuccess: () => { setReason(''); setRejectOpen(false); invalidate() } })
  const ack = useMutation({ mutationFn: () => act('ack'), onSuccess: invalidate })

  if (!st) return null
  const isSubmitter = !!(st.submitter && user && st.submitter.id === user.id)
  const selfBlocked = isSubmitter && role !== 'PLATFORM_MANAGER'
  const err = (m: { isError: boolean; error: unknown }) => m.isError ? ((m.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erreur') : null

  return (
    <div className="space-y-3">
      {/* Employee: acknowledge banner */}
      {allowAck && st.status === 'APPROVED' && st.currentVersion > 0 && !canApprove && (
        st.myAck ? (
          <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
            <CheckCircle2 size={14} /> Vous avez validé la version {st.currentVersion}.
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between bg-primary-50 border border-primary-200 rounded-xl px-3 py-2.5">
            <div className="text-xs text-primary-800">
              <span className="font-semibold">Nouvelle version {st.currentVersion}</span>
              {st.approvedAt && <> · approuvée {formatDistanceToNow(new Date(st.approvedAt), { addSuffix: true, locale: fr })}</>}
              <div className="text-primary-700/80">Lisez ce document puis confirmez que vous l'avez compris.</div>
            </div>
            <button onClick={() => ack.mutate()} disabled={ack.isPending} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 shrink-0">
              {ack.isPending ? <Loader2 size={12} className="animate-spin" /> : <BookOpenCheck size={12} />} J'ai lu et compris
            </button>
          </div>
        )
      )}

      {/* Admin / manager controls */}
      {(canApprove || canSubmit) && (
        <div className="card p-3 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <ShieldCheck size={14} className="text-primary-600" />
            <span className="font-semibold text-gray-700">Approbation</span>
            <StatusChip status={st.status} version={st.currentVersion} />
            {st.status === 'IN_REVIEW' && st.submitter && <span className="text-gray-400">soumis par {st.submitter.firstName} {st.submitter.lastName}</span>}
            {st.status === 'APPROVED' && st.approver && <span className="text-gray-400">par {st.approver.firstName} {st.approver.lastName}</span>}
            {st.status === 'REJECTED' && st.rejectedReason && <span className="text-red-600">— {st.rejectedReason}</span>}
            {st.status === 'DRAFT' && st.currentVersion > 0 && <span className="text-amber-600">modifications en attente — les employés voient la v{st.currentVersion}</span>}
            <span className="flex-1" />
            <button onClick={() => setShowHistory(v => !v)} className="btn-ghost text-xs px-2 py-1 flex items-center gap-1"><History size={12} /> Historique</button>
          </div>

          {canApprove && st.coverage && st.currentVersion > 0 && (
            <div>
              <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                <span>Lu et compris (v{st.currentVersion})</span>
                <span className="font-semibold text-gray-700">{st.coverage.acked}/{st.coverage.total} · {st.coverage.pct}%</span>
              </div>
              <div className="progress-track h-1.5"><div className="progress-fill" style={{ width: `${st.coverage.pct}%` }} /></div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {canSubmit && (st.status === 'DRAFT' || st.status === 'REJECTED') && (
              <button onClick={() => submit.mutate()} disabled={submit.isPending} className="btn-outline text-xs px-3 py-1.5 flex items-center gap-1.5">
                {submit.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Soumettre pour approbation
              </button>
            )}
            {canApprove && (st.status === 'IN_REVIEW' || (st.status === 'DRAFT' && role === 'PLATFORM_MANAGER')) && !rejectOpen && (
              <>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note de version (optionnel)" className="input text-xs py-1.5 flex-1 min-w-[160px]" />
                <button onClick={() => approve.mutate()} disabled={approve.isPending || selfBlocked} title={selfBlocked ? 'Vous ne pouvez pas approuver votre propre soumission' : ''}
                  className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50">
                  {approve.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Approuver{st.currentVersion > 0 ? ` (v${st.currentVersion + 1})` : ''}
                </button>
                {st.status === 'IN_REVIEW' && <button onClick={() => setRejectOpen(true)} className="btn-danger text-xs px-3 py-1.5 flex items-center gap-1.5"><XCircle size={12} /> Refuser</button>}
              </>
            )}
            {rejectOpen && (
              <div className="flex flex-wrap items-center gap-2 w-full">
                <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Motif du refus (obligatoire)" className="input text-xs py-1.5 flex-1 min-w-[200px]" autoFocus />
                <button onClick={() => reject.mutate()} disabled={reason.trim().length < 3 || reject.isPending} className="btn-danger text-xs px-3 py-1.5">Confirmer le refus</button>
                <button onClick={() => setRejectOpen(false)} className="btn-ghost text-xs px-2 py-1.5">Annuler</button>
              </div>
            )}
            {st.status === 'IN_REVIEW' && !canApprove && <span className="text-xs text-amber-600 flex items-center gap-1"><Clock size={12} /> En attente d'un approbateur</span>}
          </div>
          {(err(submit) || err(approve) || err(reject)) && <p className="text-xs text-red-600">{err(submit) || err(approve) || err(reject)}</p>}

          {showHistory && (
            <div className="border-t border-gray-100 pt-2 space-y-1">
              {history.length === 0 && <p className="text-xs text-gray-400">Aucune version approuvée pour l'instant.</p>}
              {history.map(v => (
                <div key={v.id} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="chip chip-gray text-[10px]">v{v.version}</span>
                  <span>{new Date(v.createdAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  {v.author && <span className="text-gray-400">· {v.author}</span>}
                  {v.changeNote && <span className="text-gray-500 italic">— {v.changeNote}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
