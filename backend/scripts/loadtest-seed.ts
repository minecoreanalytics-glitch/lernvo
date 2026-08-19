import { prisma } from '../src/utils/prisma'
import { tenantStore } from '../src/utils/tenantContext'
import { hashPassword, hashMany } from '../src/utils/password'
const N = 200
;(async () => {
  await tenantStore.run({ tenantId: null, superAdmin: true }, async () => {
    const slug = 'loadtest'
    let t = await prisma.tenant.findUnique({ where: { slug } })
    if (!t) t = await prisma.tenant.create({ data: { name: 'Load Test Co', slug, status: 'ACTIVE' } })
    const existing = await prisma.user.count({ where: { tenantId: t.id } })
    if (existing < N) {
      const plains = Array.from({ length: N }, () => 'LoadTest2026!')
      const hashes = await hashMany(plains, 8)
      const dept = await prisma.department.findFirst({ where: { tenantId: t.id } })
        ?? await prisma.department.create({ data: { name: 'Support', tenantId: t.id } })
      await prisma.user.createMany({ data: Array.from({ length: N }, (_, i) => ({
        email: `load${i}@loadtest.test`, passwordHash: hashes[i], firstName: 'Load', lastName: String(i),
        role: 'AGENT' as const, isActive: true, tenantId: t!.id, departmentId: dept.id })), skipDuplicates: true })
    }
    console.log('tenant', t.id, 'users', await prisma.user.count({ where: { tenantId: t.id } }))
  })
  process.exit(0)
})()
