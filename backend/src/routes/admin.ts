import { Router } from 'express'
import { prisma } from '../utils/prisma'
import { authenticate, authorize } from '../middleware/auth'
import { logger } from '../utils/logger'

const router = Router()
router.use(authenticate)
router.use(authorize('PLATFORM_MANAGER', 'HR', 'MANAGER', 'SUPERVISOR'))

// ─── GET /api/admin/stats ────────────────────────────────────────────────────
// Platform-wide KPIs for admin dashboard
router.get('/stats', async (_req, res) => {
  try {
    const now = new Date()
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
      totalUsers,
      activeUsers,
      totalModules,
      publishedModules,
      totalEnrollments,
      completedEnrollments,
      overdueEnrollments,
      todayDue,
      totalQuizAttempts,
      passedQuizAttempts,
      recentLogins,
      totalPoints,
      totalBadgesEarned,
      departmentCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.module.count(),
      prisma.module.count({ where: { isPublished: true } }),
      prisma.enrollment.count(),
      prisma.enrollment.count({ where: { status: 'COMPLETED' } }),
      prisma.enrollment.count({ where: { dueAt: { lt: todayStart }, status: { not: 'COMPLETED' } } }),
      prisma.enrollment.count({ where: { dueAt: { gte: todayStart, lte: todayEnd }, status: { not: 'COMPLETED' } } }),
      prisma.quizAttempt.count(),
      prisma.quizAttempt.count({ where: { passed: true } }),
      prisma.user.count({ where: { lastLoginAt: { gte: weekAgo } } }),
      prisma.pointTransaction.aggregate({ _sum: { points: true } }),
      prisma.userBadge.count(),
      prisma.department.count({ where: { parentId: { not: null } } }),
    ])

    // Completion rate
    const completionRate = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0
    const quizPassRate = totalQuizAttempts > 0 ? Math.round((passedQuizAttempts / totalQuizAttempts) * 100) : 0

    // Top 5 users by points
    const topUsers = await prisma.user.findMany({
      where: { isActive: true },
      orderBy: { totalPoints: 'desc' },
      take: 5,
      select: {
        id: true, firstName: true, lastName: true, totalPoints: true, currentStreak: true,
        department: { select: { name: true, icon: true } }
      }
    })

    // Enrollments by status
    const enrollmentsByStatus = await prisma.enrollment.groupBy({
      by: ['status'],
      _count: true
    })

    // Recent completions (last 7 days)
    const recentCompletions = await prisma.enrollment.count({
      where: { status: 'COMPLETED', completedAt: { gte: weekAgo } }
    })

    // Department stats (enrollments per department) — use count instead of fetching all users
    const departmentStats = await prisma.department.findMany({
      where: { parentId: { not: null } },
      select: {
        id: true, name: true, icon: true, color: true,
        _count: { select: { users: { where: { isActive: true } } } }
      },
      orderBy: { order: 'asc' },
      take: 50
    })

    const deptWithCounts = departmentStats.map(d => ({
      id: d.id,
      name: d.name,
      icon: d.icon,
      color: d.color,
      userCount: d._count.users
    }))

    // Recent activity (last 10 enrollments)
    const recentActivity = await prisma.enrollment.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 10,
      include: {
        user: { select: { firstName: true, lastName: true } },
        module: { select: { title: true } }
      }
    })

    res.json({
      overview: {
        totalUsers,
        activeUsers,
        totalModules,
        publishedModules,
        departmentCount,
        recentLogins,
      },
      training: {
        totalEnrollments,
        completedEnrollments,
        completionRate,
        overdueEnrollments,
        todayDue,
        recentCompletions,
      },
      quizzes: {
        totalAttempts: totalQuizAttempts,
        passRate: quizPassRate,
      },
      gamification: {
        totalPointsAwarded: totalPoints._sum.points ?? 0,
        totalBadgesEarned,
      },
      enrollmentsByStatus: enrollmentsByStatus.map(e => ({ status: e.status, count: e._count })),
      topUsers,
      departments: deptWithCounts,
      recentActivity: recentActivity.map(a => ({
        id: a.id,
        userName: `${a.user.firstName} ${a.user.lastName}`,
        moduleTitle: a.module.title,
        status: a.status,
        progressPct: a.progressPct,
        updatedAt: a.updatedAt,
      }))
    })
  } catch (err) {
    logger.error('Admin stats error:', err)
    res.status(500).json({ error: 'Failed to fetch admin stats' })
  }
})

export default router
