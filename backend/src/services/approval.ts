import type { ApprovalEntity, ApprovalStatus, Prisma } from '@prisma/client'
import { prisma } from '../utils/prisma'
import { getTenantId } from '../utils/tenantContext'
import { EmailService } from './email'
import { logger } from '../utils/logger'

export const APPROVER_ROLES = ['PLATFORM_MANAGER', 'HR'] as const
export const SUBMITTER_ROLES = ['PLATFORM_MANAGER', 'HR', 'MANAGER', 'SUPERVISOR'] as const

export function parseEntityType(t: string): ApprovalEntity | null {
  const map: Record<string, ApprovalEntity> = { kb: 'KB_ARTICLE', 'kb-article': 'KB_ARTICLE', KB_ARTICLE: 'KB_ARTICLE', module: 'MODULE', MODULE: 'MODULE' }
  return map[t] ?? null
}

/** Load the governed entity (title, link, snapshot payload). Null if not found in this tenant. */
export async function loadEntity(entityType: ApprovalEntity, entityId: string) {
  if (entityType === 'KB_ARTICLE') {
    const a = await prisma.kbArticle.findFirst({ where: { id: entityId }, include: { category: { select: { id: true, name: true } } } })
    if (!a) return null
    return {
      title: a.title,
      link: `/kb?slug=${a.slug}`,
      snapshot: { title: a.title, slug: a.slug, body: a.body, tags: a.tags, categoryId: a.categoryId, categoryName: a.category?.name ?? null } as Prisma.InputJsonValue,
    }
  }
  const m = await prisma.module.findFirst({ where: { id: entityId }, include: { contents: { orderBy: { order: 'asc' }, select: { id: true, title: true, type: true, body: true, url: true, order: true } } } })
  if (!m) return null
  return {
    title: m.title,
    link: `/modules/${m.id}`,
    snapshot: { title: m.title, description: m.description, format: m.format, estimatedMinutes: m.estimatedMinutes, contents: m.contents } as Prisma.InputJsonValue,
  }
}

export async function getOrCreateItem(entityType: ApprovalEntity, entityId: string) {
  const existing = await prisma.approvalItem.findFirst({ where: { entityType, entityId } })
  if (existing) return existing
  return prisma.approvalItem.create({ data: { entityType, entityId, tenantId: getTenantId() } })
}

export async function submit(entityType: ApprovalEntity, entityId: string, userId: string) {
  const item = await getOrCreateItem(entityType, entityId)
  if (item.status === 'IN_REVIEW') return item
  return prisma.approvalItem.update({
    where: { id: item.id },
    data: { status: 'IN_REVIEW', submittedById: userId, submittedAt: new Date(), rejectedReason: null }
  })
}

export async function reject(entityType: ApprovalEntity, entityId: string, userId: string, reason: string) {
  const item = await getOrCreateItem(entityType, entityId)
  const updated = await prisma.approvalItem.update({
    where: { id: item.id },
    data: { status: 'REJECTED', rejectedReason: reason, approvedById: null }
  })
  if (item.submittedById && item.submittedById !== userId) {
    const ent = await loadEntity(entityType, entityId)
    await prisma.notification.create({ data: {
      userId: item.submittedById, type: 'approval',
      title: 'Modifications refusées', body: `« ${ent?.title ?? 'Élément'} » : ${reason}`, link: ent?.link ?? null
    } })
  }
  return updated
}

/**
 * Approve: freeze a version snapshot, publish the entity, notify all active employees
 * (read & acknowledge) and managers (approval alert). Runs in a transaction for the data part.
 */
export async function approve(entityType: ApprovalEntity, entityId: string, approverId: string, note?: string) {
  const ent = await loadEntity(entityType, entityId)
  if (!ent) throw Object.assign(new Error('Entity not found'), { status: 404 })
  const item = await getOrCreateItem(entityType, entityId)
  const nextVersion = item.currentVersion + 1
  const tenantId = getTenantId()

  const [updated] = await prisma.$transaction([
    prisma.approvalItem.update({
      where: { id: item.id },
      data: { status: 'APPROVED', currentVersion: nextVersion, approvedById: approverId, approvedAt: new Date(), rejectedReason: null }
    }),
    prisma.contentVersion.create({
      data: { tenantId, entityType, entityId, version: nextVersion, snapshot: ent.snapshot, changeNote: note ?? null, createdById: approverId }
    }),
    entityType === 'KB_ARTICLE'
      ? prisma.kbArticle.update({ where: { id: entityId }, data: { isPublished: true } })
      : prisma.module.update({ where: { id: entityId }, data: { isPublished: true } }),
  ])

  // Notifications (best effort, outside the transaction)
  try {
    const users = await prisma.user.findMany({ where: { isActive: true, role: { not: 'SUPER_ADMIN' } }, select: { id: true, role: true } })
    const employees = users.filter(u => u.id !== approverId)
    const managers = users.filter(u => (APPROVER_ROLES as readonly string[]).includes(u.role) && u.id !== approverId)
    const isKb = entityType === 'KB_ARTICLE'
    if (employees.length) {
      await prisma.notification.createMany({ data: employees.map(u => ({
        userId: u.id, type: 'approval',
        title: isKb ? `À lire et valider : ${ent.title} (v${nextVersion})` : `Nouvelle formation approuvée : ${ent.title}`,
        body: isKb ? 'Une nouvelle version approuvée est disponible. Lisez-la et confirmez que vous l\'avez comprise.' : 'Une nouvelle version approuvée est disponible.',
        link: ent.link
      })) })
    }
    if (managers.length) {
      const approver = await prisma.user.findFirst({ where: { id: approverId }, select: { firstName: true, lastName: true } })
      await prisma.notification.createMany({ data: managers.map(u => ({
        userId: u.id, type: 'approval',
        title: `Approuvé : ${ent.title} (v${nextVersion})`,
        body: `Approuvé par ${approver ? `${approver.firstName} ${approver.lastName}` : 'un administrateur'}${note ? ` — ${note}` : ''}.`,
        link: ent.link
      })) })
    }
    if (isKb && employees.length) {
      EmailService.sendVersionApproved(employees.map(u => u.id), ent.title, nextVersion, ent.link).catch(() => {})
    }
  } catch (e) {
    logger.warn('approval notifications failed', { error: (e as Error).message })
  }
  return updated
}

export async function acknowledge(entityType: ApprovalEntity, entityId: string, userId: string) {
  const item = await prisma.approvalItem.findFirst({ where: { entityType, entityId } })
  if (!item || item.currentVersion === 0) throw Object.assign(new Error('Nothing approved to acknowledge'), { status: 409 })
  return prisma.acknowledgment.upsert({
    where: { userId_entityType_entityId_version: { userId, entityType, entityId, version: item.currentVersion } },
    create: { tenantId: getTenantId(), userId, entityType, entityId, version: item.currentVersion },
    update: {}
  })
}

export async function coverage(entityType: ApprovalEntity, entityId: string, version: number) {
  const [acked, total] = await Promise.all([
    prisma.acknowledgment.count({ where: { entityType, entityId, version } }),
    prisma.user.count({ where: { isActive: true, role: { not: 'SUPER_ADMIN' } } })
  ])
  return { acked, total, pct: total ? Math.round((acked / total) * 100) : 0 }
}

/** Approved KB articles the user has not acknowledged (current version). */
export async function myPending(userId: string) {
  const items = await prisma.approvalItem.findMany({ where: { entityType: 'KB_ARTICLE', status: 'APPROVED', currentVersion: { gt: 0 } } })
  if (items.length === 0) return []
  const acks = await prisma.acknowledgment.findMany({ where: { userId, entityType: 'KB_ARTICLE', entityId: { in: items.map(i => i.entityId) } }, select: { entityId: true, version: true } })
  const acked = new Set(acks.map(a => `${a.entityId}:${a.version}`))
  const pending = items.filter(i => !acked.has(`${i.entityId}:${i.currentVersion}`))
  const articles = await prisma.kbArticle.findMany({ where: { id: { in: pending.map(p => p.entityId) } }, select: { id: true, title: true, slug: true } })
  const byId = new Map(articles.map(a => [a.id, a]))
  return pending.map(p => ({ entityType: p.entityType, entityId: p.entityId, version: p.currentVersion, approvedAt: p.approvedAt, title: byId.get(p.entityId)?.title ?? '?', link: `/kb?slug=${byId.get(p.entityId)?.slug ?? ''}` }))
}

/** When an approved entity is edited, it goes back to DRAFT (last approved snapshot stays visible). */
export async function markEdited(entityType: ApprovalEntity, entityId: string) {
  const item = await prisma.approvalItem.findFirst({ where: { entityType, entityId } })
  if (item && item.status !== 'DRAFT') {
    await prisma.approvalItem.update({ where: { id: item.id }, data: { status: 'DRAFT' } })
  }
}

export async function latestSnapshot(entityType: ApprovalEntity, entityId: string) {
  const item = await prisma.approvalItem.findFirst({ where: { entityType, entityId } })
  if (!item || item.currentVersion === 0) return null
  const v = await prisma.contentVersion.findFirst({ where: { entityType, entityId, version: item.currentVersion } })
  return v ? { item, version: v } : null
}

export type { ApprovalStatus }
