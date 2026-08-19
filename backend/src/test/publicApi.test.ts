import { describe, it, expect, beforeAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import authRoutes from '../routes/auth'
import kbRoutes from '../routes/kb'
import approvalRoutes from '../routes/approvals'
import publicRoutes from '../routes/public'
import { prisma } from '../utils/prisma'
import { tenantStore } from '../utils/tenantContext'
import { BASE_DOMAIN } from '../utils/tenantHost'

const app = express()
app.use('/api/public', express.json(), publicRoutes)
app.use(express.json())
app.use('/api/auth', authRoutes); app.use('/api/kb', kbRoutes); app.use('/api/approvals', approvalRoutes)

const PW = 'StrongPass123!'; const ts = Date.now(); const slug = `pub${ts}`
let tenantId = ''; const pm = `pmpub${ts}@x.test`
let pubId = '', privId = '', pubSlug = '', privSlug = ''

beforeAll(async () => {
  const hash = await bcrypt.hash(PW, 10)
  await tenantStore.run({ tenantId: null, superAdmin: true }, async () => {
    const t = await prisma.tenant.create({ data: { name: 'Pub Co', slug, status: 'ACTIVE', logoUrl: 'https://x.test/l.png' } })
    tenantId = t.id
    await prisma.user.create({ data: { email: pm, passwordHash: hash, firstName: 'P', lastName: 'M', role: 'PLATFORM_MANAGER', isActive: true, tenantId } })
    pubSlug = `offre-fibre-${ts}`; privSlug = `procedure-interne-${ts}`
    const a = await prisma.kbArticle.create({ data: { title: 'Offre Fibre 100', slug: pubSlug, body: '# Fibre 100\nPrix: 50/mois', tags: ['tarif'], isPublished: false, isPublic: true, tenantId } })
    const b = await prisma.kbArticle.create({ data: { title: 'Procédure interne', slug: privSlug, body: 'secret', tags: ['proc'], isPublished: true, isPublic: false, tenantId } })
    pubId = a.id; privId = b.id
  })
})
const host = `${slug}.${BASE_DOMAIN}`

describe('public read API', () => {
  it('unknown tenant → 404; known tenant → branding', async () => {
    expect((await request(app).get('/api/public/tenant').set('Host', `nope${ts}.${BASE_DOMAIN}`)).status).toBe(404)
    const r = await request(app).get('/api/public/tenant').set('Host', host)
    expect(r.status).toBe(200); expect(r.body).toMatchObject({ name: 'Pub Co', slug, logoUrl: 'https://x.test/l.png' })
    expect(r.headers['access-control-allow-origin']).toBe('*')
  })
  it('lists nothing until approved; after approval only isPublic articles, served from the approved snapshot', async () => {
    expect((await request(app).get('/api/public/articles').set('Host', host)).body).toEqual([])
    const tok = (await request(app).post('/api/auth/login').send({ email: pm, password: PW })).body.accessToken
    await request(app).post(`/api/approvals/kb/${pubId}/approve`).set('Authorization', `Bearer ${tok}`).send({})
    await request(app).post(`/api/approvals/kb/${privId}/approve`).set('Authorization', `Bearer ${tok}`).send({})
    const list = await request(app).get('/api/public/articles').set('Host', host)
    expect(list.body.map((a: { slug: string }) => a.slug)).toEqual([pubSlug])
    expect(list.body[0]).toMatchObject({ title: 'Offre Fibre 100', version: 1, tags: ['tarif'] })
    // edit → draft: public keeps v1
    await request(app).put(`/api/kb/${pubSlug}`).set('Authorization', `Bearer ${tok}`).send({ body: '# Fibre 100\nPrix: 60/mois (brouillon)' })
    const one = await request(app).get(`/api/public/articles/${pubSlug}?tenant=${slug}`)
    expect(one.status).toBe(200); expect(one.body.body).toContain('50/mois'); expect(one.body.version).toBe(1)
    expect((await request(app).get(`/api/public/articles/${privSlug}`).set('Host', host)).status).toBe(404)
    // filter by tag
    expect((await request(app).get('/api/public/articles?tag=nope').set('Host', host)).body).toEqual([])
  })
})
