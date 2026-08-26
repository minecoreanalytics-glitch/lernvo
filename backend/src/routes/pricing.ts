import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { authenticate, authorize, reenterTenant } from '../middleware/auth'
import {
  brandLabel,
  getActivePricingAlerts,
  getPricingByBrand,
  getPricingUploadHistory,
  getUploadChanges,
  getBatchUploads,
  importPricingFromExcel,
  listPricingBrands
} from '../services/pricing'
import { logger } from '../utils/logger'

const router = Router()
router.use(authenticate)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(xlsx|xls)$/i.test(file.originalname) ||
      file.mimetype.includes('spreadsheet') ||
      file.mimetype.includes('excel')
    if (ok) cb(null, true)
    else cb(new Error('Seuls les fichiers Excel (.xlsx, .xls) sont acceptés'))
  }
})

const UploadBodySchema = z.object({
  brand: z.string().min(1).max(60).optional()
})

router.get('/', async (req, res) => {
  try {
    const brand = typeof req.query.brand === 'string' ? req.query.brand : undefined
    const [categories, brands] = await Promise.all([
      getPricingByBrand(brand),
      listPricingBrands()
    ])
    res.json({ categories, brands })
  } catch (err) {
    logger.error('Get pricing error:', err)
    res.status(500).json({ error: 'Impossible de charger les tarifs' })
  }
})

router.get('/alerts', async (_req, res) => {
  try {
    const alerts = await getActivePricingAlerts()
    res.json({ alerts })
  } catch (err) {
    logger.error('Get pricing alerts error:', err)
    res.status(500).json({ error: 'Impossible de charger les alertes tarifs' })
  }
})

router.get('/uploads', authorize('PLATFORM_MANAGER', 'HR', 'MANAGER'), async (req, res) => {
  try {
    const brand = typeof req.query.brand === 'string' ? req.query.brand : undefined
    const uploads = await getPricingUploadHistory(brand)
    res.json({ uploads })
  } catch (err) {
    logger.error('Get pricing uploads error:', err)
    res.status(500).json({ error: 'Impossible de charger l\'historique' })
  }
})

router.get('/uploads/batch/:batchId', authorize('PLATFORM_MANAGER', 'HR', 'MANAGER'), async (req, res) => {
  try {
    const uploads = await getBatchUploads(req.params.batchId)
    res.json({ uploads })
  } catch (err) {
    logger.error('Get batch uploads error:', err)
    res.status(500).json({ error: 'Impossible de charger le lot d\'import' })
  }
})

router.get('/uploads/:id/changes', async (req, res) => {
  try {
    const changes = await getUploadChanges(req.params.id)
    res.json({ changes })
  } catch (err) {
    logger.error('Get pricing changes error:', err)
    res.status(500).json({ error: 'Impossible de charger les changements' })
  }
})

router.post(
  '/upload',
  authorize('PLATFORM_MANAGER', 'HR', 'MANAGER'),
  upload.single('file'),
  reenterTenant,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier Excel fourni' })
      }

      const parsed = UploadBodySchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Marque invalide' })
      }

      const result = await importPricingFromExcel(
        req.file.buffer,
        req.file.originalname,
        req.user!.userId,
        parsed.data.brand
      )

      res.json({
        message: result.brands.length > 1
          ? `Tarifs mis à jour pour ${result.brands.length} marques`
          : 'Tarifs importés avec succès',
        batchId: result.batchId,
        totalItems: result.totalItems,
        totalChanges: result.totalChanges,
        brands: result.brands.map(b => ({
          brand: b.brand,
          brandLabel: brandLabel(b.brand),
          itemCount: b.itemCount,
          changeCount: b.changeCount,
          uploadId: b.uploadId
        })),
        itemCount: result.totalItems,
        changeCount: result.totalChanges,
        uploadId: result.brands[0]?.uploadId
      })
    } catch (err) {
      logger.error('Pricing upload error:', err)
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'import'
      res.status(500).json({ error: msg })
    }
  }
)

export default router
