import { describe, it, expect, beforeAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import contentRoutes from '../routes/content'
import { prisma } from '../utils/prisma'
import { tenantStore } from '../utils/tenantContext'
import jwt from 'jsonwebtoken'

const app = express()
app.use(express.json())
app.use('/api/content', contentRoutes)

const SECRET = process.env.JWT_SECRET as string

function makeToken(userId: string, tenantId: string | null, role = 'PLATFORM_MANAGER') {
  return jwt.sign({ userId, email: `${userId}@test.lernvo`, role, tenantId }, SECRET, { expiresIn: '15m' })
}

let tenantAId: string
let tenantBId: string
let userAId: string
let userBId: string
let videoBContentId: string

beforeAll(async () => {
  const suffix = Date.now()

  // Tenant is NOT scoped — can create without a tenant context
  const tA = await tenantStore.run({ tenantId: null, superAdmin: true }, () =>
    (prisma as any).tenant.create({ data: { name: 'UploadTA', slug: `upload-ta-${suffix}`, status: 'ACTIVE' } })
  )
  const tB = await tenantStore.run({ tenantId: null, superAdmin: true }, () =>
    (prisma as any).tenant.create({ data: { name: 'UploadTB', slug: `upload-tb-${suffix}`, status: 'ACTIVE' } })
  )
  tenantAId = tA.id
  tenantBId = tB.id

  // User IS scoped — must await INSIDE the run callback so the async context is still live
  await tenantStore.run({ tenantId: tenantAId, superAdmin: false }, async () => {
    const uA = await prisma.user.create({
      data: {
        email: `ua-${suffix}@test.lernvo`,
        firstName: 'UserA',
        lastName: 'Test',
        passwordHash: 'hash',
        role: 'PLATFORM_MANAGER',
        tenantId: tenantAId
      } as any
    })
    userAId = uA.id
  })

  await tenantStore.run({ tenantId: tenantBId, superAdmin: false }, async () => {
    const uB = await prisma.user.create({
      data: {
        email: `ub-${suffix}@test.lernvo`,
        firstName: 'UserB',
        lastName: 'Test',
        passwordHash: 'hash',
        role: 'PLATFORM_MANAGER',
        tenantId: tenantBId
      } as any
    })
    userBId = uB.id

    // Module IS scoped — create inside the same tenantB context
    const moduleB = await prisma.module.create({
      data: {
        title: 'Module B',
        tenantId: tenantBId
      } as any
    })

    // Content is NOT scoped — use superAdmin context for setup
    const contentB = await tenantStore.run({ tenantId: null, superAdmin: true }, async () => {
      return (prisma as any).content.create({
        data: {
          moduleId: moduleB.id,
          title: 'Video B',
          type: 'VIDEO',
          order: 0,
          isRequired: true,
          createdById: uB.id
        }
      })
    })
    videoBContentId = contentB.id
  })
})

describe('upload-video tenant isolation', () => {
  it('cross-tenant: PLATFORM_MANAGER of tenant A gets 404 uploading to tenant B content', async () => {
    const token = makeToken(userAId, tenantAId)
    const r = await request(app)
      .post(`/api/content/${videoBContentId}/upload-video`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('fake-video-data'), { filename: 'test.mp4', contentType: 'video/mp4' })

    expect(r.status).toBe(404)
  })

  it('same-tenant: PLATFORM_MANAGER of tenant B can upload to tenant B content', async () => {
    const token = makeToken(userBId, tenantBId)
    const r = await request(app)
      .post(`/api/content/${videoBContentId}/upload-video`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('fake-video-data'), { filename: 'test.mp4', contentType: 'video/mp4' })

    expect(r.status).toBe(200)
    expect(r.body.url).toBeTruthy()
    expect(r.body.id).toBe(videoBContentId)
  })
})
