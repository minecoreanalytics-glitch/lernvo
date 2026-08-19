import { Router } from 'express'
import { z } from 'zod'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { prisma } from '../utils/prisma'
import { authenticate, authorize } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { AIService } from '../services/ai'
import { logger } from '../utils/logger'
import { getTenantId } from '../utils/tenantContext'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['text/plain', 'application/pdf', 'text/csv', 'text/markdown']
    const allowedExt = /\.(txt|md|csv|pdf)$/i
    if (allowed.includes(file.mimetype) || file.originalname.match(allowedExt)) {
      cb(null, true)
    } else {
      cb(new Error('Type de fichier non supporté. Formats acceptés: PDF, TXT, MD, CSV.'))
    }
  }
})

const kbImportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip || 'unknown',
  message: { error: 'Trop d\'imports. Réessayez dans 15 minutes.' }
})

const router = Router()
router.use(authenticate)

const ArticleSchema = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  body: z.string().min(1),
  categoryId: z.string().uuid().optional(),
  tags: z.array(z.string()).default([]),
  isPublished: z.boolean().default(false)
})

function toSlug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function uniqueSlug(title: string): Promise<string> {
  let base = toSlug(title) || 'article'
  if (base.length > 80) base = base.slice(0, 80)
  let slug = base
  let i = 0
  while (await prisma.kbArticle.findUnique({ where: { slug } })) {
    i++
    slug = `${base}-${i}`
  }
  return slug
}

// ─── KB Groups (Categories) ──────────────────────────────────────────────────

// GET /api/kb/groups — list all KB groups
router.get('/groups', async (_req, res) => {
  try {
    const groups = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { kbArticles: true } } }
    })
    res.json(groups)
  } catch {
    res.status(500).json({ error: 'Failed to fetch groups' })
  }
})

// POST /api/kb/groups — create KB group (admin/HR only)
const GroupSchema = z.object({
  name: z.string().min(1),
  icon: z.string().optional(),
  color: z.string().optional()
})

router.post('/groups', authorize('PLATFORM_MANAGER', 'HR'), validate(GroupSchema), async (req, res) => {
  try {
    const group = await prisma.category.create({ data: req.body })
    res.status(201).json(group)
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') return res.status(409).json({ error: 'Group name already exists' })
    res.status(500).json({ error: 'Failed to create group' })
  }
})

// PUT /api/kb/groups/:id — update KB group
router.put('/groups/:id', authorize('PLATFORM_MANAGER', 'HR'), async (req, res) => {
  try {
    const group = await prisma.category.update({
      where: { id: req.params.id },
      data: req.body
    })
    res.json(group)
  } catch {
    res.status(500).json({ error: 'Failed to update group' })
  }
})

// GET /api/kb — list articles
router.get('/', async (req, res) => {
  try {
    const { category, search, tags, page = '1', limit = '20' } = req.query as Record<string, string>
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const isAdmin = ['PLATFORM_MANAGER', 'HR'].includes(req.user!.role)

    const where: Record<string, unknown> = {}
    if (!isAdmin) where.isPublished = true
    if (category) where.categoryId = category
    if (tags) where.tags = { hasSome: tags.split(',') }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } }
      ]
    }

    const [articles, total] = await Promise.all([
      prisma.kbArticle.findMany({
        where,
        select: {
          id: true, title: true, slug: true, tags: true,
          isPublished: true, updatedAt: true,
          category: { select: { id: true, name: true } },
          _count: { select: { views: true } }
        },
        skip, take: parseInt(limit), orderBy: { updatedAt: 'desc' }
      }),
      prisma.kbArticle.count({ where })
    ])

    res.json({ articles, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) })
  } catch {
    res.status(500).json({ error: 'Failed to fetch articles' })
  }
})

// POST /api/kb/import-document — create article from uploaded document
router.post(
  '/import-document',
  authorize('PLATFORM_MANAGER', 'HR'),
  kbImportLimiter,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni.' })
      }

      if (!AIService.isConfigured()) {
        return res.status(503).json({ error: 'Service IA non configuré. Définissez GEMINI_API_KEY.' })
      }

      const isPublished = req.body.isPublished === 'true' || req.body.isPublished === true
      const categoryId = req.body.categoryId || undefined

      logger.info(`KB import: file=${req.file.originalname} (${req.file.size} bytes)`)

      const extractedText = await AIService.extractDocumentText({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname
      })

      const generated = await AIService.generateKbArticle(extractedText, {
        filename: req.file.originalname
      })

      const slug = await uniqueSlug(generated.title)
      const article = await prisma.kbArticle.create({
        data: {
          title: generated.title,
          slug,
          body: generated.body,
          tenantId: getTenantId(),
          categoryId,
          tags: generated.tags,
          isPublished
        },
        include: { category: { select: { id: true, name: true } } }
      })

      logger.info(`KB article created from document: "${article.title}" (${slug})`)

      res.status(201).json({
        message: 'Article créé depuis le document',
        article
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('KB import failed:', err)
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        return res.status(429).json({ error: 'Service IA surchargé. Réessayez dans quelques instants.' })
      }
      if (msg.includes('non supporté') || msg.includes('pas de texte')) {
        return res.status(400).json({ error: msg })
      }
      res.status(500).json({ error: 'Import du document échoué. Réessayez.' })
    }
  }
)

// GET /api/kb/:slug
router.get('/:slug', async (req, res) => {
  try {
    const article = await prisma.kbArticle.findUnique({
      where: { slug: req.params.slug },
      include: { category: true }
    })
    if (!article) return res.status(404).json({ error: 'Article not found' })
    if (!article.isPublished && !['PLATFORM_MANAGER', 'HR'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    // Log view
    await prisma.kbArticleView.create({
      data: { articleId: article.id, userId: req.user!.userId }
    }).catch(() => {}) // non-blocking

    res.json(article)
  } catch {
    res.status(500).json({ error: 'Failed to fetch article' })
  }
})

// POST /api/kb
router.post('/', authorize('PLATFORM_MANAGER', 'HR'), validate(ArticleSchema), async (req, res) => {
  try {
    const data = { ...req.body, slug: req.body.slug || toSlug(req.body.title) }
    const article = await prisma.kbArticle.create({ data })
    res.status(201).json(article)
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') return res.status(409).json({ error: 'Slug already exists' })
    res.status(500).json({ error: 'Failed to create article' })
  }
})

// PUT /api/kb/:slug
router.put('/:slug', authorize('PLATFORM_MANAGER', 'HR'), validate(ArticleSchema.partial()), async (req, res) => {
  try {
    const article = await prisma.kbArticle.update({
      where: { slug: req.params.slug },
      data: req.body
    })
    res.json(article)
  } catch {
    res.status(500).json({ error: 'Failed to update article' })
  }
})

// DELETE /api/kb/:slug
router.delete('/:slug', authorize('PLATFORM_MANAGER'), async (req, res) => {
  try {
    await prisma.kbArticle.delete({ where: { slug: req.params.slug } })
    res.json({ message: 'Article deleted' })
  } catch {
    res.status(500).json({ error: 'Failed to delete article' })
  }
})

export default router
