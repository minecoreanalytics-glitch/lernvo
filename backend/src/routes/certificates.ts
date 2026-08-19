import { Router } from 'express'
import { prisma } from '../utils/prisma'
import { authenticate } from '../middleware/auth'
import { CertificateService } from '../services/certificate'
import { NotificationService } from '../services/notifications'
import path from 'path'
import fs from 'fs'

const router = Router()

// ─── GET /api/certificates/verify/:certNumber ────────────────────────────────
// Public endpoint — verify a certificate by number (no auth needed)
router.get('/verify/:certNumber', async (req, res) => {
  try {
    const result = await CertificateService.verify(req.params.certNumber)
    if (!result) return res.status(404).json({ error: 'Certificate not found' })
    res.json(result)
  } catch {
    res.status(500).json({ error: 'Verification failed' })
  }
})

// All other routes require auth
router.use(authenticate)

// ─── GET /api/certificates ───────────────────────────────────────────────────
// Get current user's certificates
router.get('/', async (req, res) => {
  try {
    const certs = await CertificateService.getUserCertificates(req.user!.userId)
    res.json(certs)
  } catch {
    res.status(500).json({ error: 'Failed to fetch certificates' })
  }
})

// ─── POST /api/certificates/module/:moduleId ─────────────────────────────────
// Issue certificate for module completion
router.post('/module/:moduleId', async (req, res) => {
  try {
    // Verify the module is completed by this user
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: req.user!.userId,
        moduleId: req.params.moduleId,
        status: 'COMPLETED'
      }
    })

    if (!enrollment) {
      return res.status(400).json({ error: 'Module not completed yet' })
    }

    const cert = await CertificateService.issueForModule(req.user!.userId, req.params.moduleId)

    // Send certificate notification - fetch module title
    const mod = await prisma.module.findUnique({ where: { id: req.params.moduleId }, select: { title: true } })
    if (mod) {
      NotificationService.sendCertificateIssued(req.user!.userId, mod.title, cert.certNumber).catch(() => {})
    }

    res.status(201).json(cert)
  } catch (err) {
    res.status(500).json({ error: 'Failed to issue certificate' })
  }
})

// ─── POST /api/certificates/path/:pathId ─────────────────────────────────────
// Issue certificate for career path completion
router.post('/path/:pathId', async (req, res) => {
  try {
    const enrollment = await prisma.careerPathEnrollment.findFirst({
      where: {
        userId: req.user!.userId,
        pathId: req.params.pathId,
        status: 'COMPLETED'
      }
    })

    if (!enrollment) {
      return res.status(400).json({ error: 'Career path not completed yet' })
    }

    const cert = await CertificateService.issueForPath(req.user!.userId, req.params.pathId)

    // Send certificate notification - fetch path title
    const careerPath = await prisma.careerPath.findUnique({ where: { id: req.params.pathId }, select: { title: true } })
    if (careerPath) {
      NotificationService.sendCertificateIssued(req.user!.userId, careerPath.title, cert.certNumber).catch(() => {})
    }

    res.status(201).json(cert)
  } catch (err) {
    res.status(500).json({ error: 'Failed to issue certificate' })
  }
})

// ─── GET /api/certificates/:id/download ──────────────────────────────────────
// Download certificate SVG
router.get('/:id/download', async (req, res) => {
  try {
    const cert = await prisma.certificate.findUnique({
      where: { id: req.params.id }
    })

    if (!cert) return res.status(404).json({ error: 'Certificate not found' })

    // Check ownership or admin
    const isAdmin = ['PLATFORM_MANAGER', 'HR'].includes(req.user!.role)
    if (cert.userId !== req.user!.userId && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const filepath = path.join(process.cwd(), 'uploads', 'certificates', `${cert.certNumber}.svg`)
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Certificate file not found' })
    }

    res.setHeader('Content-Type', 'image/svg+xml')
    res.setHeader('Content-Disposition', `attachment; filename="${cert.certNumber}.svg"`)
    fs.createReadStream(filepath).pipe(res)
  } catch {
    res.status(500).json({ error: 'Failed to download certificate' })
  }
})

export default router
