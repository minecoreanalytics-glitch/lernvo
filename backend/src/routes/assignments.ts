import { Router } from 'express'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { prisma } from '../utils/prisma'
import { getTenantId } from '../utils/tenantContext'
import { authenticate, authorize } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { NotificationService } from '../services/notifications'
import { logger } from '../utils/logger'

const router = Router()
router.use(authenticate)

// ─── Helpers ────────────────────────────────────────────────────────────────
function dayStart(d: Date) {
  const s = new Date(d); s.setHours(0, 0, 0, 0); return s
}
function dayEnd(d: Date) {
  const e = new Date(d); e.setHours(23, 59, 59, 999); return e
}

// ─── GET /api/assignments ─────────────────────────────────────────────────
// Returns today's + overdue + upcoming assignments for the logged-in user
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.userId
    const now = new Date()
    const todayStart = dayStart(now)
    const todayEnd = dayEnd(now)

    // All non-completed enrollments
    const enrollments = await prisma.enrollment.findMany({
      where: {
        userId,
        status: { not: 'COMPLETED' }
      },
      include: {
        module: {
          include: {
            category: { select: { id: true, name: true, color: true, icon: true } },
            quizzes: {
              where: { status: 'PUBLISHED' },
              select: { id: true, title: true, passingScore: true, timeLimit: true }
            }
          }
        }
      },
      orderBy: { dueAt: 'asc' }
    })

    // For each enrollment, also check if the user has passed its quizzes
    const quizIds = enrollments.flatMap(e =>
      (e.module as { quizzes: Array<{ id: string }> }).quizzes.map((q: { id: string }) => q.id)
    )

    const quizAttempts = await prisma.quizAttempt.findMany({
      where: {
        userId,
        passed: true,
        sectionIndex: null,
        quizId: { in: quizIds }
      },
      select: { quizId: true }
    })
    const passedQuizIds = new Set(quizAttempts.map(a => a.quizId))

    // Annotate: pendingQuizzes = quizzes not yet passed
    const annotated = enrollments.map(e => {
      const mod = e.module as typeof e.module & { quizzes: Array<{ id: string; title: string; passingScore: number; timeLimit: number | null }> }
      return {
        ...e,
        module: {
          ...mod,
          quizzes: mod.quizzes.map(q => ({ ...q, passed: passedQuizIds.has(q.id) }))
        },
        hasPendingQuiz: mod.quizzes.some(q => !passedQuizIds.has(q.id))
      }
    })

    const overdue    = annotated.filter(e => e.dueAt !== null && e.dueAt < todayStart)
    const today      = annotated.filter(e => e.dueAt !== null && e.dueAt >= todayStart && e.dueAt <= todayEnd)
    const upcoming   = annotated.filter(e => e.dueAt !== null && e.dueAt > todayEnd)
    const noDueDate  = annotated.filter(e => e.dueAt === null)

    res.json({ overdue, today, upcoming, noDueDate })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch assignments' })
  }
})

// ─── POST /api/assignments ────────────────────────────────────────────────
// Admin/HR/Manager assigns a module to one or more users with a due date
const AssignSchema = z.object({
  moduleId:  z.string().min(1),
  userIds:   z.array(z.string().uuid()).min(1),
  dueAt:     z.string().datetime().optional(),
  note:      z.string().optional()
})

router.post('/',
  authorize('PLATFORM_MANAGER', 'HR', 'MANAGER', 'SUPERVISOR'),
  validate(AssignSchema),
  async (req, res) => {
    try {
      const { moduleId, userIds, dueAt, note } = req.body as z.infer<typeof AssignSchema>
      const dueDate = dueAt ? new Date(dueAt) : null

      const results = await Promise.all(
        userIds.map(userId =>
          prisma.enrollment.upsert({
            where: { userId_moduleId: { userId, moduleId } },
            create: {
              tenantId: getTenantId(),
              userId,
              moduleId,
              ...(dueDate ? { dueAt: dueDate } : {}),
              status: 'IN_PROGRESS',
              startedAt: new Date()
            },
            update: { ...(dueDate ? { dueAt: dueDate } : {}) }
          })
        )
      )

      // Send assignment reminder notification to each assigned user
      const mod = await prisma.module.findUnique({ where: { id: moduleId }, select: { title: true } })
      const moduleTitle = mod?.title || 'Module assigné'
      if (dueDate) {
        await Promise.all(
          userIds.map(userId =>
            NotificationService.sendAssignmentReminder(userId, moduleTitle, dueDate).catch(() => {})
          )
        )
      }

      res.status(201).json({ assigned: results.length, dueAt: dueDate })
    } catch (err) {
      res.status(500).json({ error: 'Failed to assign module' })
    }
  }
)

// ─── Scope guard for MANAGER / SUPERVISOR ────────────────────────────────
// Returns the enrollment or sends 404/403 and returns null.
// PLATFORM_MANAGER and HR can act on any enrollment.
// MANAGER and SUPERVISOR are restricted to enrollments belonging to users
// in their own department.
async function resolveEnrollmentWithScope(
  req: import('express').Request,
  res: import('express').Response,
  enrollmentId: string
) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { user: { select: { departmentId: true } } }
  })
  if (!enrollment) {
    res.status(404).json({ error: 'Enrollment not found' })
    return null
  }
  const { role, departmentId } = req.user!
  if (role === 'MANAGER' || role === 'SUPERVISOR') {
    if (!departmentId || enrollment.user.departmentId !== departmentId) {
      res.status(403).json({ error: 'Not authorized to modify this enrollment' })
      return null
    }
  }
  return enrollment
}

// ─── DELETE /api/assignments/:enrollmentId ───────────────────────────────
// Unassign a user from a module
router.delete('/:enrollmentId',
  authorize('PLATFORM_MANAGER', 'HR', 'MANAGER', 'SUPERVISOR'),
  async (req, res) => {
    try {
      const enrollment = await resolveEnrollmentWithScope(req, res, req.params.enrollmentId)
      if (!enrollment) return
      await prisma.enrollment.delete({ where: { id: enrollment.id } })
      res.json({ message: 'Enrollment removed' })
    } catch (e) {
      if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
      res.status(500).json({ error: 'Failed to remove enrollment' })
    }
  }
)

// ─── PATCH /api/assignments/:enrollmentId/due ────────────────────────────
// Update due date for a specific enrollment
router.patch('/:enrollmentId/due',
  authorize('PLATFORM_MANAGER', 'HR', 'MANAGER', 'SUPERVISOR'),
  async (req, res) => {
    try {
      const enrollment = await resolveEnrollmentWithScope(req, res, req.params.enrollmentId)
      if (!enrollment) return
      const { dueAt } = req.body
      const updated = await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { dueAt: dueAt ? new Date(dueAt) : null }
      })
      res.json(updated)
    } catch (e) {
      if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
      res.status(500).json({ error: 'Failed to update due date' })
    }
  }
)

// ─── GET /api/assignments/summary ─────────────────────────────────────────
// Admin view: count overdue/today per department
router.get('/summary',
  authorize('PLATFORM_MANAGER', 'HR', 'MANAGER', 'SUPERVISOR'),
  async (req, res) => {
    try {
      const now = new Date()
      const todayStart = dayStart(now)
      const todayEnd = dayEnd(now)

      const [overdueCount, todayCount, totalAssigned] = await Promise.all([
        prisma.enrollment.count({ where: { dueAt: { lt: todayStart }, status: { not: 'COMPLETED' } } }),
        prisma.enrollment.count({ where: { dueAt: { gte: todayStart, lte: todayEnd }, status: { not: 'COMPLETED' } } }),
        prisma.enrollment.count({ where: { dueAt: { not: null } } })
      ])

      res.json({ overdueCount, todayCount, totalAssigned })
    } catch (e) {
      if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
      res.status(500).json({ error: 'Failed to fetch summary' })
    }
  }
)

// ─── POST /api/assignments/bulk ──────────────────────────────────────────
// Assign a module to an entire department and/or role
const BulkAssignSchema = z.object({
  moduleId:     z.string().min(1),
  departmentId: z.string().uuid().optional(),
  role:         z.nativeEnum(Role).optional(),
  dueAt:        z.string().datetime(),
  note:         z.string().optional()
}).refine(d => d.departmentId || d.role, {
  message: 'Spécifiez au moins un filtre: département ou rôle.'
})

router.post('/bulk',
  authorize('PLATFORM_MANAGER', 'HR'),
  validate(BulkAssignSchema),
  async (req, res) => {
    try {
      const { moduleId, departmentId, role, dueAt, note } = req.body as z.infer<typeof BulkAssignSchema>
      const dueDate = new Date(dueAt)

      // Build user filter
      const userWhere: Record<string, unknown> = { isActive: true }
      if (departmentId) userWhere.departmentId = departmentId
      if (role) userWhere.role = role

      const users = await prisma.user.findMany({
        where: userWhere,
        select: { id: true }
      })

      if (users.length === 0) {
        return res.status(404).json({ error: 'Aucun utilisateur trouvé pour ces critères.' })
      }

      // Bulk upsert enrollments
      const results = await Promise.all(
        users.map(u =>
          prisma.enrollment.upsert({
            where: { userId_moduleId: { userId: u.id, moduleId } },
            create: {
              tenantId: getTenantId(),
              userId: u.id,
              moduleId,
              dueAt: dueDate,
              status: 'IN_PROGRESS',
              startedAt: new Date()
            },
            update: { dueAt: dueDate }
          })
        )
      )

      // Notify all users
      const mod = await prisma.module.findUnique({ where: { id: moduleId }, select: { title: true } })
      const moduleTitle = mod?.title || 'Formation assignée'
      await Promise.all(
        users.map(u =>
          NotificationService.sendAssignmentReminder(u.id, moduleTitle, dueDate).catch(() => {})
        )
      )

      res.status(201).json({
        assigned: results.length,
        dueAt: dueDate,
        filters: { departmentId, role }
      })
    } catch (err) {
      logger.error('Bulk assign error:', err)
      res.status(500).json({ error: 'Échec de l\'assignation en masse' })
    }
  }
)

export default router
