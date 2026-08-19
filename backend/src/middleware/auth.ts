import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { Role } from '@prisma/client'
import { tenantStore } from '../utils/tenantContext'

export interface AuthPayload {
  userId: string
  email: string
  role: Role
  tenantId: string | null
  departmentId: string | null
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload
    req.user = payload
    const superAdmin = req.user.role === 'SUPER_ADMIN'
    tenantStore.run(
      { tenantId: superAdmin ? null : (req.user.tenantId ?? null), superAdmin },
      () => next()
    )
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

/**
 * Re-enter the tenant context after middlewares that break AsyncLocalStorage propagation
 * (multer/busboy with memoryStorage emits `close` on nextTick outside the request context).
 * Place it right AFTER `upload.single(...)` / `upload.array(...)`.
 */
export function reenterTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  const superAdmin = req.user.role === 'SUPER_ADMIN'
  tenantStore.run({ tenantId: superAdmin ? null : (req.user.tenantId ?? null), superAdmin }, () => next())
}

export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    next()
  }
}
