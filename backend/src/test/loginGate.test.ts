import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import authRoutes from '../routes/auth'
import { prisma } from '../utils/prisma'
import { tenantStore } from '../utils/tenantContext'
import { hashPassword, verifyPassword } from '../utils/password'

const app = express(); app.use(express.json()); app.use('/api/auth', authRoutes)

describe('login tenant gate', () => {
  it('refuses login when tenant is PENDING', async () => {
    const e = `pend${Date.now()}@x.test`
    await tenantStore.run({ tenantId: null, superAdmin: true }, async () => {
      const t = await prisma.tenant.create({ data: { name: 'P', slug: 'p'+Date.now(), status: 'PENDING' } })
      await prisma.user.create({ data: { email: e, passwordHash: await hashPassword('StrongPass123!'), firstName: 'a', lastName: 'b', role: 'PLATFORM_MANAGER', isActive: true, tenantId: t.id } })
    })
    const r = await request(app).post('/api/auth/login').send({ email: e, password: 'StrongPass123!' })
    expect(r.status).toBe(403)
    expect(r.body.error).toMatch(/approbation|attente|pending/i)
  })
  it('allows login when tenant is ACTIVE', async () => {
    const e = `act${Date.now()}@x.test`
    await tenantStore.run({ tenantId: null, superAdmin: true }, async () => {
      const t = await prisma.tenant.create({ data: { name: 'A', slug: 'a'+Date.now(), status: 'ACTIVE' } })
      await prisma.user.create({ data: { email: e, passwordHash: await hashPassword('StrongPass123!'), firstName: 'a', lastName: 'b', role: 'PLATFORM_MANAGER', isActive: true, tenantId: t.id } })
    })
    const r = await request(app).post('/api/auth/login').send({ email: e, password: 'StrongPass123!' })
    expect(r.status).toBe(200)
  })
})
