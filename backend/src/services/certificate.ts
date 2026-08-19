/**
 * Certificate PDF Generator
 * Generates professional certificates using SVG → HTML approach (no heavy deps)
 */
import { prisma } from '../utils/prisma'
import { getTenantId } from '../utils/tenantContext'
import { pushCertificate } from './hr/connectors'
import fs from 'fs'
import path from 'path'

const CERT_DIR = path.join(process.cwd(), 'uploads', 'certificates')

// Ensure directory exists
if (!fs.existsSync(CERT_DIR)) {
  fs.mkdirSync(CERT_DIR, { recursive: true })
}

function generateCertNumber(tenantSlug: string): string {
  const year = new Date().getFullYear()
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `${tenantSlug.toUpperCase()}-${year}-${rand}`
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Generate an SVG certificate (can be converted to PDF client-side or served as-is)
 */
function generateCertificateSVG(data: {
  recipientName: string
  title: string
  description: string
  certNumber: string
  issuedAt: Date
  score?: number | null
}): string {
  const { recipientName, title, description, certNumber, issuedAt, score } = data

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 842 595" width="842" height="595">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f1923;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1a2d42;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#D4A574;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#F5DEB3;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#D4A574;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="842" height="595" fill="url(#bg)" />

  <!-- Gold border -->
  <rect x="20" y="20" width="802" height="555" fill="none" stroke="url(#gold)" stroke-width="2" rx="8" />
  <rect x="28" y="28" width="786" height="539" fill="none" stroke="url(#gold)" stroke-width="0.5" rx="6" />

  <!-- Corner ornaments -->
  <circle cx="40" cy="40" r="4" fill="url(#gold)" opacity="0.6" />
  <circle cx="802" cy="40" r="4" fill="url(#gold)" opacity="0.6" />
  <circle cx="40" cy="555" r="4" fill="url(#gold)" opacity="0.6" />
  <circle cx="802" cy="555" r="4" fill="url(#gold)" opacity="0.6" />

  <!-- Logo area -->
  <text x="421" y="80" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#D4A574" letter-spacing="8">${(process.env.PLATFORM_NAME || 'Lernvo').toUpperCase()}</text>

  <!-- Decorative line -->
  <line x1="250" y1="100" x2="592" y2="100" stroke="url(#gold)" stroke-width="0.5" />

  <!-- Certificate title -->
  <text x="421" y="150" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="url(#gold)" letter-spacing="4">CERTIFICAT</text>
  <text x="421" y="175" text-anchor="middle" font-family="Georgia, serif" font-size="12" fill="#8BA3B9" letter-spacing="6">DE FORMATION</text>

  <!-- Decorative line -->
  <line x1="320" y1="195" x2="522" y2="195" stroke="url(#gold)" stroke-width="0.5" />

  <!-- "Décerné à" -->
  <text x="421" y="230" text-anchor="middle" font-family="Georgia, serif" font-size="11" fill="#8BA3B9" letter-spacing="3">DÉCERNÉ À</text>

  <!-- Recipient name -->
  <text x="421" y="270" text-anchor="middle" font-family="Georgia, serif" font-size="32" fill="#FFFFFF" font-weight="bold">${escapeXml(recipientName)}</text>

  <!-- Decorative line under name -->
  <line x1="250" y1="290" x2="592" y2="290" stroke="url(#gold)" stroke-width="0.5" />

  <!-- Description -->
  <text x="421" y="325" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#8BA3B9">pour avoir complété avec succès la formation</text>

  <!-- Module title -->
  <text x="421" y="360" text-anchor="middle" font-family="Georgia, serif" font-size="20" fill="#D4A574" font-style="italic">${escapeXml(title)}</text>

  <!-- Description / category -->
  <text x="421" y="390" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#6B8299">${escapeXml(description)}</text>

  ${score !== null && score !== undefined ? `
  <!-- Score -->
  <text x="421" y="420" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#D4A574">Score: ${Math.round(score)}%</text>
  ` : ''}

  <!-- Bottom section -->
  <line x1="100" y1="470" x2="742" y2="470" stroke="url(#gold)" stroke-width="0.3" />

  <!-- Date -->
  <text x="200" y="510" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" fill="#6B8299">Date de délivrance</text>
  <text x="200" y="530" text-anchor="middle" font-family="Georgia, serif" font-size="12" fill="#FFFFFF">${formatDate(issuedAt)}</text>
  <line x1="130" y1="495" x2="270" y2="495" stroke="url(#gold)" stroke-width="0.3" />

  <!-- Certificate number -->
  <text x="421" y="510" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" fill="#6B8299">Numéro de certificat</text>
  <text x="421" y="530" text-anchor="middle" font-family="monospace" font-size="11" fill="#D4A574">${certNumber}</text>

  <!-- Signature area -->
  <text x="642" y="510" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" fill="#6B8299">Direction ${escapeXml(process.env.PLATFORM_NAME || 'Lernvo')}</text>
  <text x="642" y="530" text-anchor="middle" font-family="Georgia, serif" font-size="12" fill="#FFFFFF" font-style="italic">Allen C. Bayard</text>
  <line x1="572" y1="495" x2="712" y2="495" stroke="url(#gold)" stroke-width="0.3" />

  <!-- Footer -->
  <text x="421" y="570" text-anchor="middle" font-family="Arial, sans-serif" font-size="8" fill="#4A6377">${escapeXml(process.env.PLATFORM_NAME || 'Lernvo')}</text>
</svg>`
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export class CertificateService {

  /**
   * Issue a certificate for module completion
   */
  static async issueForModule(userId: string, moduleId: string): Promise<{ id: string; certNumber: string; downloadUrl: string }> {
    // Check if already issued
    const existing = await prisma.certificate.findFirst({
      where: { userId, moduleId }
    })
    if (existing) {
      return { id: existing.id, certNumber: existing.certNumber, downloadUrl: existing.downloadUrl || `/api/certificates/${existing.id}/download` }
    }

    // Get user and module data
    const [user, module, enrollment] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, tenantId: true } }),
      prisma.module.findUnique({
        where: { id: moduleId },
        include: { category: { select: { name: true } } }
      }),
      prisma.enrollment.findFirst({
        where: { userId, moduleId, status: 'COMPLETED' },
        select: { score: true }
      })
    ])

    if (!user || !module) throw new Error('User or module not found')
    if (!enrollment) throw new Error('Module not completed')

    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { slug: true } })
    const tenantSlug = tenant?.slug || 'lernvo'
    const certNumber = generateCertNumber(tenantSlug)
    const issuedAt = new Date()

    // Generate SVG
    const svg = generateCertificateSVG({
      recipientName: `${user.firstName} ${user.lastName}`,
      title: module.title,
      description: module.category?.name || module.description || '',
      certNumber,
      issuedAt,
      score: enrollment.score
    })

    // Save SVG file
    const filename = `${certNumber}.svg`
    const filepath = path.join(CERT_DIR, filename)
    fs.writeFileSync(filepath, svg)

    // Save to DB
    const cert = await prisma.certificate.create({
      data: {
        tenantId: getTenantId(),
        userId,
        moduleId,
        title: module.title,
        score: enrollment.score,
        certNumber,
        issuedAt,
        downloadUrl: `/uploads/certificates/${filename}`
      }
    })
    pushCertificate(userId, module.title, certNumber, issuedAt).catch(() => {}) // HRIS (best effort)

    return { id: cert.id, certNumber: cert.certNumber, downloadUrl: cert.downloadUrl! }
  }

  /**
   * Issue a certificate for career path completion
   */
  static async issueForPath(userId: string, pathId: string): Promise<{ id: string; certNumber: string; downloadUrl: string }> {
    const existing = await prisma.certificate.findFirst({ where: { userId, pathId } })
    if (existing) {
      return { id: existing.id, certNumber: existing.certNumber, downloadUrl: existing.downloadUrl || `/api/certificates/${existing.id}/download` }
    }

    const [user, careerPath] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, tenantId: true } }),
      prisma.careerPath.findUnique({ where: { id: pathId } })
    ])

    if (!user || !careerPath) throw new Error('User or career path not found')

    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { slug: true } })
    const tenantSlug = tenant?.slug || 'lernvo'
    const certNumber = generateCertNumber(tenantSlug)
    const issuedAt = new Date()

    const svg = generateCertificateSVG({
      recipientName: `${user.firstName} ${user.lastName}`,
      title: careerPath.title,
      description: careerPath.description || 'Parcours carrière',
      certNumber,
      issuedAt
    })

    const filename = `${certNumber}.svg`
    fs.writeFileSync(path.join(CERT_DIR, filename), svg)

    const cert = await prisma.certificate.create({
      data: {
        tenantId: getTenantId(),
        userId,
        pathId,
        title: careerPath.title,
        certNumber,
        issuedAt,
        downloadUrl: `/uploads/certificates/${filename}`
      }
    })
    pushCertificate(userId, careerPath.title, certNumber, issuedAt).catch(() => {}) // HRIS (best effort)

    return { id: cert.id, certNumber: cert.certNumber, downloadUrl: cert.downloadUrl! }
  }

  /**
   * Get all certificates for a user
   */
  static async getUserCertificates(userId: string) {
    return prisma.certificate.findMany({
      where: { userId },
      include: {
        module: { select: { id: true, title: true } },
        path: { select: { id: true, title: true } }
      },
      orderBy: { issuedAt: 'desc' }
    })
  }

  /**
   * Verify a certificate by number
   */
  static async verify(certNumber: string) {
    const cert = await prisma.certificate.findUnique({
      where: { certNumber },
      include: {
        user: { select: { firstName: true, lastName: true } },
        module: { select: { title: true } },
        path: { select: { title: true } }
      }
    })
    if (!cert) return null

    const isExpired = cert.expiresAt ? new Date() > cert.expiresAt : false
    return {
      valid: !isExpired,
      certNumber: cert.certNumber,
      recipientName: `${cert.user.firstName} ${cert.user.lastName}`,
      title: cert.module?.title || cert.path?.title || cert.title,
      issuedAt: cert.issuedAt,
      expiresAt: cert.expiresAt,
      score: cert.score
    }
  }
}
