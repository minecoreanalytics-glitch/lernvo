import { makePrisma } from './prismaTenant'
import { logger } from './logger'

type ExtendedPrisma = ReturnType<typeof makePrisma>

const globalForPrisma = globalThis as unknown as { prisma: ExtendedPrisma }

export const prisma =
  globalForPrisma.prisma ||
  makePrisma()

// Slow-query logging runs in EVERY environment: production is precisely where it matters,
// and it was previously disabled there (so a query degrading with data volume stayed invisible).
{
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
  // Note: $on is not available on extended Prisma clients.
  // Slow-query logging is configured via PrismaClient log option in makePrisma().
  if (typeof (prisma as any).$on === 'function') {
    ;(prisma as any).$on('query', (e: { query: string; duration: number }) => {
      const threshold = Number(process.env.SLOW_QUERY_MS ?? 300)
      if (e.duration > threshold) logger.warn(`Slow query (${e.duration}ms): ${e.query.slice(0, 400)}`)
    })
  }
}
