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

/**
 * Platform-wide ceiling. Generous per identity — it exists to stop runaway clients, not users.
 * Anonymous traffic falls back to the IP, which for a customer is a whole office behind one NAT,
 * so that bucket gets its own, much larger budget.
 */
export const apiLimiter = rateLimit({
  ...base, windowMs: 60_000,
  limit: (req) => (identityKey(req as Request).startsWith('u:') ? 300 : 3000),
  keyGenerator: identityKey,
})

/**
 * Sign-in: only FAILED attempts are counted, per targeted account. A successful sign-in never
 * consumes budget — an office of 500 people arriving at 9 am is normal traffic, a hundred failures
 * on one account is not.
 */
export const loginLimiter = rateLimit({
  ...base, windowMs: 15 * 60_000, limit: 10, skipSuccessfulRequests: true,
  keyGenerator: (req) => `login:${String((req.body as { email?: string })?.email ?? '').trim().toLowerCase() || ipKey(req)}`,
  message: { error: 'Trop de tentatives sur ce compte. Réessayez dans quelques minutes.' },
})

/**
 * Second net against credential stuffing from one source.
 *
 * Two things make the ceiling high on purpose. Successful sign-ins are refunded, but only once the
 * response has been written — when a whole floor signs in at 9 am the requests are all in flight at
 * once, so no refund has landed yet and the raw burst is what meets this limit. And that burst is
 * the size of the customer's office, behind a single NAT. Targeted brute force is stopped by the
 * per-account limiter above; what is left for this one is bulk stuffing, which this still caps.
 */
export const authSourceLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 1000, skipSuccessfulRequests: true, keyGenerator: ipKey })

/** Token refresh: normal clients call this a few times per hour; keyed per identity. */
export const refreshLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 60, keyGenerator: identityKey })

/** Public, unauthenticated surfaces (landing API, branding, TLS check) stay IP-keyed. */
export const publicLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 120, keyGenerator: ipKey })
