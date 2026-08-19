import { useQuery, useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Brain, RefreshCw, Loader2, AlertTriangle, Send } from 'lucide-react'
import { api } from '../../utils/api'
import { useAuthStore } from '../../store/auth'

type Ctx = { department_id: string; department_name: string; headcount: number; coverage_pct: number; quiz_fail_rate: number; overdue_ratio: number; unanswered_questions: number; stale_docs: number; pending_reviews: number }
type Rec = { policy_id?: string; framing?: string | Record<string, string>; priority?: number; action?: { type?: string } | unknown }
type Insights = {
  generatedAt: string
  head: { configured: boolean; tenantEnabled: boolean; error: string | null }
  contexts: Ctx[]
  recommendations: Array<{ department: Ctx; recs: Rec[]; decision_id?: string }>
  local: Array<{ department: Ctx; policy_id: string; framing: string; priority: number }>
}

const pct = (v: number) => `${Math.round(v * 100)}%`
const bar = (v: number, invert = false) => {
  const good = invert ? v < 0.3 : v >= 0.7
  const warn = invert ? v < 0.6 : v >= 0.4
  return good ? 'bg-green-500' : warn ? 'bg-amber-500' : 'bg-red-500'
}
const PRIO: Record<number, string> = { 1: 'bg-red-50 text-red-700 border-red-200', 2: 'bg-amber-50 text-amber-700 border-amber-200', 3: 'bg-gray-50 text-gray-600 border-gray-200' }
const framingText = (f: Rec['framing']) => typeof f === 'string' ? f : (f?.fr ?? f?.en ?? '')

/** Knowledge-assurance signals per department + Morpheus head recommendations (or local doctrine fallback). */
export default function InsightsPage() {
  const { user } = useAuthStore()
  const { data, isLoading, refetch, isFetching } = useQuery<Insights>({ queryKey: ['mcore-insights'], queryFn: () => api.get('/mcore/insights').then(r => r.data), staleTime: 5 * 60_000 })
  const push = useMutation({ mutationFn: () => api.post('/mcore/push').then(r => r.data) })
  const headRecs = data?.recommendations ?? []
  const recs = headRecs.length ? headRecs.flatMap(r => r.recs.map(x => ({ department: r.department, policy_id: x.policy_id ?? '', framing: framingText(x.framing), priority: x.priority ?? 2 }))) : (data?.local ?? [])

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Brain size={20} className="text-primary-600" /> Signaux & recommandations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Par département : qui connaît les procédures, où ça coince, et quoi faire — calculé sur 30 jours{data?.head.tenantEnabled ? ', recommandé par le Core Morpheus' : ''}.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => api.get('/mcore/insights?refresh=1').then(() => refetch())} className="btn-outline text-xs px-3 py-2 flex items-center gap-1.5">{isFetching ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Recalculer</button>
          {user?.role === 'PLATFORM_MANAGER' && data?.head.tenantEnabled && (
            <button onClick={() => push.mutate()} disabled={push.isPending} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5">{push.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Envoyer au Core</button>
          )}
        </div>
      </div>
      {push.isSuccess && <p className="text-xs text-green-700">{(push.data as { pushed: number }).pushed} signaux envoyés au Core.</p>}
      {push.isError && <p className="text-xs text-red-600">Envoi impossible : {(push.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'erreur'}</p>}
      {data && !data.head.tenantEnabled && (
        <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-2"><AlertTriangle size={13} className="text-amber-500" /> Core Morpheus non connecté pour cette entreprise — recommandations calculées localement selon la doctrine de référence.</div>
      )}
      {data?.head.error && <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Core injoignable ({data.head.error}) — repli local.</div>}

      {isLoading ? <div className="skeleton h-40" /> : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-gray-800">Recommandations <span className="chip chip-gray text-[10px] ml-1">{recs.length}</span></h2>
            {recs.length === 0 ? <div className="card p-4 text-sm text-gray-400">Rien à signaler — couverture, quiz et échéances sont dans les clous.</div> : (
              <div className="space-y-2">
                {recs.sort((a, b) => a.priority - b.priority).map((r, i) => (
                  <div key={i} className="card p-3 flex items-start gap-3">
                    <span className={`chip text-[10px] border shrink-0 ${PRIO[r.priority] ?? PRIO[2]}`}>P{r.priority}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-800">{r.department.department_name} <span className="text-[11px] text-gray-400 font-normal">· {r.policy_id}</span></div>
                      <div className="text-xs text-gray-600 mt-0.5">{r.framing}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-gray-800">Signaux par département</h2>
            <div className="card overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Département</th>
                    <th className="text-right px-3 py-2 font-semibold">Effectif</th>
                    <th className="text-left px-3 py-2 font-semibold">Lu et compris</th>
                    <th className="text-left px-3 py-2 font-semibold">Échec quiz</th>
                    <th className="text-left px-3 py-2 font-semibold">Retards</th>
                    <th className="text-right px-3 py-2 font-semibold" title="Questions à l'assistant sans article trouvé (30 j)">Questions sans réponse</th>
                    <th className="text-right px-3 py-2 font-semibold" title="Documents approuvés depuis plus de 6 mois">Docs périmés</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.contexts ?? []).map(c => (
                    <tr key={c.department_id} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium text-gray-800">{c.department_name}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{c.headcount}</td>
                      {[[c.coverage_pct, false], [c.quiz_fail_rate, true], [c.overdue_ratio, true]].map(([v, inv], i) => (
                        <td key={i} className="px-3 py-2">
                          <div className="flex items-center gap-2 min-w-[110px]">
                            <div className="progress-track h-1.5 flex-1"><div className={`h-1.5 rounded-full ${bar(v as number, inv as boolean)}`} style={{ width: pct(v as number) }} /></div>
                            <span className="text-gray-600 w-9 text-right">{pct(v as number)}</span>
                          </div>
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right text-gray-600">{c.unanswered_questions}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{c.stale_docs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </motion.div>
  )
}
