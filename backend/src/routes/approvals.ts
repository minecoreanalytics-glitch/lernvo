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
router.get('/pending', authorize(...Approval.APPROVER_ROLES), async (_req, res) => {
  try {
    const items = await prisma.approvalItem.findMany({ where: { status: { in: ['IN_REVIEW', 'APPROVED', 'REJECTED', 'DRAFT'] } }, orderBy: { updatedAt: 'desc' }, take: 200 })
    const out = []
    for (const it of items) {
      const ent = await Approval.loadEntity(it.entityType, it.entityId)
      if (!ent) continue
      const cov = it.entityType === 'KB_ARTICLE' && it.currentVersion > 0 ? await Approval.coverage(it.entityType, it.entityId, it.currentVersion) : null
      const submitter = it.submittedById ? await prisma.user.findFirst({ where: { id: it.submittedById }, select: { firstName: true, lastName: true } }) : null
      out.push({ ...it, title: ent.title, link: ent.link, coverage: cov, submitter: submitter ? `${submitter.firstName} ${submitter.lastName}` : null })
    }
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
