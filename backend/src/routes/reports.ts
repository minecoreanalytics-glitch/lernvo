import { Router, Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { authenticate, authorize } from '../middleware/auth'
import { logger } from '../utils/logger'

const router = Router()
router.use(authenticate)
router.use(authorize('PLATFORM_MANAGER', 'HR'))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function csvRow(values: (string | number | null | undefined)[]): string {
  return values.map(v => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }).join(',')
}

function setCSVHeaders(res: Response, filename: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
}

function parseDateFilters(req: Request) {
  const department = req.query.department as string | undefined
  const from = req.query.from ? new Date(req.query.from as string) : undefined
  const to = req.query.to ? new Date(req.query.to as string) : undefined
  return { department, from, to }
}

// ─── GET /api/reports/users ───────────────────────────────────────────────────
router.get('/users', async (req: Request, res: Response) => {
  try {
    const { department } = parseDateFilters(req)

    const where: Record<string, unknown> = {}
    if (department) where.departmentId = department

    const users = await prisma.user.findMany({
      where,
      include: {
        department: { select: { name: true } },
        enrollments: { select: { status: true } },
      },
      orderBy: { lastName: 'asc' },
    })

    const headers = ['firstName', 'lastName', 'email', 'role', 'department', 'modulesCompleted', 'modulesInProgress', 'totalPoints', 'currentStreak', 'lastLoginAt']

    setCSVHeaders(res, `report-users-${Date.now()}.csv`)
    res.write(csvRow(headers) + '\n')

    for (const u of users) {
      const completed = u.enrollments.filter(e => e.status === 'COMPLETED').length
      const inProgress = u.enrollments.filter(e => e.status === 'IN_PROGRESS').length
      res.write(csvRow([
        u.firstName,
        u.lastName,
        u.email,
        u.role,
        u.department?.name ?? '',
        completed,
        inProgress,
        u.totalPoints,
        u.currentStreak,
        u.lastLoginAt ? u.lastLoginAt.toISOString() : '',
      ]) + '\n')
    }

    res.end()
  } catch (err) {
    logger.error('Reports users error:', err)
    res.status(500).json({ error: 'Failed to generate users report' })
  }
})

// ─── GET /api/reports/departments ─────────────────────────────────────────────
router.get('/departments', async (req: Request, res: Response) => {
  try {
    const now = new Date()

    const where: Record<string, unknown> = { parentId: { not: null } }

    const departments = await prisma.department.findMany({
      where,
      include: {
        users: {
          where: { isActive: true },
          include: {
            enrollments: {
              include: { module: { select: { id: true } } },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const headers = ['department', 'totalUsers', 'avgProgress', 'completedModules', 'overdueAssignments']

    setCSVHeaders(res, `report-departments-${Date.now()}.csv`)
    res.write(csvRow(headers) + '\n')

    for (const dept of departments) {
      const totalUsers = dept.users.length
      const allEnrollments = dept.users.flatMap(u => u.enrollments)
      const avgProgress = allEnrollments.length > 0
        ? Math.round(allEnrollments.reduce((sum, e) => sum + e.progressPct, 0) / allEnrollments.length)
        : 0
      const completedModules = allEnrollments.filter(e => e.status === 'COMPLETED').length
      const overdueAssignments = allEnrollments.filter(e => e.dueAt && e.dueAt < now && e.status !== 'COMPLETED').length

      res.write(csvRow([
        dept.name,
        totalUsers,
        avgProgress,
        completedModules,
        overdueAssignments,
      ]) + '\n')
    }

    res.end()
  } catch (err) {
    logger.error('Reports departments error:', err)
    res.status(500).json({ error: 'Failed to generate departments report' })
  }
})

// ─── GET /api/reports/modules ─────────────────────────────────────────────────
router.get('/modules', async (req: Request, res: Response) => {
  try {
    const where: Record<string, unknown> = {}

    const modules = await prisma.module.findMany({
      where,
      include: {
        category: { select: { name: true } },
        enrollments: { select: { status: true, score: true } },
      },
      orderBy: { title: 'asc' },
    })

    const headers = ['moduleTitle', 'category', 'enrollments', 'completions', 'avgScore', 'avgTimeMinutes']

    setCSVHeaders(res, `report-modules-${Date.now()}.csv`)
    res.write(csvRow(headers) + '\n')

    for (const m of modules) {
      const enrollments = m.enrollments.length
      const completions = m.enrollments.filter(e => e.status === 'COMPLETED').length
      const scores = m.enrollments.filter(e => e.score !== null).map(e => e.score as number)
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

      res.write(csvRow([
        m.title,
        m.category?.name ?? '',
        enrollments,
        completions,
        avgScore,
        m.estimatedMinutes,
      ]) + '\n')
    }

    res.end()
  } catch (err) {
    logger.error('Reports modules error:', err)
    res.status(500).json({ error: 'Failed to generate modules report' })
  }
})

// ─── GET /api/reports/activity ────────────────────────────────────────────────
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const { from, to } = parseDateFilters(req)

    const where: Record<string, unknown> = {}
    const dateFilter: Record<string, Date> = {}
    if (from) dateFilter.gte = from
    if (to) dateFilter.lte = to
    if (Object.keys(dateFilter).length > 0) where.completedAt = dateFilter

    const attempts = await prisma.quizAttempt.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true } },
        quiz: { select: { title: true, module: { select: { title: true } } } },
      },
      orderBy: { startedAt: 'desc' },
      take: 500,
    })

    const headers = ['date', 'user', 'action', 'module', 'score']

    setCSVHeaders(res, `report-activity-${Date.now()}.csv`)
    res.write(csvRow(headers) + '\n')

    for (const a of attempts) {
      res.write(csvRow([
        a.startedAt.toISOString().split('T')[0],
        `${a.user.firstName} ${a.user.lastName}`,
        a.passed ? 'Quiz reussi' : 'Quiz echoue',
        a.quiz.module?.title ?? a.quiz.title,
        Math.round(a.score),
      ]) + '\n')
    }

    res.end()
  } catch (err) {
    logger.error('Reports activity error:', err)
    res.status(500).json({ error: 'Failed to generate activity report' })
  }
})

// ─── GET /api/reports/team-progress ──────────────────────────────────────────
// JSON endpoint: team progress per module (for manager dashboard)
router.get('/team-progress', async (req: Request, res: Response) => {
  try {
    const { department } = parseDateFilters(req)

    // If manager/supervisor, scope to their team
    const isAdmin = ['PLATFORM_MANAGER', 'HR'].includes(req.user!.role)
    let userWhere: Record<string, unknown> = { isActive: true }

    if (!isAdmin) {
      // Manager sees their direct reports
      userWhere.managerId = req.user!.userId
    } else {
      if (department) userWhere.departmentId = department
    }

    const users = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        totalPoints: true,
        currentStreak: true,
        lastLoginAt: true,
        department: { select: { name: true } },
        enrollments: {
          include: {
            module: { select: { id: true, title: true, estimatedMinutes: true } }
          }
        }
      },
      orderBy: { lastName: 'asc' }
    })

    const now = new Date()
    const teamProgress = users.map(u => {
      const completed = u.enrollments.filter(e => e.status === 'COMPLETED').length
      const inProgress = u.enrollments.filter(e => e.status === 'IN_PROGRESS').length
      const overdue = u.enrollments.filter(e => e.dueAt && e.dueAt < now && e.status !== 'COMPLETED').length
      const avgProgress = u.enrollments.length > 0
        ? Math.round(u.enrollments.reduce((sum, e) => sum + e.progressPct, 0) / u.enrollments.length)
        : 0

      return {
        userId: u.id,
        name: `${u.firstName} ${u.lastName}`,
        role: u.role,
        department: u.department?.name ?? '',
        points: u.totalPoints,
        streak: u.currentStreak,
        lastLogin: u.lastLoginAt,
        stats: { completed, inProgress, overdue, total: u.enrollments.length, avgProgress },
        modules: u.enrollments.map(e => ({
          id: e.module.id,
          title: e.module.title,
          status: e.status,
          progress: e.progressPct,
          dueAt: e.dueAt,
          isOverdue: e.dueAt ? e.dueAt < now && e.status !== 'COMPLETED' : false
        }))
      }
    })

    // Summary stats
    const totalUsers = teamProgress.length
    const totalCompleted = teamProgress.reduce((s, u) => s + u.stats.completed, 0)
    const totalOverdue = teamProgress.reduce((s, u) => s + u.stats.overdue, 0)
    const avgProgress = teamProgress.length > 0
      ? Math.round(teamProgress.reduce((s, u) => s + u.stats.avgProgress, 0) / teamProgress.length)
      : 0

    res.json({
      summary: { totalUsers, totalCompleted, totalOverdue, avgProgress },
      team: teamProgress
    })
  } catch (err) {
    logger.error('Team progress error:', err)
    res.status(500).json({ error: 'Failed to fetch team progress' })
  }
})

// ─── GET /api/reports/module-analytics/:id ──────────────────────────────────
// JSON endpoint: detailed analytics for a specific module
router.get('/module-analytics/:id', async (req: Request, res: Response) => {
  try {
    const moduleId = req.params.id

    const [module, enrollments, quizAttempts] = await Promise.all([
      prisma.module.findUnique({
        where: { id: moduleId },
        select: { id: true, title: true, estimatedMinutes: true, createdAt: true }
      }),
      prisma.enrollment.findMany({
        where: { moduleId },
        include: {
          user: { select: { firstName: true, lastName: true, department: { select: { name: true } } } }
        }
      }),
      prisma.quizAttempt.findMany({
        where: { quiz: { moduleId } },
        select: { score: true, passed: true, timeTaken: true }
      })
    ])

    if (!module) return res.status(404).json({ error: 'Module not found' })

    const completed = enrollments.filter(e => e.status === 'COMPLETED').length
    const inProgress = enrollments.filter(e => e.status === 'IN_PROGRESS').length
    const notStarted = enrollments.filter(e => e.status === 'NOT_STARTED').length
    const avgScore = quizAttempts.length > 0
      ? Math.round(quizAttempts.reduce((s, a) => s + a.score, 0) / quizAttempts.length)
      : 0
    const passRate = quizAttempts.length > 0
      ? Math.round((quizAttempts.filter(a => a.passed).length / quizAttempts.length) * 100)
      : 0

    res.json({
      module,
      stats: {
        totalEnrolled: enrollments.length,
        completed, inProgress, notStarted,
        completionRate: enrollments.length > 0 ? Math.round((completed / enrollments.length) * 100) : 0,
        avgScore,
        passRate,
        totalQuizAttempts: quizAttempts.length
      },
      enrollments: enrollments.map(e => ({
        user: `${e.user.firstName} ${e.user.lastName}`,
        department: e.user.department?.name ?? '',
        status: e.status,
        progress: e.progressPct,
        dueAt: e.dueAt,
        completedAt: e.completedAt
      }))
    })
  } catch (err) {
    logger.error('Module analytics error:', err)
    res.status(500).json({ error: 'Failed to fetch module analytics' })
  }
})

export default router
