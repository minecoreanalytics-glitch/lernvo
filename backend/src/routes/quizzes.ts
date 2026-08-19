import { Router } from 'express'
import { z } from 'zod'
import { QuizStatus } from '@prisma/client'
import { prisma } from '../utils/prisma'
import { authenticate, authorize } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { GamificationService } from '../services/gamification'
import { NotificationService } from '../services/notifications'
import { logger } from '../utils/logger'
import {
  findQuizAttempts,
  findPassedFullQuizAttempt,
  createQuizAttempt,
  getPassedSectionIndices
} from '../utils/quizAttempts'

const router = Router()
router.use(authenticate)

const QuizSchema = z.object({
  moduleId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  timeLimit: z.number().int().optional(),
  passingScore: z.number().int().min(1).max(100).default(70),
  maxAttempts: z.number().int().min(1).default(3),
  shuffleQuestions: z.boolean().default(true),
  status: z.nativeEnum(QuizStatus).default('DRAFT')
})

const QuestionSchema = z.object({
  text: z.string().min(1),
  imageUrl: z.string().optional(),
  options: z.array(z.object({
    id: z.string(),
    text: z.string(),
    isCorrect: z.boolean()
  })).min(2),
  explanation: z.string().optional(),
  points: z.number().int().default(10),
  order: z.number().int().default(0),
  difficulty: z.number().int().min(1).max(3).default(2)
})

const SubmitSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string(),
    selectedOptionId: z.string()
  })),
  timeTaken: z.number().int().optional(),
  sectionIndex: z.number().int().min(0).optional()
})

// GET /api/quizzes/:id/attempts — must be registered BEFORE /:id
router.get('/:id/attempts', async (req, res) => {
  try {
    const sectionIndex = req.query.sectionIndex !== undefined
      ? parseInt(req.query.sectionIndex as string, 10)
      : undefined

    const attempts = await findQuizAttempts(
      {
        quizId: req.params.id,
        userId: req.user!.userId,
        ...(sectionIndex !== undefined && !Number.isNaN(sectionIndex)
          ? { sectionIndex }
          : { sectionIndex: null })
      },
      {
        select: {
          id: true,
          score: true,
          passed: true,
          pointsEarned: true,
          timeTaken: true,
          sectionIndex: true,
          startedAt: true,
          completedAt: true
        }
      }
    )
    res.json(attempts)
  } catch (err) {
    logger.error('Failed to fetch quiz attempts:', err)
    res.status(500).json({ error: 'Failed to fetch attempts' })
  }
})

// GET /api/quizzes
router.get('/', async (req, res) => {
  try {
    const { moduleId } = req.query
    const quizzes = await prisma.quiz.findMany({
      where: { ...(moduleId ? { moduleId: moduleId as string } : {}), status: 'PUBLISHED' },
      include: { _count: { select: { questions: true, attempts: true } } }
    })
    res.json(quizzes)
  } catch (err) {
    logger.error('Failed to fetch quizzes:', err)
    res.status(500).json({ error: 'Failed to fetch quizzes' })
  }
})

// GET /api/quizzes/:id
router.get('/:id', async (req, res) => {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.id },
      include: { questions: { orderBy: { order: 'asc' } } }
    })
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' })

    const userId = req.user!.userId
    const isInlineMode = req.query.inline === 'true'

    const fullQuizAttempts = await findQuizAttempts({
      quizId: req.params.id,
      userId,
      sectionIndex: null
    })
    const attemptCount = fullQuizAttempts.length
    const hasPassedFullQuiz = fullQuizAttempts.some(a => a.passed)

    const passedSections = isInlineMode
      ? await getPassedSectionIndices(req.params.id, userId)
      : []

    let questions = quiz.questions
    if (quiz.shuffleQuestions) {
      questions = [...questions]
      for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]]
      }
    }

    const isAdmin = ['PLATFORM_MANAGER', 'HR'].includes(req.user!.role)
    if (!isAdmin && !isInlineMode) {
      questions = questions.map(q => ({
        ...q,
        options: (q.options as Array<{ id: string; text: string; isCorrect: boolean }>).map(o => ({
          id: o.id, text: o.text
        }))
      })) as typeof questions
    }

    res.json({
      ...quiz,
      questions,
      userAttemptCount: attemptCount,
      canAttempt: !hasPassedFullQuiz,
      passedSections
    })
  } catch (err) {
    logger.error('Failed to fetch quiz:', err)
    res.status(500).json({ error: 'Failed to fetch quiz' })
  }
})

// POST /api/quizzes
router.post('/', authorize('PLATFORM_MANAGER', 'HR'), validate(QuizSchema), async (req, res) => {
  try {
    const quiz = await prisma.quiz.create({ data: req.body })
    res.status(201).json(quiz)
  } catch (err) {
    logger.error('Failed to create quiz:', err)
    res.status(500).json({ error: 'Failed to create quiz' })
  }
})

// POST /api/quizzes/:id/questions
router.post('/:id/questions', authorize('PLATFORM_MANAGER', 'HR'), validate(QuestionSchema), async (req, res) => {
  try {
    const question = await prisma.question.create({
      data: { ...req.body, quizId: req.params.id }
    })
    res.status(201).json(question)
  } catch (err) {
    logger.error('Failed to create question:', err)
    res.status(500).json({ error: 'Failed to create question' })
  }
})

// POST /api/quizzes/:id/submit — grade and award points
router.post('/:id/submit', validate(SubmitSchema), async (req, res) => {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.id },
      include: { questions: true, module: { select: { id: true } } }
    })
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' })

    if (quiz.module) {
      const enrollment = await prisma.enrollment.findFirst({
        where: { userId: req.user!.userId, moduleId: quiz.module.id }
      })
      if (!enrollment) {
        return res.status(403).json({ error: 'You must be enrolled in this module to take the quiz' })
      }
    }

    const userId = req.user!.userId
    const { answers, timeTaken, sectionIndex } = req.body

    const isSectionQuiz = sectionIndex !== undefined && sectionIndex !== null

    if (!isSectionQuiz) {
      const alreadyPassed = await findPassedFullQuizAttempt(req.params.id, userId)
      if (alreadyPassed) {
        return res.status(403).json({ error: 'Quiz déjà réussi' })
      }
    }

    let totalPoints = 0
    let earnedPoints = 0
    const gradedAnswers = answers.map((a: { questionId: string; selectedOptionId: string }) => {
      const question = quiz.questions.find(q => q.id === a.questionId)
      if (!question) return { ...a, isCorrect: false, pointsEarned: 0 }
      const options = question.options as Array<{ id: string; text: string; isCorrect: boolean }>
      const selected = options.find(o => o.id === a.selectedOptionId)
      const isCorrect = selected?.isCorrect ?? false
      totalPoints += question.points
      if (isCorrect) earnedPoints += question.points
      return { ...a, isCorrect, pointsEarned: isCorrect ? question.points : 0 }
    })

    const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0
    const passed = score >= quiz.passingScore

    const attempt = await createQuizAttempt({
      userId,
      quizId: req.params.id,
      sectionIndex: isSectionQuiz ? sectionIndex : null,
      answers: gradedAnswers,
      score,
      passed,
      pointsEarned: earnedPoints,
      timeTaken,
      completedAt: new Date()
    })

    if (passed) {
      await GamificationService.awardPoints(userId, earnedPoints, 'quiz_completion', attempt.id)
    }

    NotificationService.sendQuizResult(req.user!.userId, quiz.title, score, passed).catch(() => {})

    res.json({
      attemptId: attempt.id,
      score,
      passed,
      pointsEarned: earnedPoints,
      answers: gradedAnswers,
      questions: quiz.questions.map(q => ({
        id: q.id,
        text: q.text,
        explanation: q.explanation,
        options: q.options
      }))
    })
  } catch (err) {
    logger.error('Failed to submit quiz:', err)
    res.status(500).json({ error: 'Failed to submit quiz' })
  }
})

export default router
