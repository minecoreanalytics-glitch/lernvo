import { Router } from 'express'
import { z } from 'zod'
import { ContentType } from '@prisma/client'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../utils/prisma'
import { authenticate, authorize, reenterTenant } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { OnboardingService } from '../services/onboarding'
import { logger } from '../utils/logger'
import { TTS_CONFIGURED, markdownToSpeech, synthesizeToFile } from '../services/tts'
import { getCtx, isSuperAdmin } from '../utils/tenantContext'

const router = Router()
router.use(authenticate)

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const type = req.body.type as string
    const dir = type === 'VIDEO' ? 'uploads/videos' : type === 'AUDIO' ? 'uploads/audio' : 'uploads/files'
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${uuidv4()}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB max
  fileFilter: (_req, file, cb) => {
    const allowed = /video\/|audio\/|application\/pdf|image\//
    cb(null, allowed.test(file.mimetype))
  }
})

const ContentSchema = z.object({
  moduleId: z.string().uuid(),
  title: z.string().min(1),
  type: z.nativeEnum(ContentType),
  url: z.string().optional(),
  body: z.string().optional(),
  duration: z.number().int().optional(),
  order: z.number().int().default(0),
  isRequired: z.boolean().default(true)
})

// GET /api/content/:moduleId
router.get('/module/:moduleId', async (req, res) => {
  try {
    const contents = await prisma.content.findMany({
      where: { moduleId: req.params.moduleId },
      orderBy: { order: 'asc' }
    })

    // Attach progress for current user
    const progressLogs = await prisma.progressLog.findMany({
      where: { userId: req.user!.userId, contentId: { in: contents.map(c => c.id) } }
    })
    const progressMap = Object.fromEntries(progressLogs.map(p => [p.contentId, p]))

    res.json(contents.map(c => ({ ...c, progress: progressMap[c.id] || null })))
  } catch {
    res.status(500).json({ error: 'Failed to fetch content' })
  }
})

// POST /api/content — text/rich content
router.post('/', authorize('PLATFORM_MANAGER', 'HR'), validate(ContentSchema), async (req, res) => {
  try {
    const content = await prisma.content.create({ data: { ...req.body, createdById: req.user!.userId } })
    res.status(201).json(content)
  } catch {
    res.status(500).json({ error: 'Failed to create content' })
  }
})

// POST /api/content/upload — file upload (video/audio/pdf)
router.post('/upload', authorize('PLATFORM_MANAGER', 'HR'), upload.single('file'), reenterTenant, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const { moduleId, title, type, order, isRequired } = req.body
    const url = `/${req.file.path}`

    const content = await prisma.content.create({
      data: {
        moduleId, title, type, url, order: parseInt(order) || 0,
        isRequired: isRequired !== 'false',
        createdById: req.user!.userId
      }
    })
    res.status(201).json(content)
  } catch {
    res.status(500).json({ error: 'Failed to upload content' })
  }
})

// POST /api/content/:id/upload-video — attach a video file to an existing VIDEO section

// Safe extension whitelist — derived from validated mimetype, never from client filename
const MIME_TO_EXT: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-matroska': '.mkv',
  'video/ogg': '.ogv'
}

// Ensure upload directory exists at module load time
fs.mkdirSync('uploads/videos', { recursive: true })

const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, 'uploads/videos')
  },
  filename: (_req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype] || '.bin'
    cb(null, `${uuidv4()}${ext}`)
  }
})

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
  fileFilter: (_req, file, cb) => {
    if (MIME_TO_EXT[file.mimetype]) {
      cb(null, true)
    } else {
      cb(new Error('INVALID_MIMETYPE'))
    }
  }
})

router.post(
  '/:id/upload-video',
  authorize('PLATFORM_MANAGER', 'HR', 'SUPER_ADMIN'),
  (req, res, next) => {
    videoUpload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File exceeds 500 MB limit' })
      }
      if (err && (err as Error).message === 'INVALID_MIMETYPE') {
        return res.status(400).json({ error: 'Only video files are accepted (video/*)' })
      }
      if (err) {
        logger.error('upload-video multer error', err)
        return res.status(500).json({ error: 'Upload failed' })
      }
      next()
    })
  },
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

      const contentId = req.params.id

      // Look up content and include its module (SCOPED model) — the Prisma extension
      // auto-filters Module by tenantId, so this implicitly verifies tenant ownership.
      const content = await prisma.content.findFirst({
        where: { id: contentId },
        include: { module: true }
      })

      if (!content || !content.module) {
        return res.status(404).json({ error: 'Content not found' })
      }

      // Explicit tenant ownership check — content is NOT in the SCOPED set so
      // findFirst above runs without a tenantId filter. The include:{module:true}
      // join does NOT re-fire the $allOperations hook (Prisma extension limitation).
      // We therefore compare explicitly here. Return 404 (not 403) to avoid leaking
      // the existence of another tenant's content.
      if (!isSuperAdmin()) {
        const ctx = getCtx()
        const callerTenantId = ctx?.tenantId ?? null
        if (content.module.tenantId !== callerTenantId) {
          return res.status(404).json({ error: 'Content not found' })
        }
      }

      if (content.type !== 'VIDEO') {
        return res.status(400).json({ error: 'Section is not a VIDEO section' })
      }

      // Content is NOT in SCOPED set — update goes through unscoped Prisma.
      // Ownership is already verified above via the SCOPED Module include.
      const updated = await prisma.content.update({
        where: { id: contentId },
        data: { url: '/' + req.file.path }
      })

      return res.json({ id: updated.id, url: updated.url, title: updated.title })
    } catch (e) {
      logger.error('upload-video failed', e)
      return res.status(500).json({ error: 'Upload failed' })
    }
  }
)

// POST /api/content/:id/progress — track viewing progress
router.post('/:id/progress', async (req, res) => {
  try {
    const { progressPct, watchedSeconds } = req.body
    const completed = progressPct >= 90

    const log = await prisma.progressLog.upsert({
      where: { userId_contentId: { userId: req.user!.userId, contentId: req.params.id } },
      create: { userId: req.user!.userId, contentId: req.params.id, progressPct, watchedSeconds, completed },
      update: { progressPct, watchedSeconds, completed }
    })

    // If completed, check if entire module is now done
    if (completed) {
      const content = await prisma.content.findUnique({ where: { id: req.params.id } })
      if (content) {
        const allRequired = await prisma.content.findMany({
          where: { moduleId: content.moduleId, isRequired: true }
        })
        const allLogs = await prisma.progressLog.findMany({
          where: {
            userId: req.user!.userId,
            contentId: { in: allRequired.map(c => c.id) },
            completed: true
          }
        })
        if (allLogs.length === allRequired.length) {
          await prisma.enrollment.updateMany({
            where: { userId: req.user!.userId, moduleId: content.moduleId },
            data: { status: 'COMPLETED', progressPct: 100, completedAt: new Date() }
          })
          // Update onboarding progress (fire-and-forget)
          OnboardingService.onModuleCompleted(req.user!.userId, content.moduleId).catch(() => {})
        }
      }
    }

    res.json(log)
  } catch {
    res.status(500).json({ error: 'Failed to update progress' })
  }
})

// PUT /api/content/:id
router.put('/:id', authorize('PLATFORM_MANAGER', 'HR'), validate(ContentSchema.partial()), async (req, res) => {
  try {
    const content = await prisma.content.update({ where: { id: req.params.id }, data: req.body })
    res.json(content)
  } catch {
    res.status(500).json({ error: 'Failed to update content' })
  }
})

// DELETE /api/content/:id
router.delete('/:id', authorize('PLATFORM_MANAGER'), async (req, res) => {
  try {
    await prisma.content.delete({ where: { id: req.params.id } })
    res.json({ message: 'Content deleted' })
  } catch {
    res.status(500).json({ error: 'Failed to delete content' })
  }
})

// POST /api/content/:id/generate-audio — TTS of a TEXT/PRESENTATION section → sibling AUDIO section
router.post('/:id/generate-audio', authorize('PLATFORM_MANAGER', 'HR'), async (req, res) => {
  try {
    if (!TTS_CONFIGURED) return res.status(503).json({ error: 'Génération audio non configurée (GEMINI_API_KEY).' })
    const content = await prisma.content.findFirst({ where: { id: req.params.id }, include: { module: true } })
    if (!content || !content.module) return res.status(404).json({ error: 'Content not found' })
    if (!isSuperAdmin() && content.module.tenantId !== (getCtx()?.tenantId ?? null)) return res.status(404).json({ error: 'Content not found' })
    const text = markdownToSpeech(content.body || '')
    if (text.length < 20) return res.status(400).json({ error: 'Section sans texte à lire.' })
    if (text.length > 30_000) return res.status(400).json({ error: 'Texte trop long pour une seule piste (30 000 caractères max).' })
    const filename = `tts-${content.id}-${Date.now()}.wav`
    const out = await synthesizeToFile(text, { filename, voice: typeof req.body?.voice === 'string' ? req.body.voice : undefined })
    // Reuse an existing generated audio sibling, else create one right after the source section
    const existing = await prisma.content.findFirst({ where: { moduleId: content.moduleId, type: 'AUDIO', title: `🎧 ${content.title}` } })
    const audio = existing
      ? await prisma.content.update({ where: { id: existing.id }, data: { url: out.url, duration: out.seconds } })
      : await prisma.content.create({ data: { moduleId: content.moduleId, title: `🎧 ${content.title}`, type: 'AUDIO', url: out.url, duration: out.seconds, order: content.order + 1, isRequired: false, createdById: req.user!.userId } })
    res.json({ id: audio.id, url: audio.url, seconds: out.seconds, chunks: out.chunks })
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500
    if (status === 500) logger.error('generate-audio failed', e)
    res.status(status).json({ error: status === 503 ? 'Génération audio non configurée' : (e as Error).message })
  }
})

export default router
