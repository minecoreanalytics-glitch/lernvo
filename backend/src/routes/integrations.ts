/**
 * /api/integrations — Salesforce / n8n (clé = connecteur RH type API)
 *
 * Complète /api/hr/push : sync d'un employé à la fois + webhook de complétion.
 */
import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { Role } from '@prisma/client'
import { prisma } from '../utils/prisma'
import { validate } from '../middleware/validate'
import { tenantStore } from '../utils/tenantContext'
import { sha256 } from '../utils/crypto'
import { hashPassword } from '../utils/password'
import { NotificationService } from '../services/notifications'
import { logger } from '../utils/logger'

const router = Router()

const limiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false })
router.use(limiter)

async function resolveTenantFromKey(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-integration-key']
  if (typeof key !== 'string' || key.length < 20) {
    return res.status(401).json({ error: 'Invalid integration key' })
  }
  const connector = await tenantStore.run({ tenantId: null, superAdmin: true }, async () =>
    prisma.hrConnector.findFirst({ where: { type: 'API', enabled: true, apiKeyHash: sha256(key) } })
  )
  if (!connector) return res.status(401).json({ error: 'Invalid integration key' })
  ;(req as Request & { integrationTenantId: string }).integrationTenantId = connector.tenantId
  tenantStore.run({ tenantId: connector.tenantId, superAdmin: false }, () => next())
}

router.use(resolveTenantFromKey)

const ROLE_MAP: Record<string, Role> = {
  'Agent Commercial': 'AGENT',
  'Sales Rep': 'AGENT',
  Commercial: 'AGENT',
  Agent: 'AGENT',
  Superviseur: 'SUPERVISOR',
  Supervisor: 'SUPERVISOR',
  Manager: 'MANAGER',
  'Team Lead': 'MANAGER',
  HR: 'HR',
  RH: 'HR',
  'Platform Manager': 'PLATFORM_MANAGER'
}

const SyncUserSchema = z.object({
  salesforceId: z.string().min(1),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  salesforceRole: z.string().optional(),
  departmentName: z.string().optional(),
  managerId: z.string().optional(),
  isActive: z.boolean().default(true)
})

router.post('/sync-user', validate(SyncUserSchema), async (req, res) => {
  try {
    const {
      salesforceId, email, firstName, lastName,
      salesforceRole, departmentName, managerId, isActive
    } = req.body as z.infer<typeof SyncUserSchema>

    const role = ROLE_MAP[salesforceRole ?? ''] ?? 'AGENT'
    const tenantId = (req as Request & { integrationTenantId: string }).integrationTenantId

    let departmentId: string | undefined
    if (departmentName) {
      const dept = await prisma.department.findFirst({
        where: { name: { contains: departmentName, mode: 'insensitive' } }
      })
      departmentId = dept?.id
    }

    const existing = await prisma.user.findFirst({ where: { email } })
    const isNew = !existing

    let user
    if (existing) {
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          firstName,
          lastName,
          role: existing.role === 'PLATFORM_MANAGER' || existing.role === 'HR' ? existing.role : role,
          isActive,
          externalSource: 'SALESFORCE',
          externalId: salesforceId,
          ...(departmentId && { departmentId }),
          ...(managerId && { managerId })
        }
      })
    } else {
      const tempPassword = `LV-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
      user = await prisma.user.create({
        data: {
          tenantId,
          email,
          firstName,
          lastName,
          passwordHash: await hashPassword(tempPassword),
          role,
          isActive,
          externalSource: 'SALESFORCE',
          externalId: salesforceId,
          ...(departmentId && { departmentId }),
          ...(managerId && { managerId })
        }
      })
      await NotificationService.sendWelcome(user.id, tempPassword).catch(() => {})
    }

    if (isActive) {
      const mandatoryModules = await prisma.module.findMany({
        where: {
          isPublished: true,
          AND: [
            {
              OR: [
                { requiredRoles: { isEmpty: true } },
                { requiredRoles: { has: role } }
              ]
            },
            departmentId
              ? { OR: [{ departmentId: null }, { departmentId }] }
              : { departmentId: null }
          ]
        },
        select: { id: true }
      })

      if (mandatoryModules.length > 0) {
        const dueAt = new Date()
        dueAt.setDate(dueAt.getDate() + 30)
        await Promise.all(
          mandatoryModules.map(m =>
            prisma.enrollment.upsert({
              where: { userId_moduleId: { userId: user.id, moduleId: m.id } },
              create: {
                tenantId,
                userId: user.id,
                moduleId: m.id,
                status: 'IN_PROGRESS',
                startedAt: new Date(),
                dueAt
              },
              update: {}
            }).catch(() => {})
          )
        )
      }
    }

    res.status(isNew ? 201 : 200).json({
      action: isNew ? 'created' : 'updated',
      userId: user.id,
      email: user.email,
      role: user.role
    })
  } catch (err) {
    logger.error('Salesforce sync-user error:', err)
    res.status(500).json({ error: 'Échec de la synchronisation utilisateur' })
  }
})

const ModuleCompleteSchema = z.object({
  userId: z.string().uuid(),
  moduleId: z.string().min(1),
  score: z.number().min(0).max(100),
  passed: z.boolean(),
  completedAt: z.string().datetime()
})

router.post('/webhooks/module-complete', validate(ModuleCompleteSchema), async (req, res) => {
  try {
    const { userId, moduleId, score, passed, completedAt } = req.body as z.infer<typeof ModuleCompleteSchema>
    const [user, module] = await Promise.all([
      prisma.user.findFirst({ where: { id: userId }, select: { email: true, firstName: true, lastName: true } }),
      prisma.module.findFirst({ where: { id: moduleId }, select: { title: true } })
    ])
    if (!user || !module) return res.status(404).json({ error: 'User ou module introuvable' })

    logger.info(`Module complete webhook: ${user.email} completed "${module.title}"`)
    res.json({
      salesforcePayload: {
        email: user.email,
        fullName: `${user.firstName} ${user.lastName}`,
        moduleTitle: module.title,
        score: Math.round(score),
        passed,
        completedAt
      }
    })
  } catch (err) {
    logger.error('Module complete webhook error:', err)
    res.status(500).json({ error: 'Erreur webhook complétion' })
  }
})

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    endpoints: ['POST /sync-user', 'POST /webhooks/module-complete']
  })
})

export default router
