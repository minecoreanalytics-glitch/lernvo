import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import authRoutes from '../routes/auth'

const app = express()
app.use(express.json())
app.use('/api/auth', authRoutes)

describe('POST /api/auth/signup', () => {
  it('creates a PENDING tenant + inactive admin', async () => {
    const r = await request(app).post('/api/auth/signup').send({
      companyName: 'Acme ' + Date.now(),
      email: `boss${Date.now()}@acme.test`,
      password: 'StrongPass123!',
      firstName: 'Boss', lastName: 'Person'
    })
    expect(r.status).toBe(201)
    expect(r.body.tenantStatus).toBe('PENDING')
  })
  it('rejects too-short password (zod 400)', async () => {
    const r = await request(app).post('/api/auth/signup').send({
      companyName: 'X', email: 'x@y.test', password: 'short', firstName: 'a', lastName: 'b'
    })
    expect(r.status).toBe(400)
  })
  it('the same email may create a second company (email is unique per tenant, LRN-16)', async () => {
    const email = `dup${Date.now()}@acme.test`
    const payload = {
      companyName: 'DupCo ' + Date.now(),
      email,
      password: 'StrongPass123!',
      firstName: 'Dup', lastName: 'User'
    }
    const first = await request(app).post('/api/auth/signup').send(payload)
    expect(first.status).toBe(201)
    const second = await request(app).post('/api/auth/signup').send({
      ...payload,
      companyName: 'DupCo2 ' + Date.now(),
    })
    expect(second.status).toBe(201)
    expect(second.body.tenant?.slug ?? second.body.tenantSlug ?? '').not.toBe(first.body.tenant?.slug ?? first.body.tenantSlug ?? 'x')
  })
})
