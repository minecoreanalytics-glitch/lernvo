import { Prisma, PrismaClient } from '@prisma/client'
import { getCtx, isSuperAdmin } from './tenantContext'

// Compound unique keys per model, e.g. Enrollment -> { userId_moduleId: ['userId', 'moduleId'] }.
// Needed to rewrite findUnique into findFirst (see below); read from the generated schema so a
// new @@unique never has to be registered by hand.
const COMPOUND_UNIQUE = new Map<string, Record<string, string[]>>()
for (const m of Prisma.dmmf.datamodel.models) {
  const keys: Record<string, string[]> = {}
  for (const idx of m.uniqueIndexes) {
    if (idx.fields.length > 1) keys[idx.name || idx.fields.join('_')] = [...idx.fields]
  }
  if (m.primaryKey && m.primaryKey.fields.length > 1) {
    keys[m.primaryKey.name || m.primaryKey.fields.join('_')] = [...m.primaryKey.fields]
  }
  if (Object.keys(keys).length > 0) COMPOUND_UNIQUE.set(m.name, keys)
}

// Every business model carries tenantId and is scoped here. Deliberately NOT scoped:
// Tenant (the root), Badge (platform-wide catalogue), RefreshToken (looked up by unguessable
// token before any tenant context exists; ownership is verified through the user).
// CI (scripts/check-tenant-scope.sh) fails if a model with tenantId is missing from this set.
const SCOPED = new Set([
  'Department', 'User', 'Category', 'Module',
  'CareerPath', 'KbArticle', 'OnboardingPlan',
  'ApprovalItem', 'ContentVersion', 'Acknowledgment',
  'HrConnector', 'HrSyncRun', 'ChatQuestionLog',
  'PricingCategory', 'PricingItem', 'PricingUpload', 'PricingChange', 'PricingAlert',
  'CompanyUnit', 'Announcement', 'AnnouncementRead',
  'Content', 'Enrollment', 'Quiz', 'Question', 'QuizAttempt', 'ProgressLog', 'Certificate',
  'Notification', 'PointTransaction', 'UserBadge', 'KbArticleView', 'ModuleFeedback',
  'UserSession', 'UserActivityLog', 'UserOnboarding', 'CareerPathModule', 'CareerPathEnrollment',
  'CareerPathPrerequisite', 'OnboardingPlanModule'
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
            // A compound unique key (`userId_moduleId: { … }`) only exists in findUnique's
            // WhereUniqueInput. findFirst takes a WhereInput, which has no such key, so it
            // must be flattened into its component fields or Prisma rejects the query.
            const where: any = { ...(a.where ?? {}) }
            const compound = COMPOUND_UNIQUE.get(model)
            if (compound) {
              for (const key of Object.keys(compound)) {
                const parts = where[key]
                if (parts && typeof parts === 'object') {
                  delete where[key]
                  Object.assign(where, parts)
                }
              }
            }
            a.where = { ...where, tenantId: tid }
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
