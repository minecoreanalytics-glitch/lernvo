import { Router } from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { prisma } from '../utils/prisma'
import { tenantStore } from '../utils/tenantContext'
import { tenantSlugFromRequest, BASE_DOMAIN } from '../utils/tenantHost'

/**
 * Public read API — no auth. Serves ONLY the last APPROVED version of "publiable" knowledge items of the tenant
 * resolved from the Host (<slug>.<DOMAIN>) or ?tenant=<slug>. Meant for the customer's website:
 * "what the customer reads = what the employees were trained on".
 */
const router = Router()
router.use(cors({ origin: '*', methods: ['GET', 'POST'] }))
router.use(rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }))

async function resolveTenant(req: Parameters<typeof tenantSlugFromRequest>[0] & { query: Record<string, unknown> }) {
  const slug = (typeof req.query.tenant === 'string' && req.query.tenant) || tenantSlugFromRequest(req)
  if (!slug) return null
  return tenantStore.run({ tenantId: null, superAdmin: true }, async () =>
    await prisma.tenant.findUnique({ where: { slug }, select: { id: true, name: true, slug: true, logoUrl: true, supportEmail: true, status: true } }))
}
const inTenant = <T>(tenantId: string, fn: () => Promise<T>) => tenantStore.run({ tenantId, superAdmin: false }, fn)
const excerpt = (md: string) => md.replace(/^#.*$/gm, '').replace(/[*_`>#\[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200)

router.get('/tenant', async (req, res) => {
  const t = await resolveTenant(req)
  if (!t || t.status !== 'ACTIVE') return res.status(404).json({ error: 'Unknown tenant' })
  res.json({ name: t.name, slug: t.slug, logoUrl: t.logoUrl, supportEmail: t.supportEmail, baseDomain: BASE_DOMAIN })
})

router.get('/categories', async (req, res) => {
  const t = await resolveTenant(req)
  if (!t || t.status !== 'ACTIVE') return res.status(404).json({ error: 'Unknown tenant' })
  const cats = await inTenant(t.id, () => prisma.category.findMany({ select: { id: true, name: true, icon: true, color: true }, orderBy: { name: 'asc' } }))
  res.json(cats)
})

// GET /api/public/articles?category=<id>&tag=<tag>&q=<text>
router.get('/articles', async (req, res) => {
  const t = await resolveTenant(req)
  if (!t || t.status !== 'ACTIVE') return res.status(404).json({ error: 'Unknown tenant' })
  const { category, tag, q } = req.query as Record<string, string | undefined>
  const out = await inTenant(t.id, async () => {
    const approved = await prisma.approvalItem.findMany({ where: { entityType: 'KB_ARTICLE', currentVersion: { gt: 0 } }, select: { entityId: true, currentVersion: true, approvedAt: true } })
    const byId = new Map(approved.map(a => [a.entityId, a]))
    if (byId.size === 0) return []
    const articles = await prisma.kbArticle.findMany({
      where: { id: { in: [...byId.keys()] }, isPublic: true, isPublished: true, ...(category ? { categoryId: category } : {}), ...(tag ? { tags: { has: tag } } : {}),
        ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { body: { contains: q, mode: 'insensitive' } }] } : {}) },
      include: { category: { select: { id: true, name: true, icon: true } } }, orderBy: { updatedAt: 'desc' }, take: 200,
    })
    const versions = await prisma.contentVersion.findMany({ where: { entityType: 'KB_ARTICLE', entityId: { in: articles.map(a => a.id) } }, select: { entityId: true, version: true, snapshot: true } })
    const snap = new Map(versions.map(v => [`${v.entityId}:${v.version}`, v.snapshot as { title?: string; body?: string; tags?: string[] }]))
    return articles.map(a => {
      const ap = byId.get(a.id)!; const s = snap.get(`${a.id}:${ap.currentVersion}`) ?? {}
      return { slug: a.slug, title: s.title ?? a.title, excerpt: excerpt(s.body ?? a.body), tags: s.tags ?? a.tags, category: a.category, version: ap.currentVersion, approvedAt: ap.approvedAt }
    })
  })
  res.json(out)
})

router.get('/articles/:slug', async (req, res) => {
  const t = await resolveTenant(req)
  if (!t || t.status !== 'ACTIVE') return res.status(404).json({ error: 'Unknown tenant' })
  const out = await inTenant(t.id, async () => {
    const a = await prisma.kbArticle.findFirst({ where: { slug: req.params.slug, isPublic: true, isPublished: true }, include: { category: { select: { id: true, name: true, icon: true } } } })
    if (!a) return null
    const ap = await prisma.approvalItem.findFirst({ where: { entityType: 'KB_ARTICLE', entityId: a.id, currentVersion: { gt: 0 } } })
    if (!ap) return null
    const v = await prisma.contentVersion.findFirst({ where: { entityType: 'KB_ARTICLE', entityId: a.id, version: ap.currentVersion } })
    const s = (v?.snapshot ?? {}) as { title?: string; body?: string; tags?: string[] }
    return { slug: a.slug, title: s.title ?? a.title, body: s.body ?? a.body, tags: s.tags ?? a.tags, category: a.category, version: ap.currentVersion, approvedAt: ap.approvedAt, format: 'markdown' }
  })
  if (!out) return res.status(404).json({ error: 'Not found' })
  res.set('Cache-Control', 'public, max-age=60')
  res.json(out)
})

// POST /api/public/leads — landing-page form (no auth). Honeypot + rate limit; forwarded to LEADS_WEBHOOK_URL (n8n → CRM) if set.
const leadLimiter = rateLimit({ windowMs: 60_000, max: 5, standardHeaders: true, legacyHeaders: false })
router.post('/leads', leadLimiter, async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>
  if (typeof b.website === 'string' && b.website.trim()) return res.status(200).json({ ok: true }) // honeypot: pretend success
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : ''
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Email invalide' })
  const str = (k: string, max = 200) => (typeof b[k] === 'string' ? (b[k] as string).trim().slice(0, max) : null) || null
  const intent = ['demo', 'pilot', 'contact'].includes(String(b.intent)) ? String(b.intent) : 'contact'
  const lead = await tenantStore.run({ tenantId: null, superAdmin: true }, async () =>
    await prisma.lead.create({ data: { email, name: str('name'), company: str('company'), size: str('size', 40), phone: str('phone', 40), message: str('message', 2000), intent, source: str('source', 300), locale: str('locale', 10), host: (req.headers['x-forwarded-host'] as string) || req.headers.host || null } }))
  const hook = process.env.LEADS_WEBHOOK_URL
  if (hook) fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...lead, createdAt: lead.createdAt.toISOString() }), signal: AbortSignal.timeout(8000) }).catch(() => {})
  res.status(201).json({ ok: true })
})

export default router
