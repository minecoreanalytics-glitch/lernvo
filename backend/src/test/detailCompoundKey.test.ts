import { describe, it, expect, beforeAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import moduleRoutes from '../routes/modules'
import careerRoutes from '../routes/career'
import { prisma } from '../utils/prisma'
import { tenantStore } from '../utils/tenantContext'
import jwt from 'jsonwebtoken'

// Regression: the tenant extension rewrites findUnique into findFirst to inject tenantId.
// A compound unique key (userId_moduleId, userId_pathId) only exists in WhereUniqueInput, so
// unless it is flattened first, findFirst is handed a key its WhereInput does not have and
// Prisma throws — turning both detail endpoints into a 500. Shipped broken for 5 days because
// nothing opened a module in the suite.

const app = express()
app.use(express.json())
app.use('/api/modules', moduleRoutes)
app.use('/api/career', careerRoutes)

const SECRET = process.env.JWT_SECRET as string

function makeToken(userId: string, tenantId: string, role = 'PLATFORM_MANAGER') {
  return jwt.sign({ userId, email: `${userId}@test.lernvo`, role, tenantId }, SECRET, { expiresIn: '15m', issuer: 'lernvo', audience: 'api' })
}

let tenantId: string
let userId: string
let moduleId: string
let pathId: string

beforeAll(async () => {
  const suffix = Date.now()

  const t = await tenantStore.run({ tenantId: null, superAdmin: true }, () =>
    (prisma as any).tenant.create({ data: { name: 'DetailT', slug: `detail-t-${suffix}`, status: 'ACTIVE' } })
  )
  tenantId = t.id

  await tenantStore.run({ tenantId, superAdmin: false }, async () => {
    const u = await prisma.user.create({
      data: {
        email: `detail-${suffix}@test.lernvo`,
        firstName: 'Detail',
        lastName: 'Test',
        passwordHash: 'hash',
        role: 'PLATFORM_MANAGER',
        tenantId
      } as any
    })
    userId = u.id

    const m = await prisma.module.create({
      data: { title: 'Module détail', isPublished: true, tenantId } as any
    })
    moduleId = m.id

    // The enrollment is what forces the compound-key lookup on the detail route.
    await prisma.enrollment.create({
      data: { userId, moduleId, status: 'IN_PROGRESS', progressPct: 42, tenantId } as any
    })

    const p = await (prisma as any).careerPath.create({
      data: { title: 'Parcours détail', status: 'ACTIVE', tenantId }
    })
    pathId = p.id

    await (prisma as any).careerPathEnrollment.create({
      data: { userId, pathId, status: 'IN_PROGRESS', tenantId }
    })
  })
})

describe('detail endpoints resolving a compound unique key', () => {
  it('GET /api/modules/:id returns the module with the user enrollment attached', async () => {
    const r = await request(app)
      .get(`/api/modules/${moduleId}`)
      .set('Authorization', `Bearer ${makeToken(userId, tenantId)}`)

    expect(r.status).toBe(200)
    expect(r.body.id).toBe(moduleId)
    expect(r.body.userEnrollment).toBeTruthy()
    expect(r.body.userEnrollment.progressPct).toBe(42)
  })

  it('GET /api/career/paths/:id returns the path with the user enrollment attached', async () => {
    const r = await request(app)
      .get(`/api/career/paths/${pathId}`)
      .set('Authorization', `Bearer ${makeToken(userId, tenantId)}`)

    expect(r.status).toBe(200)
    expect(r.body.id).toBe(pathId)
    expect(r.body.userEnrollment).toBeTruthy()
  })
})
