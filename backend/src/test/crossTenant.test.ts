import { describe, it, expect, beforeAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import authRoutes from '../routes/auth'
import contentRoutes from '../routes/content'
import quizRoutes from '../routes/quizzes'
import moduleRoutes from '../routes/modules'
import adminRoutes from '../routes/admin'
import reportRoutes from '../routes/reports'
import certRoutes from '../routes/certificates'
import userRoutes from '../routes/users'
import { prisma } from '../utils/prisma'
import { tenantStore } from '../utils/tenantContext'

const app = express(); app.use(express.json())
app.use('/api/auth', authRoutes); app.use('/api/content', contentRoutes); app.use('/api/quizzes', quizRoutes)
app.use('/api/modules', moduleRoutes); app.use('/api/admin', adminRoutes); app.use('/api/reports', reportRoutes)
app.use('/api/certificates', certRoutes); app.use('/api/users', userRoutes)

const PW = 'StrongPass123!'; const ts = Date.now()
let tA = '', tB = ''; const adminA = `a${ts}@x.test`, adminB = `b${ts}@x.test`, agentB = `agb${ts}@x.test`
let moduleB = '', contentB = '', quizB = '', certB = '', userAgentB = ''
const login = async (e: string) => (await request(app).post('/api/auth/login').send({ email: e, password: PW })).body
const auth = (t: string) => ({ Authorization: `Bearer ${t}` })

beforeAll(async () => {
  const hash = await bcrypt.hash(PW, 10)
  await tenantStore.run({ tenantId: null, superAdmin: true }, async () => {
    tA = (await prisma.tenant.create({ data: { name: 'A', slug: `ca${ts}`, status: 'ACTIVE' } })).id
    tB = (await prisma.tenant.create({ data: { name: 'B', slug: `cb${ts}`, status: 'ACTIVE' } })).id
    await prisma.user.create({ data: { email: adminA, passwordHash: hash, firstName: 'A', lastName: 'A', role: 'PLATFORM_MANAGER', isActive: true, tenantId: tA } })
    await prisma.user.create({ data: { email: adminB, passwordHash: hash, firstName: 'B', lastName: 'B', role: 'PLATFORM_MANAGER', isActive: true, tenantId: tB } })
    userAgentB = (await prisma.user.create({ data: { email: agentB, passwordHash: hash, firstName: 'Ag', lastName: 'B', role: 'AGENT', isActive: true, tenantId: tB } })).id
    moduleB = (await prisma.module.create({ data: { title: 'Module B', tenantId: tB, isPublished: true } })).id
    contentB = (await prisma.content.create({ data: { tenantId: tB, moduleId: moduleB, title: 'Texte B', type: 'TEXT', body: 'secret B', order: 0, isRequired: true } })).id
    quizB = (await prisma.quiz.create({ data: { tenantId: tB, moduleId: moduleB, title: 'Quiz B', status: 'PUBLISHED', passingScore: 50 } })).id
    await prisma.question.create({ data: { tenantId: tB, quizId: quizB, text: 'Q1', order: 0, points: 10, options: [{ id: 'o1', text: 'oui', isCorrect: true }, { id: 'o2', text: 'non', isCorrect: false }] } })
    await prisma.enrollment.create({ data: { tenantId: tB, userId: userAgentB, moduleId: moduleB, status: 'IN_PROGRESS' } })
    await prisma.quizAttempt.create({ data: { tenantId: tB, userId: userAgentB, quizId: quizB, answers: [], score: 100, passed: true, pointsEarned: 10 } })
    certB = (await prisma.certificate.create({ data: { tenantId: tB, userId: userAgentB, moduleId: moduleB, title: 'Cert B', certNumber: `CT-${ts}`, issuedAt: new Date() } })).id
  })
})

describe('cross-tenant isolation on formerly unguarded models', () => {
  it('tenant A cannot read/modify tenant B content, quiz, module; cannot inject content into B module', async () => {
    const a = (await login(adminA)).accessToken
    expect((await request(app).get(`/api/content/module/${moduleB}`).set(auth(a))).body).toEqual([])
    expect((await request(app).put(`/api/content/${contentB}`).set(auth(a)).send({ title: 'hacked' })).status).toBeGreaterThanOrEqual(400)
    expect((await request(app).delete(`/api/content/${contentB}`).set(auth(a))).status).toBeGreaterThanOrEqual(400)
    const inject = await request(app).post('/api/content').set(auth(a)).send({ moduleId: moduleB, title: 'inj', type: 'TEXT', body: 'x', order: 9 })
    expect(inject.status).toBeGreaterThanOrEqual(400)
    expect((await request(app).get(`/api/quizzes/${quizB}`).set(auth(a))).status).toBe(404)
    expect((await request(app).get(`/api/modules/${moduleB}`).set(auth(a))).status).toBe(404)
    await tenantStore.run({ tenantId: tB, superAdmin: false }, async () => {
      expect((await prisma.content.findFirst({ where: { id: contentB } }))?.title).toBe('Texte B')
      expect(await prisma.content.count({ where: { moduleId: moduleB } })).toBe(1)
    })
  })
  it('admin stats / reports / recent activity only count the caller tenant', async () => {
    const a = (await login(adminA)).accessToken
    const stats = await request(app).get('/api/admin/stats').set(auth(a))
    expect(stats.status).toBe(200)
    expect(stats.body.totalEnrollments ?? stats.body.enrollments ?? 0).toBe(0)
    const act = await request(app).get('/api/admin/recent-activity').set(auth(a))
    if (act.status === 200) expect(JSON.stringify(act.body)).not.toContain('Ag')
    const rep = await request(app).get('/api/reports/quiz-results').set(auth(a))
    if (rep.status === 200) expect(rep.text).not.toContain(`CT-${ts}`), expect(rep.text).not.toContain('Ag B')
  })
  it('learner never receives the answer key, even with ?inline=true', async () => {
    const b = (await login(agentB)).accessToken
    const q = await request(app).get(`/api/quizzes/${quizB}?inline=true`).set(auth(b))
    expect(q.status).toBe(200)
    expect(JSON.stringify(q.body)).not.toContain('isCorrect')
  })
  it('certificate download is tenant-bound for admins too', async () => {
    const a = (await login(adminA)).accessToken
    expect((await request(app).get(`/api/certificates/${certB}/download`).set(auth(a))).status).toBe(404)
  })
  it('role ceiling: HR cannot create PLATFORM_MANAGER or SUPER_ADMIN; PLATFORM_MANAGER cannot create SUPER_ADMIN', async () => {
    const a = (await login(adminA)).accessToken
    const sa = await request(app).post('/api/users').set(auth(a)).send({ email: `sa${ts}@x.test`, password: 'StrongPass123!', firstName: 'S', lastName: 'A', role: 'SUPER_ADMIN' })
    expect(sa.status).toBe(400) // not in the enum
    const hrRes = await request(app).post('/api/users').set(auth(a)).send({ email: `hr${ts}@x.test`, password: 'StrongPass123!', firstName: 'H', lastName: 'R', role: 'HR' })
    expect(hrRes.status).toBe(201)
    const hr = (await login(`hr${ts}@x.test`)).accessToken
    const up = await request(app).post('/api/users').set(auth(hr)).send({ email: `pm2${ts}@x.test`, password: 'StrongPass123!', firstName: 'P', lastName: 'M', role: 'PLATFORM_MANAGER' })
    expect(up.status).toBe(403)
  })
  it('refresh tokens rotate and the old one is rejected; password change revokes sessions', async () => {
    const l = await login(adminB)
    const r1 = await request(app).post('/api/auth/refresh').send({ refreshToken: l.refreshToken })
    expect(r1.status).toBe(200); expect(r1.body.refreshToken).toBeTruthy(); expect(r1.body.refreshToken).not.toBe(l.refreshToken)
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: l.refreshToken })).status).toBe(401)
    const cp = await request(app).post('/api/auth/change-password').set(auth(r1.body.accessToken)).send({ currentPassword: PW, newPassword: 'AnotherStrong123!' })
    expect(cp.status).toBe(200)
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: r1.body.refreshToken })).status).toBe(401)
    await tenantStore.run({ tenantId: null, superAdmin: true }, async () => {
      const u = await prisma.user.findFirst({ where: { email: adminB } })
      await prisma.user.update({ where: { id: u!.id }, data: { passwordHash: await bcrypt.hash(PW, 10) } })
    })
  })
})

describe('same email in two tenants (LRN-16)', () => {
  it('login on apex asks which company; on a tenant host it resolves directly; wrong password → 401', async () => {
    const hash = await bcrypt.hash(PW, 10)
    const shared = `dup${ts}@x.test`
    let slugA = '', slugB = ''
    await tenantStore.run({ tenantId: null, superAdmin: true }, async () => {
      slugA = (await prisma.tenant.findUnique({ where: { id: tA } }))!.slug
      slugB = (await prisma.tenant.findUnique({ where: { id: tB } }))!.slug
      await prisma.user.create({ data: { email: shared, passwordHash: hash, firstName: 'D', lastName: 'A', role: 'AGENT', isActive: true, tenantId: tA } })
      await prisma.user.create({ data: { email: shared, passwordHash: hash, firstName: 'D', lastName: 'B', role: 'AGENT', isActive: true, tenantId: tB } })
    })
    const apex = await request(app).post('/api/auth/login').send({ email: shared, password: PW })
    expect(apex.status).toBe(409); expect(apex.body.needTenant).toBe(true); expect(apex.body.tenants.map((t: { slug: string }) => t.slug).sort()).toEqual([slugA, slugB].sort())
    const pick = await request(app).post('/api/auth/login').send({ email: shared, password: PW, tenantSlug: slugB })
    expect(pick.status).toBe(200); expect(pick.body.user.tenantId).toBe(tB)
    const host = await request(app).post('/api/auth/login').set('Host', `${slugA}.lernvo.com`).send({ email: shared, password: PW })
    expect(host.status).toBe(200); expect(host.body.user.tenantId).toBe(tA)
    expect((await request(app).post('/api/auth/login').send({ email: shared, password: 'wrong-password' })).status).toBe(401)
  })
})
