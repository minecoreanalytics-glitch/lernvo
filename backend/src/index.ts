import express from 'express'
import path from 'path'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
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
import analyticsRoutes from './routes/analytics'
import onboardingRoutes from './routes/onboarding'
import tenantRoutes from './routes/tenants'
import brandingRoutes from './routes/branding'
import approvalRoutes from './routes/approvals'
import hrRoutes from './routes/hr'
import publicRoutes from './routes/public'
import mcoreRoutes from './routes/mcore'
import { apiLimiter, authSourceLimiter } from './middleware/limits'
import { mediaGuard } from './middleware/media'
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
// Uploaded media (videos, audio, files, certificates): cookie-authenticated + tenant-checked (middleware/media.ts)
app.use('/uploads', mediaGuard, express.static(path.join(process.cwd(), 'uploads'), { maxAge: '30d', immutable: true, index: false, dotfiles: 'deny', setHeaders: (r) => { r.setHeader('X-Content-Type-Options', 'nosniff'); r.setHeader('Content-Disposition', 'inline') } }))
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
// Limits are keyed by identity, never by IP for authenticated traffic: a customer's employees
// share one office NAT (see middleware/limits.ts).
app.use('/api', apiLimiter)
app.use('/api/auth', authSourceLimiter)

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

// Un rejet non géré ne doit jamais tuer le process en silence : on le trace et on continue.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason instanceof Error ? reason.stack : String(reason) })
})
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { stack: err.stack })
})

const server = app.listen(PORT, () => {
  logger.info(`Lernvo API running on port ${PORT}`)
  // HRIS pull connectors scheduler (every 5 min, each connector honours its own interval)
  if (process.env.HR_SYNC_SCHEDULER !== 'off' && process.env.NODE_ENV !== 'test') {
    setInterval(() => { runDueConnectors().catch(e => logger.warn('hr scheduler', { error: (e as Error).message })) }, 5 * 60_000).unref()
  }
})

// nginx garde ses connexions amont ouvertes 60 s. Si Node ferme les siennes avant, nginx envoie
// une requête dans une connexion en train de se fermer et le client reçoit un 502. Node doit donc
// toujours tenir plus longtemps que le proxy qui est devant lui.
server.keepAliveTimeout = 65_000
server.headersTimeout = 70_000

export default app
