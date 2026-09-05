import { prisma } from '../utils/prisma'
import { getTenantId } from '../utils/tenantContext'
import { redis } from '../utils/redis'
import { BadgeType } from '@prisma/client'

export const GamificationService = {
  async awardPoints(userId: string, points: number, reason: string, referenceId?: string) {
    if (points <= 0) return

    await prisma.$transaction([
      prisma.pointTransaction.create({ data: { tenantId: getTenantId(), userId, points, reason, referenceId } }),
      prisma.user.update({ where: { id: userId }, data: { totalPoints: { increment: points } } })
    ])

    // Invalidate leaderboard cache
    // invalidate every cached leaderboard variant of this tenant
    if (redis.status === 'ready') {
      try { const keys = await redis.keys(`leaderboard:${getTenantId()}:*`); if (keys.length) await redis.del(...keys) } catch { /* cache only */ }
    }

    // Check badge conditions
    await this.checkAndAwardBadges(userId, reason)
  },

  async updateStreak(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return

    const now = new Date()
    const lastActivity = user.lastActivityAt
    let newStreak = user.currentStreak

    if (!lastActivity) {
      newStreak = 1
    } else {
      const hoursSince = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60)
      if (hoursSince < 24) {
        // Same day, no streak change
      } else if (hoursSince < 48) {
        // Next day, increment streak
        newStreak = user.currentStreak + 1
      } else {
        // Streak broken
        newStreak = 1
      }
    }

    const longestStreak = Math.max(newStreak, user.longestStreak)

    await prisma.user.update({
      where: { id: userId },
      data: { currentStreak: newStreak, longestStreak, lastActivityAt: now }
    })

    // Award streak bonus points
    if (newStreak >= 7 && newStreak % 7 === 0) {
      const bonusPoints = Math.min(newStreak * 5, 100)
      await this.awardPoints(userId, bonusPoints, 'streak_bonus')
    }

    return newStreak
  },

  async checkAndAwardBadges(userId: string, reason: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { userBadges: { select: { badgeId: true } } }
    })
    if (!user) return

    const earnedBadgeIds = new Set(user.userBadges.map(b => b.badgeId))
    const badges = await prisma.badge.findMany()

    for (const badge of badges) {
      if (earnedBadgeIds.has(badge.id)) continue

      const condition = badge.condition as Record<string, unknown>
      let earned = false

      switch (badge.type) {
        case 'STREAK' as BadgeType:
          earned = user.currentStreak >= (condition.threshold as number)
          break
        case 'COMPLETION' as BadgeType:
          if (reason === 'module_complete') {
            const count = await prisma.enrollment.count({
              where: { userId, status: 'COMPLETED' }
            })
            earned = count >= (condition.threshold as number)
          }
          break
        case 'QUIZ_SCORE' as BadgeType:
          if (reason === 'quiz_completion') {
            const perfect = await prisma.quizAttempt.count({
              where: { userId, score: { gte: condition.minScore as number } }
            })
            earned = perfect >= (condition.threshold as number)
          }
          break
        case 'FIRST_LOGIN' as BadgeType:
          earned = reason === 'first_login'
          break
      }

      if (earned) {
        await prisma.userBadge.create({ data: { tenantId: getTenantId(), userId, badgeId: badge.id } })
        await this.awardPoints(userId, badge.points, `badge_${badge.id}`)
        await prisma.notification.create({
          data: {
            tenantId: getTenantId(),
            userId,
            title: `Badge unlocked: ${badge.name}!`,
            body: badge.description,
            type: 'badge',
            link: `/profile#badges`
          }
        })
      }
    }
  },

  async getLeaderboard(limit = 20, departmentId?: string) {
    const cacheKey = `leaderboard:${getTenantId()}:${departmentId || 'all'}:${limit}`
    // Redis is an optional cache. Never queue a learner request during a reconnect.
    if (redis.status === 'ready') {
      try {
        const cached = await redis.get(cacheKey)
        if (cached) return JSON.parse(cached)
      } catch { /* fall through to the authoritative database */ }
    }

    const where: Record<string, unknown> = { isActive: true }
    if (departmentId) {
      // Include parent dept + all children
      const children = await prisma.department.findMany({ where: { parentId: departmentId }, select: { id: true } })
      const grandchildren = await prisma.department.findMany({ where: { parentId: { in: children.map(c => c.id) } }, select: { id: true } })
      const deptIds = [departmentId, ...children.map(c => c.id), ...grandchildren.map(c => c.id)]
      where.departmentId = { in: deptIds }
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, firstName: true, lastName: true, avatarUrl: true,
        role: true, totalPoints: true, currentStreak: true,
        department: { select: { name: true } }
      },
      orderBy: { totalPoints: 'desc' },
      take: limit
    })

    const leaderboard = users.map((u, i) => ({ rank: i + 1, ...u }))
    if (redis.status === 'ready') {
      try { await redis.setex(cacheKey, 60, JSON.stringify(leaderboard)) } catch { /* cache only */ }
    }
    return leaderboard
  }
}
