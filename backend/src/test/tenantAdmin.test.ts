import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import tenantRoutes from '../routes/tenants'
import { prisma } from '../utils/prisma'
import { tenantStore } from '../utils/tenantContext'
import jwt from 'jsonwebtoken'

const app = express()
app.use(express.json())
app.use('/api/tenants', tenantRoutes)

const SECRET = process.env.JWT_SECRET as string
const saToken = () =>
  jwt.sign(
    { userId: 'sa', email: 'sa@lernvo', role: 'SUPER_ADMIN', tenantId: null },
    SECRET,
    { expiresIn: '15m', issuer: 'lernvo', audience: 'api' }
  )

describe('tenant admin', () => {
  it('SUPER_ADMIN approves a PENDING tenant', async () => {
    const t = await tenantStore.run({ tenantId: null, superAdmin: true }, () =>
      prisma.tenant.create({
        data: { name: 'Z', slug: 'z' + Date.now(), status: 'PENDING' }
      })
    )
    const r = await request(app)
      .post(`/api/tenants/${t.id}/approve`)
      .set('Authorization', `Bearer ${saToken()}`)
    expect(r.status).toBe(200)
    expect(r.body.status).toBe('ACTIVE')
  })

  it('non-super-admin gets 403 listing tenants', async () => {
    const tok = jwt.sign(
      { userId: 'u', email: 'u@x', role: 'PLATFORM_MANAGER', tenantId: 'x' },
      SECRET,
      { expiresIn: '15m', issuer: 'lernvo', audience: 'api' }
    )
    const r = await request(app)
      .get('/api/tenants')
      .set('Authorization', `Bearer ${tok}`)
    expect(r.status).toBe(403)
  })

  it('unauthenticated gets 401', async () => {
    const r = await request(app).get('/api/tenants')
    expect(r.status).toBe(401)
  })
})
