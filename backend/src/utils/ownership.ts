/**
 * Parent-ownership guards for writes that reference another row by id (moduleId, quizId, userId…).
 * The Prisma extension scopes reads/writes by tenantId, but a client-supplied foreign key could still
 * point at another tenant's row; these helpers resolve the parent THROUGH the scoped client, so a
 * foreign id simply does not exist from the caller's point of view (→ 404, no existence leak).
 */
import { prisma } from './prisma'

export class NotOwned extends Error { status = 404; constructor(what: string) { super(`${what} not found`) } }

export async function requireModule(id: string | undefined | null) {
  if (!id) return null
  const m = await prisma.module.findFirst({ where: { id }, select: { id: true, tenantId: true } })
  if (!m) throw new NotOwned('Module'); return m
}
export async function requireQuiz(id: string) {
  const q = await prisma.quiz.findFirst({ where: { id }, select: { id: true, moduleId: true } })
  if (!q) throw new NotOwned('Quiz'); return q
}
export async function requireUser(id: string) {
  const u = await prisma.user.findFirst({ where: { id }, select: { id: true, departmentId: true, role: true } })
  if (!u) throw new NotOwned('User'); return u
}
export async function requireContent(id: string) {
  const c = await prisma.content.findFirst({ where: { id }, select: { id: true, moduleId: true, type: true } })
  if (!c) throw new NotOwned('Content'); return c
}
/** Express helper: map NotOwned → 404, everything else → rethrow */
export function ownershipError(res: { status: (n: number) => { json: (b: unknown) => unknown } }, e: unknown): boolean {
  if (e instanceof NotOwned) { res.status(404).json({ error: e.message }); return true }
  return false
}
