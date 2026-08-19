import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { randomBytes } from 'crypto'
import { prisma } from '../utils/prisma'
import { authenticate, authorize, reenterTenant } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { tenantStore, getTenantId } from '../utils/tenantContext'
import { sha256 } from '../utils/crypto'
import { logger } from '../utils/logger'
import { applyHrPayload, parseCsv, csvToPayload, type HrPayload } from '../services/hr/sync'
import { encryptConfig, maskConfig, testConnector, runConnector } from '../services/hr/connectors'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

// ── External push (n8n, Salesforce flow, any HRIS): X-HR-Key resolves the tenant ──
const pushLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false })
const PayloadSchema = z.object({
  departments: z.array(z.object({ externalId: z.string().min(1), name: z.string().min(1), parentExternalId: z.string().nullable().optional(), managerName: z.string().nullable().optional() })).optional(),
  employees: z.array(z.object({
    externalId: z.string().min(1), email: z.string().email(), firstName: z.string().min(1), lastName: z.string().min(1),
    role: z.enum(['AGENT', 'SUPERVISOR', 'MANAGER', 'HR', 'PLATFORM_MANAGER']).nullable().optional(),
    departmentExternalId: z.string().nullable().optional(), departmentName: z.string().nullable().optional(),
    managerExternalId: z.string().nullable().optional(), hiredAt: z.string().nullable().optional(), active: z.boolean().optional(),
  })).max(5000),
  deactivateMissing: z.boolean().optional(),
})

router.post('/push', pushLimiter, validate(PayloadSchema), async (req: Request, res: Response) => {
  const key = req.headers['x-hr-key']
  if (typeof key !== 'string' || key.length < 20) return res.status(401).json({ error: 'Missing X-HR-Key' })
  const connector = await tenantStore.run({ tenantId: null, superAdmin: true }, async () =>
    await prisma.hrConnector.findFirst({ where: { type: 'API', enabled: true, apiKeyHash: sha256(key) } }))
  if (!connector) return res.status(401).json({ error: 'Invalid key' })
  const body = req.body as HrPayload & { deactivateMissing?: boolean }
  const result = await tenantStore.run({ tenantId: connector.tenantId, superAdmin: false }, async () => {
    const run = await prisma.hrSyncRun.create({ data: { tenantId: connector.tenantId, connectorId: connector.id, source: 'API', status: 'running' } })
    try {
      const stats = await applyHrPayload('API', body, { deactivateMissing: body.deactivateMissing ?? connector.deactivateMissing })
      await prisma.hrSyncRun.update({ where: { id: run.id }, data: { status: 'success', stats: stats as object, finishedAt: new Date() } })
      await prisma.hrConnector.update({ where: { id: connector.id }, data: { lastRunAt: new Date() } })
      return { ok: true, stats }
    } catch (e) {
      await prisma.hrSyncRun.update({ where: { id: run.id }, data: { status: 'error', error: (e as Error).message.slice(0, 1000), finishedAt: new Date() } })
      throw e
    }
  }).catch((e: Error) => ({ ok: false, error: e.message }))
  res.status('ok' in result && result.ok ? 200 : 500).json(result)
})

// ── Admin (JWT) ──
router.use(authenticate)
router.use(authorize('PLATFORM_MANAGER'))

const publicConnector = (c: { config: unknown; apiKeyHash?: string | null } & Record<string, unknown>) => {
  const { apiKeyHash, config, ...rest } = c
  return { ...rest, config: maskConfig((config ?? {}) as Record<string, unknown>), hasApiKey: !!apiKeyHash }
}

router.get('/connectors', async (_req, res) => {
  const list = await prisma.hrConnector.findMany({ orderBy: { createdAt: 'asc' } })
  res.json(list.map(publicConnector))
})

const ConnectorSchema = z.object({
  type: z.enum(['ODOO', 'CSV', 'API']),
  name: z.string().min(2).max(60),
  config: z.record(z.unknown()).default({}),
  enabled: z.boolean().optional(),
  pushCertificates: z.boolean().optional(),
  deactivateMissing: z.boolean().optional(),
  intervalMinutes: z.number().int().min(15).max(1440).optional(),
})
router.post('/connectors', validate(ConnectorSchema), async (req, res) => {
  try {
    if (req.body.type === 'ODOO') {
      const c = req.body.config as Record<string, unknown>
      for (const k of ['url', 'db', 'username', 'apiKey']) if (typeof c[k] !== 'string' || !(c[k] as string).trim()) return res.status(400).json({ error: `Odoo: champ ${k} requis` })
      if (!/^https?:\/\//.test(c.url as string)) return res.status(400).json({ error: 'Odoo: url doit commencer par http(s)://' })
    }
    const created = await prisma.hrConnector.create({ data: { ...req.body, config: encryptConfig(req.body.config), tenantId: getTenantId() } })
    res.status(201).json(publicConnector(created))
  } catch (e) { logger.error('hr connector create', e); res.status(500).json({ error: 'Failed' }) }
})

router.patch('/connectors/:id', validate(ConnectorSchema.partial()), async (req, res) => {
  try {
    const existing = await prisma.hrConnector.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Not found' })
    const data: Record<string, unknown> = { ...req.body }
    if (req.body.config) {
      // keep existing secrets when the client sends the mask
      const merged: Record<string, unknown> = { ...(existing.config as Record<string, unknown>) }
      for (const [k, v] of Object.entries(req.body.config as Record<string, unknown>)) if (v !== '••••••••') merged[k] = v
      data.config = encryptConfig(merged)
    }
    const updated = await prisma.hrConnector.update({ where: { id: existing.id }, data })
    res.json(publicConnector(updated))
  } catch (e) { logger.error('hr connector update', e); res.status(500).json({ error: 'Failed' }) }
})

router.delete('/connectors/:id', async (req, res) => {
  const existing = await prisma.hrConnector.findFirst({ where: { id: req.params.id } })
  if (!existing) return res.status(404).json({ error: 'Not found' })
  await prisma.hrConnector.delete({ where: { id: existing.id } })
  res.json({ ok: true })
})

router.post('/connectors/:id/test', async (req, res) => {
  const c = await prisma.hrConnector.findFirst({ where: { id: req.params.id } })
  if (!c) return res.status(404).json({ error: 'Not found' })
  try { res.json({ ok: true, ...(await testConnector(c)) }) }
  catch (e) { res.status(400).json({ ok: false, error: (e as Error).message }) }
})

router.post('/connectors/:id/run', async (req, res) => {
  const c = await prisma.hrConnector.findFirst({ where: { id: req.params.id } })
  if (!c) return res.status(404).json({ error: 'Not found' })
  const r = await runConnector(c)
  res.status(r.error ? 400 : 200).json(r)
})

/** Generate (or rotate) the push key of an API connector — shown once. */
router.post('/connectors/:id/rotate-key', async (req, res) => {
  const c = await prisma.hrConnector.findFirst({ where: { id: req.params.id } })
  if (!c || c.type !== 'API') return res.status(404).json({ error: 'Not found' })
  const key = `lrv_${randomBytes(24).toString('base64url')}`
  await prisma.hrConnector.update({ where: { id: c.id }, data: { apiKeyHash: sha256(key) } })
  res.json({ key })
})

/** CSV upload (users, with department names) — synchronous import. */
router.post('/import-csv', upload.single('file'), reenterTenant, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier CSV requis' })
  const deactivateMissing = req.body.deactivateMissing === 'true'
  const file = req.file
  // multer/busboy loses the AsyncLocalStorage context → re-enter the tenant context explicitly
  const tenantId = req.user!.tenantId!
  await tenantStore.run({ tenantId, superAdmin: false }, async () => {
    const run = await prisma.hrSyncRun.create({ data: { tenantId, source: 'CSV', status: 'running' } })
    try {
      const rows = parseCsv(file.buffer.toString('utf8'))
      if (rows.length === 0) throw new Error('CSV vide ou en-tête manquant')
      const stats = await applyHrPayload('CSV', csvToPayload(rows), { deactivateMissing })
      await prisma.hrSyncRun.update({ where: { id: run.id }, data: { status: 'success', stats: stats as object, finishedAt: new Date() } })
      res.json({ ok: true, rows: rows.length, stats })
    } catch (e) {
      await prisma.hrSyncRun.update({ where: { id: run.id }, data: { status: 'error', error: (e as Error).message.slice(0, 1000), finishedAt: new Date() } })
      res.status(400).json({ ok: false, error: (e as Error).message })
    }
  })
})

router.get('/runs', async (_req, res) => {
  res.json(await prisma.hrSyncRun.findMany({ orderBy: { startedAt: 'desc' }, take: 50 }))
})

export default router
