import { describe, it, expect, beforeAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import { hashPassword, verifyPassword } from '../utils/password'
import authRoutes from '../routes/auth'
import hrRoutes from '../routes/hr'
import { prisma } from '../utils/prisma'
import { tenantStore } from '../utils/tenantContext'
import { parseCsv, csvToPayload } from '../services/hr/sync'

const app = express()
app.use(express.json())
app.use('/api/auth', authRoutes)
app.use('/api/hr', hrRoutes)

const PW = 'StrongPass123!'
const ts = Date.now()
let tenantId = '', otherTenantId = ''
const pm = `pmhr${ts}@x.test`, other = `othr${ts}@x.test`
let apiKey = ''

const login = async (email: string) => (await request(app).post('/api/auth/login').send({ email, password: PW })).body.accessToken as string
const auth = (t: string) => ({ Authorization: `Bearer ${t}` })

beforeAll(async () => {
  const hash = await hashPassword(PW)
  await tenantStore.run({ tenantId: null, superAdmin: true }, async () => {
    const t = await prisma.tenant.create({ data: { name: 'HR', slug: `hr${ts}`, status: 'ACTIVE' } })
    const o = await prisma.tenant.create({ data: { name: 'HR other', slug: `hro${ts}`, status: 'ACTIVE' } })
    tenantId = t.id; otherTenantId = o.id
    await prisma.user.create({ data: { email: pm, passwordHash: hash, firstName: 'PM', lastName: 'HR', role: 'PLATFORM_MANAGER', isActive: true, tenantId } })
    await prisma.user.create({ data: { email: other, passwordHash: hash, firstName: 'O', lastName: 'T', role: 'PLATFORM_MANAGER', isActive: true, tenantId: otherTenantId } })
    // pre-existing HR user in tenant (must never be downgraded by an HR feed)
    await prisma.user.create({ data: { email: `rh${ts}@corp.test`, passwordHash: hash, firstName: 'Rh', lastName: 'Existing', role: 'HR', isActive: true, tenantId } })
  })
})

describe('CSV parsing', () => {
  it('parses quoted fields, semicolons, aliases', () => {
    const rows = parseCsv('email;prenom;nom;departement;manager_email;role\n"a@c.test";"Jean";"Dupont, Jr";"Ventes";;superviseur\nb@c.test;Ana;Li;Ventes;a@c.test;agent\n')
    expect(rows).toHaveLength(2)
    const p = csvToPayload(rows)
    expect(p.departments?.map(d => d.name)).toEqual(['Ventes'])
    expect(p.employees[0]).toMatchObject({ email: 'a@c.test', lastName: 'Dupont, Jr', role: 'SUPERVISOR' })
    expect(p.employees[1].managerExternalId).toBe(p.employees[0].externalId)
  })
})

describe('HR push API', () => {
  it('PLATFORM_MANAGER creates an API connector and rotates its key', async () => {
    const tok = await login(pm)
    const c = await request(app).post('/api/hr/connectors').set(auth(tok)).send({ type: 'API', name: 'n8n' })
    expect(c.status).toBe(201); expect(c.body.hasApiKey).toBe(false)
    const k = await request(app).post(`/api/hr/connectors/${c.body.id}/rotate-key`).set(auth(tok))
    expect(k.status).toBe(200); apiKey = k.body.key; expect(apiKey.startsWith('lrv_')).toBe(true)
  })

  it('rejects a bad key; accepts payload: departments hierarchy, users, managers, roles protected', async () => {
    const bad = await request(app).post('/api/hr/push').set('X-HR-Key', 'lrv_definitely_wrong_key_123456').send({ employees: [] })
    expect(bad.status).toBe(401)
    const payload = {
      departments: [
        { externalId: 'D1', name: 'Direction Générale' },
        { externalId: 'D2', name: 'Ventes', parentExternalId: 'D1', managerName: 'Jean Dupont' },
      ],
      employees: [
        { externalId: 'E1', email: `jean${ts}@corp.test`, firstName: 'Jean', lastName: 'Dupont', role: 'MANAGER', departmentExternalId: 'D2' },
        { externalId: 'E2', email: `ana${ts}@corp.test`, firstName: 'Ana', lastName: 'Li', departmentExternalId: 'D2', managerExternalId: 'E1', hiredAt: '2026-01-15' },
        { externalId: 'E3', email: `rh${ts}@corp.test`, firstName: 'Rh', lastName: 'Existing', role: 'AGENT', departmentExternalId: 'D1' },
      ],
    }
    const r = await request(app).post('/api/hr/push').set('X-HR-Key', apiKey).send(payload)
    expect(r.status).toBe(200)
    expect(r.body.stats.departments.created).toBe(2)
    expect(r.body.stats.employees.created).toBe(2)
    expect(r.body.stats.employees.updated).toBe(1) // existing HR adopted by email
    await tenantStore.run({ tenantId, superAdmin: false }, async () => {
      const ventes = await prisma.department.findFirst({ where: { name: 'Ventes' }, include: { parent: true } })
      expect(ventes?.parent?.name).toBe('Direction Générale'); expect(ventes?.externalId).toBe('D2')
      const ana = await prisma.user.findFirst({ where: { email: `ana${ts}@corp.test` }, include: { manager: true, department: true } })
      expect(ana?.manager?.email).toBe(`jean${ts}@corp.test`); expect(ana?.department?.name).toBe('Ventes'); expect(ana?.role).toBe('AGENT')
      expect(ana?.hiredAt?.toISOString().slice(0, 10)).toBe('2026-01-15')
      const rh = await prisma.user.findFirst({ where: { email: `rh${ts}@corp.test` } })
      expect(rh?.role).toBe('HR') // never downgraded
      expect(rh?.externalId).toBe('E3')
    })
  })

  it('second push is idempotent; deactivateMissing disables absent employees', async () => {
    const r1 = await request(app).post('/api/hr/push').set('X-HR-Key', apiKey).send({ employees: [
      { externalId: 'E1', email: `jean${ts}@corp.test`, firstName: 'Jean', lastName: 'Dupont' },
    ], deactivateMissing: true })
    expect(r1.status).toBe(200)
    expect(r1.body.stats.employees.created).toBe(0)
    expect(r1.body.stats.employees.deactivated).toBe(1) // ana gone; rh (HR) protected
    await tenantStore.run({ tenantId, superAdmin: false }, async () => {
      const ana = await prisma.user.findFirst({ where: { email: `ana${ts}@corp.test` } })
      expect(ana?.isActive).toBe(false)
      const rh = await prisma.user.findFirst({ where: { email: `rh${ts}@corp.test` } })
      expect(rh?.isActive).toBe(true)
    })
  })

  it('CSV import creates users and departments; runs are logged; other tenant sees nothing', async () => {
    const tok = await login(pm)
    const csv = `email,firstname,lastname,department,role\ncsv1${ts}@corp.test,Marc,Aurel,Support,agent\ncsv2${ts}@corp.test,Lia,Zed,Support,manager\n`
    const r = await request(app).post('/api/hr/import-csv').set(auth(tok)).attach('file', Buffer.from(csv), 'users.csv')
    expect(r.status).toBe(200); expect(r.body.stats.employees.created).toBe(2); expect(r.body.stats.departments.created).toBe(1)
    const runs = await request(app).get('/api/hr/runs').set(auth(tok))
    expect(runs.body.length).toBeGreaterThanOrEqual(3)
    const otherRuns = await request(app).get('/api/hr/runs').set(auth(await login(other)))
    expect(otherRuns.body).toHaveLength(0)
    const otherConn = await request(app).get('/api/hr/connectors').set(auth(await login(other)))
    expect(otherConn.body).toHaveLength(0)
  })

  it('Odoo connector: validates config, masks secrets, test fails cleanly on unreachable host', async () => {
    const tok = await login(pm)
    const bad = await request(app).post('/api/hr/connectors').set(auth(tok)).send({ type: 'ODOO', name: 'Odoo', config: { url: 'x' } })
    expect(bad.status).toBe(400)
    const c = await request(app).post('/api/hr/connectors').set(auth(tok)).send({ type: 'ODOO', name: 'Odoo', config: { url: 'http://127.0.0.1:9', db: 'db', username: 'u', apiKey: 'secret-key' } })
    expect(c.status).toBe(201); expect(c.body.config.apiKey).toBe('••••••••'); expect(c.body.config.url).toBe('http://127.0.0.1:9')
    await tenantStore.run({ tenantId, superAdmin: false }, async () => {
      const row = await prisma.hrConnector.findFirst({ where: { id: c.body.id } })
      expect((row!.config as { apiKey: string }).apiKey.startsWith('enc:v1:')).toBe(true) // encrypted at rest
    })
    const t = await request(app).post(`/api/hr/connectors/${c.body.id}/test`).set(auth(tok))
    expect(t.status).toBe(400); expect(t.body.ok).toBe(false)
    const run = await request(app).post(`/api/hr/connectors/${c.body.id}/run`).set(auth(tok))
    expect(run.status).toBe(400); expect(run.body.error).toBeTruthy()
  })
})
