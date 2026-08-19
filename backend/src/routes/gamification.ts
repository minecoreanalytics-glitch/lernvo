import { Router } from 'express'
import { prisma } from '../utils/prisma'
import { authenticate, authorize } from '../middleware/auth'
import { GamificationService } from '../services/gamification'

const router = Router()
router.use(authenticate)

// GET /api/gamification/leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const { department, limit = '20' } = req.query as Record<string, string>
    let deptFilter = department

    // MANAGER/SUPERVISOR: auto-scope to their department
    if (!deptFilter && ['MANAGER', 'SUPERVISOR'].includes(req.user!.role)) {
      const me = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { departmentId: true } })
      if (me?.departmentId) {
        const myDept = await prisma.department.findUnique({ where: { id: me.departmentId }, select: { id: true, parentId: true } })
        deptFilter = myDept?.parentId || me.departmentId
      }
    }

    const leaderboard = await GamificationService.getLeaderboard(parseInt(limit), deptFilter)
    res.json(leaderboard)
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to fetch leaderboard' })
  }
})

// GET /api/gamification/my-stats
router.get('/my-stats', async (req, res) => {
  try {
    const [user, recentPoints, badges] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { totalPoints: true, currentStreak: true, longestStreak: true, lastActivityAt: true }
      }),
      prisma.pointTransaction.findMany({
        where: { userId: req.user!.userId },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.userBadge.findMany({
        where: { userId: req.user!.userId },
        include: { badge: true },
        orderBy: { earnedAt: 'desc' }
      })
    ])

    // Get rank
    const rank = await prisma.user.count({
      where: { totalPoints: { gt: user?.totalPoints || 0 }, isActive: true }
    }) + 1

    res.json({ ...user, rank, recentPoints, badges })
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// GET /api/gamification/badges — all available badges
router.get('/badges', async (_req, res) => {
  try {
    const badges = await prisma.badge.findMany({ orderBy: { points: 'asc' } })
    res.json(badges)
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to fetch badges' })
  }
})

// POST /api/gamification/badges — create badge (admin only)
router.post('/badges', authorize('PLATFORM_MANAGER'), async (req, res) => {
  try {
    const badge = await prisma.badge.create({ data: req.body })
    res.status(201).json(badge)
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to create badge' })
  }
})

// POST /api/gamification/streak — called on daily check-in / any activity
router.post('/streak', async (req, res) => {
  try {
    const streak = await GamificationService.updateStreak(req.user!.userId)
    res.json({ streak })
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to update streak' })
  }
})

export default router
