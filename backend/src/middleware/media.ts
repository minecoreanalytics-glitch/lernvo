/**
 * /uploads — authenticated, tenant-checked media serving (LRN-15).
 * <video>/<audio>/<img> tags cannot send an Authorization header, so login sets an httpOnly cookie
 * (`lernvo_media`, path=/uploads) carrying a short signed token {userId, tenantId}. Every request
 * under /uploads must present it, and the file must belong to the caller's tenant:
 *   - uploads/certificates/<certNumber>.svg  → Certificate.certNumber within the tenant
 *   - any other path                         → Content.url === '/uploads/…' within the tenant
 * Super-admins bypass the tenant check. Unknown files → 404 (never 403, no existence leak).
 */
import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import path from 'path'
import { prisma } from '../utils/prisma'
import { tenantStore } from '../utils/tenantContext'

export const MEDIA_COOKIE = 'lernvo_media'
type MediaClaims = { userId: string; tenantId: string | null; superAdmin: boolean }

export function signMediaCookie(claims: MediaClaims): string {
  return jwt.sign(claims, process.env.JWT_SECRET!, { expiresIn: '7d', audience: 'media' })
}
export function mediaCookieOptions() {
  return { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/uploads', maxAge: 7 * 24 * 3600 * 1000 }
}

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.cookie
  if (!raw) return null
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

export async function mediaGuard(req: Request, res: Response, next: NextFunction) {
  const token = readCookie(req, MEDIA_COOKIE) || (typeof req.query.t === 'string' ? req.query.t : null)
  if (!token) return res.status(401).end()
  let claims: MediaClaims
  try { claims = jwt.verify(token, process.env.JWT_SECRET!, { audience: 'media' }) as MediaClaims } catch { return res.status(401).end() }
  // normalise & block traversal
  const rel = path.posix.normalize('/' + req.path).replace(/^\/+/, '')
  if (rel.includes('..') || rel.startsWith('.')) return res.status(404).end()
  if (claims.superAdmin) return next()
  if (!claims.tenantId) return res.status(404).end()
  const url = `/uploads/${rel}`
  const ok = await tenantStore.run({ tenantId: claims.tenantId, superAdmin: false }, async () => {
    if (rel.startsWith('certificates/')) {
      const certNumber = path.posix.basename(rel).replace(/\.svg$/i, '')
      return !!(await prisma.certificate.findFirst({ where: { certNumber }, select: { id: true } }))
    }
    return !!(await prisma.content.findFirst({ where: { url }, select: { id: true } }))
  }).catch(() => false)
  if (!ok) return res.status(404).end()
  next()
}
