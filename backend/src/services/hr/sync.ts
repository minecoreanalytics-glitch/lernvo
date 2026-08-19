import { Prisma, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { prisma } from '../../utils/prisma'
import { getTenantId } from '../../utils/tenantContext'
import { NotificationService } from '../notifications'
import { logger } from '../../utils/logger'

/** Normalized HR payload — every connector (Odoo, CSV, API) produces this. */
export type HrDepartment = { externalId: string; name: string; parentExternalId?: string | null; managerName?: string | null }
export type HrEmployee = {
  externalId: string; email: string; firstName: string; lastName: string
  role?: Role | null; departmentExternalId?: string | null; departmentName?: string | null
  managerExternalId?: string | null; hiredAt?: string | Date | null; active?: boolean
}
export type HrPayload = { departments?: HrDepartment[]; employees: HrEmployee[] }
export type HrSyncStats = {
  departments: { created: number; updated: number }
  employees: { created: number; updated: number; deactivated: number; skipped: number }
  warnings: string[]
}

const PROTECTED_ROLES: Role[] = ['PLATFORM_MANAGER', 'HR', 'SUPER_ADMIN']

/**
 * Upsert departments then employees for the current tenant.
 * Matching: externalId (per source) first, then name (departments) / email (employees) → adopted.
 * Never downgrades PLATFORM_MANAGER / HR / SUPER_ADMIN roles from an HR feed.
 */
export async function applyHrPayload(source: string, payload: HrPayload, opts: { deactivateMissing?: boolean; sendWelcome?: boolean } = {}): Promise<HrSyncStats> {
  const tenantId = getTenantId()
  const stats: HrSyncStats = { departments: { created: 0, updated: 0 }, employees: { created: 0, updated: 0, deactivated: 0, skipped: 0 }, warnings: [] }
  const deptByExt = new Map<string, string>() // externalId -> id

  // ── Departments (two passes: upsert, then parents) ──
  const depts = payload.departments ?? []
  for (const d of depts) {
    if (!d.externalId || !d.name?.trim()) { stats.warnings.push(`département ignoré (externalId/nom manquant): ${JSON.stringify(d).slice(0, 80)}`); continue }
    const name = d.name.trim()
    let row = await prisma.department.findFirst({ where: { externalSource: source, externalId: d.externalId } })
    if (!row) row = await prisma.department.findFirst({ where: { name } })
    if (row) {
      await prisma.department.update({ where: { id: row.id }, data: { name, managerName: d.managerName ?? row.managerName, externalSource: source, externalId: d.externalId } })
      stats.departments.updated++
    } else {
      row = await prisma.department.create({ data: { name, managerName: d.managerName ?? null, externalSource: source, externalId: d.externalId, tenantId } })
      stats.departments.created++
    }
    deptByExt.set(d.externalId, row.id)
  }
  for (const d of depts) {
    if (!d.parentExternalId || !deptByExt.has(d.externalId)) continue
    const parentId = deptByExt.get(d.parentExternalId)
    if (!parentId || parentId === deptByExt.get(d.externalId)) continue
    await prisma.department.update({ where: { id: deptByExt.get(d.externalId)! }, data: { parentId } })
  }
  // resolve department names given without externalId
  const deptByName = new Map((await prisma.department.findMany({ select: { id: true, name: true } })).map(x => [x.name.toLowerCase(), x.id]))

  // ── Employees ──
  const userByExt = new Map<string, string>()
  const seenIds = new Set<string>()
  const welcome: Array<{ id: string; tmp: string }> = []
  for (const e of payload.employees) {
    const email = e.email?.trim().toLowerCase()
    if (!e.externalId || !email || !email.includes('@')) { stats.employees.skipped++; stats.warnings.push(`employé ignoré (externalId/email manquant): ${e.firstName ?? ''} ${e.lastName ?? ''}`.trim()); continue }
    const departmentId = (e.departmentExternalId && deptByExt.get(e.departmentExternalId)) || (e.departmentName && deptByName.get(e.departmentName.toLowerCase())) || null
    let row = await prisma.user.findFirst({ where: { externalSource: source, externalId: e.externalId } })
    if (!row) row = await prisma.user.findFirst({ where: { email } })
    const active = e.active !== false
    if (row) {
      const role = e.role && !PROTECTED_ROLES.includes(row.role) ? e.role : row.role
      await prisma.user.update({ where: { id: row.id }, data: {
        firstName: e.firstName?.trim() || row.firstName, lastName: e.lastName?.trim() || row.lastName, email,
        role, departmentId: departmentId ?? row.departmentId, hiredAt: e.hiredAt ? new Date(e.hiredAt) : row.hiredAt,
        isActive: PROTECTED_ROLES.includes(row.role) ? row.isActive : active,
        externalSource: source, externalId: e.externalId
      } })
      stats.employees.updated++
    } else {
      const tmp = randomBytes(6).toString('base64url')
      row = await prisma.user.create({ data: {
        email, firstName: e.firstName?.trim() || '—', lastName: e.lastName?.trim() || '—',
        passwordHash: await bcrypt.hash(tmp, 10), role: e.role ?? 'AGENT', tenantId, departmentId,
        hiredAt: e.hiredAt ? new Date(e.hiredAt) : null, isActive: active, externalSource: source, externalId: e.externalId
      } })
      stats.employees.created++
      if (active) welcome.push({ id: row.id, tmp })
    }
    userByExt.set(e.externalId, row.id); seenIds.add(row.id)
  }
  // managers (second pass)
  for (const e of payload.employees) {
    if (!e.managerExternalId) continue
    const uid = userByExt.get(e.externalId), mid = userByExt.get(e.managerExternalId)
    if (uid && mid && uid !== mid) await prisma.user.update({ where: { id: uid }, data: { managerId: mid } })
  }
  // deactivate missing (only users owned by this source)
  if (opts.deactivateMissing) {
    const owned = await prisma.user.findMany({ where: { externalSource: source, isActive: true, role: { notIn: PROTECTED_ROLES } }, select: { id: true } })
    const gone = owned.filter(u => !seenIds.has(u.id)).map(u => u.id)
    if (gone.length) { await prisma.user.updateMany({ where: { id: { in: gone } }, data: { isActive: false } }); stats.employees.deactivated = gone.length }
  }
  if (opts.sendWelcome !== false) {
    for (const w of welcome) NotificationService.sendWelcome(w.id, w.tmp).catch(() => {})
  }
  logger.info(`HR sync [${source}] tenant=${tenantId}`, stats)
  return stats
}

/** Minimal RFC-4180-ish CSV parser (quotes, commas/semicolons, CRLF). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false
  const src = text.replace(/^﻿/, '')
  const sep = (src.split('\n')[0].match(/;/g)?.length ?? 0) > (src.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ','
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (q) { if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += c; continue }
    if (c === '"') q = true
    else if (c === sep) { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (c !== '\r') cell += c
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row) }
  const header = (rows.shift() ?? []).map(h => h.trim().toLowerCase())
  return rows.filter(r => r.some(v => v.trim())).map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
}

const ROLE_ALIASES: Record<string, Role> = { agent: 'AGENT', employe: 'AGENT', employé: 'AGENT', employee: 'AGENT', superviseur: 'SUPERVISOR', supervisor: 'SUPERVISOR', manager: 'MANAGER', gestionnaire: 'MANAGER', responsable: 'MANAGER', hr: 'HR', rh: 'HR', platform_manager: 'PLATFORM_MANAGER', admin: 'PLATFORM_MANAGER' }

/** CSV columns (header, case-insensitive): externalid|id, email, firstname|prenom, lastname|nom, department|departement, manager_email, role, hiredat|embauche, active */
export function csvToPayload(rows: Record<string, string>[]): HrPayload {
  const g = (r: Record<string, string>, ...keys: string[]) => { for (const k of keys) if (r[k]) return r[k]; return '' }
  const byEmail = new Map<string, string>()
  const employees: HrEmployee[] = rows.map((r, i) => {
    const email = g(r, 'email', 'courriel', 'mail').toLowerCase()
    const externalId = g(r, 'externalid', 'external_id', 'id', 'matricule') || email || `row-${i + 1}`
    byEmail.set(email, externalId)
    const roleRaw = g(r, 'role', 'rôle').toLowerCase()
    return {
      externalId, email, firstName: g(r, 'firstname', 'first_name', 'prenom', 'prénom'), lastName: g(r, 'lastname', 'last_name', 'nom'),
      role: ROLE_ALIASES[roleRaw] ?? (roleRaw ? undefined : undefined), departmentName: g(r, 'department', 'departement', 'département') || null,
      hiredAt: g(r, 'hiredat', 'hired_at', 'embauche', 'date_embauche') || null,
      active: !['0', 'false', 'non', 'no', 'inactif', 'inactive'].includes(g(r, 'active', 'actif').toLowerCase()),
      _managerEmail: g(r, 'manager_email', 'manager', 'responsable_email').toLowerCase()
    } as HrEmployee & { _managerEmail: string }
  })
  for (const e of employees as Array<HrEmployee & { _managerEmail?: string }>) {
    if (e._managerEmail && byEmail.has(e._managerEmail)) e.managerExternalId = byEmail.get(e._managerEmail)
    delete e._managerEmail
  }
  const deptNames = [...new Set(employees.map(e => e.departmentName).filter(Boolean))] as string[]
  const departments: HrDepartment[] = deptNames.map(n => ({ externalId: `csv:${n.toLowerCase()}`, name: n }))
  employees.forEach(e => { if (e.departmentName) e.departmentExternalId = `csv:${e.departmentName.toLowerCase()}` })
  return { departments, employees }
}

export type { Prisma }
