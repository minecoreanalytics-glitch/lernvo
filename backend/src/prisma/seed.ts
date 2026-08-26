import { PrismaClient, Role } from '@prisma/client'
import { hashPassword, verifyPassword } from '../utils/password'

const db = new PrismaClient()

async function main() {
  // ── 1. Demo tenant ──────────────────────────────────────────────────────────
  const tenant = await db.tenant.upsert({
    where: { slug: 'acme-demo' },
    update: {},
    create: {
      name: 'Acme Inc',
      slug: 'acme-demo',
      status: 'ACTIVE',
      approvedAt: new Date(),
    },
  })

  // ── 2. Password hash (shared by all demo users) ─────────────────────────────
  const passwordHash = await hashPassword('LernvoDemo2026!')

  // ── 3. SUPER_ADMIN ──────────────────────────────────────────────────────────
  await db.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'superadmin@lernvo.com' } },
    update: {},
    create: {
      email: 'superadmin@lernvo.com',
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: Role.SUPER_ADMIN,
      tenantId: tenant.id,
      isActive: true,
    },
  })

  // ── 4. One user per role for the demo tenant ─────────────────────────────────
  const roleUsers: { email: string; firstName: string; lastName: string; role: Role }[] = [
    { email: 'platform_manager@acme.demo', firstName: 'Platform', lastName: 'Manager', role: Role.PLATFORM_MANAGER },
    { email: 'hr@acme.demo',               firstName: 'Demo',     lastName: 'Hr',      role: Role.HR },
    { email: 'manager@acme.demo',          firstName: 'Demo',     lastName: 'Manager', role: Role.MANAGER },
    { email: 'supervisor@acme.demo',       firstName: 'Demo',     lastName: 'Supervisor', role: Role.SUPERVISOR },
    { email: 'agent@acme.demo',            firstName: 'Demo',     lastName: 'Agent',   role: Role.AGENT },
  ]

  for (const u of roleUsers) {
    await db.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: u.email } },
      update: {},
      create: {
        ...u,
        passwordHash,
        tenantId: tenant.id,
        isActive: true,
      },
    })
  }

  // ── 5. One Department ────────────────────────────────────────────────────────
  const department = await db.department.upsert({
    where: { name_tenantId: { name: 'Operations', tenantId: tenant.id } },
    update: {},
    create: {
      name: 'Operations',
      tenantId: tenant.id,
    },
  })

  // ── 6. One Category ──────────────────────────────────────────────────────────
  const category = await db.category.upsert({
    where: { name_tenantId: { name: 'Onboarding', tenantId: tenant.id } },
    update: {},
    create: {
      name: 'Onboarding',
      tenantId: tenant.id,
    },
  })

  // ── 7. One Module ────────────────────────────────────────────────────────────
  await db.module.upsert({
    where: { id: 'seed-welcome-module' },
    update: {},
    create: {
      id: 'seed-welcome-module',
      title: 'Welcome to Lernvo',
      tenantId: tenant.id,
      categoryId: category.id,
      departmentId: department.id,
      estimatedMinutes: 10,
    },
  })

  await db.companyUnit.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'ACME' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Acme Inc', slug: 'ACME', order: 0 }
  })

  console.log('Lernvo demo seed complete: tenant=acme-demo, 6 users, 1 department, 1 category, 1 module.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
