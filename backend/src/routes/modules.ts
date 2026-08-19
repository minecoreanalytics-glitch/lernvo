import { Router } from 'express'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { prisma } from '../utils/prisma'
import { getTenantId } from '../utils/tenantContext'
import { authenticate, authorize } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()
router.use(authenticate)

const ModuleSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  prerequisiteId: z.string().uuid().nullable().optional(),
  thumbnail: z.string().optional(),
  estimatedMinutes: z.number().int().min(1).default(15),
  order: z.number().int().default(0),
  isPublished: z.boolean().default(false),
  requiredRoles: z.array(z.nativeEnum(Role)).default([])
})

// GET /api/modules
router.get('/', async (req, res) => {
  try {
    const { category, department, search, page = '1', limit = '20' } = req.query as Record<string, string>
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where: Record<string, unknown> = {}
    if (category) where.categoryId = category
    if (department) where.departmentId = department
    if (search) where.title = { contains: search, mode: 'insensitive' }

    const isAdmin = ['PLATFORM_MANAGER', 'HR'].includes(req.user!.role)
    const isAgent = req.user!.role === 'AGENT'

    if (isAgent) {
      // Agents only see modules they've been enrolled in
      const enrollments = await prisma.enrollment.findMany({
        where: { userId: req.user!.userId },
        select: { moduleId: true }
      })
      where.isPublished = true
      where.id = { in: enrollments.map(e => e.moduleId) }
    } else if (!isAdmin) {
      // Managers/Supervisors see published modules for their dept + general modules
      where.isPublished = true

      if (!department) {
        const userDeptId = req.user!.departmentId
        const roleFilter = { OR: [
          { requiredRoles: { equals: null } },
          { requiredRoles: { isEmpty: true } },
          { requiredRoles: { has: req.user!.role as Role } }
        ]}

        if (userDeptId) {
          const childDepts = await prisma.department.findMany({ where: { parentId: userDeptId }, select: { id: true } })
          const deptIds = [userDeptId, ...childDepts.map(d => d.id)]
          where.AND = [
            roleFilter,
            { OR: [
              { departmentId: null },
              { departmentId: { in: deptIds } }
            ]}
          ]
        } else {
          where.AND = [roleFilter]
        }
      } else {
        where.AND = [{ OR: [
          { requiredRoles: { equals: null } },
          { requiredRoles: { isEmpty: true } },
          { requiredRoles: { has: req.user!.role as Role } }
        ]}]
      }
    }

    const [modules, total] = await Promise.all([
      prisma.module.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, color: true, icon: true } },
          _count: { select: { contents: true, enrollments: true } }
        },
        skip, take: parseInt(limit), orderBy: [{ order: 'asc' }, { createdAt: 'desc' }]
      }),
      prisma.module.count({ where })
    ])

    // Attach current user's enrollment status to each module
    const moduleIds = modules.map(m => m.id)
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: req.user!.userId, moduleId: { in: moduleIds } },
      select: { moduleId: true, status: true, progressPct: true, dueAt: true }
    })
    const enrollMap = new Map(enrollments.map(e => [e.moduleId, e]))

    const enriched = modules.map(m => ({
      ...m,
      userEnrollment: enrollMap.get(m.id) || null
    }))

    res.json({ modules: enriched, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) })
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to fetch modules' })
  }
})

// GET /api/modules/:id
router.get('/:id', async (req, res) => {
  try {
    const module = await prisma.module.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        contents: { orderBy: { order: 'asc' } },
        quizzes: { select: { id: true, title: true, passingScore: true, timeLimit: true, status: true } },
        prerequisite: { select: { id: true, title: true } },
        _count: { select: { enrollments: true, feedbacks: true } }
      }
    })
    if (!module) return res.status(404).json({ error: 'Module not found' })

    // Attach user's enrollment/progress if exists
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_moduleId: { userId: req.user!.userId, moduleId: req.params.id } }
    })

    // Check prerequisite completion
    let prerequisiteMet = true
    if (module.prerequisiteId) {
      const prereqEnrollment = await prisma.enrollment.findUnique({
        where: { userId_moduleId: { userId: req.user!.userId, moduleId: module.prerequisiteId } }
      })
      prerequisiteMet = prereqEnrollment?.status === 'COMPLETED'
    }

    // Compute average rating
    const ratingAgg = await prisma.moduleFeedback.aggregate({
      where: { moduleId: req.params.id },
      _avg: { rating: true },
      _count: { rating: true }
    })

    res.json({
      ...module,
      userEnrollment: enrollment,
      prerequisiteMet,
      averageRating: ratingAgg._avg.rating ?? null,
      feedbackCount: ratingAgg._count.rating
    })
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to fetch module' })
  }
})

// POST /api/modules
router.post('/', authorize('PLATFORM_MANAGER', 'HR'), validate(ModuleSchema), async (req, res) => {
  try {
    const module = await prisma.module.create({
      data: { ...req.body, createdById: req.user!.userId }
    })
    res.status(201).json(module)
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to create module' })
  }
})

// PUT /api/modules/:id
router.put('/:id', authorize('PLATFORM_MANAGER', 'HR'), validate(ModuleSchema.partial()), async (req, res) => {
  try {
    const module = await prisma.module.update({ where: { id: req.params.id }, data: req.body })
    res.json(module)
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to update module' })
  }
})

// DELETE /api/modules/:id
router.delete('/:id', authorize('PLATFORM_MANAGER'), async (req, res) => {
  try {
    await prisma.module.delete({ where: { id: req.params.id } })
    res.json({ message: 'Module deleted' })
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to delete module' })
  }
})

// GET /api/modules/:id/enrollments
router.get('/:id/enrollments', authorize('PLATFORM_MANAGER', 'HR', 'MANAGER', 'SUPERVISOR'), async (req, res) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { moduleId: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            avatarUrl: true,
            department: { select: { name: true, icon: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json(enrollments)
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to fetch enrollments' })
  }
})

// POST /api/modules/:id/enroll
router.post('/:id/enroll', async (req, res) => {
  try {
    const enrollment = await prisma.enrollment.upsert({
      where: { userId_moduleId: { userId: req.user!.userId, moduleId: req.params.id } },
      create: { tenantId: getTenantId(), userId: req.user!.userId, moduleId: req.params.id, status: 'IN_PROGRESS', startedAt: new Date() },
      update: { status: 'IN_PROGRESS', startedAt: new Date() }
    })
    res.json(enrollment)
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to enroll' })
  }
})

// GET /api/modules/:id/feedback
router.get('/:id/feedback', async (req, res) => {
  try {
    const feedbacks = await prisma.moduleFeedback.findMany({
      where: { moduleId: req.params.id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    const ratingAgg = await prisma.moduleFeedback.aggregate({
      where: { moduleId: req.params.id },
      _avg: { rating: true },
      _count: { rating: true }
    })

    res.json({
      feedbacks,
      averageRating: ratingAgg._avg.rating ?? null,
      feedbackCount: ratingAgg._count.rating
    })
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to fetch feedback' })
  }
})

// POST /api/modules/:id/feedback
const FeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional()
})

router.post('/:id/feedback', validate(FeedbackSchema), async (req, res) => {
  try {
    // Verify module exists
    const module = await prisma.module.findUnique({ where: { id: req.params.id } })
    if (!module) return res.status(404).json({ error: 'Module not found' })

    const feedback = await prisma.moduleFeedback.upsert({
      where: {
        moduleId_userId: { moduleId: req.params.id, userId: req.user!.userId }
      },
      create: {
        tenantId: getTenantId(),
        moduleId: req.params.id,
        userId: req.user!.userId,
        rating: req.body.rating,
        comment: req.body.comment
      },
      update: {
        rating: req.body.rating,
        comment: req.body.comment
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } }
      }
    })

    res.status(201).json(feedback)
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to submit feedback' })
  }
})

export default router
