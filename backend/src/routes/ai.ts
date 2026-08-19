import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import multer from 'multer'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdf = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>
import { prisma } from '../utils/prisma'
import { getTenantId } from '../utils/tenantContext'
import { authenticate, authorize, reenterTenant } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { AIService, TrainingPurpose, TrainingFormat } from '../services/ai'
import { logger } from '../utils/logger'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for audio/video
  fileFilter: (_req, file, cb) => {
    const allowed = [
      // Text
      'text/plain', 'application/pdf', 'text/csv', 'text/markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Audio
      'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg',
      // Video
      'video/mp4', 'video/webm', 'video/quicktime'
    ]
    const allowedExt = /\.(txt|md|csv|pdf|docx|mp3|wav|m4a|aac|ogg|mp4|webm|mov)$/i
    if (allowed.includes(file.mimetype) || file.originalname.match(allowedExt)) {
      cb(null, true)
    } else {
      cb(new Error('Type de fichier non supporté. Formats acceptés: TXT, PDF, CSV, MD, DOCX, MP3, WAV, M4A, MP4, WEBM.'))
    }
  }
})

const router = Router()
router.use(authenticate)
router.use(authorize('PLATFORM_MANAGER', 'HR'))

// Expensive Gemini calls — per authenticated user (must run after authenticate)
const aiGenerationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip || 'unknown',
  message: { error: 'Trop de requêtes IA. Réessayez dans 15 minutes.' }
})

function handleAiRouteError(res: import('express').Response, err: unknown, context: string) {
  const message = err instanceof Error ? err.message : String(err)
  logger.error(`${context}:`, err)

  if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
    return res.status(429).json({ error: 'Service IA surchargé. Réessayez dans quelques instants.' })
  }
  if (message.includes('NOT_CONFIGURED') || message.includes('AI service not configured')) {
    return res.status(503).json({ error: 'Service IA non configuré sur ce serveur.' })
  }
  if (message.includes('incomplète') || message.includes('incomplet')) {
    return res.status(502).json({ error: message })
  }

  return res.status(500).json({ error: `${context} a échoué. Réessayez.` })
}

// ─── POST /api/ai/analyze-content ────────────────────────────────────────────
// Step 2: Analyze uploaded content → suggest purpose + format + transcribe
router.post('/analyze-content', aiGenerationLimiter, upload.single('file'), reenterTenant, async (req, res) => {
  try {
    if (!AIService.isConfigured()) {
      return res.status(503).json({ error: 'AI service not configured. Set GEMINI_API_KEY environment variable.' })
    }

    const prompt = req.body.prompt || ''
    const kbArticleIds = req.body.kbArticleIds ? JSON.parse(req.body.kbArticleIds) : []

    if (!req.file && !prompt.trim()) {
      return res.status(400).json({ error: 'Provide a file or a text prompt to analyze.' })
    }

    // Fetch KB content if specified
    let kbContent = ''
    if (kbArticleIds.length > 0) {
      const articles = await prisma.kbArticle.findMany({
        where: { id: { in: kbArticleIds } },
        select: { title: true, body: true }
      })
      kbContent = articles.map((a: { title: string; body: string }) => `=== ${a.title} ===\n${a.body}`).join('\n\n')
    }

    logger.info(`AI analyzing content: file=${req.file?.originalname || 'none'} (${req.file?.size || 0} bytes, ${req.file?.mimetype || 'n/a'}), prompt=${prompt.slice(0, 50)}...`)

    const result = await AIService.analyzeContent({
      file: req.file ? {
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
        size: req.file.size
      } : undefined,
      prompt: prompt || undefined,
      kbContent: kbContent || undefined
    })

    res.json(result)
  } catch (err) {
    handleAiRouteError(res, err, 'Analyse du contenu')
  }
})

// ─── POST /api/ai/generate-module ────────────────────────────────────────────
// Step 3: Generate a full module + quiz, optionally save to DB
const GenerateSchema = z.object({
  prompt: z.string().min(5).max(2000),
  categoryId: z.string().uuid().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
  numSections: z.coerce.number().int().min(2).max(8).default(4),
  numQuestions: z.coerce.number().int().min(3).max(20).default(10),
  autoPublish: z.preprocess(v => v === 'true' || v === true, z.boolean().default(false)),
  context: z.string().optional(),
  kbArticleIds: z.preprocess(v => typeof v === 'string' ? JSON.parse(v) : v, z.array(z.string().uuid()).optional()),
  // New wizard fields
  purpose: z.enum(['Processus', 'Produit', 'Dépannage', 'Promotion']).optional(),
  format: z.enum(['Texte', 'Vidéo', 'Diaporama']).optional(),
  sessionId: z.string().uuid().optional(),
  preview: z.preprocess(v => v === 'true' || v === true, z.boolean().default(false)),
})

router.post('/generate-module', aiGenerationLimiter, upload.single('file'), reenterTenant, validate(GenerateSchema), async (req, res) => {
  try {
    if (!AIService.isConfigured()) {
      return res.status(503).json({
        error: 'AI service not configured. Set GEMINI_API_KEY environment variable.'
      })
    }

    const { prompt, categoryId, difficulty, numSections, numQuestions, autoPublish, context, kbArticleIds,
            purpose, format, sessionId, preview } = req.body

    // If KB articles specified, fetch their content to enrich the prompt
    let kbContext = ''
    if (kbArticleIds?.length) {
      const articles = await prisma.kbArticle.findMany({
        where: { id: { in: kbArticleIds } },
        select: { title: true, body: true }
      })
      kbContext = articles.map((a: { title: string; body: string }) => `=== ${a.title} ===\n${a.body}`).join('\n\n')
    }

    // Get file content: from session cache (wizard) or from uploaded file (direct)
    let fileContent = ''

    if (sessionId) {
      // Wizard flow: retrieve cached transcription from analysis step
      const sessionData = await AIService.getSessionData(sessionId)
      if (sessionData?.transcription) {
        fileContent = sessionData.transcription
      }
    }

    if (!fileContent && req.file) {
      // Direct upload flow (backward compatible)
      const buffer = req.file.buffer
      if (req.file.mimetype === 'text/plain' || req.file.originalname.match(/\.(txt|md|csv)$/i)) {
        fileContent = buffer.toString('utf-8')
      } else if (req.file.mimetype === 'application/pdf') {
        const pdfData = await pdf(buffer)
        fileContent = pdfData.text
      } else {
        fileContent = buffer.toString('utf-8')
      }
      if (fileContent.length > 15000) fileContent = fileContent.slice(0, 15000) + '\n\n[... contenu tronqué ...]'
      logger.info(`File uploaded: ${req.file.originalname} (${req.file.size} bytes, extracted ${fileContent.length} chars)`)
    }

    const fullContext = [context, kbContext].filter(Boolean).join('\n\n')

    logger.info(`AI generating module: "${prompt}" (purpose=${purpose || 'auto'}, format=${format || 'Texte'}, difficulty=${difficulty}, ${numSections} sections, ${numQuestions} questions)`)

    // 1. Generate content via Gemini
    const generated = await AIService.generateModule(prompt, {
      difficulty, numSections, numQuestions,
      context: fullContext || undefined,
      fileContent: fileContent || undefined,
      purpose: purpose as TrainingPurpose | undefined,
      format: format as TrainingFormat | undefined
    })

    // If preview mode, return generated content without saving
    if (preview) {
      return res.json({
        message: 'Preview generated',
        preview: true,
        generated
      })
    }

    // 2. Save module to DB
    const module = await prisma.module.create({
      data: {
        title: generated.module.title,
        description: generated.module.description,
        categoryId: categoryId || undefined,
        estimatedMinutes: generated.module.estimatedMinutes,
        isPublished: autoPublish,
        tenantId: getTenantId(),
        createdById: req.user!.userId,
        contents: {
          create: generated.module.sections.map(s => ({
            tenantId: getTenantId(),
            title: s.title,
            type: 'TEXT' as const,
            body: s.body,
            order: s.order,
            isRequired: true,
            createdById: req.user!.userId
          }))
        }
      },
      include: {
        contents: true,
        category: { select: { id: true, name: true } }
      }
    })

    // 3. Save quiz to DB
    const quiz = await prisma.quiz.create({
      data: {
        tenantId: getTenantId(),
        moduleId: module.id,
        title: generated.quiz.title,
        description: generated.quiz.description,
        timeLimit: generated.quiz.timeLimit,
        passingScore: generated.quiz.passingScore,
        status: autoPublish ? 'PUBLISHED' : 'DRAFT',
        questions: {
          create: generated.quiz.questions.map(q => ({
            tenantId: getTenantId(),
            text: q.text,
            options: q.options,
            explanation: q.explanation,
            difficulty: q.difficulty,
            points: q.points,
            order: q.order
          }))
        }
      },
      include: { questions: true }
    })

    logger.info(`AI generated module "${module.title}" (${module.contents.length} sections, ${quiz.questions.length} questions)`)

    res.status(201).json({
      message: 'Module generated successfully',
      module: {
        id: module.id,
        title: module.title,
        description: module.description,
        estimatedMinutes: module.estimatedMinutes,
        isPublished: module.isPublished,
        sectionsCount: module.contents.length,
        category: module.category
      },
      quiz: {
        id: quiz.id,
        title: quiz.title,
        questionsCount: quiz.questions.length,
        passingScore: quiz.passingScore,
        status: quiz.status
      }
    })
  } catch (err) {
    handleAiRouteError(res, err, 'Génération du module')
  }
})

// ─── POST /api/ai/save-preview ───────────────────────────────────────────────
// Step 4: Save a previewed/edited module to DB
const SavePreviewSchema = z.object({
  module: z.object({
    title: z.string().min(1),
    description: z.string().optional().default(''),
    estimatedMinutes: z.preprocess(v => Number(v) || 30, z.number().int().min(1)),
    sections: z.array(z.object({
      title: z.string(),
      body: z.string(),
      order: z.preprocess(v => Number(v) || 0, z.number().int())
    }))
  }),
  quiz: z.object({
    title: z.string(),
    description: z.string().optional().default(''),
    timeLimit: z.preprocess(v => Number(v) || 600, z.number().int()),
    passingScore: z.preprocess(v => Number(v) || 70, z.number().int()),
    questions: z.array(z.object({
      text: z.string(),
      options: z.array(z.object({
        id: z.string(),
        text: z.string(),
        isCorrect: z.boolean()
      })),
      explanation: z.string().optional().default(''),
      difficulty: z.preprocess(v => Number(v) || 2, z.number().int()),
      points: z.preprocess(v => Number(v) || 10, z.number().int()),
      order: z.preprocess(v => Number(v) || 0, z.number().int())
    }))
  }),
  categoryId: z.string().uuid().optional(),
  autoPublish: z.boolean().default(false),
  format: z.enum(['Texte', 'Vidéo', 'Diaporama']).optional(),
  purpose: z.enum(['Processus', 'Produit', 'Dépannage', 'Promotion']).optional(),
  departmentId: z.string().uuid().optional(),
})

router.post('/save-preview', validate(SavePreviewSchema), async (req, res) => {
  try {
    const { module: moduleData, quiz: quizData, categoryId, autoPublish, format, departmentId } = req.body

    const contentType = format === 'Diaporama' ? 'PRESENTATION' : format === 'Vidéo' ? 'VIDEO' : 'TEXT'

    const module = await prisma.module.create({
      data: {
        title: moduleData.title,
        description: moduleData.description,
        format: format || null,
        categoryId: categoryId || undefined,
        estimatedMinutes: moduleData.estimatedMinutes,
        isPublished: autoPublish,
        tenantId: getTenantId(),
        createdById: req.user!.userId,
        contents: {
          create: moduleData.sections.map((s: { title: string; body: string; order: number }) => ({
            title: s.title,
            type: contentType as 'TEXT' | 'PRESENTATION' | 'VIDEO',
            body: s.body,
            order: s.order,
            isRequired: true,
            createdById: req.user!.userId
          }))
        }
      },
      include: {
        contents: true,
        category: { select: { id: true, name: true } }
      }
    })

    const quiz = await prisma.quiz.create({
      data: {
        tenantId: getTenantId(),
        moduleId: module.id,
        title: quizData.title,
        description: quizData.description,
        timeLimit: quizData.timeLimit,
        passingScore: quizData.passingScore,
        status: autoPublish ? 'PUBLISHED' : 'DRAFT',
        questions: {
          create: quizData.questions.map((q: { text: string; options: unknown; explanation: string; difficulty: number; points: number; order: number }) => ({
            text: q.text,
            options: q.options,
            explanation: q.explanation,
            difficulty: q.difficulty,
            points: q.points,
            order: q.order
          }))
        }
      },
      include: { questions: true }
    })

    let departmentAssignment: { departmentId: string; departmentName: string; enrolled: number } | undefined

    if (departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { id: true, name: true }
      })
      if (!department) {
        return res.status(404).json({ error: 'Département introuvable' })
      }

      await prisma.module.update({ where: { id: module.id }, data: { departmentId } })

      const members = await prisma.user.findMany({
        where: { departmentId, isActive: true },
        select: { id: true }
      })

      await Promise.all(members.map(u =>
        prisma.enrollment.upsert({
          where: { userId_moduleId: { userId: u.id, moduleId: module.id } },
          create: { tenantId: getTenantId(), userId: u.id, moduleId: module.id, status: 'IN_PROGRESS', startedAt: new Date() },
          update: {}
        })
      ))

      departmentAssignment = {
        departmentId: department.id,
        departmentName: department.name,
        enrolled: members.length
      }

      logger.info(`Assigned module "${module.title}" to department "${department.name}" (${members.length} members enrolled)`)
    }

    logger.info(`Saved preview module "${module.title}" (${module.contents.length} sections, ${quiz.questions.length} questions)`)

    res.status(201).json({
      message: 'Module saved successfully',
      module: {
        id: module.id,
        title: module.title,
        description: module.description,
        estimatedMinutes: module.estimatedMinutes,
        isPublished: module.isPublished,
        sectionsCount: module.contents.length,
        category: module.category
      },
      quiz: {
        id: quiz.id,
        title: quiz.title,
        questionsCount: quiz.questions.length,
        passingScore: quiz.passingScore,
        status: quiz.status
      },
      departmentAssignment
    })
  } catch (err) {
    logger.error('Save preview failed:', err)
    res.status(500).json({ error: 'Save failed' })
  }
})

// ─── POST /api/ai/generate-quiz ──────────────────────────────────────────────
// Generate quiz for an existing module
const QuizGenSchema = z.object({
  moduleId: z.string().uuid(),
  numQuestions: z.number().int().min(3).max(20).default(10),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate')
})

router.post('/generate-quiz', aiGenerationLimiter, validate(QuizGenSchema), async (req, res) => {
  try {
    if (!AIService.isConfigured()) {
      return res.status(503).json({ error: 'AI service not configured' })
    }

    const { moduleId, numQuestions, difficulty } = req.body

    // Get module content
    const module = await prisma.module.findUnique({
      where: { id: moduleId },
      include: { contents: { where: { type: 'TEXT' }, orderBy: { order: 'asc' } } }
    })
    if (!module) return res.status(404).json({ error: 'Module not found' })

    const contentText = module.contents.map(c => c.body || c.title).join('\n\n')
    const generated = await AIService.generateQuiz(module.title, contentText, {
      numQuestions, difficulty
    })

    const quiz = await prisma.quiz.create({
      data: {
        tenantId: getTenantId(),
        moduleId,
        title: generated.title,
        description: generated.description,
        timeLimit: generated.timeLimit,
        passingScore: generated.passingScore,
        status: 'DRAFT',
        questions: {
          create: generated.questions.map(q => ({
            tenantId: getTenantId(),
            text: q.text,
            options: q.options,
            explanation: q.explanation,
            difficulty: q.difficulty,
            points: q.points,
            order: q.order
          }))
        }
      },
      include: { questions: true }
    })

    res.status(201).json({
      message: 'Quiz generated',
      quiz: { id: quiz.id, title: quiz.title, questionsCount: quiz.questions.length }
    })
  } catch (err) {
    handleAiRouteError(res, err, 'Génération du quiz')
  }
})

// ─── GET /api/ai/status ──────────────────────────────────────────────────────
router.get('/status', (_req, res) => {
  res.json({
    configured: AIService.isConfigured(),
    model: 'gemini-2.5-flash',
    capabilities: ['analyze-content', 'generate-module', 'generate-quiz', 'save-preview']
  })
})

export default router
