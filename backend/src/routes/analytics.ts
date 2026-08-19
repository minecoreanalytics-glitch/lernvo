import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth'
import { AnalyticsService } from '../services/analytics'

const router = Router()
router.use(authenticate)

// GET /api/analytics/overview?days=30 (PM/HR only)
router.get('/overview', authorize('PLATFORM_MANAGER', 'HR'), async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30
    const [overview, activeUsers] = await Promise.all([
      AnalyticsService.getOverview(days),
      AnalyticsService.getActiveUsers(days)
    ])
    res.json({ ...overview, ...activeUsers })
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch overview' })
  }
})

// GET /api/analytics/pages?days=30 (PM/HR only)
router.get('/pages', authorize('PLATFORM_MANAGER', 'HR'), async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30
    res.json(await AnalyticsService.getEntryExitPages(days))
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to fetch pages' })
  }
})

// GET /api/analytics/courses?days=30 (PM/HR only)
router.get('/courses', authorize('PLATFORM_MANAGER', 'HR'), async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30
    res.json(await AnalyticsService.getCourseStats(days))
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to fetch course stats' })
  }
})

// GET /api/analytics/timeline?days=30 (PM/HR only)
router.get('/timeline', authorize('PLATFORM_MANAGER', 'HR'), async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30
    res.json(await AnalyticsService.getTimeline(days))
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to fetch timeline' })
  }
})

// GET /api/analytics/logs?limit=50 (PM/HR only)
router.get('/logs', authorize('PLATFORM_MANAGER', 'HR'), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50
    res.json(await AnalyticsService.getRecentLogs(limit))
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to fetch logs' })
  }
})

// POST /api/analytics/session/start (all authenticated users)
router.post('/session/start', async (req, res) => {
  try {
    const { entryPage, device } = req.body
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    const sessionId = await AnalyticsService.startSession(userId, entryPage || '/', device)
    res.json({ sessionId })
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to start session' })
  }
})

// POST /api/analytics/session/end
router.post('/session/end', async (req, res) => {
  try {
    const { sessionId, exitPage } = req.body
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' })
    await AnalyticsService.endSession(sessionId, exitPage || '/')
    res.json({ ok: true })
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to end session' })
  }
})

// POST /api/analytics/event (all authenticated users)
router.post('/event', async (req, res) => {
  try {
    const { sessionId, event, page, referenceId, metadata } = req.body
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    await AnalyticsService.log(userId, sessionId, event, page, referenceId, metadata)
    res.json({ ok: true })
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to log event' })
  }
})

export default router
