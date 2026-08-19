import { Router } from 'express'
import { prisma } from '../utils/prisma'
import { authenticate, authorize } from '../middleware/auth'
import { logger } from '../utils/logger'
import { MCORE_CONFIGURED, computeAllDepartmentContexts, recommendForDepartment, pushSignals, type DeptContext, type HeadRecommendation } from '../services/mcore'

const router = Router()
router.use(authenticate)
router.use(authorize('PLATFORM_MANAGER', 'HR', 'MANAGER'))

const cache = new Map<string, { at: number; data: unknown }>()
const TTL = 10 * 60_000

async function tenantMcore(tenantId: string) {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { mcoreTenant: true } })
  return t?.mcoreTenant ?? null
}

// GET /api/mcore/status
router.get('/status', async (req, res) => {
  const mt = req.user!.tenantId ? await tenantMcore(req.user!.tenantId) : null
  res.json({ configured: MCORE_CONFIGURED, tenantEnabled: !!mt, mcoreTenant: mt })
})

// GET /api/mcore/insights — signals of every department + head recommendations (cached 10 min)
router.get('/insights', async (req, res) => {
  try {
    const tenantId = req.user!.tenantId!
    const key = `insights:${tenantId}`
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < TTL && req.query.refresh !== '1') return res.json(hit.data)
    const mt = await tenantMcore(tenantId)
    const contexts: DeptContext[] = (await computeAllDepartmentContexts()).filter(c => c.headcount > 0)
    let recommendations: Array<{ department: DeptContext; recs: HeadRecommendation[]; decision_id?: string }> = []
    let headError: string | null = null
    if (mt && MCORE_CONFIGURED) {
      for (const c of contexts) {
        try {
          const r = await recommendForDepartment(mt, c, req.user!.userId, req.user!.role.toLowerCase())
          if (r && r.recommendations.length) recommendations.push({ department: c, recs: r.recommendations, decision_id: r.decision_id })
        } catch (e) { headError = (e as Error).message }
      }
    }
    // Local fallback: apply the reference doctrine thresholds so the page is useful even without the head
    const local = contexts.flatMap(c => {
      const out: Array<{ department: DeptContext; policy_id: string; framing: string; priority: number }> = []
      if (c.coverage_pct <= 0.7 && c.headcount >= 3) out.push({ department: c, policy_id: 'coverage-gap-reinforce', priority: 1, framing: "Moins de 70 % de l'équipe a validé les procédures en vigueur : relancer les retardataires." })
      if (c.quiz_fail_rate >= 0.4) out.push({ department: c, policy_id: 'procedure-misunderstood-rewrite', priority: 1, framing: "Taux d'échec élevé aux quiz : la procédure est probablement ambiguë — la réécrire ou ajouter un module." })
      if (c.unanswered_questions >= 5) out.push({ department: c, policy_id: 'knowledge-gap-from-questions', priority: 2, framing: "Plusieurs questions à l'assistant sans article : documenter ce sujet." })
      if (c.overdue_ratio >= 0.3) out.push({ department: c, policy_id: 'overdue-assignments-escalate', priority: 2, framing: 'Plus de 30 % des formations assignées sont en retard : le manager doit arbitrer.' })
      if (c.stale_docs >= 1) out.push({ department: c, policy_id: 'stale-documents-reapprove', priority: 3, framing: 'Des documents approuvés depuis plus de 6 mois : planifier une relecture.' })
      return out
    })
    const data = { generatedAt: new Date().toISOString(), head: { configured: MCORE_CONFIGURED, tenantEnabled: !!mt, error: headError }, contexts, recommendations, local }
    cache.set(key, { at: Date.now(), data })
    res.json(data)
  } catch (e) { logger.error('mcore insights', e); res.status(500).json({ error: 'Failed' }) }
})

// POST /api/mcore/push — push current department signals to the head now
router.post('/push', authorize('PLATFORM_MANAGER'), async (req, res) => {
  const mt = await tenantMcore(req.user!.tenantId!)
  if (!mt || !MCORE_CONFIGURED) return res.status(409).json({ error: 'Tentacule non activée (MORPHEUS_CORE_URL/KEY ou mcoreTenant manquant)' })
  const contexts: DeptContext[] = (await computeAllDepartmentContexts()).filter(c => c.headcount > 0)
  try { res.json(await pushSignals(mt, contexts)) }
  catch (e) { res.status(502).json({ error: (e as Error).message }) }
})

export default router
