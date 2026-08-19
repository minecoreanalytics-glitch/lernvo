import { Router } from 'express'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import { Role } from '@prisma/client'
import { prisma } from '../utils/prisma'
import { getTenantId } from '../utils/tenantContext'
import { authenticate, authorize } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { NotificationService } from '../services/notifications'
import { OnboardingService } from '../services/onboarding'
import { logger } from '../utils/logger'

const router = Router()
router.use(authenticate)

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.nativeEnum(Role),
  departmentId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  hiredAt: z.string().datetime().optional()
})

const UpdateUserSchema = CreateUserSchema.partial().omit({ password: true })

const BulkDepartmentSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1, 'Au moins un utilisateur requis'),
  departmentId: z.string().uuid().nullable()
})

// ─── CSV Import helpers ──────────────────────────────────────────────────────

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true)
    } else {
      cb(new Error('Seuls les fichiers CSV sont acceptés'))
    }
  }
})

const ImportRowSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide'),
  role: z.nativeEnum(Role, { errorMap: () => ({ message: `Rôle invalide. Valeurs acceptées: ${Object.values(Role).join(', ')}` }) }),
  departmentId: z.string().uuid('departmentId invalide').optional()
})

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++ }
      else if (ch === '"') { inQuotes = false }
      else { current += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { fields.push(current.trim()); current = '' }
      else { current += ch }
    }
  }
  fields.push(current.trim())
  return fields
}

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim().length > 0)
  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0])
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      if (values[idx] !== undefined && values[idx] !== '') row[h] = values[idx]
    })
    rows.push(row)
  }
  return rows
}

// GET /api/users — HR, Manager, Platform Manager
router.get('/', authorize('PLATFORM_MANAGER', 'HR', 'MANAGER'), async (req, res) => {
  try {
    const { department, role, search, page = '1', limit = '20' } = req.query as Record<string, string>
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where: Record<string, unknown> = {}
    if (department) where.departmentId = department
    if (role) where.role = role
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Managers/supervisors only see their department
    if (req.user!.role === 'MANAGER' || req.user!.role === 'SUPERVISOR') {
      const me = await prisma.user.findUnique({ where: { id: req.user!.userId } })
      if (!me?.departmentId) {
        return res.status(403).json({ error: 'Manager must be assigned to a department' })
      }
      where.departmentId = me.departmentId
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, avatarUrl: true, isActive: true,
          totalPoints: true, currentStreak: true, lastLoginAt: true,
          department: { select: { id: true, name: true } },
          hiredAt: true, createdAt: true
        },
        skip, take: parseInt(limit), orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ])

    res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) })
  } catch {
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

// GET /api/users/my-team — Manager/Supervisor sees their direct reports + training progress
router.get('/my-team', authorize('MANAGER', 'SUPERVISOR', 'HR', 'PLATFORM_MANAGER'), async (req, res) => {
  try {
    const userId = req.user!.userId
    const now = new Date()
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)

    const team = await prisma.user.findMany({
      where: { managerId: userId, isActive: true },
      select: {
        id: true, firstName: true, lastName: true, email: true, avatarUrl: true,
        role: true, totalPoints: true, currentStreak: true, lastLoginAt: true,
        department: { select: { id: true, name: true, icon: true } },
        enrollments: {
          select: {
            id: true, status: true, progressPct: true, dueAt: true,
            module: { select: { id: true, title: true } }
          },
          orderBy: { updatedAt: 'desc' },
          take: 5
        },
        _count: {
          select: {
            enrollments: true,
            quizAttempts: true,
            userBadges: true
          }
        }
      },
      orderBy: { firstName: 'asc' }
    })

    // Enrich with overdue count
    const enriched = team.map(member => {
      const overdueCount = member.enrollments.filter(
        e => e.dueAt && new Date(e.dueAt) < todayStart && e.status !== 'COMPLETED'
      ).length
      const completedCount = member.enrollments.filter(e => e.status === 'COMPLETED').length
      const inProgressCount = member.enrollments.filter(e => e.status === 'IN_PROGRESS').length

      return {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        avatarUrl: member.avatarUrl,
        role: member.role,
        totalPoints: member.totalPoints,
        currentStreak: member.currentStreak,
        lastLoginAt: member.lastLoginAt,
        department: member.department,
        overdueCount,
        completedCount,
        inProgressCount,
        totalEnrollments: member._count.enrollments,
        totalQuizAttempts: member._count.quizAttempts,
        totalBadges: member._count.userBadges,
        recentEnrollments: member.enrollments
      }
    })

    res.json({ team: enriched, count: enriched.length })
  } catch (err) {
    logger.error('My team error:', err)
    res.status(500).json({ error: 'Failed to fetch team' })
  }
})

// POST /api/users/import — CSV bulk import (PLATFORM_MANAGER, HR only)
router.post('/import', authorize('PLATFORM_MANAGER', 'HR'), csvUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier CSV fourni' })
    }

    const content = req.file.buffer.toString('utf-8')
    const rows = parseCsv(content)

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Le fichier CSV est vide ou mal formaté' })
    }

    const tempPassword = randomBytes(12).toString('base64url')
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    // Validate all rows first
    const validRows: Array<{ rowNum: number; data: z.infer<typeof ImportRowSchema> }> = []
    const errors: { row: number; error: string }[] = []

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2
      const parsed = ImportRowSchema.safeParse(rows[i])
      if (!parsed.success) {
        errors.push({ row: rowNum, error: parsed.error.errors.map(e => e.message).join('; ') })
        continue
      }
      if (parsed.data.departmentId) {
        const dept = await prisma.department.findUnique({ where: { id: parsed.data.departmentId } })
        if (!dept) {
          errors.push({ row: rowNum, error: `Département introuvable: ${parsed.data.departmentId}` })
          continue
        }
      }
      validRows.push({ rowNum, data: parsed.data })
    }

    // Insert valid rows in a transaction
    let created = 0
    const createdUserIds: string[] = []
    if (validRows.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const { rowNum, data } of validRows) {
          try {
            const newUser = await tx.user.create({
              data: {
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email.toLowerCase(),
                passwordHash,
                role: data.role,
                tenantId: getTenantId(),
                departmentId: data.departmentId || undefined
              }
            })
            createdUserIds.push(newUser.id)
            created++
          } catch (err: unknown) {
            if ((err as { code?: string }).code === 'P2002') {
              errors.push({ row: rowNum, error: `Email déjà existant: ${data.email}` })
            } else {
              errors.push({ row: rowNum, error: `Erreur de création pour ${data.email}` })
            }
          }
        }
      })
    }

    // Welcome email + onboarding for each created user (fire-and-forget)
    let onboarded = 0
    for (const uid of createdUserIds) {
      NotificationService.sendWelcome(uid, tempPassword).catch(() => {})
      const result = await OnboardingService.triggerOnboarding(uid).catch(() => null)
      if (result) onboarded++
    }

    res.json({ created, onboarded, errors, tempPassword: created > 0 ? tempPassword : undefined })
  } catch (err) {
    logger.error('CSV import error:', err)
    res.status(500).json({ error: "Erreur lors de l'importation CSV" })
  }
})

// PATCH /api/users/bulk-department — mise à jour département en masse
router.patch('/bulk-department', authorize('PLATFORM_MANAGER', 'HR'), validate(BulkDepartmentSchema), async (req, res) => {
  try {
    const { userIds, departmentId } = req.body as z.infer<typeof BulkDepartmentSchema>

    if (departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId } })
      if (!dept) return res.status(400).json({ error: 'Département introuvable' })
    }

    const result = await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { departmentId }
    })

    res.json({ updated: result.count })
  } catch (err) {
    logger.error('Bulk department update error:', err)
    res.status(500).json({ error: 'Échec de la mise à jour en masse' })
  }
})

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  try {
    const canViewOthers = ['PLATFORM_MANAGER', 'HR', 'MANAGER', 'SUPERVISOR'].includes(req.user!.role)
    if (!canViewOthers && req.params.id !== req.user!.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        department: true,
        userBadges: { include: { badge: true }, orderBy: { earnedAt: 'desc' } },
        enrollments: { include: { module: { select: { id: true, title: true, thumbnail: true } } } },
        pathEnrollments: { include: { path: { select: { id: true, title: true, color: true } } } }
      }
    })

    if (!user) return res.status(404).json({ error: 'User not found' })
    const { passwordHash: _, ...safe } = user
    res.json(safe)
  } catch {
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// POST /api/users — HR, Platform Manager only
router.post('/', authorize('PLATFORM_MANAGER', 'HR'), validate(CreateUserSchema), async (req, res) => {
  try {
    const { password, ...rest } = req.body
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { ...rest, passwordHash },
      select: { id: true, email: true, firstName: true, lastName: true, role: true }
    })
    // Send welcome notification + email + trigger onboarding (fire-and-forget)
    NotificationService.sendWelcome(user.id, password).catch(() => {})
    OnboardingService.triggerOnboarding(user.id).catch(() => {})

    res.status(201).json(user)
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') return res.status(409).json({ error: 'Email already exists' })
    res.status(500).json({ error: 'Failed to create user' })
  }
})

// PUT /api/users/:id
router.put('/:id', authorize('PLATFORM_MANAGER', 'HR'), validate(UpdateUserSchema), async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: req.body,
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true }
    })
    res.json(user)
  } catch {
    res.status(500).json({ error: 'Failed to update user' })
  }
})

// POST /api/users/:id/reset-password — Admin/HR resets any user's password
router.post('/:id/reset-password', authorize('PLATFORM_MANAGER', 'HR'), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const tempPassword = randomBytes(8).toString('base64url').slice(0, 10)
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash } })
    // Revoke all refresh tokens so user is forced to re-login
    await prisma.refreshToken.deleteMany({ where: { userId: req.params.id } })

    // Email the new temp password to the user (fire-and-forget)
    const { EmailService } = await import('../services/email')
    EmailService.sendPasswordReset(req.params.id, tempPassword).catch(() => {})

    res.json({ tempPassword })
  } catch {
    res.status(500).json({ error: 'Failed to reset password' })
  }
})

// DELETE /api/users/:id — soft delete
router.delete('/:id', authorize('PLATFORM_MANAGER'), async (req, res) => {
  try {
    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } })
    res.json({ message: 'User deactivated' })
  } catch {
    res.status(500).json({ error: 'Failed to deactivate user' })
  }
})

export default router
