import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'

import mobileRoutes from '../routes/mobile'
import { pickTodaySession } from '../services/mobileLearner'
import { prisma } from '../utils/prisma'
import { tenantStore } from '../utils/tenantContext'

const app = express()
app.use(express.json())
app.use('/api/mobile/v1', mobileRoutes)

const secret = process.env.JWT_SECRET!
const suffix = Date.now()
let tenantId = ''
let userId = ''
let managerId = ''
let moduleId = ''
let quizId = ''
let contentId = ''
let announcementId = ''

function accessToken(role: 'AGENT' | 'MANAGER' = 'AGENT', id = userId) {
  return jwt.sign(
    {
      userId: id,
      email: `learner-${suffix}@lernvo.test`,
      role,
      tenantId,
      departmentId: null,
    },
    secret,
    { expiresIn: '15m', algorithm: 'HS256', issuer: 'lernvo', audience: 'api' },
  )
}

describe('pickTodaySession', () => {
  it('prefers overdue work, then due today, then in-progress', () => {
    const overdue = pickTodaySession([
      {
        moduleId: 'in-progress',
        title: 'Later',
        dueAt: null,
        status: 'IN_PROGRESS',
        progressPct: 10,
        estimatedMinutes: 8,
        pendingQuizId: null,
      },
      {
        moduleId: 'overdue',
        title: 'Safety',
        dueAt: new Date('2020-01-01T00:00:00.000Z'),
        status: 'IN_PROGRESS',
        progressPct: 40,
        estimatedMinutes: 5,
        pendingQuizId: 'quiz-1',
      },
    ])
    expect(overdue).toMatchObject({ kind: 'module', moduleId: 'overdue', reason: 'overdue' })
  })

  it('starts the quiz when remaining work is mostly complete', () => {
    const session = pickTodaySession([
      {
        moduleId: 'mod-1',
        title: 'Policies',
        dueAt: new Date(),
        status: 'IN_PROGRESS',
        progressPct: 90,
        estimatedMinutes: 5,
        pendingQuizId: 'quiz-9',
      },
    ])
    expect(session).toMatchObject({ kind: 'quiz', quizId: 'quiz-9', moduleId: 'mod-1' })
  })
})

describe('mobile learner facades', () => {
  beforeAll(async () => {
    await tenantStore.run({ tenantId: null, superAdmin: true }, async () => {
      const tenant = await prisma.tenant.create({
        data: { name: `Learner ${suffix}`, slug: `learner-${suffix}`, status: 'ACTIVE' },
      })
      tenantId = tenant.id
      const manager = await prisma.user.create({
        data: {
          email: `mgr-${suffix}@lernvo.test`,
          passwordHash: 'not-used',
          firstName: 'Mia',
          lastName: 'Manager',
          role: 'MANAGER',
          isActive: true,
          tenantId: tenant.id,
        },
      })
      const user = await prisma.user.create({
        data: {
          email: `learner-${suffix}@lernvo.test`,
          passwordHash: 'not-used',
          firstName: 'Lee',
          lastName: 'Learner',
          role: 'AGENT',
          isActive: true,
          tenantId: tenant.id,
          managerId: manager.id,
        },
      })
      userId = user.id
      managerId = manager.id
      const module = await prisma.module.create({
        data: {
          tenantId: tenant.id,
          title: 'Workplace safety',
          description: 'Required module',
          estimatedMinutes: 6,
          isPublished: true,
        },
      })
      moduleId = module.id
      const content = await prisma.content.create({
        data: {
          tenantId: tenant.id,
          moduleId: module.id,
          title: 'Intro',
          type: 'TEXT',
          body: 'Wear required protection.',
          order: 0,
          isRequired: true,
        },
      })
      contentId = content.id
      const quiz = await prisma.quiz.create({
        data: {
          tenantId: tenant.id,
          moduleId: module.id,
          title: 'Safety check',
          passingScore: 70,
          status: 'PUBLISHED',
          shuffleQuestions: false,
        },
      })
      quizId = quiz.id
      await prisma.question.create({
        data: {
          tenantId: tenant.id,
          quizId: quiz.id,
          text: 'When is protection required?',
          options: [
            { id: 'a', text: 'Always', isCorrect: true },
            { id: 'b', text: 'Never', isCorrect: false },
          ],
          explanation: 'Always.',
          points: 10,
          order: 0,
        },
      })
      await prisma.enrollment.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          moduleId: module.id,
          status: 'IN_PROGRESS',
          progressPct: 20,
          dueAt: new Date('2020-01-02T12:00:00.000Z'),
          startedAt: new Date(),
        },
      })
      const unit = await prisma.companyUnit.create({
        data: { tenantId: tenant.id, name: 'HQ', slug: `HQ_${suffix}`, order: 0 },
      })
      const announcement = await prisma.announcement.create({
        data: {
          tenantId: tenant.id,
          companyUnitId: unit.id,
          authorId: manager.id,
          body: 'Please complete today\'s assigned module.',
        },
      })
      announcementId = announcement.id
    })
  })

  it('returns the next overdue session on today', async () => {
    const response = await request(app)
      .get('/api/mobile/v1/today')
      .set('Authorization', `Bearer ${accessToken()}`)

    expect(response.status).toBe(200)
    expect(response.body.data.session).toMatchObject({
      kind: 'module',
      moduleId,
      title: 'Workplace safety',
      reason: 'overdue',
    })
  })

  it('lists assigned published modules without leaking other tenants', async () => {
    const response = await request(app)
      .get('/api/mobile/v1/learn')
      .set('Authorization', `Bearer ${accessToken()}`)

    expect(response.status).toBe(200)
    expect(response.body.data.modules).toEqual([
      expect.objectContaining({ id: moduleId, title: 'Workplace safety' }),
    ])
  })

  it('strips quiz answer keys for learners', async () => {
    const response = await request(app)
      .get(`/api/mobile/v1/quizzes/${quizId}`)
      .set('Authorization', `Bearer ${accessToken()}`)

    expect(response.status).toBe(200)
    expect(JSON.stringify(response.body)).not.toContain('isCorrect')
    expect(response.body.data.questions[0].options).toEqual([
      { id: 'a', text: 'Always' },
      { id: 'b', text: 'Never' },
    ])
  })

  it('records content progress and lists inbox acknowledgements', async () => {
    const progress = await request(app)
      .post(`/api/mobile/v1/contents/${contentId}/progress`)
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({ progressPct: 100 })
    expect(progress.status).toBe(200)
    expect(progress.body.data.progress.completed).toBe(true)

    const inbox = await request(app)
      .get('/api/mobile/v1/inbox')
      .set('Authorization', `Bearer ${accessToken()}`)
    expect(inbox.status).toBe(200)
    expect(inbox.body.data.unreadCount).toBeGreaterThanOrEqual(1)

    const ack = await request(app)
      .post('/api/mobile/v1/inbox/read')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({ ids: [announcementId] })
    expect(ack.status).toBe(200)
    expect(ack.body.data.unreadCount).toBe(0)
  })

  it('hides team details from agents and returns a thin roster to managers', async () => {
    const agent = await request(app)
      .get('/api/mobile/v1/team')
      .set('Authorization', `Bearer ${accessToken()}`)
    expect(agent.status).toBe(403)

    const manager = await request(app)
      .get('/api/mobile/v1/team')
      .set('Authorization', `Bearer ${accessToken('MANAGER', managerId)}`)
    expect(manager.status).toBe(200)
    expect(manager.body.data.count).toBe(1)
    expect(manager.body.data.members[0]).toMatchObject({
      id: userId,
      firstName: 'Lee',
    })
  })

  it('returns profile certificates envelope for the signed-in learner', async () => {
    const response = await request(app)
      .get('/api/mobile/v1/me')
      .set('Authorization', `Bearer ${accessToken()}`)
    expect(response.status).toBe(200)
    expect(response.body.data.user).toMatchObject({
      id: userId,
      email: `learner-${suffix}@lernvo.test`,
      role: 'AGENT',
    })
    expect(response.body.data.certificates).toEqual([])
  })

  it('ranks the tenant on the leaderboard and flags the caller', async () => {
    const res = await request(app)
      .get('/api/mobile/v1/leaderboard')
      .set('Authorization', `Bearer ${accessToken()}`)
    expect(res.status).toBe(200)
    expect(res.body.data.scope).toBe('company')
    expect(res.body.data.me.rank).toBeGreaterThanOrEqual(1)
    const rows = res.body.data.entries as Array<{ userId: string; isMe: boolean; rank: number }>
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row, i) => row.rank === i + 1)).toBe(true)
    expect(rows.some((row) => row.userId === userId && row.isMe)).toBe(true)
    // answer keys / emails never leak
    expect(JSON.stringify(res.body)).not.toContain('@lernvo.test')
  })


  it('never downgrades a completed enrollment when a module is started again', async () => {
    await tenantStore.run({ tenantId, superAdmin: false }, async () => {
      await prisma.enrollment.updateMany({ where: { userId, moduleId }, data: { status: 'COMPLETED', progressPct: 100, completedAt: new Date() } })
    })
    const res = await request(app)
      .post(`/api/mobile/v1/modules/${moduleId}/start`)
      .set('Authorization', `Bearer ${accessToken()}`)
    expect(res.status).toBe(200)
    expect(res.body.data.enrollment.status).toBe('COMPLETED')
    await tenantStore.run({ tenantId, superAdmin: false }, async () => {
      await prisma.enrollment.updateMany({ where: { userId, moduleId }, data: { status: 'IN_PROGRESS', progressPct: 0, completedAt: null } })
    })
  })

})
