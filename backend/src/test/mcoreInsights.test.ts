import { describe, it, expect, beforeAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import authRoutes from '../routes/auth'
import mcoreRoutes from '../routes/mcore'
import { prisma } from '../utils/prisma'
import { tenantStore } from '../utils/tenantContext'
import { computeDepartmentContext } from '../services/mcore'

const app = express(); app.use(express.json()); app.use('/api/auth', authRoutes); app.use('/api/mcore', mcoreRoutes)
const PW = 'StrongPass123!'; const ts = Date.now()
let tenantId = '', deptId = ''; const pm = `pmmc${ts}@x.test`

beforeAll(async () => {
  const hash = await bcrypt.hash(PW, 10)
  await tenantStore.run({ tenantId: null, superAdmin: true }, async () => {
    const t = await prisma.tenant.create({ data: { name: 'MC', slug: `mc${ts}`, status: 'ACTIVE' } }); tenantId = t.id
    const d = await prisma.department.create({ data: { name: 'Support', tenantId } }); deptId = d.id
    const admin = await prisma.user.create({ data: { email: pm, passwordHash: hash, firstName: 'P', lastName: 'M', role: 'PLATFORM_MANAGER', isActive: true, tenantId, departmentId: deptId } })
    const agents = await Promise.all([1, 2, 3].map(i => prisma.user.create({ data: { email: `ag${i}${ts}@x.test`, passwordHash: hash, firstName: 'A', lastName: String(i), role: 'AGENT', isActive: true, tenantId, departmentId: deptId } })))
    const art = await prisma.kbArticle.create({ data: { title: 'Proc', slug: `proc${ts}`, body: 'x', tags: [], isPublished: true, tenantId } })
    await prisma.approvalItem.create({ data: { tenantId, entityType: 'KB_ARTICLE', entityId: art.id, status: 'APPROVED', currentVersion: 1, approvedAt: new Date(Date.now() - 200 * 86_400_000) } })
    await prisma.acknowledgment.create({ data: { tenantId, userId: agents[0].id, entityType: 'KB_ARTICLE', entityId: art.id, version: 1 } })
    for (let i = 0; i < 6; i++) await prisma.chatQuestionLog.create({ data: { tenantId, userId: agents[1].id, departmentId: deptId, question: `q${i}`, kbHits: 0 } })
    void admin
  })
})

describe('knowledge-assurance signals', () => {
  it('computes department context', async () => {
    const c = await tenantStore.run({ tenantId, superAdmin: false }, () => computeDepartmentContext(deptId))
    expect(c).not.toBeNull()
    expect(c!.headcount).toBe(4)               // admin + 3 agents
    expect(c!.coverage_pct).toBe(0.25)         // 1 ack / (1 doc × 4)
    expect(c!.unanswered_questions).toBe(6)
    expect(c!.stale_docs).toBe(1)              // approved 200 days ago
  })
  it('insights endpoint returns local doctrine recommendations without the head', async () => {
    const tok = (await request(app).post('/api/auth/login').send({ email: pm, password: PW })).body.accessToken
    const r = await request(app).get('/api/mcore/insights').set('Authorization', `Bearer ${tok}`)
    expect(r.status).toBe(200)
    expect(r.body.head.tenantEnabled).toBe(false)
    const ids = r.body.local.map((x: { policy_id: string }) => x.policy_id)
    expect(ids).toContain('coverage-gap-reinforce'); expect(ids).toContain('knowledge-gap-from-questions'); expect(ids).toContain('stale-documents-reapprove')
    const push = await request(app).post('/api/mcore/push').set('Authorization', `Bearer ${tok}`)
    expect(push.status).toBe(409)
  })
})
