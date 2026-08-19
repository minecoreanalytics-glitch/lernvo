import type { Request } from 'express'

/** Base platform domain (apex). Tenants are served on <slug>.<BASE_DOMAIN>. */
export const BASE_DOMAIN = (process.env.DOMAIN || 'lernvo.com').toLowerCase()

const RESERVED = new Set(['www', 'api', 'app', 'admin', 'mail', 'static'])

/** Extract the tenant slug from a Host header, or null when on the apex / unknown host. */
export function tenantSlugFromHost(hostHeader: string | undefined): string | null {
  if (!hostHeader) return null
  const host = hostHeader.split(',')[0].trim().toLowerCase().replace(/:\d+$/, '')
  if (host === BASE_DOMAIN || host === `www.${BASE_DOMAIN}`) return null
  if (!host.endsWith(`.${BASE_DOMAIN}`)) return null
  const label = host.slice(0, -(BASE_DOMAIN.length + 1))
  if (!label || label.includes('.') || RESERVED.has(label)) return null
  return label
}

export function tenantSlugFromRequest(req: Request): string | null {
  const fwd = req.headers['x-forwarded-host']
  return tenantSlugFromHost(typeof fwd === 'string' ? fwd : req.headers.host)
}
