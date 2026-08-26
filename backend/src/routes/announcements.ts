/**
 * Fil d'actualités interne — tout le monde peut publier.
 * Les entités (filiales / marques) sont des données du tenant, pas un enum produit.
 */
import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { prisma } from '../utils/prisma'
import { getTenantId } from '../utils/tenantContext'
import { authenticate, authorize, reenterTenant } from '../middleware/auth'
import { logger } from '../utils/logger'

const router = Router()
router.use(authenticate)

const IMAGE_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
}

fs.mkdirSync('uploads/announcements', { recursive: true })

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, 'uploads/announcements'),
    filename: (_req, file, cb) => {
      const ext = IMAGE_MIME[file.mimetype] || '.bin'
      cb(null, `${uuidv4()}${ext}`)
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIME[file.mimetype]) cb(null, true)
    else cb(new Error('IMAGE_TYPE'))
  }
})

function slugify(name: string) {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60)
  return slug || 'ENTITE'
}

async function ensureDefaultUnit() {
  const existing = await prisma.companyUnit.count()
  if (existing > 0) return
  const tenant = await prisma.tenant.findUnique({ where: { id: getTenantId() } })
  if (!tenant) return
  await prisma.companyUnit.create({
    data: { tenantId: getTenantId(), name: tenant.name, slug: slugify(tenant.name), order: 0 }
  })
}

function serialize(a: {
  id: string
  body: string | null
  imageUrl: string | null
  createdAt: Date
  authorId: string
  companyUnit: { id: string; name: string; slug: string }
  author: { firstName: string; lastName: string; avatarUrl: string | null }
  reads: { userId: string }[]
}, userId: string) {
  return {
    id: a.id,
    body: a.body,
    imageUrl: a.imageUrl,
    createdAt: a.createdAt,
    authorId: a.authorId,
    company: a.companyUnit,
    author: a.author,
    isUnread: !a.reads.some(r => r.userId === userId)
  }
}

router.get('/company-units', async (req, res) => {
  try {
    await ensureDefaultUnit()
    const includeInactive = ['PLATFORM_MANAGER', 'HR'].includes(req.user!.role)
    const units = await prisma.companyUnit.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }]
    })
    res.json({ units })
  } catch (err) {
    logger.error('List company units failed', err)
    res.status(500).json({ error: 'Impossible de charger les entités' })
  }
})

router.post('/company-units', authorize('PLATFORM_MANAGER', 'HR'), async (req, res) => {
  try {
    const parsed = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Nom d\'entité requis' })
    const name = parsed.data.name
    let slug = slugify(name)
    const clash = await prisma.companyUnit.findFirst({ where: { slug } })
    if (clash) slug = `${slug}_${uuidv4().slice(0, 6).toUpperCase()}`
    const max = await prisma.companyUnit.aggregate({ _max: { order: true } })
    const unit = await prisma.companyUnit.create({
      data: { tenantId: getTenantId(), name, slug, order: (max._max.order ?? -1) + 1 }
    })
    res.status(201).json(unit)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'P2002') return res.status(409).json({ error: 'Cette entité existe déjà' })
    logger.error('Create company unit failed', err)
    res.status(500).json({ error: 'Impossible de créer l\'entité' })
  }
})

router.patch('/company-units/:id', authorize('PLATFORM_MANAGER', 'HR'), async (req, res) => {
  try {
    const parsed = z.object({
      name: z.string().trim().min(1).max(80).optional(),
      isActive: z.boolean().optional()
    }).safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Données invalides' })
    const unit = await prisma.companyUnit.update({
      where: { id: req.params.id },
      data: parsed.data
    })
    res.json(unit)
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Entité introuvable' })
    logger.error('Update company unit failed', err)
    res.status(500).json({ error: 'Impossible de modifier l\'entité' })
  }
})

router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.user!.userId
    const unreadCount = await prisma.announcement.count({
      where: { NOT: { reads: { some: { userId } } } }
    })
    res.json({ unreadCount })
  } catch (err) {
    logger.error('Unread announcements failed', err)
    res.status(500).json({ error: 'Impossible de charger le compteur' })
  }
})

router.get('/', async (req, res) => {
  try {
    const userId = req.user!.userId
    const companyUnitId = typeof req.query.companyUnitId === 'string' ? req.query.companyUnitId : undefined
    const items = await prisma.announcement.findMany({
      where: companyUnitId ? { companyUnitId } : {},
      orderBy: { createdAt: 'desc' },
      take: 80,
      include: {
        companyUnit: { select: { id: true, name: true, slug: true } },
        author: { select: { firstName: true, lastName: true, avatarUrl: true } },
        reads: { where: { userId }, select: { userId: true } }
      }
    })
    const unreadCount = await prisma.announcement.count({
      where: { NOT: { reads: { some: { userId } } } }
    })
    res.json({ announcements: items.map(a => serialize(a, userId)), unreadCount })
  } catch (err) {
    logger.error('List announcements failed', err)
    res.status(500).json({ error: 'Impossible de charger les actualités' })
  }
})

router.post(
  '/',
  (req, res, next) => {
    imageUpload.single('image')(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image trop lourde (8 Mo max)' })
      }
      if (err && (err as Error).message === 'IMAGE_TYPE') {
        return res.status(400).json({ error: 'Formats acceptés : JPG, PNG, WebP, GIF' })
      }
      if (err) {
        logger.error('announcement image multer', err)
        return res.status(400).json({ error: 'Image invalide' })
      }
      next()
    })
  },
  reenterTenant,
  async (req, res) => {
    try {
      const companyUnitId = String(req.body.companyUnitId || '').trim()
      const body = typeof req.body.body === 'string' ? req.body.body.trim() : ''
      const imageUrl = req.file ? `/uploads/announcements/${req.file.filename}` : null
      if (!companyUnitId) return res.status(400).json({ error: 'Choisissez une entité' })
      if (!body && !imageUrl) return res.status(400).json({ error: 'Ajoutez un texte ou une image' })
      if (body.length > 8000) return res.status(400).json({ error: 'Texte trop long' })

      const unit = await prisma.companyUnit.findFirst({ where: { id: companyUnitId, isActive: true } })
      if (!unit) return res.status(400).json({ error: 'Entité introuvable' })

      const created = await prisma.announcement.create({
        data: {
          tenantId: getTenantId(),
          companyUnitId,
          authorId: req.user!.userId,
          body: body || null,
          imageUrl
        },
        include: {
          companyUnit: { select: { id: true, name: true, slug: true } },
          author: { select: { firstName: true, lastName: true, avatarUrl: true } }
        }
      })
      await prisma.announcementRead.create({
        data: { tenantId: getTenantId(), announcementId: created.id, userId: req.user!.userId }
      })
      res.status(201).json(serialize({ ...created, reads: [{ userId: req.user!.userId }] }, req.user!.userId))
    } catch (err) {
      logger.error('Create announcement failed', err)
      res.status(500).json({ error: 'Impossible de publier' })
    }
  }
)

router.post('/read', async (req, res) => {
  try {
    const userId = req.user!.userId
    const ids = Array.isArray(req.body?.ids)
      ? (req.body.ids as unknown[]).filter((id): id is string => typeof id === 'string')
      : []
    const unread = await prisma.announcement.findMany({
      where: {
        ...(ids.length ? { id: { in: ids } } : {}),
        NOT: { reads: { some: { userId } } }
      },
      select: { id: true }
    })
    if (unread.length > 0) {
      await prisma.announcementRead.createMany({
        data: unread.map(a => ({ announcementId: a.id, userId, tenantId: getTenantId() })),
        skipDuplicates: true
      })
    }
    const unreadCount = await prisma.announcement.count({
      where: { NOT: { reads: { some: { userId } } } }
    })
    res.json({ marked: unread.length, unreadCount })
  } catch (err) {
    logger.error('Mark announcements read failed', err)
    res.status(500).json({ error: 'Impossible de marquer comme lu' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.announcement.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Actualité introuvable' })
    const canDelete = existing.authorId === req.user!.userId
      || ['PLATFORM_MANAGER', 'HR'].includes(req.user!.role)
    if (!canDelete) return res.status(403).json({ error: 'Vous ne pouvez pas supprimer cette actualité' })
    await prisma.announcement.delete({ where: { id: existing.id } })
    if (existing.imageUrl) {
      const rel = existing.imageUrl.replace(/^\/uploads\//, '')
      const file = path.join(process.cwd(), 'uploads', rel)
      fs.unlink(file, () => {})
    }
    res.json({ ok: true })
  } catch (err) {
    logger.error('Delete announcement failed', err)
    res.status(500).json({ error: 'Impossible de supprimer' })
  }
})

export default router
