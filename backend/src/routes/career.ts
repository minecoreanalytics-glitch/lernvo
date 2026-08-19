import { Router } from 'express'
import { z } from 'zod'
import { PathStatus, Role } from '@prisma/client'
import { prisma } from '../utils/prisma'
import { authenticate, authorize } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { GamificationService } from '../services/gamification'

const router = Router()
router.use(authenticate)

const PathSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  targetRole: z.nativeEnum(Role).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  status: z.nativeEnum(PathStatus).default('DRAFT')
})

// GET /api/career/paths
router.get('/paths', async (req, res) => {
  try {
    const { targetRole } = req.query
    const isAdmin = ['PLATFORM_MANAGER', 'HR'].includes(req.user!.role)

    const where: Record<string, unknown> = {}
    if (!isAdmin) where.status = 'ACTIVE'
    if (targetRole) where.targetRole = targetRole

    const paths = await prisma.careerPath.findMany({
      where,
      include: {
        _count: { select: { modules: true, enrollments: true } },
        enrollments: {
          where: { userId: req.user!.userId },
          select: { status: true, progressPct: true }
        }
      },
      orderBy: { title: 'asc' }
    })

    res.json(paths.map(p => ({
      ...p,
      userEnrollment: p.enrollments[0] || null,
      enrollments: undefined
    })))
  } catch {
    res.status(500).json({ error: 'Failed to fetch career paths' })
  }
})

// GET /api/career/paths/:id
router.get('/paths/:id', async (req, res) => {
  try {
    const path = await prisma.careerPath.findUnique({
      where: { id: req.params.id },
      include: {
        modules: {
          include: { module: { include: { _count: { select: { contents: true } } } } },
          orderBy: { order: 'asc' }
        },
        prerequisites: { include: { prerequisite: { select: { id: true, title: true } } } }
      }
    })
    if (!path) return res.status(404).json({ error: 'Career path not found' })

    const enrollment = await prisma.careerPathEnrollment.findUnique({
      where: { userId_pathId: { userId: req.user!.userId, pathId: req.params.id } }
    })

    // Get module completion status for this user
    const moduleIds = path.modules.map(m => m.moduleId)
    const moduleEnrollments = await prisma.enrollment.findMany({
      where: { userId: req.user!.userId, moduleId: { in: moduleIds } },
      select: { moduleId: true, status: true, progressPct: true }
    })
    const moduleMap = Object.fromEntries(moduleEnrollments.map(e => [e.moduleId, e]))

    res.json({
      ...path,
      userEnrollment: enrollment,
      modules: path.modules.map(pm => ({
        ...pm,
        userStatus: moduleMap[pm.moduleId] || null
      }))
    })
  } catch {
    res.status(500).json({ error: 'Failed to fetch career path' })
  }
})

// POST /api/career/paths
router.post('/paths', authorize('PLATFORM_MANAGER', 'HR'), validate(PathSchema), async (req, res) => {
  try {
    const path = await prisma.careerPath.create({ data: req.body })
    res.status(201).json(path)
  } catch {
    res.status(500).json({ error: 'Failed to create career path' })
  }
})

// POST /api/career/paths/:id/modules — add module to path
router.post('/paths/:id/modules', authorize('PLATFORM_MANAGER', 'HR'), async (req, res) => {
  try {
    const { moduleId, order, isRequired } = req.body
    const pm = await prisma.careerPathModule.create({
      data: { pathId: req.params.id, moduleId, order: order || 0, isRequired: isRequired !== false }
    })
    res.status(201).json(pm)
  } catch {
    res.status(500).json({ error: 'Failed to add module to path' })
  }
})

// POST /api/career/paths/:id/enroll
router.post('/paths/:id/enroll', async (req, res) => {
  try {
    const enrollment = await prisma.careerPathEnrollment.upsert({
      where: { userId_pathId: { userId: req.user!.userId, pathId: req.params.id } },
      create: { userId: req.user!.userId, pathId: req.params.id, status: 'IN_PROGRESS', startedAt: new Date() },
      update: { status: 'IN_PROGRESS', startedAt: new Date() }
    })

    // Also enroll in all required modules
    const pathModules = await prisma.careerPathModule.findMany({
      where: { pathId: req.params.id, isRequired: true }
    })
    for (const pm of pathModules) {
      await prisma.enrollment.upsert({
        where: { userId_moduleId: { userId: req.user!.userId, moduleId: pm.moduleId } },
        create: { userId: req.user!.userId, moduleId: pm.moduleId, status: 'NOT_STARTED' },
        update: {}
      })
    }

    res.json(enrollment)
  } catch {
    res.status(500).json({ error: 'Failed to enroll in path' })
  }
})

// GET /api/career/my-paths — enrolled paths with progress
router.get('/my-paths', async (req, res) => {
  try {
    const enrollments = await prisma.careerPathEnrollment.findMany({
      where: { userId: req.user!.userId },
      include: {
        path: {
          include: { _count: { select: { modules: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json(enrollments)
  } catch {
    res.status(500).json({ error: 'Failed to fetch enrolled paths' })
  }
})

export default router
