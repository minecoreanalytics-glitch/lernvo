import { prisma } from '../utils/prisma'
import { getTenantId } from '../utils/tenantContext'
import { ActivityEvent, Prisma } from '@prisma/client'

export class AnalyticsService {
  static async startSession(userId: string, entryPage: string, device?: string): Promise<string> {
    const session = await prisma.userSession.create({
      data: { tenantId: getTenantId(), userId, entryPage, device, startedAt: new Date() }
    })
    await AnalyticsService.log(userId, session.id, ActivityEvent.SESSION_START, entryPage)
    return session.id
  }

  static async endSession(sessionId: string, exitPage: string): Promise<void> {
    const session = await prisma.userSession.findUnique({ where: { id: sessionId } })
    if (!session) return
    const duration = Math.round((Date.now() - session.startedAt.getTime()) / 1000)
    await prisma.userSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date(), exitPage, duration, updatedAt: new Date() }
    })
    await AnalyticsService.log(session.userId, sessionId, ActivityEvent.SESSION_END, exitPage)
  }

  static async log(
    userId: string,
    sessionId: string | null,
    event: ActivityEvent,
    page?: string,
    referenceId?: string,
    metadata?: Prisma.InputJsonValue
  ): Promise<void> {
    await prisma.userActivityLog.create({
      data: { tenantId: getTenantId(), userId, sessionId, event, page, referenceId, metadata }
    }).catch(() => {}) // fire-and-forget, never block request
  }

  static async getOverview(days = 30) {
    const since = new Date(Date.now() - days * 86400000)
    const [totalSessions, activeSessions, avgDuration, topEvents] = await Promise.all([
      prisma.userSession.count({ where: { startedAt: { gte: since } } }),
      prisma.userSession.count({ where: { startedAt: { gte: since }, endedAt: { not: null } } }),
      prisma.userSession.aggregate({
        where: { startedAt: { gte: since }, duration: { not: null } },
        _avg: { duration: true }
      }),
      prisma.userActivityLog.groupBy({
        by: ['event'],
        where: { createdAt: { gte: since } },
        _count: { event: true },
        orderBy: { _count: { event: 'desc' } }
      })
    ])
    return {
      totalSessions,
      completedSessions: activeSessions,
      avgDurationSeconds: Math.round(avgDuration._avg.duration ?? 0),
      topEvents
    }
  }

  static async getEntryExitPages(days = 30) {
    const since = new Date(Date.now() - days * 86400000)
    const [entryPages, exitPages] = await Promise.all([
      prisma.userSession.groupBy({
        by: ['entryPage'],
        where: { startedAt: { gte: since }, entryPage: { not: null } },
        _count: { entryPage: true },
        orderBy: { _count: { entryPage: 'desc' } },
        take: 10
      }),
      prisma.userSession.groupBy({
        by: ['exitPage'],
        where: { startedAt: { gte: since }, exitPage: { not: null } },
        _count: { exitPage: true },
        orderBy: { _count: { exitPage: 'desc' } },
        take: 10
      })
    ])
    return { entryPages, exitPages }
  }

  static async getCourseStats(days = 30) {
    const since = new Date(Date.now() - days * 86400000)
    const [started, exited, completed] = await Promise.all([
      prisma.userActivityLog.count({ where: { event: 'COURSE_STARTED', createdAt: { gte: since } } }),
      prisma.userActivityLog.count({ where: { event: 'COURSE_EXITED', createdAt: { gte: since } } }),
      prisma.userActivityLog.count({ where: { event: 'COURSE_COMPLETED', createdAt: { gte: since } } }),
    ])
    const topCourses = await prisma.userActivityLog.groupBy({
      by: ['referenceId'],
      where: { event: 'COURSE_STARTED', createdAt: { gte: since }, referenceId: { not: null } },
      _count: { referenceId: true },
      orderBy: { _count: { referenceId: 'desc' } },
      take: 10
    })
    return { started, exited, completed, abandonRate: started > 0 ? Math.round((exited / started) * 100) : 0, topCourses }
  }

  static async getTimeline(days = 30) {
    const since = new Date(Date.now() - days * 86400000)
    const logs = await prisma.userActivityLog.findMany({
      where: { createdAt: { gte: since } },
      select: { event: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    })
    // Group by day
    const byDay: Record<string, Record<string, number>> = {}
    for (const log of logs) {
      const day = log.createdAt.toISOString().slice(0, 10)
      if (!byDay[day]) byDay[day] = {}
      byDay[day][log.event] = (byDay[day][log.event] ?? 0) + 1
    }
    return Object.entries(byDay).map(([date, events]) => ({ date, ...events }))
  }

  static async getActiveUsers(days = 30) {
    const since = new Date(Date.now() - days * 86400000)
    const result = await prisma.userActivityLog.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: since } },
      _count: { userId: true }
    })
    return { activeUsers: result.length }
  }

  static async getRecentLogs(limit = 50) {
    return prisma.userActivityLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } }
      }
    })
  }
}
