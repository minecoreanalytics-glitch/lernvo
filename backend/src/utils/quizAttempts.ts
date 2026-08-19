import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { logger } from './logger'

let sectionIndexSupported: boolean | null = null

/** Detect whether the sectionIndex column exists (migration applied) */
export async function hasSectionIndexColumn(): Promise<boolean> {
  if (sectionIndexSupported !== null) return sectionIndexSupported
  try {
    await prisma.quizAttempt.findFirst({
      where: { sectionIndex: null },
      select: { id: true }
    })
    sectionIndexSupported = true
  } catch (err) {
    logger.warn('QuizAttempt.sectionIndex unavailable — legacy quiz mode active', err)
    sectionIndexSupported = false
  }
  return sectionIndexSupported
}

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
  const supported = await hasSectionIndexColumn()
  const { sectionIndex, ...base } = where

  if (!supported) {
    if (sectionIndex !== undefined && sectionIndex !== null && typeof sectionIndex === 'number') {
      return []
    }
    if (typeof sectionIndex === 'object') {
      return []
    }
    const select = options?.select
      ? Object.fromEntries(Object.entries(options.select).filter(([k]) => k !== 'sectionIndex'))
      : undefined
    return prisma.quizAttempt.findMany({
      where: base,
      orderBy: options?.orderBy ?? { startedAt: 'desc' },
      ...(select ? { select: select as Prisma.QuizAttemptSelect } : {})
    })
  }

  return prisma.quizAttempt.findMany({
    where,
    orderBy: options?.orderBy ?? { startedAt: 'desc' },
    ...(options?.select ? { select: options.select } : {})
  })
}

export async function findPassedFullQuizAttempt(quizId: string, userId: string) {
  const supported = await hasSectionIndexColumn()
  if (!supported) {
    return prisma.quizAttempt.findFirst({
      where: { quizId, userId, passed: true }
    })
  }
  return prisma.quizAttempt.findFirst({
    where: { quizId, userId, sectionIndex: null, passed: true }
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
  const supported = await hasSectionIndexColumn()
  if (supported) {
    return prisma.quizAttempt.create({ data })
  }
  const { sectionIndex: _omit, ...legacy } = data
  return prisma.quizAttempt.create({ data: legacy })
}

export async function getPassedSectionIndices(quizId: string, userId: string): Promise<number[]> {
  const supported = await hasSectionIndexColumn()
  if (!supported) return []

  const sectionAttempts = await prisma.quizAttempt.findMany({
    where: { quizId, userId, sectionIndex: { not: null }, passed: true },
    select: { sectionIndex: true }
  })
  return [...new Set(sectionAttempts.map(a => a.sectionIndex!).filter(i => i !== null))]
}
