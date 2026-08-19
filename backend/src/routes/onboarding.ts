/**
 * Onboarding Routes
 * Manages onboarding plans (CRUD), AI plan generation, progress tracking.
 *
 * POST /api/onboarding/plans/generate    — AI generates a full onboarding plan + modules
 * GET  /api/onboarding/plans             — list all plans
 * GET  /api/onboarding/plans/:id         — get plan details
 * POST /api/onboarding/plans             — create plan manually
 * PUT  /api/onboarding/plans/:id         — update plan
 * DELETE /api/onboarding/plans/:id       — delete plan
 * GET  /api/onboarding/my                — employee sees their onboarding
 * GET  /api/onboarding/team              — manager sees team onboarding
 * GET  /api/onboarding/stats             — admin dashboard stats
 * POST /api/onboarding/check-overdue     — trigger overdue check
 */

import { Router } from 'express'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { prisma } from '../utils/prisma'
import { getTenantId } from '../utils/tenantContext'
import { authenticate, authorize } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { AIService } from '../services/ai'
import { OnboardingService } from '../services/onboarding'
import { logger } from '../utils/logger'

const router = Router()
router.use(authenticate)

// ─── Schemas ────────────────────────────────────────────────────────────────

const CreatePlanSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  role: z.nativeEnum(Role),
  departmentId: z.string().uuid().optional(),
  expectedDays: z.number().int().min(1).default(30),
  modules: z.array(z.object({
    moduleId: z.string().uuid(),
    dueDaysFromHire: z.number().int().min(1),
    order: z.number().int().default(0),
    isRequired: z.boolean().default(true),
    phase: z.string().optional()
  })).optional()
})

const GeneratePlanSchema = z.object({
  role: z.nativeEnum(Role),
  departmentId: z.string().uuid().optional(),
  durationDays: z.number().int().min(7).max(90).default(30),
  companyContext: z.string().optional(),
  autoCreateModules: z.boolean().default(true) // AI generates module content too
})

// ─── AI Plan Generation ─────────────────────────────────────────────────────

/**
 * POST /api/onboarding/plans/generate
 * AI generates a complete onboarding plan with modules and content.
 * This is the "zero HR effort" endpoint: one click, entire onboarding ready.
 */
router.post('/plans/generate',
  authorize('PLATFORM_MANAGER', 'HR'),
  validate(GeneratePlanSchema),
  async (req, res) => {
    try {
      if (!AIService.isConfigured()) {
        return res.status(503).json({ error: 'AI service not configured' })
      }

      const { role, departmentId, durationDays, companyContext, autoCreateModules } = req.body

      // Get department name for AI context
      let departmentName: string | undefined
      if (departmentId) {
        const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } })
        departmentName = dept?.name
      }

      // Step 1: AI generates the onboarding plan structure
      logger.info(`Generating onboarding plan: role=${role}, dept=${departmentName}, days=${durationDays}`)
      const aiPlan = await AIService.generateOnboardingPlan({
        role,
        department: departmentName,
        companyContext,
        durationDays
      })

      // Step 2: Create actual modules if autoCreateModules is true
      const createdModules: Array<{
        moduleId: string
        title: string
        dueDaysFromHire: number
        order: number
        phase: string
      }> = []

      if (autoCreateModules) {
        for (const mod of aiPlan.modules) {
          // Generate full module content with AI
          const generated = await AIService.generateModule(mod.title, {
            difficulty: mod.difficulty,
            numSections: mod.difficulty === 'beginner' ? 3 : 4,
            numQuestions: mod.difficulty === 'beginner' ? 5 : 8,
            purpose: mod.purpose,
            format: 'Texte',
            context: companyContext
          })

          // Create module in DB
          const dbModule = await prisma.module.create({
            data: {
              title: generated.module.title,
              description: generated.module.description || mod.description,
              departmentId,
              estimatedMinutes: generated.module.estimatedMinutes,
              isPublished: true, // auto-publish for onboarding
              requiredRoles: [role],
              tenantId: getTenantId(),
              createdById: req.user!.userId
            }
          })

          // Create content sections
          for (const section of generated.module.sections) {
            await prisma.content.create({
              data: {
                moduleId: dbModule.id,
                title: section.title,
                type: 'TEXT',
                body: section.body,
                order: section.order,
                isRequired: true,
                createdById: req.user!.userId
              }
            })
          }

          // Create quiz
          const quiz = await prisma.quiz.create({
            data: {
              moduleId: dbModule.id,
              title: generated.quiz.title,
              description: generated.quiz.description,
              timeLimit: generated.quiz.timeLimit,
              passingScore: generated.quiz.passingScore,
              status: 'PUBLISHED'
            }
          })

          // Create questions
          for (const q of generated.quiz.questions) {
            await prisma.question.create({
              data: {
                quizId: quiz.id,
                text: q.text,
                options: q.options,
                explanation: q.explanation,
                difficulty: q.difficulty,
                points: q.points,
                order: q.order
              }
            })
          }

          createdModules.push({
            moduleId: dbModule.id,
            title: dbModule.title,
            dueDaysFromHire: mod.dueDaysFromHire,
            order: mod.order,
            phase: mod.phase
          })
        }
      }

      // Step 3: Create the onboarding plan
      const plan = await prisma.onboardingPlan.create({
        data: {
          name: aiPlan.name,
          description: aiPlan.description,
          role,
          departmentId,
          isActive: true,
          isAiGenerated: true,
          expectedDays: aiPlan.expectedDays,
          tenantId: getTenantId(),
          modules: autoCreateModules ? {
            create: createdModules.map(m => ({
              moduleId: m.moduleId,
              dueDaysFromHire: m.dueDaysFromHire,
              order: m.order,
              isRequired: true,
              phase: m.phase
            }))
          } : undefined
        },
        include: {
          modules: {
            include: { module: { select: { id: true, title: true } } },
            orderBy: { order: 'asc' }
          }
        }
      })

      logger.info(`Onboarding plan generated: ${plan.id}, ${createdModules.length} modules created`)

      res.status(201).json({
        plan,
        modulesGenerated: createdModules.length,
        message: `Plan d'onboarding créé avec ${createdModules.length} modules de formation`
      })
    } catch (err) {
      logger.error('Onboarding plan generation error:', err)
      res.status(500).json({ error: 'Failed to generate onboarding plan' })
    }
  }
)

// ─── CRUD Plans ─────────────────────────────────────────────────────────────

// GET /api/onboarding/plans
router.get('/plans', authorize('PLATFORM_MANAGER', 'HR'), async (_req, res) => {
  try {
    const plans = await prisma.onboardingPlan.findMany({
      include: {
        department: { select: { id: true, name: true, icon: true } },
        _count: { select: { modules: true, userOnboardings: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json(plans)
  } catch {
    res.status(500).json({ error: 'Failed to fetch onboarding plans' })
  }
})

// GET /api/onboarding/plans/:id
router.get('/plans/:id', authorize('PLATFORM_MANAGER', 'HR'), async (req, res) => {
  try {
    const plan = await prisma.onboardingPlan.findUnique({
      where: { id: req.params.id },
      include: {
        department: true,
        modules: {
          include: { module: { select: { id: true, title: true, estimatedMinutes: true, isPublished: true } } },
          orderBy: { order: 'asc' }
        },
        userOnboardings: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, hiredAt: true } }
          },
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    })
    if (!plan) return res.status(404).json({ error: 'Plan not found' })
    res.json(plan)
  } catch {
    res.status(500).json({ error: 'Failed to fetch plan' })
  }
})

// POST /api/onboarding/plans (manual creation)
router.post('/plans',
  authorize('PLATFORM_MANAGER', 'HR'),
  validate(CreatePlanSchema),
  async (req, res) => {
    try {
      const { modules, ...planData } = req.body
      const plan = await prisma.onboardingPlan.create({
        data: {
          ...planData,
          modules: modules ? {
            create: modules.map((m: { moduleId: string; dueDaysFromHire: number; order: number; isRequired: boolean; phase?: string }) => ({
              moduleId: m.moduleId,
              dueDaysFromHire: m.dueDaysFromHire,
              order: m.order,
              isRequired: m.isRequired,
              phase: m.phase
            }))
          } : undefined
        },
        include: {
          modules: {
            include: { module: { select: { id: true, title: true } } },
            orderBy: { order: 'asc' }
          }
        }
      })
      res.status(201).json(plan)
    } catch {
      res.status(500).json({ error: 'Failed to create plan' })
    }
  }
)

// PUT /api/onboarding/plans/:id
router.put('/plans/:id',
  authorize('PLATFORM_MANAGER', 'HR'),
  validate(CreatePlanSchema.partial()),
  async (req, res) => {
    try {
      const { modules, ...planData } = req.body

      // Update plan fields
      const plan = await prisma.onboardingPlan.update({
        where: { id: req.params.id },
        data: planData
      })

      // Replace modules if provided
      if (modules) {
        await prisma.onboardingPlanModule.deleteMany({ where: { planId: req.params.id } })
        await prisma.onboardingPlanModule.createMany({
          data: modules.map((m: { moduleId: string; dueDaysFromHire: number; order: number; isRequired: boolean; phase?: string }) => ({
            planId: req.params.id,
            moduleId: m.moduleId,
            dueDaysFromHire: m.dueDaysFromHire,
            order: m.order,
            isRequired: m.isRequired,
            phase: m.phase
          }))
        })
      }

      const updated = await prisma.onboardingPlan.findUnique({
        where: { id: req.params.id },
        include: {
          modules: {
            include: { module: { select: { id: true, title: true } } },
            orderBy: { order: 'asc' }
          }
        }
      })

      res.json(updated)
    } catch {
      res.status(500).json({ error: 'Failed to update plan' })
    }
  }
)

// DELETE /api/onboarding/plans/:id
router.delete('/plans/:id', authorize('PLATFORM_MANAGER'), async (req, res) => {
  try {
    await prisma.onboardingPlan.delete({ where: { id: req.params.id } })
    res.json({ message: 'Plan deleted' })
  } catch {
    res.status(500).json({ error: 'Failed to delete plan' })
  }
})

// ─── Employee View ──────────────────────────────────────────────────────────

// GET /api/onboarding/my — employee sees their onboarding progress
router.get('/my', async (req, res) => {
  try {
    const onboardings = await prisma.userOnboarding.findMany({
      where: { userId: req.user!.userId },
      include: {
        plan: {
          include: {
            modules: {
              include: { module: { select: { id: true, title: true, estimatedMinutes: true, thumbnail: true } } },
              orderBy: { order: 'asc' }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (onboardings.length === 0) {
      return res.json({ onboarding: null })
    }

    // Get enrollment status for each module
    const active = onboardings[0] // most recent
    const moduleIds = active.plan.modules.map(m => m.moduleId)
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: req.user!.userId, moduleId: { in: moduleIds } },
      select: { moduleId: true, status: true, progressPct: true, dueAt: true }
    })

    const enrollmentMap = new Map(enrollments.map(e => [e.moduleId, e]))

    // Group by phase
    const phases = new Map<string, Array<{
      module: { id: string; title: string; estimatedMinutes: number; thumbnail: string | null }
      dueDaysFromHire: number
      isRequired: boolean
      enrollment: { status: string; progressPct: number; dueAt: Date | null } | null
    }>>()

    for (const pm of active.plan.modules) {
      const phase = pm.phase || 'Général'
      if (!phases.has(phase)) phases.set(phase, [])
      phases.get(phase)!.push({
        module: pm.module,
        dueDaysFromHire: pm.dueDaysFromHire,
        isRequired: pm.isRequired,
        enrollment: enrollmentMap.get(pm.moduleId) || null
      })
    }

    res.json({
      onboarding: {
        id: active.id,
        status: active.status,
        progressPct: active.progressPct,
        startedAt: active.startedAt,
        expectedEndAt: active.expectedEndAt,
        completedAt: active.completedAt,
        plan: {
          id: active.plan.id,
          name: active.plan.name,
          description: active.plan.description,
          expectedDays: active.plan.expectedDays
        },
        phases: Object.fromEntries(phases)
      }
    })
  } catch {
    res.status(500).json({ error: 'Failed to fetch onboarding' })
  }
})

// ─── Manager / Admin Views ──────────────────────────────────────────────────

// GET /api/onboarding/team — manager sees their direct reports' onboarding
router.get('/team',
  authorize('PLATFORM_MANAGER', 'HR', 'MANAGER', 'SUPERVISOR'),
  async (req, res) => {
    try {
      const where: Record<string, unknown> = {}

      // Managers only see their direct reports
      if (req.user!.role === 'MANAGER' || req.user!.role === 'SUPERVISOR') {
        const directReportIds = await prisma.user.findMany({
          where: { managerId: req.user!.userId, isActive: true },
          select: { id: true }
        })
        where.userId = { in: directReportIds.map(u => u.id) }
      }

      const onboardings = await prisma.userOnboarding.findMany({
        where,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true, hiredAt: true,
              department: { select: { name: true, icon: true } }
            }
          },
          plan: { select: { id: true, name: true, expectedDays: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      })

      res.json(onboardings)
    } catch {
      res.status(500).json({ error: 'Failed to fetch team onboarding' })
    }
  }
)

// GET /api/onboarding/stats — admin dashboard
router.get('/stats',
  authorize('PLATFORM_MANAGER', 'HR'),
  async (_req, res) => {
    try {
      const [total, inProgress, completed, overdue, avgProgress] = await Promise.all([
        prisma.userOnboarding.count(),
        prisma.userOnboarding.count({ where: { status: 'IN_PROGRESS' } }),
        prisma.userOnboarding.count({ where: { status: 'COMPLETED' } }),
        prisma.userOnboarding.count({ where: { status: 'OVERDUE' } }),
        prisma.userOnboarding.aggregate({ _avg: { progressPct: true } })
      ])

      const activePlans = await prisma.onboardingPlan.count({ where: { isActive: true } })

      res.json({
        totalOnboardings: total,
        inProgress,
        completed,
        overdue,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        averageProgress: Math.round(avgProgress._avg.progressPct ?? 0),
        activePlans
      })
    } catch {
      res.status(500).json({ error: 'Failed to fetch onboarding stats' })
    }
  }
)

// POST /api/onboarding/check-overdue — trigger overdue check (can be called by cron)
router.post('/check-overdue',
  authorize('PLATFORM_MANAGER', 'HR'),
  async (_req, res) => {
    try {
      const result = await OnboardingService.checkOverdue()
      res.json(result)
    } catch {
      res.status(500).json({ error: 'Failed to check overdue' })
    }
  }
)

export default router
