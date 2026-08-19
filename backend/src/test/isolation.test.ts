import { describe, it, expect, beforeAll } from 'vitest'
import { prisma } from '../utils/prisma'
import { tenantStore } from '../utils/tenantContext'

let tA: string, tB: string
let catAId: string

beforeAll(async () => {
  const ta = await (prisma as any).tenant.create({ data: { name: 'A', slug: 'a-'+Date.now(), status: 'ACTIVE' } })
  const tb = await (prisma as any).tenant.create({ data: { name: 'B', slug: 'b-'+Date.now(), status: 'ACTIVE' } })
  tA = ta.id; tB = tb.id
  await tenantStore.run({ tenantId: tA, superAdmin: false }, async () => {
    const catA = await prisma.category.create({ data: { name: 'CatA', tenantId: tA } as any })
    catAId = catA.id
  })
  await tenantStore.run({ tenantId: tB, superAdmin: false }, async () => {
    await prisma.category.create({ data: { name: 'CatB', tenantId: tB } as any })
  })
})

describe('tenant isolation', () => {
  it('tenant A only sees its own categories', async () => {
    await tenantStore.run({ tenantId: tA, superAdmin: false }, async () => {
      const cats = await prisma.category.findMany()
      expect(cats.every((c: any) => c.tenantId === tA)).toBe(true)
      expect(cats.find((c: any) => c.name === 'CatB')).toBeUndefined()
    })
  })
  it('write in tenant A context is forced to tenant A', async () => {
    await tenantStore.run({ tenantId: tA, superAdmin: false }, async () => {
      const c = await prisma.category.create({ data: { name: 'Forced'+Date.now(), tenantId: tB } as any })
      expect(c.tenantId).toBe(tA)
    })
  })
  it('query without context throws (fail-closed)', async () => {
    await expect(prisma.category.findMany()).rejects.toThrow(/no tenant context/i)
  })
  it('superAdmin bypasses isolation', async () => {
    await tenantStore.run({ tenantId: null, superAdmin: true }, async () => {
      const cats = await prisma.category.findMany()
      expect(cats.length).toBeGreaterThanOrEqual(2)
    })
  })
  it('findUnique by id within same tenant returns the row', async () => {
    await tenantStore.run({ tenantId: tA, superAdmin: false }, async () => {
      const cat = await (prisma.category as any).findUnique({ where: { id: catAId } })
      expect(cat).not.toBeNull()
      expect(cat.id).toBe(catAId)
      expect(cat.tenantId).toBe(tA)
    })
  })
  it('findUnique by id of another tenant row returns null (no leak)', async () => {
    await tenantStore.run({ tenantId: tB, superAdmin: false }, async () => {
      const cat = await (prisma.category as any).findUnique({ where: { id: catAId } })
      expect(cat).toBeNull()
    })
  })
  it('groupBy in tenant A context only returns groups for tenant A', async () => {
    await tenantStore.run({ tenantId: tA, superAdmin: false }, async () => {
      const groups = await (prisma.category as any).groupBy({ by: ['tenantId'], _count: true })
      expect(groups.every((g: any) => g.tenantId === tA)).toBe(true)
      expect(groups.find((g: any) => g.tenantId === tB)).toBeUndefined()
    })
  })
})
