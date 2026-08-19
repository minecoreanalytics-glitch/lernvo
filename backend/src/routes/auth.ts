import { Router } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../utils/prisma'
import { validate } from '../middleware/validate'
import { authenticate } from '../middleware/auth'
import { tenantStore } from '../utils/tenantContext'
import { tenantSlugFromRequest } from '../utils/tenantHost'
import { logger } from '../utils/logger'

const router = Router()

const SignupSchema = z.object({
  companyName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(10),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})

const RefreshSchema = z.object({ refreshToken: z.string() })

function signAccess(userId: string, email: string, role: string, tenantId: string | null, departmentId: string | null) {
  return jwt.sign({ userId, email, role, tenantId, departmentId }, process.env.JWT_SECRET!, { expiresIn: '15m' })
}

function signRefresh() {
  return uuidv4()
}

// POST /api/auth/signup — public, creates PENDING tenant + inactive PLATFORM_MANAGER
router.post('/signup', validate(SignupSchema), async (req, res) => {
  try {
    const { companyName, email, password, firstName, lastName } = req.body as z.infer<typeof SignupSchema>

    // Build a URL-safe slug: lowercase, non-alnum → '-', trimmed, + 4 random base36 chars
    const base = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    const suffix = Math.random().toString(36).slice(2, 6)
    const slug = `${base}-${suffix}`

    const passwordHash = await bcrypt.hash(password, 12)

    // Use superAdmin context so the tenant-scoped User create succeeds before
    // any tenant context exists (fail-closed guard would otherwise throw).
    // Both creates are wrapped in an interactive transaction so an error on
    // user.create rolls back the tenant — no orphaned tenants.
    const tenant = await tenantStore.run({ tenantId: null, superAdmin: true }, async () => {
      return prisma.$transaction(async (tx) => {
        const newTenant = await tx.tenant.create({
          data: { name: companyName, slug, status: 'PENDING' },
        })
        await tx.user.create({
          data: {
            email,
            passwordHash,
            firstName,
            lastName,
            role: 'PLATFORM_MANAGER',
            isActive: false,
            tenantId: newTenant.id,
          },
        })
        return newTenant
      })
    })

    res.status(201).json({
      tenantStatus: tenant.status,
      message: "Compte créé, en attente d'approbation.",
    })
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002') {
      return res.status(409).json({ error: 'Email already in use' })
    }
    logger.error('Signup failed', { err })
    res.status(500).json({ error: 'Signup failed' })
  }
})

// POST /api/auth/login
router.post('/login', validate(LoginSchema), async (req, res) => {
  try {
    const { email, password } = req.body

    // Lookup user in superAdmin context — no tenant context exists at login time
    const user = await tenantStore.run({ tenantId: null, superAdmin: true },
      async () => {
        return await prisma.user.findUnique({ where: { email } })
      })
    if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    // Tenant gate: non-SUPER_ADMIN users cannot log in unless their tenant is ACTIVE
    if (user.role !== 'SUPER_ADMIN') {
      const tenant = await tenantStore.run({ tenantId: null, superAdmin: true },
        async () => {
          return await prisma.tenant.findUnique({ where: { id: user.tenantId } })
        })
      if (!tenant || tenant.status !== 'ACTIVE') {
        return res.status(403).json({ error: "Compte en attente d'approbation." })
      }
      // Host lock: on <slug>.<DOMAIN>, only that tenant's users may log in
      const hostSlug = tenantSlugFromRequest(req)
      if (hostSlug && hostSlug !== tenant.slug) {
        return res.status(401).json({ error: 'Invalid credentials' })
      }
    }

    const accessToken = signAccess(user.id, user.email, user.role, user.tenantId, user.departmentId ?? null)
    const refreshToken = signRefresh()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    await tenantStore.run({ tenantId: null, superAdmin: true }, async () => {
      await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } })
      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    })

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        avatarUrl: user.avatarUrl,
        totalPoints: user.totalPoints,
        currentStreak: user.currentStreak
      }
    })
  } catch (err) {
    logger.error('Login failed', { err })
    res.status(500).json({ error: 'Login failed' })
  }
})

// POST /api/auth/refresh
router.post('/refresh', validate(RefreshSchema), async (req, res) => {
  try {
    const { refreshToken } = req.body
    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    })

    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' })
    }

    // Host lock (same rule as /login): on <slug>.<DOMAIN> only that tenant's users
    const hostSlug = tenantSlugFromRequest(req)
    if (hostSlug && stored.user.role !== 'SUPER_ADMIN') {
      const t = await tenantStore.run({ tenantId: null, superAdmin: true }, async () =>
        await prisma.tenant.findUnique({ where: { id: stored.user.tenantId }, select: { slug: true } }))
      if (!t || t.slug !== hostSlug) return res.status(401).json({ error: 'Invalid or expired refresh token' })
    }
    const accessToken = signAccess(stored.user.id, stored.user.email, stored.user.role, stored.user.tenantId, stored.user.departmentId ?? null)
    res.json({ accessToken })
  } catch {
    res.status(500).json({ error: 'Token refresh failed' })
  }
})

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    const { refreshToken } = req.body
    if (refreshToken) {
      // Only delete tokens belonging to the authenticated user
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken, userId: req.user!.userId }
      })
    }
    // Also revoke all other tokens for this user to force re-login on all devices
    await prisma.refreshToken.deleteMany({ where: { userId: req.user!.userId } })
    res.json({ message: 'Logged out' })
  } catch {
    res.status(500).json({ error: 'Logout failed' })
  }
})

// POST /api/auth/change-password — authenticated user changes their own password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mot de passe actuel et nouveau requis' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' })
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' })

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })

    res.json({ message: 'Mot de passe mis à jour' })
  } catch {
    res.status(500).json({ error: 'Failed to change password' })
  }
})

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        department: true,
        userBadges: { include: { badge: true }, orderBy: { earnedAt: 'desc' }, take: 5 }
      }
    })
    if (!user) return res.status(404).json({ error: 'User not found' })
    const { passwordHash: _, ...safe } = user
    res.json(safe)
  } catch {
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

export default router
