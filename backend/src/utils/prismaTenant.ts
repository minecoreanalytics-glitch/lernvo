import { PrismaClient } from '@prisma/client'
import { getCtx, isSuperAdmin } from './tenantContext'

const SCOPED = new Set([
  'Department', 'User', 'Category', 'Module',
  'CareerPath', 'KbArticle', 'OnboardingPlan',
  'ApprovalItem', 'ContentVersion', 'Acknowledgment',
  'HrConnector', 'HrSyncRun', 'ChatQuestionLog'
])

/** Lowercase only the first character of a model name to get the delegate key. */
function delegateKey(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1)
}

export function makePrisma() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? [{ emit: 'event', level: 'query' }, 'error', 'warn']
      : ['error']
  })

  // No forward reference needed: the findUnique rewrite dispatches through the
  // BASE client (not the extended one). By the time we reach that branch we have
  // already injected `tenantId` into `where`, so calling base[delegate].findFirst
  // with the full where preserves isolation exactly — the base client skips the
  // extension but the tenantId filter is already present in the args.
  const client = base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !SCOPED.has(model)) return query(args)
          if (isSuperAdmin()) return query(args)

          const ctx = getCtx()
          if (!ctx || ctx.tenantId == null) {
            throw new Error('No tenant context available (fail-closed)')
          }
          const tid = ctx.tenantId
          const a: any = args ?? {}

          // findUnique / findUniqueOrThrow cannot have non-unique fields (like
          // tenantId) added to their where clause — Prisma rejects such a query.
          // Rewrite them to findFirst / findFirstOrThrow with tenantId injected.
          // We dispatch through the BASE client so there is no circular reference
          // back to the extended client. Isolation is preserved because tenantId
          // is already injected into `where` before the base client call.
          if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
            a.where = { ...(a.where ?? {}), tenantId: tid }
            const delegate = delegateKey(model)
            const rewritten = operation === 'findUniqueOrThrow'
              ? 'findFirstOrThrow'
              : 'findFirst'
            return (base as any)[delegate][rewritten](a)
          }

          if (['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate',
               'groupBy', 'updateMany', 'deleteMany'].includes(operation)) {
            a.where = { ...(a.where ?? {}), tenantId: tid }
          }
          if (operation === 'create') {
            a.data = { ...(a.data ?? {}), tenantId: tid }
          }
          if (operation === 'createMany') {
            const rows = Array.isArray(a.data) ? a.data : [a.data]
            a.data = rows.map((r: any) => ({ ...r, tenantId: tid }))
          }
          if (operation === 'update' || operation === 'delete' || operation === 'upsert') {
            a.where = { ...(a.where ?? {}), tenantId: tid }
            if (operation === 'upsert') {
              a.create = { ...(a.create ?? {}), tenantId: tid }
            }
          }
          return query(a)
        }
      }
    }
  })

  return client
}
