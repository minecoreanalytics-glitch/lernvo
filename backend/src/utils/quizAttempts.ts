import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { getTenantId } from './tenantContext'

// sectionIndex is part of the schema (null = final exam, 0+ = inline section quiz).
// The former runtime column probe was removed: schema drift belongs to deployment, not to a branch here.

type AttemptWhere = {
  quizId: string
  userId: string
  passed?: boolean
  sectionIndex?: number | null | { not: null }
}

export async function findQuizAttempts(
  where: AttemptWhere,
  options?: { orderBy?: Prisma.QuizAttemptOrderByWithRelationInput; select?: Prisma.QuizAttemptSelect }
) {
  return prisma.quizAttempt.findMany({
    where,
    orderBy: options?.orderBy ?? { startedAt: 'desc' },
    ...(options?.select ? { select: options.select } : {})
  })
}

export async function createQuizAttempt(data: {
  userId: string
  quizId: string
  sectionIndex?: number | null
  answers: Prisma.InputJsonValue
  score: number
  passed: boolean
  pointsEarned: number
  timeTaken?: number
  completedAt: Date
}) {
  return prisma.quizAttempt.create({ data: { tenantId: getTenantId(), ...data } })
}

export async function getPassedSectionIndices(quizId: string, userId: string): Promise<number[]> {
  const rows = await prisma.quizAttempt.findMany({
    where: { quizId, userId, passed: true, sectionIndex: { not: null } },
    select: { sectionIndex: true }
  })
  return [...new Set(rows.map(r => r.sectionIndex).filter((v): v is number => typeof v === 'number'))]
}

export async function findPassedFullQuizAttempt(quizId: string, userId: string) {
  return prisma.quizAttempt.findFirst({ where: { quizId, userId, sectionIndex: null, passed: true } })
}
