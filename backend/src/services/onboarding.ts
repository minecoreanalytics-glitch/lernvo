/**
 * Onboarding Service
 * Automates employee onboarding: plan matching, module enrollment, progress tracking.
 * Goal: HR creates employee → everything else is automatic.
 */

import { prisma } from '../utils/prisma'
import { getTenantId } from '../utils/tenantContext'
import { NotificationService } from './notifications'
import { logger } from '../utils/logger'
import type { Role } from '@prisma/client'

export class OnboardingService {

  /**
   * Called automatically when a new user is created.
   * Finds matching onboarding plan → enrolls in all modules → notifies user + manager.
   */
  static async triggerOnboarding(userId: string): Promise<{ planId: string; modulesAssigned: number } | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, departmentId: true, hiredAt: true, managerId: true, firstName: true, lastName: true }
      })
      if (!user) return null

      // Find matching plan: exact match (role + department) → fallback (role only)
      const plan = await this.findMatchingPlan(user.role, user.departmentId)
      if (!plan) {
        logger.info(`No onboarding plan found for role=${user.role}, dept=${user.departmentId}`)
        return null
      }

      const hireDate = user.hiredAt || new Date()
      const expectedEndAt = new Date(hireDate.getTime() + plan.expectedDays * 24 * 60 * 60 * 1000)

      // Create user onboarding record
      const userOnboarding = await prisma.userOnboarding.upsert({
        where: { userId_planId: { userId, planId: plan.id } },
        create: {
          tenantId: getTenantId(),
          userId,
          planId: plan.id,
          status: 'IN_PROGRESS',
          startedAt: hireDate,
          expectedEndAt
        },
        update: {} // don't overwrite if re-triggered
      })

      // Auto-enroll in all plan modules with calculated due dates
      let modulesAssigned = 0
      for (const pm of plan.modules) {
        const dueAt = new Date(hireDate.getTime() + pm.dueDaysFromHire * 24 * 60 * 60 * 1000)

        await prisma.enrollment.upsert({
          where: { userId_moduleId: { userId, moduleId: pm.moduleId } },
          create: {
            tenantId: getTenantId(),
            userId,
            moduleId: pm.moduleId,
            status: 'NOT_STARTED',
            dueAt,
            startedAt: null
          },
          update: { dueAt } // update due date if re-triggered
        })
        modulesAssigned++
      }

      // Send notifications (fire-and-forget)
      NotificationService.sendOnboardingStarted(userId, plan.name, plan.expectedDays).catch(() => {})

      // Notify manager if exists
      if (user.managerId) {
        NotificationService.sendNewHireAlert(
          user.managerId,
          `${user.firstName} ${user.lastName}`,
          plan.name,
          modulesAssigned
        ).catch(() => {})
      }

      logger.info(`Onboarding triggered: user=${userId}, plan=${plan.id}, modules=${modulesAssigned}`)
      return { planId: plan.id, modulesAssigned }

    } catch (err) {
      logger.error('Onboarding trigger error:', err)
      return null
    }
  }

  /**
   * Find the best matching onboarding plan for a user.
   * Priority: exact (role+dept) → role only
   */
  private static async findMatchingPlan(role: Role, departmentId: string | null) {
    const candidates = await prisma.onboardingPlan.findMany({
      where: {
        role,
        isActive: true,
        OR: [
          { departmentId },       // exact dept match
          { departmentId: null }  // generic for role
        ]
      },
      include: {
        modules: {
          include: { module: { select: { id: true, title: true, isPublished: true } } },
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (candidates.length === 0) return null

    // Score each candidate by specificity
    const scored = candidates.map(plan => {
      let score = 0
      if (plan.departmentId === departmentId && departmentId) score += 2
      return { plan, score }
    })

    scored.sort((a, b) => b.score - a.score)
    return scored[0].plan
  }

  /**
   * Called when a module enrollment is completed.
   * Recalculates onboarding progress and triggers completion if done.
   */
  static async onModuleCompleted(userId: string, moduleId: string): Promise<void> {
    try {
      // Find any active onboarding for this user
      const userOnboardings = await prisma.userOnboarding.findMany({
        where: { userId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
        include: {
          plan: {
            include: {
              modules: {
                where: { isRequired: true },
                select: { moduleId: true }
              }
            }
          }
        }
      })

      for (const uo of userOnboardings) {
        // Check if this module is part of this onboarding plan
        const planModuleIds = uo.plan.modules.map(m => m.moduleId)
        if (!planModuleIds.includes(moduleId)) continue

        // Count completed required modules
        const enrollments = await prisma.enrollment.findMany({
          where: {
            userId,
            moduleId: { in: planModuleIds },
            status: 'COMPLETED'
          },
          select: { moduleId: true }
        })

        const totalRequired = planModuleIds.length
        const completedCount = enrollments.length
        const progressPct = totalRequired > 0 ? Math.round((completedCount / totalRequired) * 100) : 0

        const isComplete = completedCount >= totalRequired

        await prisma.userOnboarding.update({
          where: { id: uo.id },
          data: {
            progressPct,
            status: isComplete ? 'COMPLETED' : 'IN_PROGRESS',
            completedAt: isComplete ? new Date() : null
          }
        })

        if (isComplete) {
          // Notify user
          NotificationService.sendOnboardingCompleted(userId, uo.plan.name).catch(() => {})

          // Notify manager
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { managerId: true, firstName: true, lastName: true }
          })
          if (user?.managerId) {
            NotificationService.sendOnboardingCompletedManager(
              user.managerId,
              `${user.firstName} ${user.lastName}`,
              uo.plan.name
            ).catch(() => {})
          }

          logger.info(`Onboarding completed: user=${userId}, plan=${uo.planId}`)
        }
      }
    } catch (err) {
      logger.error('Onboarding progress update error:', err)
    }
  }

  /**
   * Check all active onboardings for overdue status.
   * Should be called periodically (e.g., daily cron).
   */
  static async checkOverdue(): Promise<{ overdueCount: number; notified: number }> {
    const now = new Date()
    let notified = 0

    // Find overdue onboardings
    const overdue = await prisma.userOnboarding.findMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        expectedEndAt: { lt: now }
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, managerId: true } },
        plan: { select: { name: true } }
      }
    })

    for (const uo of overdue) {
      await prisma.userOnboarding.update({
        where: { id: uo.id },
        data: { status: 'OVERDUE' }
      })

      // Notify user
      NotificationService.sendOnboardingOverdue(uo.userId, uo.plan.name).catch(() => {})
      notified++

      // Notify manager
      if (uo.user.managerId) {
        NotificationService.sendOnboardingOverdueManager(
          uo.user.managerId,
          `${uo.user.firstName} ${uo.user.lastName}`,
          uo.plan.name
        ).catch(() => {})
        notified++
      }
    }

    // Also check individual module deadlines
    const overdueEnrollments = await prisma.enrollment.findMany({
      where: {
        dueAt: { lt: now },
        status: { not: 'COMPLETED' }
      },
      include: {
        user: { select: { id: true } },
        module: { select: { title: true } }
      },
      take: 100
    })

    for (const e of overdueEnrollments) {
      NotificationService.sendOverdueAlert(e.userId, e.module.title).catch(() => {})
    }

    logger.info(`Overdue check: ${overdue.length} onboardings overdue, ${notified} notifications sent`)
    return { overdueCount: overdue.length, notified }
  }
}
