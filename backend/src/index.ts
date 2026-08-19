import express from 'express'
import path from 'path'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import { logger } from './utils/logger'
import { prisma } from './utils/prisma'
import { redis } from './utils/redis'
import authRoutes from './routes/auth'
import userRoutes from './routes/users'
import departmentRoutes from './routes/departments'
import moduleRoutes from './routes/modules'
import contentRoutes from './routes/content'
import quizRoutes from './routes/quizzes'
import careerRoutes from './routes/career'
import kbRoutes from './routes/kb'
import gamificationRoutes from './routes/gamification'
import notificationRoutes from './routes/notifications'
import assignmentRoutes from './routes/assignments'
import adminRoutes from './routes/admin'
import aiRoutes from './routes/ai'
import certificateRoutes from './routes/certificates'
import reportRoutes from './routes/reports'
import searchRoutes from './routes/search'
import integrationRoutes from './routes/integrations'
import analyticsRoutes from './routes/analytics'
import onboardingRoutes from './routes/onboarding'
import tenantRoutes from './routes/tenants'
import brandingRoutes from './routes/branding'
import approvalRoutes from './routes/approvals'
import hrRoutes from './routes/hr'
import publicRoutes from './routes/public'
import mcoreRoutes from './routes/mcore'
import { runDueConnectors } from './services/hr/connectors'
import chatRoutes from './routes/chat'

dotenv.config()

// Platform name — override via PLATFORM_NAME env var
const PLATFORM_NAME = process.env.PLATFORM_NAME || 'Lernvo' // eslint-disable-line @typescript-eslint/no-unused-vars

const app = express()
const PORT = process.env.PORT || 4000

// Trust proxy (behind Caddy + nginx)
app.set('trust proxy', 1)

// ─── Security & Parsing ───────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
// Uploaded media (videos, audio, files, certificates). Filenames are unguessable (uuid / cert number /
// content-id+timestamp); served without auth so <video>/<audio> tags can load them. TODO: signed URLs.
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), { maxAge: '30d', immutable: true, index: false, dotfiles: 'deny' }))
// Public read API: mounted BEFORE the platform CORS policy (open CORS, GET only, its own rate limit)
app.use('/api/public', express.json(), publicRoutes)
app.use(cors({
  origin: process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000'),
  credentials: true
}))
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ─── Rate Limiting ────────────────────────────────────────────────────────────
// 1500/15min per IP — enough headroom for many employees behind a shared corporate NAT
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1500, standardHeaders: true, legacyHeaders: false })
// Auth: strict brute-force protection (20 attempts per 15min per IP)
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false })
const integrationLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false })
app.use('/api', limiter)
app.use('/api/auth', authLimiter)
app.use('/api/integrations', integrationLimiter)

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/departments', departmentRoutes)
app.use('/api/modules', moduleRoutes)
app.use('/api/content', contentRoutes)
app.use('/api/quizzes', quizRoutes)
app.use('/api/career', careerRoutes)
app.use('/api/kb', kbRoutes)
app.use('/api/gamification', gamificationRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/assignments', assignmentRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/certificates', certificateRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/integrations', integrationRoutes)
app.use('/api/onboarding', onboardingRoutes)
app.use('/api/tenants', tenantRoutes)
app.use('/api/branding', brandingRoutes)
app.use('/api/approvals', approvalRoutes)
app.use('/api/hr', hrRoutes)
app.use('/api/mcore', mcoreRoutes)
app.use('/api/chat', chatRoutes)

// ─── Health Check (both /health and /api/health) ─────────────────────────────
const healthHandler: express.RequestHandler = async (_req, res) => {
  const checks: Record<string, string> = {}
  let healthy = true

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.postgres = 'ok'
  } catch {
    checks.postgres = 'error'
    healthy = false
  }

  try {
    await redis.ping()
    checks.redis = 'ok'
  } catch {
    checks.redis = 'error'
    healthy = false
  }

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks
  })
}
app.get('/health', healthHandler)
app.get('/api/health', healthHandler)

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(err.message, { stack: err.stack })
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  logger.info(`Lernvo API running on port ${PORT}`)
  // HRIS pull connectors scheduler (every 5 min, each connector honours its own interval)
  if (process.env.HR_SYNC_SCHEDULER !== 'off' && process.env.NODE_ENV !== 'test') {
    setInterval(() => { runDueConnectors().catch(e => logger.warn('hr scheduler', { error: (e as Error).message })) }, 5 * 60_000).unref()
  }
})

export default app
