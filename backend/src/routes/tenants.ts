import { Router } from 'express'
import type { Tenant } from '@prisma/client'
import { prisma } from '../utils/prisma'
import { authenticate, authorize } from '../middleware/auth'
import { tenantStore } from '../utils/tenantContext'
import { logger } from '../utils/logger'
import { z } from 'zod'
import { validate } from '../middleware/validate'

const router = Router()

router.use(authenticate)

// ── Tenant self-service (PLATFORM_MANAGER of the tenant) ─────────────────────
const BrandingSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  logoUrl: z.string().url().max(500).regex(/^https?:\/\//, 'http(s) URL only').nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  supportEmail: z.string().email().max(200).nullable().optional(),
})

// GET /api/tenants/me — current tenant (any authenticated tenant user)
router.get('/me', async (req, res) => {
  try {
    if (!req.user!.tenantId) return res.status(404).json({ error: 'No tenant' })
    const t = await prisma.tenant.findUnique({
      where: { id: req.user!.tenantId },
      select: { id: true, name: true, slug: true, status: true, logoUrl: true, primaryColor: true, supportEmail: true, createdAt: true }
    })
    res.json(t)
  } catch (e) {
    logger.error('get my tenant', e)
    res.status(500).json({ error: 'Failed' })
  }
})

// PATCH /api/tenants/me — update branding of own tenant
router.patch('/me', authorize('PLATFORM_MANAGER'), validate(BrandingSchema), async (req, res) => {
  try {
    if (!req.user!.tenantId) return res.status(404).json({ error: 'No tenant' })
    const t = await prisma.tenant.update({
      where: { id: req.user!.tenantId },
      data: req.body,
      select: { id: true, name: true, slug: true, logoUrl: true, primaryColor: true, supportEmail: true }
    })
    res.json(t)
  } catch (e) {
    logger.error('update my tenant', e)
    res.status(500).json({ error: 'Failed' })
  }
})

router.use(authorize('SUPER_ADMIN'))

// PATCH /api/tenants/:id/mcore — enable/disable the Morpheus tentacle for a tenant (platform staff)
router.patch('/:id/mcore', validate(z.object({ mcoreTenant: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/).nullable() })), async (req, res) => {
  try {
    const t = await asSA(() => prisma.tenant.update({ where: { id: req.params.id }, data: { mcoreTenant: req.body.mcoreTenant }, select: { id: true, slug: true, mcoreTenant: true } }))
    res.json(t)
  } catch (e) { logger.error('tenant mcore', e); res.status(500).json({ error: 'Failed' }) }
})

const asSA = <T>(fn: () => Promise<T>) =>
  tenantStore.run({ tenantId: null, superAdmin: true }, fn)

// GET /api/tenants — list all tenants
router.get('/', async (_req, res) => {
  try {
    const tenants = await asSA(() =>
      prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } })
    )
    res.json(tenants)
  } catch (e) {
    logger.error('list tenants', e)
    res.status(500).json({ error: 'Failed' })
  }
})

// POST /api/tenants/:id/approve — approve a PENDING tenant
router.post('/:id/approve', async (req, res) => {
  try {
    const t = await asSA(() =>
      prisma.tenant.update({
        where: { id: req.params.id },
        data: {
          status: 'ACTIVE',
          approvedAt: new Date(),
          approvedBy: req.user!.userId
        }
      })
    ) as Tenant
    // Activate the tenant's PLATFORM_MANAGER users (scoped requires superAdmin bypass)
    await asSA(() =>
      prisma.user.updateMany({
        where: { tenantId: t.id, role: 'PLATFORM_MANAGER' },
        data: { isActive: true }
      })
    )
    res.json(t)
  } catch (e) {
    logger.error('approve tenant', e)
    res.status(500).json({ error: 'Failed' })
  }
})

// POST /api/tenants/:id/suspend — suspend an ACTIVE tenant
router.post('/:id/suspend', async (req, res) => {
  try {
    const t = await asSA(() =>
      prisma.tenant.update({
        where: { id: req.params.id },
        data: { status: 'SUSPENDED' }
      })
    )
    res.json(t)
  } catch (e) {
    logger.error('suspend tenant', e)
    res.status(500).json({ error: 'Failed' })
  }
})

export default router
