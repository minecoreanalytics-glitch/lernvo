import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import mobileRoutes from '../routes/mobile'
import * as learner from '../services/mobileLearner'
import { prisma } from '../utils/prisma'
import { tenantStore } from '../utils/tenantContext'

const app = express()
app.use(express.json())
app.use('/api/mobile/v1', mobileRoutes)
let tenantId: string

beforeAll(async () => {
  await tenantStore.run({ tenantId: null, superAdmin: true }, async () => {
    const tenant = await prisma.tenant.create({ data: {
      name: 'Release regression', slug: `release-${Date.now()}`, status: 'ACTIVE',
    } })
    tenantId = tenant.id
  })
})

async function fixture(options: { completed?: boolean; maxAttempts?: number } = {}) {
  return tenantStore.run({ tenantId, superAdmin: false }, async () => {
    const user = await prisma.user.create({ data: {
      tenantId, email: `${crypto.randomUUID()}@release.test`, passwordHash: 'unused',
      firstName: 'Release', lastName: 'Learner', role: 'AGENT', isActive: true,
    } })
    const module = await prisma.module.create({ data: {
      tenantId, title: 'Safety release', isPublished: true,
    } })
    const content = await prisma.content.create({ data: {
      tenantId, moduleId: module.id, title: 'Required section', type: 'TEXT', isRequired: true,
    } })
    const quiz = await prisma.quiz.create({ data: {
      tenantId, moduleId: module.id, title: 'Final exam', status: 'PUBLISHED',
      passingScore: 70, shuffleQuestions: false, maxAttempts: options.maxAttempts ?? 3,
    } })
    const questions = await Promise.all([0, 1].map(order => prisma.question.create({ data: {
      tenantId, quizId: quiz.id, text: `Question ${order}`, order, points: 10,
      options: [{ id: 'yes', text: 'Yes', isCorrect: true }, { id: 'no', text: 'No', isCorrect: false }],
    } })))
    await prisma.enrollment.create({ data: {
      tenantId, moduleId: module.id, userId: user.id, status: 'IN_PROGRESS',
    } })
    if (options.completed !== false) await prisma.progressLog.create({ data: {
      tenantId, userId: user.id, contentId: content.id, progressPct: 100, completed: true,
    } })
    const token = jwt.sign({ userId: user.id, role: 'AGENT', tenantId, email: user.email }, process.env.JWT_SECRET!, {
      algorithm: 'HS256', issuer: 'lernvo', audience: 'api', expiresIn: '15m',
    })
    const answers = questions.map(q => ({ questionId: q.id, selectedOptionId: 'yes' }))
    return { user, module, content, quiz, answers, token }
  })
}

describe('mobile release gates', () => {
  it.each(['missing', 'duplicate', 'foreign', 'invalid-option'] as const)('rejects %s answers without creating an attempt', async kind => {
    const f = await fixture()
    const answers = kind === 'missing' ? f.answers.slice(0, 1)
      : kind === 'duplicate' ? [f.answers[0], f.answers[0]]
      : kind === 'foreign' ? [f.answers[0], { questionId: 'outside-quiz', selectedOptionId: 'yes' }]
      : [f.answers[0], { ...f.answers[1], selectedOptionId: 'outside-options' }]
    const result = await request(app).post(`/api/mobile/v1/quizzes/${f.quiz.id}/submit`)
      .set('Authorization', `Bearer ${f.token}`).send({ answers })
    expect(result.status).toBe(400)
    expect(result.body.error.code).toBe('INVALID_ANSWERS')
    const count = await tenantStore.run({ tenantId, superAdmin: false }, async () => await prisma.quizAttempt.count({ where: { userId: f.user.id } }))
    expect(count).toBe(0)
  })

  it('enforces required sections on the server before accepting a quiz', async () => {
    const f = await fixture({ completed: false })
    const result = await request(app).post(`/api/mobile/v1/quizzes/${f.quiz.id}/submit`)
      .set('Authorization', `Bearer ${f.token}`).send({ answers: f.answers })
    expect(result.status).toBe(403)
    expect(result.body.error.code).toBe('CONTENT_INCOMPLETE')
  })

  it('keeps a module in progress until its final exam passes', async () => {
    const f = await fixture({ completed: false })
    await request(app).post(`/api/mobile/v1/contents/${f.content.id}/progress`)
      .set('Authorization', `Bearer ${f.token}`).send({ progressPct: 100 }).expect(200)
    const enrollment = () => tenantStore.run({ tenantId, superAdmin: false }, async () => await prisma.enrollment.findFirst({ where: { userId: f.user.id, moduleId: f.module.id } }))
    expect((await enrollment())?.status).toBe('IN_PROGRESS')
    const today = await request(app).get('/api/mobile/v1/today').set('Authorization', `Bearer ${f.token}`)
    expect(today.body.data.session).toMatchObject({ kind: 'quiz', quizId: f.quiz.id })
    const result = await request(app).post(`/api/mobile/v1/quizzes/${f.quiz.id}/submit`)
      .set('Authorization', `Bearer ${f.token}`).send({ answers: f.answers })
    expect(result.status).toBe(200)
    expect(result.body.data).toMatchObject({ score: 100, passed: true, pointsEarned: 20 })
    expect((await enrollment())?.status).toBe('COMPLETED')
  })

  it('enforces maxAttempts in both quiz details and submissions', async () => {
    const f = await fixture({ maxAttempts: 1 })
    const failed = await request(app).post(`/api/mobile/v1/quizzes/${f.quiz.id}/submit`)
      .set('Authorization', `Bearer ${f.token}`).send({ answers: f.answers.map(a => ({ ...a, selectedOptionId: 'no' })) })
    expect(failed.status).toBe(200)
    const details = await request(app).get(`/api/mobile/v1/quizzes/${f.quiz.id}`).set('Authorization', `Bearer ${f.token}`)
    expect(details.body.data.canAttempt).toBe(false)
    const retry = await request(app).post(`/api/mobile/v1/quizzes/${f.quiz.id}/submit`)
      .set('Authorization', `Bearer ${f.token}`).send({ answers: f.answers })
    expect(retry.status).toBe(403)
    expect(retry.body.error.code).toBe('MAX_ATTEMPTS')
  })

  it('returns a recoverable response when a mobile service rejects', async () => {
    const f = await fixture()
    const spy = vi.spyOn(learner, 'loadTodaySession').mockRejectedValueOnce(new Error('private database detail'))
    try {
      const result = await request(app).get('/api/mobile/v1/today').set('Authorization', `Bearer ${f.token}`)
        .timeout({ response: 500 })
      expect(result.status).toBe(500)
      expect(result.body.error.code).toBe('INTERNAL_ERROR')
      expect(JSON.stringify(result.body)).not.toContain('private database detail')
    } finally { spy.mockRestore() }
  })
})
