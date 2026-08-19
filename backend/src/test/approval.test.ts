import { describe, it, expect, beforeAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import { hashPassword, verifyPassword } from '../utils/password'
import authRoutes from '../routes/auth'
import kbRoutes from '../routes/kb'
import approvalRoutes from '../routes/approvals'
import { prisma } from '../utils/prisma'
import { tenantStore } from '../utils/tenantContext'

const app = express()
app.use(express.json())
app.use('/api/auth', authRoutes)
app.use('/api/kb', kbRoutes)
app.use('/api/approvals', approvalRoutes)

const PW = 'StrongPass123!'
const ts = Date.now()
let tenantId = '', otherTenantId = ''
const pm = `pm${ts}@x.test`, hr = `hr${ts}@x.test`, agent = `ag${ts}@x.test`, agent2 = `ag2${ts}@x.test`, other = `ot${ts}@x.test`
let articleId = '', slug = ''

async function login(email: string) {
  const r = await request(app).post('/api/auth/login').send({ email, password: PW })
  return r.body.accessToken as string
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` })

beforeAll(async () => {
  const hash = await hashPassword(PW)
  await tenantStore.run({ tenantId: null, superAdmin: true }, async () => {
    const t = await prisma.tenant.create({ data: { name: 'Appr', slug: `appr${ts}`, status: 'ACTIVE' } })
    const o = await prisma.tenant.create({ data: { name: 'Other', slug: `oth${ts}`, status: 'ACTIVE' } })
    tenantId = t.id; otherTenantId = o.id
    const mk = (email: string, role: 'PLATFORM_MANAGER' | 'HR' | 'AGENT', tid: string) =>
      prisma.user.create({ data: { email, passwordHash: hash, firstName: email.slice(0, 2), lastName: 'T', role, isActive: true, tenantId: tid } })
    await mk(pm, 'PLATFORM_MANAGER', tenantId); await mk(hr, 'HR', tenantId); await mk(agent, 'AGENT', tenantId); await mk(agent2, 'AGENT', tenantId)
    await mk(other, 'PLATFORM_MANAGER', otherTenantId)
    slug = `proc-${ts}`
    const a = await prisma.kbArticle.create({ data: { title: 'Procédure v1', slug, body: 'Corps v1', tags: ['proc'], isPublished: false, tenantId } })
    articleId = a.id
  })
})

describe('approval workflow', () => {
  it('starts as DRAFT, unpublished; agent cannot read', async () => {
    const st = await request(app).get(`/api/approvals/kb/${articleId}`).set(auth(await login(agent)))
    expect(st.body.status).toBe('DRAFT'); expect(st.body.currentVersion).toBe(0)
    const rd = await request(app).get(`/api/kb/${slug}`).set(auth(await login(agent)))
    expect(rd.status).toBe(403)
  })

  it('HR submits; HR cannot self-approve; PM approves → v1, published, notifications, manager alert', async () => {
    const hrTok = await login(hr)
    const sub = await request(app).post(`/api/approvals/kb/${articleId}/submit`).set(auth(hrTok))
    expect(sub.status).toBe(200); expect(sub.body.status).toBe('IN_REVIEW')
    const self = await request(app).post(`/api/approvals/kb/${articleId}/approve`).set(auth(hrTok)).send({})
    expect(self.status).toBe(403)
    const pmTok = await login(pm)
    const ap = await request(app).post(`/api/approvals/kb/${articleId}/approve`).set(auth(pmTok)).send({ note: 'Version initiale' })
    expect(ap.status).toBe(200); expect(ap.body.status).toBe('APPROVED'); expect(ap.body.currentVersion).toBe(1)

    await tenantStore.run({ tenantId, superAdmin: false }, async () => {
      const art = await prisma.kbArticle.findFirst({ where: { id: articleId } })
      expect(art?.isPublished).toBe(true)
      const v = await prisma.contentVersion.findFirst({ where: { entityId: articleId, version: 1 } })
      expect((v?.snapshot as { body: string }).body).toBe('Corps v1')
      const agentUser = await prisma.user.findFirst({ where: { email: agent } })
      const n = await prisma.notification.findFirst({ where: { userId: agentUser!.id, type: 'approval' } })
      expect(n?.title).toMatch(/À lire et valider/)
      const hrUser = await prisma.user.findFirst({ where: { email: hr } })
      const m = await prisma.notification.findFirst({ where: { userId: hrUser!.id, type: 'approval', title: { startsWith: 'Approuvé' } } })
      expect(m).not.toBeNull()
    })
  })

  it('agent sees it in my-pending, acknowledges, coverage updates', async () => {
    const agTok = await login(agent)
    const pend = await request(app).get('/api/approvals/my-pending').set(auth(agTok))
    expect(pend.body.some((p: { entityId: string }) => p.entityId === articleId)).toBe(true)
    const ack = await request(app).post(`/api/approvals/kb/${articleId}/ack`).set(auth(agTok))
    expect(ack.status).toBe(200)
    const pend2 = await request(app).get('/api/approvals/my-pending').set(auth(agTok))
    expect(pend2.body.some((p: { entityId: string }) => p.entityId === articleId)).toBe(false)
    const st = await request(app).get(`/api/approvals/kb/${articleId}`).set(auth(await login(pm)))
    expect(st.body.coverage.acked).toBe(1)
    expect(st.body.coverage.total).toBe(4) // pm, hr, agent, agent2 (SUPER_ADMIN excluded)
  })

  it('editing an approved article → DRAFT; employees keep reading v1 snapshot; re-approval → v2 resets ack', async () => {
    const pmTok = await login(pm)
    const ed = await request(app).put(`/api/kb/${slug}`).set(auth(pmTok)).send({ body: 'Corps v2 (brouillon)' })
    expect(ed.status).toBe(200)
    const st = await request(app).get(`/api/approvals/kb/${articleId}`).set(auth(pmTok))
    expect(st.body.status).toBe('DRAFT'); expect(st.body.currentVersion).toBe(1)
    const agTok = await login(agent)
    const rd = await request(app).get(`/api/kb/${slug}`).set(auth(agTok))
    expect(rd.status).toBe(200); expect(rd.body.body).toBe('Corps v1'); expect(rd.body.approvedVersion).toBe(1)
    const adminRead = await request(app).get(`/api/kb/${slug}`).set(auth(pmTok))
    expect(adminRead.body.body).toBe('Corps v2 (brouillon)')

    await request(app).post(`/api/approvals/kb/${articleId}/submit`).set(auth(await login(hr)))
    const ap = await request(app).post(`/api/approvals/kb/${articleId}/approve`).set(auth(pmTok)).send({ note: 'v2' })
    expect(ap.body.currentVersion).toBe(2)
    const rd2 = await request(app).get(`/api/kb/${slug}`).set(auth(agTok))
    expect(rd2.body.body).toBe('Corps v2 (brouillon)')
    const st2 = await request(app).get(`/api/approvals/kb/${articleId}`).set(auth(agTok))
    expect(st2.body.myAck).toBe(false)
    const hist = await request(app).get(`/api/approvals/kb/${articleId}/history`).set(auth(pmTok))
    expect(hist.body.map((h: { version: number }) => h.version)).toEqual([2, 1])
  })

  it('reject notifies submitter with reason', async () => {
    const hrTok = await login(hr)
    await request(app).put(`/api/kb/${slug}`).set(auth(hrTok)).send({ body: 'Corps v3' })
    await request(app).post(`/api/approvals/kb/${articleId}/submit`).set(auth(hrTok))
    const rj = await request(app).post(`/api/approvals/kb/${articleId}/reject`).set(auth(await login(pm))).send({ reason: 'Manque la section tarifs' })
    expect(rj.status).toBe(200); expect(rj.body.status).toBe('REJECTED')
    await tenantStore.run({ tenantId, superAdmin: false }, async () => {
      const hrUser = await prisma.user.findFirst({ where: { email: hr } })
      const n = await prisma.notification.findFirst({ where: { userId: hrUser!.id, title: 'Modifications refusées' } })
      expect(n?.body).toMatch(/Manque la section tarifs/)
    })
  })

  it('other tenant cannot see or act on the item', async () => {
    const otTok = await login(other)
    const st = await request(app).get(`/api/approvals/kb/${articleId}`).set(auth(otTok))
    expect(st.body.currentVersion ?? 0).toBe(0) // not found → default DRAFT/0
    const ap = await request(app).post(`/api/approvals/kb/${articleId}/approve`).set(auth(otTok)).send({})
    expect(ap.status).toBe(404)
    const pend = await request(app).get('/api/approvals/pending').set(auth(otTok))
    expect(pend.body.some((p: { entityId: string }) => p.entityId === articleId)).toBe(false)
  })
})
