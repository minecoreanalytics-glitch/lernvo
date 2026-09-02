import { prisma } from '../utils/prisma'
import { getTenantId } from '../utils/tenantContext'
import { CertificateService } from './certificate'
import { GamificationService } from './gamification'
import { NotificationService } from './notifications'
import { OnboardingService } from './onboarding'
import {
  createQuizAttempt,
  findPassedFullQuizAttempt,
  findQuizAttempts,
} from '../utils/quizAttempts'

export type SessionReason = 'overdue' | 'dueToday' | 'inProgress' | 'assigned'

export type TodaySession =
  | { kind: 'none' }
  | {
      kind: 'module' | 'quiz'
      moduleId: string
      quizId: string | null
      title: string
      dueAt: string | null
      estimatedMinutes: number
      reason: SessionReason
      progressPct: number
    }

type AnnotatedEnrollment = {
  moduleId: string
  title: string
  dueAt: Date | null
  status: string
  progressPct: number
  estimatedMinutes: number
  pendingQuizId: string | null
}

export function pickTodaySession(items: AnnotatedEnrollment[], now = new Date()): TodaySession {
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)

  const withReason = items.map((item) => {
    let reason: SessionReason = 'assigned'
    if (item.dueAt && item.dueAt < todayStart) reason = 'overdue'
    else if (item.dueAt && item.dueAt >= todayStart && item.dueAt <= todayEnd) reason = 'dueToday'
    else if (item.status === 'IN_PROGRESS') reason = 'inProgress'
    return { ...item, reason }
  })

  const rank: Record<SessionReason, number> = {
    overdue: 0,
    dueToday: 1,
    inProgress: 2,
    assigned: 3,
  }
  withReason.sort((a, b) => {
    const rankDelta = rank[a.reason] - rank[b.reason]
    if (rankDelta !== 0) return rankDelta
    const aDue = a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER
    const bDue = b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER
    return aDue - bDue
  })

  const pick = withReason[0]
  if (!pick) return { kind: 'none' }

  const preferQuiz = Boolean(pick.pendingQuizId) && pick.progressPct >= 80
  return {
    kind: preferQuiz ? 'quiz' : 'module',
    moduleId: pick.moduleId,
    quizId: preferQuiz ? pick.pendingQuizId : pick.pendingQuizId,
    title: pick.title,
    dueAt: pick.dueAt ? pick.dueAt.toISOString() : null,
    estimatedMinutes: pick.estimatedMinutes,
    reason: pick.reason,
    progressPct: pick.progressPct,
  }
}

function stripQuestionOptions(options: unknown) {
  if (!Array.isArray(options)) return []
  return options.map((option) => {
    const row = option as { id?: unknown; text?: unknown }
    return {
      id: typeof row.id === 'string' ? row.id : '',
      text: typeof row.text === 'string' ? row.text : '',
    }
  })
}

export async function loadTodaySession(userId: string): Promise<TodaySession> {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, status: { not: 'COMPLETED' } },
    include: {
      module: {
        select: {
          id: true,
          title: true,
          estimatedMinutes: true,
          quizzes: {
            where: { status: 'PUBLISHED' },
            select: { id: true },
          },
        },
      },
    },
    orderBy: { dueAt: 'asc' },
  })

  const quizIds = enrollments.flatMap((enrollment) => enrollment.module.quizzes.map((quiz) => quiz.id))
  const passed = quizIds.length
    ? await prisma.quizAttempt.findMany({
        where: { userId, passed: true, sectionIndex: null, quizId: { in: quizIds } },
        select: { quizId: true },
      })
    : []
  const passedIds = new Set(passed.map((row) => row.quizId))

  return pickTodaySession(
    enrollments.map((enrollment) => ({
      moduleId: enrollment.module.id,
      title: enrollment.module.title,
      dueAt: enrollment.dueAt,
      status: enrollment.status,
      progressPct: enrollment.progressPct,
      estimatedMinutes: enrollment.module.estimatedMinutes,
      pendingQuizId: enrollment.module.quizzes.find((quiz) => !passedIds.has(quiz.id))?.id ?? null,
    })),
  )
}

export async function loadLearnCatalog(userId: string) {
  const [enrollments, pathEnrollments] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId },
      include: {
        module: {
          select: {
            id: true,
            title: true,
            description: true,
            estimatedMinutes: true,
            isPublished: true,
            category: { select: { id: true, name: true, color: true } },
            quizzes: {
              where: { status: 'PUBLISHED' },
              select: { id: true, title: true },
            },
          },
        },
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
    }),
    prisma.careerPathEnrollment.findMany({
      where: { userId },
      include: {
        path: {
          select: {
            id: true,
            title: true,
            description: true,
            _count: { select: { modules: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return {
    modules: enrollments
      .filter((enrollment) => enrollment.module.isPublished)
      .map((enrollment) => ({
        id: enrollment.module.id,
        title: enrollment.module.title,
        description: enrollment.module.description,
        estimatedMinutes: enrollment.module.estimatedMinutes,
        category: enrollment.module.category,
        status: enrollment.status,
        progressPct: enrollment.progressPct,
        dueAt: enrollment.dueAt,
        quizzes: enrollment.module.quizzes,
      })),
    paths: pathEnrollments.map((enrollment) => ({
      id: enrollment.path.id,
      title: enrollment.path.title,
      description: enrollment.path.description,
      status: enrollment.status,
      progressPct: enrollment.progressPct,
      moduleCount: enrollment.path._count.modules,
    })),
  }
}

export async function loadModuleForLearner(userId: string, moduleId: string) {
  const module = await prisma.module.findFirst({
    where: { id: moduleId, isPublished: true },
    include: {
      category: { select: { id: true, name: true, color: true } },
      contents: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          type: true,
          url: true,
          body: true,
          duration: true,
          order: true,
          isRequired: true,
        },
      },
      quizzes: {
        where: { status: 'PUBLISHED' },
        select: { id: true, title: true, passingScore: true, timeLimit: true },
      },
      prerequisite: { select: { id: true, title: true } },
    },
  })
  if (!module) return null

  const [enrollment, logs] = await Promise.all([
    prisma.enrollment.findFirst({
      where: { userId, moduleId },
      select: { id: true, status: true, progressPct: true, dueAt: true, startedAt: true },
    }),
    prisma.progressLog.findMany({
      where: { userId, contentId: { in: module.contents.map((content) => content.id) } },
      select: { contentId: true, progressPct: true, completed: true },
    }),
  ])

  const logByContent = new Map(logs.map((log) => [log.contentId, log]))
  let prerequisiteMet = true
  if (module.prerequisiteId) {
    const prereq = await prisma.enrollment.findFirst({
      where: { userId, moduleId: module.prerequisiteId },
      select: { status: true },
    })
    prerequisiteMet = prereq?.status === 'COMPLETED'
  }

  return {
    id: module.id,
    title: module.title,
    description: module.description,
    estimatedMinutes: module.estimatedMinutes,
    category: module.category,
    prerequisite: module.prerequisite,
    prerequisiteMet,
    enrollment,
    contents: module.contents.map((content) => ({
      ...content,
      progress: logByContent.get(content.id) ?? null,
    })),
    quizzes: module.quizzes,
  }
}

export async function startModuleForLearner(userId: string, moduleId: string) {
  const module = await prisma.module.findFirst({
    where: { id: moduleId, isPublished: true },
    select: { id: true },
  })
  if (!module) return null

  return prisma.enrollment.upsert({
    where: { userId_moduleId: { userId, moduleId } },
    create: {
      tenantId: getTenantId(),
      userId,
      moduleId,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    },
    update: {
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    },
  })
}

export async function recordContentProgress(
  userId: string,
  contentId: string,
  progressPct: number,
) {
  const content = await prisma.content.findFirst({
    where: { id: contentId },
    select: { id: true, moduleId: true, isRequired: true },
  })
  if (!content) return null

  const clamped = Math.max(0, Math.min(100, Math.round(progressPct)))
  const completed = clamped >= 90
  const log = await prisma.progressLog.upsert({
    where: { userId_contentId: { userId, contentId } },
    create: {
      tenantId: getTenantId(),
      userId,
      contentId,
      progressPct: clamped,
      watchedSeconds: 0,
      completed,
    },
    update: { progressPct: clamped, completed },
  })

  if (completed) {
    const required = await prisma.content.findMany({
      where: { moduleId: content.moduleId, isRequired: true },
      select: { id: true },
    })
    const completedLogs = await prisma.progressLog.findMany({
      where: {
        userId,
        contentId: { in: required.map((row) => row.id) },
        completed: true,
      },
      select: { contentId: true },
    })
    const progress = required.length === 0
      ? 100
      : Math.round((completedLogs.length / required.length) * 100)
    await prisma.enrollment.updateMany({
      where: { userId, moduleId: content.moduleId },
      data:
        required.length > 0 && completedLogs.length === required.length
          ? { status: 'COMPLETED', progressPct: 100, completedAt: new Date() }
          : { status: 'IN_PROGRESS', progressPct: progress },
    })
    if (required.length > 0 && completedLogs.length === required.length) {
      OnboardingService.onModuleCompleted(userId, content.moduleId).catch(() => undefined)
    }
  }

  return log
}

export async function loadQuizForLearner(userId: string, quizId: string) {
  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, status: 'PUBLISHED' },
    include: { questions: { orderBy: { order: 'asc' } }, module: { select: { id: true } } },
  })
  if (!quiz) return null

  if (quiz.module) {
    const enrollment = await prisma.enrollment.findFirst({
      where: { userId, moduleId: quiz.module.id },
      select: { id: true },
    })
    if (!enrollment) return { forbidden: true as const }
  }

  const attempts = await findQuizAttempts({
    quizId,
    userId,
    sectionIndex: null,
  })
  let questions = quiz.questions
  if (quiz.shuffleQuestions) {
    questions = [...questions]
    for (let i = questions.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      const current = questions[i]
      const swap = questions[j]
      if (!current || !swap) continue
      questions[i] = swap
      questions[j] = current
    }
  }

  return {
    id: quiz.id,
    moduleId: quiz.moduleId,
    title: quiz.title,
    description: quiz.description,
    timeLimit: quiz.timeLimit,
    passingScore: quiz.passingScore,
    maxAttempts: quiz.maxAttempts,
    userAttemptCount: attempts.length,
    canAttempt: !attempts.some((attempt) => attempt.passed),
    questions: questions.map((question) => ({
      id: question.id,
      text: question.text,
      imageUrl: question.imageUrl,
      points: question.points,
      order: question.order,
      options: stripQuestionOptions(question.options),
    })),
  }
}

export async function submitQuizForLearner(
  userId: string,
  quizId: string,
  answers: Array<{ questionId: string; selectedOptionId: string }>,
  timeTaken?: number,
) {
  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, status: 'PUBLISHED' },
    include: { questions: true, module: { select: { id: true, title: true } } },
  })
  if (!quiz) return { error: 'NOT_FOUND' as const }

  if (quiz.module) {
    const enrollment = await prisma.enrollment.findFirst({
      where: { userId, moduleId: quiz.module.id },
      select: { id: true },
    })
    if (!enrollment) return { error: 'NOT_ENROLLED' as const }
  }

  const alreadyPassed = await findPassedFullQuizAttempt(quizId, userId)
  if (alreadyPassed) return { error: 'ALREADY_PASSED' as const }

  let totalPoints = 0
  let earnedPoints = 0
  const gradedAnswers = answers.map((answer) => {
    const question = quiz.questions.find((row) => row.id === answer.questionId)
    if (!question) return { ...answer, isCorrect: false, pointsEarned: 0, explanation: null as string | null }
    const options = question.options as Array<{ id: string; text: string; isCorrect: boolean }>
    const selected = options.find((option) => option.id === answer.selectedOptionId)
    const isCorrect = selected?.isCorrect ?? false
    totalPoints += question.points
    if (isCorrect) earnedPoints += question.points
    return {
      ...answer,
      isCorrect,
      pointsEarned: isCorrect ? question.points : 0,
      explanation: question.explanation,
    }
  })

  const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0
  const passed = score >= quiz.passingScore
  const attempt = await createQuizAttempt({
    userId,
    quizId,
    sectionIndex: null,
    answers: gradedAnswers.map(({ questionId, selectedOptionId, isCorrect, pointsEarned }) => ({
      questionId,
      selectedOptionId,
      isCorrect,
      pointsEarned,
    })),
    score,
    passed,
    pointsEarned: earnedPoints,
    timeTaken,
    completedAt: new Date(),
  })

  if (passed) {
    await GamificationService.awardPoints(userId, earnedPoints, 'quiz_completion', attempt.id)
  }
  NotificationService.sendQuizResult(userId, quiz.title, score, passed).catch(() => undefined)

  return {
    error: null,
    result: {
      attemptId: attempt.id,
      score,
      passed,
      pointsEarned: earnedPoints,
      answers: gradedAnswers,
    },
  }
}

export async function loadInbox(userId: string) {
  const items = await prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' },
    take: 80,
    include: {
      companyUnit: { select: { id: true, name: true, slug: true } },
      author: { select: { firstName: true, lastName: true } },
      reads: { where: { userId }, select: { userId: true } },
    },
  })
  const unreadCount = items.filter((item) => item.reads.length === 0).length
  return {
    unreadCount,
    announcements: items.map((item) => ({
      id: item.id,
      body: item.body,
      imageUrl: item.imageUrl,
      createdAt: item.createdAt,
      company: item.companyUnit,
      author: item.author,
      isUnread: item.reads.length === 0,
    })),
  }
}

export async function acknowledgeAnnouncements(userId: string, ids: string[]) {
  const unread = await prisma.announcement.findMany({
    where: {
      ...(ids.length ? { id: { in: ids } } : {}),
      NOT: { reads: { some: { userId } } },
    },
    select: { id: true },
  })
  if (unread.length > 0) {
    await prisma.announcementRead.createMany({
      data: unread.map((row) => ({
        announcementId: row.id,
        userId,
        tenantId: getTenantId(),
      })),
      skipDuplicates: true,
    })
  }
  const unreadCount = await prisma.announcement.count({
    where: { NOT: { reads: { some: { userId } } } },
  })
  return { marked: unread.length, unreadCount }
}

export async function loadProfile(userId: string) {
  const [user, certificates, enrollmentCounts] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        totalPoints: true,
        currentStreak: true,
        department: { select: { id: true, name: true } },
      },
    }),
    CertificateService.getUserCertificates(userId),
    prisma.enrollment.groupBy({
      by: ['status'],
      where: { userId },
      _count: { _all: true },
    }),
  ])
  if (!user) return null

  const counts = { assigned: 0, inProgress: 0, completed: 0 }
  for (const row of enrollmentCounts) {
    if (row.status === 'COMPLETED') counts.completed = row._count._all
    else if (row.status === 'IN_PROGRESS') counts.inProgress = row._count._all
    else counts.assigned += row._count._all
  }

  return {
    user,
    progress: counts,
    certificates: certificates.map((cert) => ({
      id: cert.id,
      title: cert.title,
      certNumber: cert.certNumber,
      issuedAt: cert.issuedAt,
      expiresAt: cert.expiresAt,
      score: cert.score,
      moduleTitle: cert.module?.title ?? null,
      pathTitle: cert.path?.title ?? null,
    })),
  }
}

export async function loadTeamStatus(userId: string, role: string) {
  if (role === 'AGENT') return { error: 'FORBIDDEN' as const }

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  const team = await prisma.user.findMany({
    where: { managerId: userId, isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
      currentStreak: true,
      lastLoginAt: true,
      department: { select: { name: true } },
      enrollments: {
        select: { status: true, dueAt: true },
      },
    },
    orderBy: { firstName: 'asc' },
  })

  const members = team.map((member) => {
    const overdueCount = member.enrollments.filter(
      (enrollment) =>
        enrollment.dueAt &&
        enrollment.dueAt < todayStart &&
        enrollment.status !== 'COMPLETED',
    ).length
    const inProgressCount = member.enrollments.filter(
      (enrollment) => enrollment.status === 'IN_PROGRESS',
    ).length
    return {
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      role: member.role,
      department: member.department?.name ?? null,
      currentStreak: member.currentStreak,
      lastLoginAt: member.lastLoginAt,
      overdueCount,
      inProgressCount,
    }
  })

  return {
    error: null,
    data: {
      count: members.length,
      overdueMembers: members.filter((member) => member.overdueCount > 0).length,
      members,
    },
  }
}

// ── Knowledge base (documents / procedures the employee can consult) ──────────
// Tenant is auto-scoped by the extended prisma client; only published articles
// are exposed to the mobile learner.
export async function loadKbArticles() {
  const articles = await prisma.kbArticle.findMany({
    where: { isPublished: true },
    select: {
      id: true,
      title: true,
      tags: true,
      updatedAt: true,
      category: { select: { name: true } },
    },
    orderBy: [{ updatedAt: 'desc' }],
  })
  return {
    articles: articles.map((a) => ({
      id: a.id,
      title: a.title,
      category: a.category?.name ?? null,
      tags: a.tags,
      updatedAt: a.updatedAt.toISOString(),
    })),
  }
}

export async function loadKbArticle(id: string) {
  const a = await prisma.kbArticle.findFirst({
    where: { id, isPublished: true },
    select: {
      id: true,
      title: true,
      body: true,
      tags: true,
      updatedAt: true,
      category: { select: { name: true } },
    },
  })
  if (!a) return null
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    tags: a.tags,
    category: a.category?.name ?? null,
    updatedAt: a.updatedAt.toISOString(),
  }
}
