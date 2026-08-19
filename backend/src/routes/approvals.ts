import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma'
import { authenticate, authorize } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { logger } from '../utils/logger'
import * as Approval from '../services/approval'

const router = Router()
router.use(authenticate)

const isApprover = (role: string) => (Approval.APPROVER_ROLES as readonly string[]).includes(role)

function parse(req: { params: Record<string, string> }, res: { status: (n: number) => { json: (b: unknown) => unknown } }) {
  const t = Approval.parseEntityType(req.params.type ?? '')
  if (!t) { res.status(400).json({ error: 'Unknown entity type' }); return null }
  return t
}

// GET /api/approvals/pending — review queue + coverage (admins)
// Batched on purpose: this used to run 3-4 queries per row (up to ~600 for a full queue).
// It now costs a fixed 5 queries whatever the size of the queue.
router.get('/pending', authorize(...Approval.APPROVER_ROLES), async (_req, res) => {
  try {
    const items = await prisma.approvalItem.findMany({ orderBy: { updatedAt: 'desc' }, take: 200 })
    if (items.length === 0) return res.json([])

    const kbIds = items.filter(i => i.entityType === 'KB_ARTICLE').map(i => i.entityId)
    const moduleIds = items.filter(i => i.entityType === 'MODULE').map(i => i.entityId)
    const submitterIds = [...new Set(items.map(i => i.submittedById).filter(Boolean))] as string[]

    const [articles, modules, submitters, activeUsers, ackGroups] = await Promise.all([
      kbIds.length ? prisma.kbArticle.findMany({ where: { id: { in: kbIds } }, select: { id: true, title: true, slug: true } }) : [],
      moduleIds.length ? prisma.module.findMany({ where: { id: { in: moduleIds } }, select: { id: true, title: true } }) : [],
      submitterIds.length ? prisma.user.findMany({ where: { id: { in: submitterIds } }, select: { id: true, firstName: true, lastName: true } }) : [],
      prisma.user.count({ where: { isActive: true, role: { not: 'SUPER_ADMIN' } } }),
      kbIds.length ? prisma.acknowledgment.groupBy({ by: ['entityId', 'version'], where: { entityType: 'KB_ARTICLE', entityId: { in: kbIds } }, _count: { _all: true } }) : [],
    ])

    const artById = new Map(articles.map(a => [a.id, a]))
    const modById = new Map(modules.map(m => [m.id, m]))
    const subById = new Map(submitters.map(u => [u.id, `${u.firstName} ${u.lastName}`]))
    const ackByKey = new Map(ackGroups.map(g => [`${g.entityId}:${g.version}`, g._count._all]))

    const out = items.flatMap(it => {
      const isKb = it.entityType === 'KB_ARTICLE'
      const ent = isKb ? artById.get(it.entityId) : modById.get(it.entityId)
      if (!ent) return []
      const acked = isKb && it.currentVersion > 0 ? (ackByKey.get(`${it.entityId}:${it.currentVersion}`) ?? 0) : null
      return [{
        ...it,
        title: ent.title,
        link: isKb ? `/kb?slug=${(ent as { slug?: string }).slug ?? ''}` : `/modules/${it.entityId}`,
        coverage: acked === null ? null : { acked, total: activeUsers, pct: activeUsers ? Math.round((acked / activeUsers) * 100) : 0 },
        submitter: it.submittedById ? subById.get(it.submittedById) ?? null : null,
      }]
    })
    res.json(out)
  } catch (e) { logger.error('approvals pending', e); res.status(500).json({ error: 'Failed' }) }
})

// GET /api/approvals/my-pending — what I still have to acknowledge
router.get('/my-pending', async (req, res) => {
  try { res.json(await Approval.myPending(req.user!.userId)) }
  catch (e) { logger.error('approvals my-pending', e); res.status(500).json({ error: 'Failed' }) }
})

// GET /api/approvals/:type/:id — status for one entity
router.get('/:type/:id', async (req, res) => {
  const t = parse(req, res); if (!t) return
  try {
    const item = await prisma.approvalItem.findFirst({ where: { entityType: t, entityId: req.params.id } })
    if (!item) return res.json({ status: 'DRAFT', currentVersion: 0, myAck: false, coverage: null })
    const myAck = item.currentVersion > 0
      ? !!(await prisma.acknowledgment.findFirst({ where: { userId: req.user!.userId, entityType: t, entityId: req.params.id, version: item.currentVersion } }))
      : false
    const cov = isApprover(req.user!.role) && t === 'KB_ARTICLE' && item.currentVersion > 0 ? await Approval.coverage(t, req.params.id, item.currentVersion) : null
    const [submitter, approver] = await Promise.all([
      item.submittedById ? prisma.user.findFirst({ where: { id: item.submittedById }, select: { id: true, firstName: true, lastName: true } }) : null,
      item.approvedById ? prisma.user.findFirst({ where: { id: item.approvedById }, select: { id: true, firstName: true, lastName: true } }) : null,
    ])
    res.json({ ...item, myAck, coverage: cov, submitter, approver })
  } catch (e) { logger.error('approvals get', e); res.status(500).json({ error: 'Failed' }) }
})

// GET /api/approvals/:type/:id/history
router.get('/:type/:id/history', async (req, res) => {
  const t = parse(req, res); if (!t) return
  try {
    const versions = await prisma.contentVersion.findMany({ where: { entityType: t, entityId: req.params.id }, orderBy: { version: 'desc' } })
    const authorIds = [...new Set(versions.map(v => v.createdById).filter(Boolean))] as string[]
    const authors = authorIds.length ? await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, firstName: true, lastName: true } }) : []
    const byId = new Map(authors.map(a => [a.id, `${a.firstName} ${a.lastName}`]))
    const admin = isApprover(req.user!.role)
    res.json(versions.map(v => ({ id: v.id, version: v.version, changeNote: v.changeNote, createdAt: v.createdAt, author: v.createdById ? byId.get(v.createdById) ?? null : null, snapshot: admin ? v.snapshot : undefined })))
  } catch (e) { logger.error('approvals history', e); res.status(500).json({ error: 'Failed' }) }
})

// POST /api/approvals/:type/:id/submit
router.post('/:type/:id/submit', authorize(...Approval.SUBMITTER_ROLES), async (req, res) => {
  const t = parse(req, res); if (!t) return
  try {
    if (!(await Approval.loadEntity(t, req.params.id))) return res.status(404).json({ error: 'Not found' })
    res.json(await Approval.submit(t, req.params.id, req.user!.userId))
  } catch (e) { logger.error('approvals submit', e); res.status(500).json({ error: 'Failed' }) }
})

const ApproveSchema = z.object({ note: z.string().max(500).optional() })
// POST /api/approvals/:type/:id/approve
router.post('/:type/:id/approve', authorize(...Approval.APPROVER_ROLES), validate(ApproveSchema), async (req, res) => {
  const t = parse(req, res); if (!t) return
  try {
    const item = await prisma.approvalItem.findFirst({ where: { entityType: t, entityId: req.params.id } })
    // No self-approval (PLATFORM_MANAGER may override)
    if (item?.submittedById && item.submittedById === req.user!.userId && req.user!.role !== 'PLATFORM_MANAGER') {
      return res.status(403).json({ error: 'Vous ne pouvez pas approuver votre propre soumission.' })
    }
    res.json(await Approval.approve(t, req.params.id, req.user!.userId, req.body.note))
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500
    if (status === 500) logger.error('approvals approve', e)
    res.status(status).json({ error: status === 404 ? 'Not found' : 'Failed' })
  }
})

const RejectSchema = z.object({ reason: z.string().min(3).max(500) })
// POST /api/approvals/:type/:id/reject
router.post('/:type/:id/reject', authorize(...Approval.APPROVER_ROLES), validate(RejectSchema), async (req, res) => {
  const t = parse(req, res); if (!t) return
  try {
    if (!(await Approval.loadEntity(t, req.params.id))) return res.status(404).json({ error: 'Not found' })
    res.json(await Approval.reject(t, req.params.id, req.user!.userId, req.body.reason))
  } catch (e) { logger.error('approvals reject', e); res.status(500).json({ error: 'Failed' }) }
})

// POST /api/approvals/:type/:id/ack — "J'ai lu et compris" (current version)
router.post('/:type/:id/ack', async (req, res) => {
  const t = parse(req, res); if (!t) return
  try { res.json(await Approval.acknowledge(t, req.params.id, req.user!.userId)) }
  catch (e) {
    const status = (e as { status?: number }).status ?? 500
    if (status === 500) logger.error('approvals ack', e)
    res.status(status).json({ error: status === 409 ? 'Aucune version approuvée à valider' : 'Failed' })
  }
})

export default router
