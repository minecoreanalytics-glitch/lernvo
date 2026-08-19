import type { HrConnector } from '@prisma/client'
import { prisma } from '../../utils/prisma'
import { tenantStore, getTenantId } from '../../utils/tenantContext'
import { encrypt, decrypt } from '../../utils/crypto'
import { logger } from '../../utils/logger'
import { applyHrPayload, type HrSyncStats } from './sync'
import { OdooClient, type OdooConfig } from './odoo'

const SECRET_KEYS = ['apiKey', 'password', 'token', 'secret']

export function encryptConfig(cfg: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...cfg }
  for (const k of SECRET_KEYS) if (typeof out[k] === 'string' && !(out[k] as string).startsWith('enc:v1:')) out[k] = encrypt(out[k] as string)
  return out
}
export function decryptConfig(cfg: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...cfg }
  for (const k of SECRET_KEYS) if (typeof out[k] === 'string') out[k] = decrypt(out[k] as string)
  return out
}
/** Public view: secrets masked. */
export function maskConfig(cfg: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...cfg }
  for (const k of SECRET_KEYS) if (out[k]) out[k] = '••••••••'
  return out
}

export async function testConnector(c: HrConnector) {
  if (c.type === 'ODOO') return new OdooClient(decryptConfig(c.config as Record<string, unknown>) as OdooConfig).test()
  return { ok: true }
}

/** Run one connector now (must be called inside the connector's tenant context). */
export async function runConnector(c: HrConnector): Promise<{ runId: string; stats?: HrSyncStats; error?: string }> {
  const run = await prisma.hrSyncRun.create({ data: { tenantId: getTenantId(), connectorId: c.id, source: c.type, status: 'running' } })
  try {
    let stats: HrSyncStats
    if (c.type === 'ODOO') {
      const client = new OdooClient(decryptConfig(c.config as Record<string, unknown>) as OdooConfig)
      const payload = await client.pull()
      stats = await applyHrPayload('ODOO', payload, { deactivateMissing: c.deactivateMissing })
    } else {
      throw new Error(`Connector type ${c.type} is push-only (CSV upload / API)`)
    }
    await prisma.hrSyncRun.update({ where: { id: run.id }, data: { status: 'success', stats: stats as object, finishedAt: new Date() } })
    await prisma.hrConnector.update({ where: { id: c.id }, data: { lastRunAt: new Date() } })
    return { runId: run.id, stats }
  } catch (e) {
    const msg = (e as Error).message
    await prisma.hrSyncRun.update({ where: { id: run.id }, data: { status: 'error', error: msg.slice(0, 1000), finishedAt: new Date() } })
    await prisma.hrConnector.update({ where: { id: c.id }, data: { lastRunAt: new Date() } })
    logger.warn(`HR connector ${c.id} failed: ${msg}`)
    return { runId: run.id, error: msg }
  }
}

/** Scheduler tick: run every enabled pull connector whose interval elapsed (all tenants). */
export async function runDueConnectors() {
  const due = await tenantStore.run({ tenantId: null, superAdmin: true }, async () =>
    await prisma.hrConnector.findMany({ where: { enabled: true, type: 'ODOO' } }))
  const now = Date.now()
  for (const c of due) {
    if (c.lastRunAt && now - c.lastRunAt.getTime() < c.intervalMinutes * 60_000) continue
    await tenantStore.run({ tenantId: c.tenantId, superAdmin: false }, () => runConnector(c))
  }
}

/** Push a freshly issued certificate to every enabled connector of the tenant that supports it. */
export async function pushCertificate(userId: string, title: string, certNumber: string, issuedAt: Date) {
  try {
    const user = await prisma.user.findFirst({ where: { id: userId }, select: { externalSource: true, externalId: true } })
    if (!user?.externalSource || !user.externalId) return
    const connectors = await prisma.hrConnector.findMany({ where: { enabled: true, pushCertificates: true, type: user.externalSource as 'ODOO' | 'CSV' | 'API' } })
    for (const c of connectors) {
      if (c.type === 'ODOO') {
        const client = new OdooClient(decryptConfig(c.config as Record<string, unknown>) as OdooConfig)
        const how = await client.pushCertificate(user.externalId, title, certNumber, issuedAt)
        logger.info(`certificate ${certNumber} pushed to Odoo (${how})`)
      }
    }
  } catch (e) {
    logger.warn(`certificate push failed: ${(e as Error).message}`)
  }
}
