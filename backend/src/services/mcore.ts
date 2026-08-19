/**
 * Lernvo as a tentacle of the Morpheus head (m-core).
 * Enabled when MORPHEUS_CORE_URL + MORPHEUS_API_KEY are set AND the tenant has `mcoreTenant`.
 * Signals per department → /subjects + /signals/batch ; recommendations ← /api/morpheus/recommend.
 */
import { prisma } from '../utils/prisma'
import { logger } from '../utils/logger'

const BASE = (process.env.MORPHEUS_CORE_URL || '').replace(/\/+$/, '')
const KEY = (process.env.MORPHEUS_API_KEY || '').trim()
export const MCORE_CONFIGURED = !!(BASE && KEY)

const WINDOW_DAYS = 30
const STALE_DAYS = 180
const REVIEW_BACKLOG_DAYS = 7

export type DeptContext = {
  department_id: string; department_name: string; headcount: number
  coverage_pct: number; quiz_fail_rate: number; overdue_ratio: number
  unanswered_questions: number; stale_docs: number; pending_reviews: number
}

function h(tenant: string, actor: string, role: string): Record<string, string> {
  return { 'content-type': 'application/json', 'x-morpheus-api-key': KEY, 'x-morpheus-tenant': tenant, 'x-morpheus-actor': actor, 'x-morpheus-role': role }
}

/** Compute the knowledge-assurance context of one department (tenant-scoped prisma). */
export async function computeDepartmentContext(deptId: string): Promise<DeptContext | null> {
  const dept = await prisma.department.findFirst({ where: { id: deptId }, select: { id: true, name: true } })
  if (!dept) return null
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000)
  const users = await prisma.user.findMany({ where: { departmentId: deptId, isActive: true, role: { not: 'SUPER_ADMIN' } }, select: { id: true } })
  const uids = users.map(u => u.id); const headcount = uids.length

  // coverage: approved KB items × active users of the dept
  const approved = await prisma.approvalItem.findMany({ where: { entityType: 'KB_ARTICLE', currentVersion: { gt: 0 } }, select: { entityId: true, currentVersion: true, approvedAt: true } })
  let coverage = 1
  if (approved.length && headcount) {
    const acks = await prisma.acknowledgment.count({ where: { userId: { in: uids }, entityType: 'KB_ARTICLE', OR: approved.map(a => ({ entityId: a.entityId, version: a.currentVersion })) } })
    coverage = Math.min(1, acks / (approved.length * headcount))
  }
  const staleDocs = approved.filter(a => a.approvedAt && Date.now() - a.approvedAt.getTime() > STALE_DAYS * 86_400_000).length

  const [attempts, failed] = headcount ? await Promise.all([
    prisma.quizAttempt.count({ where: { userId: { in: uids }, startedAt: { gte: since } } }),
    prisma.quizAttempt.count({ where: { userId: { in: uids }, startedAt: { gte: since }, passed: false } }),
  ]) : [0, 0]
  const [open, overdue] = headcount ? await Promise.all([
    prisma.enrollment.count({ where: { userId: { in: uids }, status: { not: 'COMPLETED' }, dueAt: { not: null } } }),
    prisma.enrollment.count({ where: { userId: { in: uids }, status: { not: 'COMPLETED' }, dueAt: { lt: new Date() } } }),
  ]) : [0, 0]
  const unanswered = await prisma.chatQuestionLog.count({ where: { departmentId: deptId, kbHits: 0, createdAt: { gte: since } } })
  const pendingReviews = await prisma.approvalItem.count({ where: { status: 'IN_REVIEW', submittedAt: { lt: new Date(Date.now() - REVIEW_BACKLOG_DAYS * 86_400_000) } } })

  return {
    department_id: dept.id, department_name: dept.name, headcount,
    coverage_pct: +coverage.toFixed(3), quiz_fail_rate: attempts ? +(failed / attempts).toFixed(3) : 0,
    overdue_ratio: open ? +(overdue / open).toFixed(3) : 0,
    unanswered_questions: unanswered, stale_docs: staleDocs, pending_reviews: pendingReviews,
  }
}

export type HeadRecommendation = { policy_id?: string; action?: unknown; framing?: string | Record<string, string>; priority?: number; [k: string]: unknown }

/** Ask the head for recommendations on one department. Returns null when the tentacle is disabled. */
export async function recommendForDepartment(mcoreTenant: string, ctx: DeptContext, actor: string, role: string): Promise<{ recommendations: HeadRecommendation[]; decision_id?: string; raw?: unknown } | null> {
  if (!MCORE_CONFIGURED) return null
  const r = await fetch(`${BASE}/api/morpheus/recommend`, {
    method: 'POST', headers: h(mcoreTenant, actor, role),
    body: JSON.stringify({ customer_id: `dept:${ctx.department_id}`, context: ctx, limit: 5 }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!r.ok) throw new Error(`m-core recommend ${r.status}`)
  const j = await r.json() as Record<string, unknown>
  const recs = (j.recommendations ?? j.results ?? j.actions ?? []) as HeadRecommendation[]
  return { recommendations: Array.isArray(recs) ? recs : [], decision_id: (j.decision_id as string | undefined), raw: j }
}

/** Push department signals to the head (subjects + signals batch). Best effort. */
export async function pushSignals(mcoreTenant: string, contexts: DeptContext[]): Promise<{ pushed: number }> {
  if (!MCORE_CONFIGURED || contexts.length === 0) return { pushed: 0 }
  const headers = h(mcoreTenant, 'lernvo', 'system')
  let pushed = 0
  for (const c of contexts) {
    const ext = `lernvo:${mcoreTenant}:dept:${c.department_id}`
    let subjectId: string | null = null
    const get = await fetch(`${BASE}/subjects/by-external/${encodeURIComponent(ext)}`, { headers, signal: AbortSignal.timeout(15_000) })
    if (get.ok) subjectId = ((await get.json()) as { subject_id?: string; id?: string }).subject_id ?? null
    if (!subjectId) {
      const cr = await fetch(`${BASE}/subjects`, { method: 'POST', headers, body: JSON.stringify({ external_id: ext, tags: ['lernvo', 'department'], metadata: { name: c.department_name, tenant: mcoreTenant } }), signal: AbortSignal.timeout(15_000) })
      if (!cr.ok) { logger.warn(`m-core subject create ${cr.status}`); continue }
      subjectId = ((await cr.json()) as { subject_id?: string }).subject_id ?? null
    }
    if (!subjectId) continue
    const ts = new Date().toISOString()
    const sig = (signal_type: string, intensity: number, payload: Record<string, unknown>) => ({ subject_id: subjectId, timestamp: ts, source: 'lernvo', signal_type, payload, intensity: Math.max(0, Math.min(1, intensity)), reliability: 0.9 })
    const signals = [
      sig('coverage_gap', 1 - c.coverage_pct, { coverage_pct: c.coverage_pct, headcount: c.headcount }),
      sig('quiz_failure', c.quiz_fail_rate, { quiz_fail_rate: c.quiz_fail_rate }),
      sig('overdue_training', c.overdue_ratio, { overdue_ratio: c.overdue_ratio }),
      sig('unanswered_questions', Math.min(1, c.unanswered_questions / 10), { count: c.unanswered_questions }),
      sig('stale_documents', Math.min(1, c.stale_docs / 5), { count: c.stale_docs }),
    ]
    const b = await fetch(`${BASE}/signals/batch`, { method: 'POST', headers, body: JSON.stringify({ signals }), signal: AbortSignal.timeout(20_000) })
    if (b.ok) pushed += signals.length; else logger.warn(`m-core signals batch ${b.status}`)
  }
  return { pushed }
}
