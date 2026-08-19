import { prisma } from '../utils/prisma'
import { EmailService } from './email'

export class NotificationService {
  static async sendWelcome(userId: string, tempPassword?: string) {
    EmailService.sendWelcome(userId, tempPassword).catch(() => {})
    return prisma.notification.create({
      data: {
        userId,
        type: 'welcome',
        title: 'Bienvenue !',
        body: 'Bienvenue sur Lernvo ! Commencez votre première formation.',
        link: '/modules'
      }
    })
  }

  static async sendAssignmentReminder(userId: string, moduleTitle: string, dueAt: Date) {
    const formatted = dueAt.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
    EmailService.sendAssignmentReminder(userId, moduleTitle, dueAt).catch(() => {})
    return prisma.notification.create({
      data: {
        userId,
        type: 'reminder',
        title: 'Rappel de devoir',
        body: `Rappel : ${moduleTitle} est dû le ${formatted}`,
        link: '/assignments'
      }
    })
  }

  static async sendOverdueAlert(userId: string, moduleTitle: string) {
    return prisma.notification.create({
      data: {
        userId,
        type: 'deadline',
        title: 'Devoir en retard',
        body: `⚠ ${moduleTitle} est en retard ! Complétez-le rapidement.`,
        link: '/assignments'
      }
    })
  }

  static async sendQuizResult(userId: string, quizTitle: string, score: number, passed: boolean) {
    const status = passed ? 'Réussi' : 'Échoué'
    return prisma.notification.create({
      data: {
        userId,
        type: 'quiz',
        title: 'Résultat de quiz',
        body: `Quiz ${quizTitle}: ${Math.round(score)}% - ${status}`,
        link: '/quizzes'
      }
    })
  }

  static async sendBadgeEarned(userId: string, badgeName: string, badgeIcon: string) {
    return prisma.notification.create({
      data: {
        userId,
        type: 'badge',
        title: 'Nouveau badge !',
        body: `${badgeIcon} Nouveau badge : ${badgeName} !`,
        link: '/profile#badges'
      }
    })
  }

  static async sendCertificateIssued(userId: string, certTitle: string, certNumber?: string) {
    if (certNumber) {
      EmailService.sendCertificateIssued(userId, certTitle, certNumber).catch(() => {})
    }
    return prisma.notification.create({
      data: {
        userId,
        type: 'certificate',
        title: 'Certificat obtenu',
        body: `Certificat obtenu : ${certTitle}`,
        link: '/certificates'
      }
    })
  }

  static async sendStreakMilestone(userId: string, days: number) {
    return prisma.notification.create({
      data: {
        userId,
        type: 'streak',
        title: 'Série maintenue !',
        body: `🔥 Série de ${days} jours ! Continuez !`,
        link: '/profile'
      }
    })
  }

  static async sendModuleCompleted(userId: string, moduleTitle: string, pointsEarned: number) {
    return prisma.notification.create({
      data: {
        userId,
        type: 'completion',
        title: 'Module complété',
        body: `Module complété : ${moduleTitle} (+${pointsEarned} pts)`,
        link: '/modules'
      }
    })
  }

  // ─── Onboarding Notifications ─────────────────────────────────────────────

  static async sendOnboardingStarted(userId: string, planName: string, expectedDays: number) {
    return prisma.notification.create({
      data: {
        userId,
        type: 'onboarding',
        title: 'Bienvenue — Votre plan d\'intégration est prêt !',
        body: `Votre parcours d'intégration "${planName}" est prêt. ${expectedDays} jours pour compléter vos formations. C'est parti !`,
        link: '/onboarding'
      }
    })
  }

  static async sendNewHireAlert(managerId: string, employeeName: string, planName: string, moduleCount: number) {
    return prisma.notification.create({
      data: {
        userId: managerId,
        type: 'onboarding',
        title: 'Nouvel employé en intégration',
        body: `${employeeName} a commencé son intégration "${planName}" (${moduleCount} modules assignés automatiquement).`,
        link: '/onboarding/team'
      }
    })
  }

  static async sendOnboardingCompleted(userId: string, planName: string) {
    return prisma.notification.create({
      data: {
        userId,
        type: 'onboarding',
        title: 'Intégration terminée !',
        body: `Félicitations ! Vous avez complété votre parcours d'intégration "${planName}".`,
        link: '/onboarding'
      }
    })
  }

  static async sendOnboardingCompletedManager(managerId: string, employeeName: string, planName: string) {
    return prisma.notification.create({
      data: {
        userId: managerId,
        type: 'onboarding',
        title: 'Intégration terminée',
        body: `${employeeName} a terminé son intégration "${planName}".`,
        link: '/onboarding/team'
      }
    })
  }

  static async sendOnboardingOverdue(userId: string, planName: string) {
    return prisma.notification.create({
      data: {
        userId,
        type: 'onboarding',
        title: 'Intégration en retard',
        body: `⚠ Votre parcours d'intégration "${planName}" est en retard. Complétez vos formations rapidement.`,
        link: '/onboarding'
      }
    })
  }

  static async sendOnboardingOverdueManager(managerId: string, employeeName: string, planName: string) {
    return prisma.notification.create({
      data: {
        userId: managerId,
        type: 'onboarding',
        title: 'Intégration en retard',
        body: `⚠ L'intégration de ${employeeName} ("${planName}") est en retard.`,
        link: '/onboarding/team'
      }
    })
  }
}
