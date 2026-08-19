import { describe, it, expect, beforeAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import authRoutes from '../routes/auth'
import brandingRoutes from '../routes/branding'
import tenantRoutes from '../routes/tenants'
import { prisma } from '../utils/prisma'
import { tenantStore } from '../utils/tenantContext'
import { tenantSlugFromHost, BASE_DOMAIN } from '../utils/tenantHost'

const app = express()
app.use(express.json())
app.use('/api/auth', authRoutes)
app.use('/api/branding', brandingRoutes)
app.use('/api/tenants', tenantRoutes)

const PW = 'StrongPass123!'
const ts = Date.now()
const slugA = `ta${ts}`, slugB = `tb${ts}`
const emailA = `a${ts}@x.test`, emailB = `b${ts}@x.test`
let tenantAId = ''

beforeAll(async () => {
  const hash = await bcrypt.hash(PW, 10)
  await tenantStore.run({ tenantId: null, superAdmin: true }, async () => {
    const a = await prisma.tenant.create({ data: { name: 'Tenant A', slug: slugA, status: 'ACTIVE', logoUrl: 'https://a.test/logo.png' } })
    const b = await prisma.tenant.create({ data: { name: 'Tenant B', slug: slugB, status: 'ACTIVE' } })
    tenantAId = a.id
    await prisma.user.create({ data: { email: emailA, passwordHash: hash, firstName: 'a', lastName: 'a', role: 'PLATFORM_MANAGER', isActive: true, tenantId: a.id } })
    await prisma.user.create({ data: { email: emailB, passwordHash: hash, firstName: 'b', lastName: 'b', role: 'PLATFORM_MANAGER', isActive: true, tenantId: b.id } })
  })
})

describe('tenantSlugFromHost', () => {
  it('parses tenant subdomains and ignores apex/www/reserved/foreign', () => {
    expect(tenantSlugFromHost(`acme.${BASE_DOMAIN}`)).toBe('acme')
    expect(tenantSlugFromHost(`ACME.${BASE_DOMAIN}:443`)).toBe('acme')
    expect(tenantSlugFromHost(BASE_DOMAIN)).toBeNull()
    expect(tenantSlugFromHost(`www.${BASE_DOMAIN}`)).toBeNull()
    expect(tenantSlugFromHost(`api.${BASE_DOMAIN}`)).toBeNull()
    expect(tenantSlugFromHost(`a.b.${BASE_DOMAIN}`)).toBeNull()
    expect(tenantSlugFromHost('evil.com')).toBeNull()
    expect(tenantSlugFromHost(undefined)).toBeNull()
  })
})

describe('login host lock', () => {
  it('apex: any tenant can log in', async () => {
    const r = await request(app).post('/api/auth/login').set('Host', BASE_DOMAIN).send({ email: emailA, password: PW })
    expect(r.status).toBe(200)
  })
  it('own subdomain: allowed', async () => {
    const r = await request(app).post('/api/auth/login').set('Host', `${slugA}.${BASE_DOMAIN}`).send({ email: emailA, password: PW })
    expect(r.status).toBe(200)
  })
  it('other tenant subdomain: refused with generic 401', async () => {
    const r = await request(app).post('/api/auth/login').set('Host', `${slugB}.${BASE_DOMAIN}`).send({ email: emailA, password: PW })
    expect(r.status).toBe(401)
    expect(r.body.error).toBe('Invalid credentials')
  })
  it('refresh token is also host-locked', async () => {
    const login = await request(app).post('/api/auth/login').set('Host', BASE_DOMAIN).send({ email: emailA, password: PW })
    const rt = login.body.refreshToken
    const ok = await request(app).post('/api/auth/refresh').set('Host', `${slugA}.${BASE_DOMAIN}`).send({ refreshToken: rt })
    expect(ok.status).toBe(200)
    const bad = await request(app).post('/api/auth/refresh').set('Host', `${slugB}.${BASE_DOMAIN}`).send({ refreshToken: rt })
    expect(bad.status).toBe(401)
  })
})

describe('branding + tls-check', () => {
  it('apex returns platform branding, tenant host returns tenant branding, ?slug is ignored', async () => {
    const apex = await request(app).get('/api/branding').set('Host', BASE_DOMAIN)
    expect(apex.body.tenant).toBeNull()
    const t = await request(app).get('/api/branding').set('Host', `${slugA}.${BASE_DOMAIN}`)
    expect(t.body.tenant).toMatchObject({ name: 'Tenant A', slug: slugA, logoUrl: 'https://a.test/logo.png' })
    expect(t.body.tenant.status).toBeUndefined()
    const enumAttempt = await request(app).get(`/api/branding?slug=${slugA}`).set('Host', BASE_DOMAIN)
    expect(enumAttempt.body.tenant).toBeNull()
  })
  it('tls-check: 200 for apex/www/active tenant, 404 otherwise', async () => {
    expect((await request(app).get(`/api/branding/tls-check?domain=${BASE_DOMAIN}`)).status).toBe(200)
    expect((await request(app).get(`/api/branding/tls-check?domain=www.${BASE_DOMAIN}`)).status).toBe(200)
    expect((await request(app).get(`/api/branding/tls-check?domain=${slugA}.${BASE_DOMAIN}`)).status).toBe(200)
    expect((await request(app).get(`/api/branding/tls-check?domain=nope${ts}.${BASE_DOMAIN}`)).status).toBe(404)
    expect((await request(app).get(`/api/branding/tls-check?domain=evil.com`)).status).toBe(404)
    expect((await request(app).get(`/api/branding/tls-check`)).status).toBe(400)
  })
  it('tls-check: 404 for a SUSPENDED tenant', async () => {
    const slugS = `ts${ts}`
    await tenantStore.run({ tenantId: null, superAdmin: true }, () =>
      prisma.tenant.create({ data: { name: 'S', slug: slugS, status: 'SUSPENDED' } }))
    expect((await request(app).get(`/api/branding/tls-check?domain=${slugS}.${BASE_DOMAIN}`)).status).toBe(404)
  })
})

describe('PATCH /api/tenants/me', () => {
  async function token(email: string) {
    const r = await request(app).post('/api/auth/login').send({ email, password: PW })
    return r.body.accessToken as string
  }
  it('PLATFORM_MANAGER updates only its own tenant; https logo enforced', async () => {
    const tok = await token(emailB)
    const bad = await request(app).patch('/api/tenants/me').set('Authorization', `Bearer ${tok}`).send({ logoUrl: 'javascript:alert(1)' })
    expect(bad.status).toBe(400)
    const ok = await request(app).patch('/api/tenants/me').set('Authorization', `Bearer ${tok}`).send({ name: 'Tenant B renamed', supportEmail: 'help@b.test' })
    expect(ok.status).toBe(200)
    expect(ok.body.slug).toBe(slugB)
    // tenant A untouched
    const a = await tenantStore.run({ tenantId: null, superAdmin: true }, () => prisma.tenant.findUnique({ where: { id: tenantAId } }))
    expect(a?.name).toBe('Tenant A')
  })
})
