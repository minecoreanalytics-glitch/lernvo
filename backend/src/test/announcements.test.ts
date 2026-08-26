import { describe, it, expect, beforeAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import { hashPassword } from '../utils/password'
import authRoutes from '../routes/auth'
import announcementRoutes from '../routes/announcements'
import { prisma } from '../utils/prisma'
import { tenantStore } from '../utils/tenantContext'

const app = express()
app.use(express.json())
app.use('/api/auth', authRoutes)
app.use('/api/announcements', announcementRoutes)

const PW = 'StrongPass123!'
const ts = Date.now()
const slugA = `news${ts}a`
const slugB = `news${ts}b`
const emailA = `pma${ts}@x.test`
const emailB = `pmb${ts}@x.test`
const agentA = `aga${ts}@x.test`

const login = async (email: string) => (await request(app).post('/api/auth/login').send({ email, password: PW })).body.accessToken as string
const auth = (t: string) => ({ Authorization: `Bearer ${t}` })

let unitA = ''
let unitB = ''

beforeAll(async () => {
  const hash = await hashPassword(PW)
  await tenantStore.run({ tenantId: null, superAdmin: true }, async () => {
    const a = await prisma.tenant.create({ data: { name: 'News A', slug: slugA, status: 'ACTIVE' } })
    const b = await prisma.tenant.create({ data: { name: 'News B', slug: slugB, status: 'ACTIVE' } })
    await prisma.user.create({ data: { email: emailA, passwordHash: hash, firstName: 'Pa', lastName: 'A', role: 'PLATFORM_MANAGER', isActive: true, tenantId: a.id } })
    await prisma.user.create({ data: { email: emailB, passwordHash: hash, firstName: 'Pb', lastName: 'B', role: 'PLATFORM_MANAGER', isActive: true, tenantId: b.id } })
    await prisma.user.create({ data: { email: agentA, passwordHash: hash, firstName: 'Ag', lastName: 'A', role: 'AGENT', isActive: true, tenantId: a.id } })
    unitA = (await prisma.companyUnit.create({ data: { tenantId: a.id, name: 'Filiale A', slug: 'FILIALE_A', order: 0 } })).id
    unitB = (await prisma.companyUnit.create({ data: { tenantId: b.id, name: 'Filiale B', slug: 'FILIALE_B', order: 0 } })).id
  })
})

describe('announcements', () => {
  it('any employee can publish; text or image required; company required', async () => {
    const tok = await login(agentA)
    const bad = await request(app).post('/api/announcements').set(auth(tok)).field('companyUnitId', unitA)
    expect(bad.status).toBe(400)
    const ok = await request(app).post('/api/announcements').set(auth(tok)).field('companyUnitId', unitA).field('body', 'Nouveau partenaire signé')
    expect(ok.status).toBe(201)
    expect(ok.body.company.name).toBe('Filiale A')
    expect(ok.body.author.firstName).toBe('Ag')
    expect(ok.body.isUnread).toBe(false)
  })

  it('unread counter drops after mark-read; other tenant cannot see the post', async () => {
    const tokA = await login(emailA)
    const tokB = await login(emailB)
    await request(app).post('/api/announcements').set(auth(tokA)).field('companyUnitId', unitA).field('body', 'Ouverture succursale')
    const unread = await request(app).get('/api/announcements/unread-count').set(auth(tokA))
    expect(unread.body.unreadCount).toBeGreaterThanOrEqual(1)
    const listB = await request(app).get('/api/announcements').set(auth(tokB))
    expect(listB.body.announcements.every((x: { body: string }) => x.body !== 'Ouverture succursale')).toBe(true)
    await request(app).post('/api/announcements/read').set(auth(tokA)).send({})
    const after = await request(app).get('/api/announcements/unread-count').set(auth(tokA))
    expect(after.body.unreadCount).toBe(0)
  })

  it('cannot publish against another tenant company unit', async () => {
    const tok = await login(agentA)
    const r = await request(app).post('/api/announcements').set(auth(tok)).field('companyUnitId', unitB).field('body', 'leak')
    expect(r.status).toBe(400)
  })
})
