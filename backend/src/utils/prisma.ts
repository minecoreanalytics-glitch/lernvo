import { makePrisma } from './prismaTenant'
import { logger } from './logger'

type ExtendedPrisma = ReturnType<typeof makePrisma>

const globalForPrisma = globalThis as unknown as { prisma: ExtendedPrisma }

export const prisma =
  globalForPrisma.prisma ||
  makePrisma()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  // Note: $on is not available on extended Prisma clients.
  // Slow-query logging is configured via PrismaClient log option in makePrisma().
  if (typeof (prisma as any).$on === 'function') {
    ;(prisma as any).$on('query', (e: { query: string; duration: number }) => {
      if (e.duration > 500) logger.warn(`Slow query (${e.duration}ms): ${e.query}`)
    })
  }
}
