/**
 * Rate limits keyed by IDENTITY, not by IP.
 *
 * A customer's employees sit behind one office NAT: an IP-keyed limit punishes the whole company
 * for the traffic of one browser. Every authenticated limit is therefore keyed on the user id read
 * from the (verified) access token, and falls back to the IP only for anonymous traffic.
 * Sign-in attempts are keyed on the account being targeted, so a brute-force run against one
 * account never locks out that account's colleagues.
 */
import type { Request } from 'express'
import rateLimit, { type Options } from 'express-rate-limit'
import jwt from 'jsonwebtoken'

/** IPv6-safe bucket: individual IPv4, /64 prefix for IPv6. */
function ipKey(req: Request): string {
  const ip = req.ip ?? '0.0.0.0'
  return ip.includes(':') ? ip.split(':').slice(0, 4).join(':') + '::/64' : ip
}

/** user id from a valid Bearer token, else the caller IP. */
export function identityKey(req: Request): string {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (token) {
    try {
      const p = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'], issuer: 'lernvo', audience: 'api' }) as { userId?: string }
      if (p?.userId) return `u:${p.userId}`
    } catch { /* fall through to IP */ }
  }
  return `ip:${ipKey(req)}`
}

const base: Partial<Options> = { standardHeaders: true, legacyHeaders: false }

/** Platform-wide ceiling. Generous per identity — it exists to stop runaway clients, not users. */
export const apiLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 300, keyGenerator: identityKey })

/** Sign-in: per targeted account (email), so one attacker cannot lock out an office. */
export const loginLimiter = rateLimit({
  ...base, windowMs: 15 * 60_000, limit: 10,
  keyGenerator: (req) => `login:${String((req.body as { email?: string })?.email ?? '').trim().toLowerCase() || ipKey(req)}`,
  message: { error: 'Trop de tentatives sur ce compte. Réessayez dans quelques minutes.' },
})

/** Second, wider net against credential stuffing from a single source. */
export const authSourceLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 300, keyGenerator: ipKey })

/** Token refresh: normal clients call this a few times per hour; keyed per identity. */
export const refreshLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 60, keyGenerator: identityKey })

/** Public, unauthenticated surfaces (landing API, branding, TLS check) stay IP-keyed. */
export const publicLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 120, keyGenerator: ipKey })
