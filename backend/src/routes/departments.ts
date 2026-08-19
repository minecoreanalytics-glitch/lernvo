import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma'
import { getTenantId } from '../utils/tenantContext'
import { authenticate, authorize } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()
router.use(authenticate)

const DepartmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  mission: z.string().optional(),
  managerName: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  parentId: z.string().uuid().optional()
})

// GET /api/departments — list all (with hierarchy)
router.get('/', async (req, res) => {
  try {
    const { parentOnly, flat } = req.query
    const isAdmin = ['PLATFORM_MANAGER', 'HR'].includes(req.user!.role)

    // Flat list for organigram page
    if (flat === 'true') {
      const departments = await prisma.department.findMany({
        select: {
          id: true, name: true, parentId: true, icon: true, color: true,
          managerName: true, mission: true, order: true,
          _count: { select: { users: true, modules: true, children: true } }
        },
        orderBy: { order: 'asc' }
      })
      return res.json(departments)
    }

    const where: Record<string, unknown> = {}
    if (parentOnly === 'true') where.parentId = null

    // MANAGER/SUPERVISOR: only see their department + children
    if (!isAdmin) {
      const me = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { departmentId: true } })
      if (me?.departmentId) {
        // Find their dept and its parent (to show context)
        const myDept = await prisma.department.findUnique({ where: { id: me.departmentId }, select: { id: true, parentId: true } })
        const topDeptId = myDept?.parentId || me.departmentId
        // Show their top-level dept (or parent if they're in a sub-dept)
        where.id = topDeptId
        delete where.parentId // override parentOnly since we're filtering
      }
    }

    const departments = await prisma.department.findMany({
      where,
      include: {
        _count: { select: { users: true, children: true, modules: true } },
        children: {
          select: { id: true, name: true, icon: true, color: true, managerName: true, _count: { select: { users: true, modules: true } } },
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { order: 'asc' }
    })
    res.json(departments)
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to fetch departments' })
  }
})

// GET /api/departments/:id — full detail with modules, members, children
router.get('/:id', async (req, res) => {
  try {
    // MANAGER/SUPERVISOR: only their department tree
    const isAdmin = ['PLATFORM_MANAGER', 'HR'].includes(req.user!.role)
    if (!isAdmin) {
      const me = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { departmentId: true } })
      if (me?.departmentId) {
        const myDept = await prisma.department.findUnique({ where: { id: me.departmentId }, select: { id: true, parentId: true } })
        const topDeptId = myDept?.parentId || me.departmentId
        // Collect all allowed dept IDs (top + children + grandchildren)
        const children = await prisma.department.findMany({ where: { parentId: topDeptId }, select: { id: true } })
        const grandchildren = await prisma.department.findMany({ where: { parentId: { in: children.map(c => c.id) } }, select: { id: true } })
        const allowedIds = [topDeptId, ...children.map(c => c.id), ...grandchildren.map(c => c.id)]
        if (!allowedIds.includes(req.params.id)) {
          return res.status(403).json({ error: 'Access denied to this department' })
        }
      }
    }

    const department = await prisma.department.findUnique({
      where: { id: req.params.id },
      include: {
        parent: { select: { id: true, name: true, icon: true } },
        children: {
          select: { id: true, name: true, icon: true, color: true, managerName: true, mission: true, _count: { select: { users: true, modules: true } } },
          orderBy: { order: 'asc' }
        },
        modules: {
          where: { isPublished: true },
          include: {
            category: { select: { id: true, name: true, color: true, icon: true } },
            _count: { select: { contents: true, enrollments: true } }
          },
          orderBy: { order: 'asc' }
        },
        _count: { select: { users: true, children: true, modules: true } }
      }
    })
    if (!department) return res.status(404).json({ error: 'Department not found' })
    res.json(department)
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to fetch department' })
  }
})

// GET /api/departments/:id/members
router.get('/:id/members', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { departmentId: req.params.id, isActive: true },
      select: {
        id: true, firstName: true, lastName: true, role: true,
        avatarUrl: true, totalPoints: true, currentStreak: true
      },
      orderBy: { firstName: 'asc' }
    })
    res.json(users)
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to fetch department members' })
  }
})

// POST /api/departments/:id/modules — assign a module to dept + enroll all active members
router.post('/:id/modules', authorize('PLATFORM_MANAGER', 'HR', 'MANAGER', 'SUPERVISOR'), async (req, res) => {
  try {
    const { moduleId } = req.body
    if (!moduleId) return res.status(400).json({ error: 'moduleId required' })

    await prisma.module.update({ where: { id: moduleId }, data: { departmentId: req.params.id } })

    const members = await prisma.user.findMany({
      where: { departmentId: req.params.id, isActive: true },
      select: { id: true }
    })

    await Promise.all(members.map(u =>
      prisma.enrollment.upsert({
        where: { userId_moduleId: { userId: u.id, moduleId } },
        create: { tenantId: getTenantId(), userId: u.id, moduleId, status: 'IN_PROGRESS', startedAt: new Date() },
        update: {}
      })
    ))

    res.status(201).json({ enrolled: members.length })
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to assign module to department' })
  }
})

// DELETE /api/departments/:id/modules/:moduleId — remove module from dept (unlink only)
router.delete('/:id/modules/:moduleId', authorize('PLATFORM_MANAGER', 'HR', 'MANAGER', 'SUPERVISOR'), async (req, res) => {
  try {
    await prisma.module.update({ where: { id: req.params.moduleId }, data: { departmentId: null } })
    res.json({ message: 'Module removed from department' })
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to remove module from department' })
  }
})

// POST /api/departments
router.post('/', authorize('PLATFORM_MANAGER', 'HR'), validate(DepartmentSchema), async (req, res) => {
  try {
    const dept = await prisma.department.create({ data: req.body })
    res.status(201).json(dept)
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') return res.status(409).json({ error: 'Department already exists' })
    res.status(500).json({ error: 'Failed to create department' })
  }
})

// PUT /api/departments/:id
router.put('/:id', authorize('PLATFORM_MANAGER', 'HR'), validate(DepartmentSchema.partial()), async (req, res) => {
  try {
    const dept = await prisma.department.update({ where: { id: req.params.id }, data: req.body })
    res.json(dept)
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to update department' })
  }
})

// DELETE /api/departments/:id
router.delete('/:id', authorize('PLATFORM_MANAGER'), async (req, res) => {
  try {
    await prisma.department.delete({ where: { id: req.params.id } })
    res.json({ message: 'Department deleted' })
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Not found' }) // scoped update/delete on a row outside the tenant
    res.status(500).json({ error: 'Failed to delete department' })
  }
})

export default router
