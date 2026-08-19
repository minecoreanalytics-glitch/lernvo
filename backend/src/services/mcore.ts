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

/**
 * Knowledge-assurance context for EVERY department of the tenant, in a fixed number of queries.
 * The previous version ran ~8 queries per department (12 departments = ~100 round trips per page
 * load); this runs 9 grouped queries whatever the size of the company.
 */
export async function computeAllDepartmentContexts(): Promise<DeptContext[]> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000)
  const now = new Date()
  const staleBefore = new Date(Date.now() - STALE_DAYS * 86_400_000)
  const backlogBefore = new Date(Date.now() - REVIEW_BACKLOG_DAYS * 86_400_000)

  const [departments, users, approved, pendingReviews] = await Promise.all([
    prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ where: { isActive: true, role: { not: 'SUPER_ADMIN' }, departmentId: { not: null } }, select: { id: true, departmentId: true } }),
    prisma.approvalItem.findMany({ where: { entityType: 'KB_ARTICLE', currentVersion: { gt: 0 } }, select: { entityId: true, currentVersion: true, approvedAt: true } }),
    prisma.approvalItem.count({ where: { status: 'IN_REVIEW', submittedAt: { lt: backlogBefore } } }),
  ])
  if (departments.length === 0) return []

  const deptOf = new Map(users.map(u => [u.id, u.departmentId as string]))
  const headcount = new Map<string, number>()
  for (const u of users) headcount.set(u.departmentId as string, (headcount.get(u.departmentId as string) ?? 0) + 1)
  const userIds = users.map(u => u.id)
  const staleDocs = approved.filter(a => a.approvedAt && a.approvedAt < staleBefore).length

  const [acks, attempts, failures, openAssign, overdueAssign, questions] = await Promise.all([
    approved.length && userIds.length
      ? prisma.acknowledgment.findMany({ where: { userId: { in: userIds }, entityType: 'KB_ARTICLE', OR: approved.map(a => ({ entityId: a.entityId, version: a.currentVersion })) }, select: { userId: true } })
      : [],
    userIds.length ? prisma.quizAttempt.groupBy({ by: ['userId'], where: { userId: { in: userIds }, startedAt: { gte: since } }, _count: { _all: true } }) : [],
    userIds.length ? prisma.quizAttempt.groupBy({ by: ['userId'], where: { userId: { in: userIds }, startedAt: { gte: since }, passed: false }, _count: { _all: true } }) : [],
    userIds.length ? prisma.enrollment.groupBy({ by: ['userId'], where: { userId: { in: userIds }, status: { not: 'COMPLETED' }, dueAt: { not: null } }, _count: { _all: true } }) : [],
    userIds.length ? prisma.enrollment.groupBy({ by: ['userId'], where: { userId: { in: userIds }, status: { not: 'COMPLETED' }, dueAt: { lt: now } }, _count: { _all: true } }) : [],
    prisma.chatQuestionLog.groupBy({ by: ['departmentId'], where: { kbHits: 0, createdAt: { gte: since } }, _count: { _all: true } }),
  ])

  const perDept = (rows: Array<{ userId: string; _count: { _all: number } }>) => {
    const m = new Map<string, number>()
    for (const r of rows) { const d = deptOf.get(r.userId); if (d) m.set(d, (m.get(d) ?? 0) + r._count._all) }
    return m
  }
  const ackByDept = new Map<string, number>()
  for (const a of acks) { const d = deptOf.get(a.userId); if (d) ackByDept.set(d, (ackByDept.get(d) ?? 0) + 1) }
  const attemptsByDept = perDept(attempts), failByDept = perDept(failures)
  const openByDept = perDept(openAssign), overdueByDept = perDept(overdueAssign)
  const questionsByDept = new Map(questions.filter(q => q.departmentId).map(q => [q.departmentId as string, q._count._all]))

  return departments.map(d => {
    const hc = headcount.get(d.id) ?? 0
    const expected = approved.length * hc
    const att = attemptsByDept.get(d.id) ?? 0
    const open = openByDept.get(d.id) ?? 0
    return {
      department_id: d.id, department_name: d.name, headcount: hc,
      coverage_pct: expected ? +Math.min(1, (ackByDept.get(d.id) ?? 0) / expected).toFixed(3) : 1,
      quiz_fail_rate: att ? +((failByDept.get(d.id) ?? 0) / att).toFixed(3) : 0,
      overdue_ratio: open ? +((overdueByDept.get(d.id) ?? 0) / open).toFixed(3) : 0,
      unanswered_questions: questionsByDept.get(d.id) ?? 0,
      stale_docs: staleDocs,
      pending_reviews: pendingReviews,
    }
  })
}

/** Single-department context (kept for targeted calls); prefer computeAllDepartmentContexts. */
export async function computeDepartmentContext(deptId: string): Promise<DeptContext | null> {
  const all = await computeAllDepartmentContexts()
  return all.find(c => c.department_id === deptId) ?? null
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
      const cr = await fetch(`${BASE}/subjects/`, { method: 'POST', headers, body: JSON.stringify({ external_id: ext, tags: ['lernvo', 'department'], metadata: { name: c.department_name, tenant: mcoreTenant } }), signal: AbortSignal.timeout(15_000) })
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
