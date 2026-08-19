/**
 * /api/integrations — Salesforce ↔ Lernvo
 *
 * Authentication: API Key (X-Integration-Key header) — not JWT
 * Called by n8n or external Salesforce integrations
 */
import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Role } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { prisma } from '../utils/prisma'
import { getTenantId } from '../utils/tenantContext'
import { validate } from '../middleware/validate'
import { NotificationService } from '../services/notifications'
import { logger } from '../utils/logger'

const router = Router()

// ─── Middleware : API Key auth ────────────────────────────────────────────────
function requireIntegrationKey(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-integration-key']
  const expected = process.env.INTEGRATION_API_KEY

  if (!expected) {
    logger.error('INTEGRATION_API_KEY not set in environment')
    return res.status(503).json({ error: 'Integration not configured' })
  }
  if (!key || key !== expected) {
    logger.warn(`Integration auth failed — invalid key from ${req.ip}`)
    return res.status(401).json({ error: 'Invalid integration key' })
  }
  next()
}

router.use(requireIntegrationKey)

// ─── Rate limit specific to integrations (10 req/min) ─────────────────────────
// Applied in index.ts via /api/integrations

// ─── Mapping Salesforce role → Lernvo Role ──────────────────────────────────
const SALESFORCE_ROLE_MAP: Record<string, Role> = {
  'Agent Commercial':    'AGENT',
  'Sales Rep':           'AGENT',
  'Commercial':          'AGENT',
  'Superviseur':         'SUPERVISOR',
  'Supervisor':          'SUPERVISOR',
  'Manager':             'MANAGER',
  'Team Lead':           'MANAGER',
  'HR':                  'HR',
  'RH':                  'HR',
  'Platform Manager':    'PLATFORM_MANAGER',
}

function mapSalesforceRole(sfRole: string): Role {
  return SALESFORCE_ROLE_MAP[sfRole] ?? 'AGENT'
}

// ─── POST /api/integrations/sync-user ────────────────────────────────────────
// Called by n8n when a Salesforce Contact is created/updated
// Upserts the employee in Lernvo + auto-enrolls in mandatory modules
const SyncUserSchema = z.object({
  salesforceId:   z.string().min(1),
  email:          z.string().email(),
  firstName:      z.string().min(1),
  lastName:       z.string().min(1),
  salesforceRole: z.string().optional(),
  departmentName: z.string().optional(),
  managerId:      z.string().optional(), // Lernvo userId of the manager
  isActive:       z.boolean().default(true)
})

router.post('/sync-user', validate(SyncUserSchema), async (req, res) => {
  try {
    const {
      salesforceId, email, firstName, lastName,
      salesforceRole, departmentName, managerId, isActive
    } = req.body as z.infer<typeof SyncUserSchema>

    const role = mapSalesforceRole(salesforceRole ?? '')

    // Resolve department if provided
    let departmentId: string | undefined
    if (departmentName) {
      const dept = await prisma.department.findFirst({
        where: { name: { contains: departmentName, mode: 'insensitive' } }
      })
      departmentId = dept?.id
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } })
    const isNew = !existing

    let user
    if (existing) {
      // Update
      user = await prisma.user.update({
        where: { email },
        data: {
          firstName,
          lastName,
          role,
          isActive,
          ...(departmentId && { departmentId }),
          ...(managerId && { managerId })
        }
      })
      logger.info(`Salesforce sync: updated user ${email}`)
    } else {
      // Create — temporary password, employee must change it
      const tempPassword = `Lernvo-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
      const passwordHash = await bcrypt.hash(tempPassword, 12)

      user = await prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          passwordHash,
          role,
          isActive,
          tenantId: getTenantId(),
          ...(departmentId && { departmentId }),
          ...(managerId && { managerId })
        }
      })
      logger.info(`Salesforce sync: created user ${email} (${role})`)

      // Welcome notification
      await NotificationService.sendWelcome(user.id).catch(() => {})
    }

    // Auto-enroll in mandatory modules for this role
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
        select: { id: true, title: true }
      })

      if (mandatoryModules.length > 0) {
        const dueAt = new Date()
        dueAt.setDate(dueAt.getDate() + 30) // 30 days to complete

        await Promise.all(
          mandatoryModules.map(m =>
            prisma.enrollment.upsert({
              where: { userId_moduleId: { userId: user.id, moduleId: m.id } },
              create: {
                userId: user.id,
                moduleId: m.id,
                status: 'IN_PROGRESS',
                startedAt: new Date(),
                dueAt
              },
              update: {} // Don't overwrite if already enrolled
            }).catch(() => {})
          )
        )

        logger.info(`Salesforce sync: auto-enrolled ${email} in ${mandatoryModules.length} module(s)`)
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
    res.status(500).json({ error: 'User sync failed' })
  }
})

// ─── POST /api/integrations/webhooks/module-complete ─────────────────────────
// Called when a module is completed, forwards completion data to n8n → Salesforce
const ModuleCompleteSchema = z.object({
  userId:      z.string().uuid(),
  moduleId:    z.string().uuid(),
  score:       z.number().min(0).max(100),
  passed:      z.boolean(),
  completedAt: z.string().datetime()
})

router.post('/webhooks/module-complete', validate(ModuleCompleteSchema), async (req, res) => {
  try {
    const { userId, moduleId, score, passed, completedAt } = req.body as z.infer<typeof ModuleCompleteSchema>

    const [user, module] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true, lastName: true } }),
      prisma.module.findUnique({ where: { id: moduleId }, select: { title: true } })
    ])

    if (!user || !module) {
      return res.status(404).json({ error: 'User or module not found' })
    }

    logger.info(`Module complete webhook: ${user.email} completed "${module.title}" (${Math.round(score)}%, passed=${passed})`)

    // Payload to forward to n8n for Salesforce update
    res.json({
      salesforcePayload: {
        email:        user.email,
        fullName:     `${user.firstName} ${user.lastName}`,
        moduleTitle:  module.title,
        score:        Math.round(score),
        passed,
        completedAt
      }
    })
  } catch (err) {
    logger.error('Module complete webhook error:', err)
    res.status(500).json({ error: 'Webhook completion error' })
  }
})

// ─── GET /api/integrations/health ────────────────────────────────────────────
// Ping to verify integration is operational (used by n8n)
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    endpoints: ['POST /sync-user', 'POST /webhooks/module-complete']
  })
})

export default router
