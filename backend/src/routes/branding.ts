import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { prisma } from '../utils/prisma'
import { tenantStore } from '../utils/tenantContext'
import { tenantSlugFromRequest, tenantSlugFromHost, BASE_DOMAIN } from '../utils/tenantHost'

const router = Router()
const PLATFORM_NAME = process.env.PLATFORM_NAME || 'Lernvo'

// GET /api/branding — public. Resolves the tenant from the Host header (<slug>.<DOMAIN>) only
// (no ?slug= param: avoids tenant enumeration). Returns platform branding on the apex.
router.get('/', async (req, res) => {
  const slug = tenantSlugFromRequest(req)
  if (!slug) {
    return res.json({ platformName: PLATFORM_NAME, baseDomain: BASE_DOMAIN, tenant: null })
  }
  const tenant = await tenantStore.run({ tenantId: null, superAdmin: true }, () =>
    prisma.tenant.findUnique({
      where: { slug },
      select: { name: true, slug: true, status: true, logoUrl: true, primaryColor: true, supportEmail: true }
    })
  )
  if (!tenant || tenant.status !== 'ACTIVE') {
    return res.json({ platformName: PLATFORM_NAME, baseDomain: BASE_DOMAIN, tenant: null })
  }
  const { status: _s, ...pub } = tenant
  res.json({ platformName: PLATFORM_NAME, baseDomain: BASE_DOMAIN, tenant: pub })
})

// GET /api/branding/tls-check?domain=<host> — Caddy on_demand_tls "ask" endpoint.
// 200 = issue a certificate (apex, www, or an ACTIVE tenant subdomain); 404 otherwise.
const tlsCheckLimiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false })
router.get('/tls-check', tlsCheckLimiter, async (req, res) => {
  const domain = typeof req.query.domain === 'string' ? req.query.domain.toLowerCase() : ''
  if (!domain) return res.status(400).end()
  if (domain === BASE_DOMAIN || domain === `www.${BASE_DOMAIN}`) return res.status(200).end()
  const slug = tenantSlugFromHost(domain)
  if (!slug) return res.status(404).end()
  const t = await tenantStore.run({ tenantId: null, superAdmin: true }, () =>
    prisma.tenant.findUnique({ where: { slug }, select: { status: true } })
  )
  return res.status(t && t.status === 'ACTIVE' ? 200 : 404).end()
})

export default router
