import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'
import { logger } from '../utils/logger'

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      logger.warn('Validation failed', { errors: result.error.flatten().fieldErrors })
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.flatten().fieldErrors
      })
    }
    req.body = result.data
    next()
  }
}
