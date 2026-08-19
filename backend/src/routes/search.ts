import { Router } from 'express'
import { prisma } from '../utils/prisma'
import { authenticate } from '../middleware/auth'
import { Role } from '@prisma/client'

const router = Router()
router.use(authenticate)

interface SearchResult {
  id: string
  title: string
  type: 'module' | 'article' | 'department' | 'path'
  description: string
  link: string
}

function truncate(text: string | null | undefined, max = 120): string {
  if (!text) return ''
  return text.length > max ? text.slice(0, max) + '...' : text
}

// GET /api/search?q=xxx
router.get('/', async (req, res) => {
  try {
    const q = (req.query.q as string || '').trim()
    if (!q || q.length < 2) {
      return res.json({ modules: [], articles: [], departments: [], paths: [] })
    }

    const isAdmin = ['PLATFORM_MANAGER', 'HR'].includes(req.user!.role)
    const searchFilter = { contains: q, mode: 'insensitive' as const }

    // Determine user's department for visibility
    let userDeptIds: string[] = []
    if (!isAdmin) {
      const me = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { departmentId: true }
      })
      if (me?.departmentId) {
        const childDepts = await prisma.department.findMany({
          where: { parentId: me.departmentId },
          select: { id: true }
        })
        userDeptIds = [me.departmentId, ...childDepts.map(d => d.id)]
      }
    }

    // --- Modules ---
    const moduleWhere: Record<string, unknown> = {
      OR: [
        { title: searchFilter },
        { description: searchFilter }
      ]
    }
    if (!isAdmin) {
      moduleWhere.isPublished = true
      const roleFilter = {
        OR: [
          { requiredRoles: { isEmpty: true } },
          { requiredRoles: { has: req.user!.role as Role } }
        ]
      }
      if (userDeptIds.length > 0) {
        moduleWhere.AND = [
          roleFilter,
          { OR: [{ departmentId: null }, { departmentId: { in: userDeptIds } }] }
        ]
      } else {
        moduleWhere.AND = [roleFilter]
      }
    }

    const modulesPromise = prisma.module.findMany({
      where: moduleWhere,
      select: { id: true, title: true, description: true },
      take: 5,
      orderBy: { title: 'asc' }
    })

    // --- KB Articles ---
    const articleWhere: Record<string, unknown> = {
      OR: [
        { title: searchFilter },
        { body: searchFilter },
        { tags: { has: q } }
      ]
    }
    if (!isAdmin) articleWhere.isPublished = true

    const articlesPromise = prisma.kbArticle.findMany({
      where: articleWhere,
      select: { id: true, title: true, slug: true, body: true },
      take: 5,
      orderBy: { updatedAt: 'desc' }
    })

    // --- Departments ---
    const deptWhere: Record<string, unknown> = {
      OR: [
        { name: searchFilter },
        { description: searchFilter }
      ]
    }

    const departmentsPromise = prisma.department.findMany({
      where: deptWhere,
      select: { id: true, name: true, description: true },
      take: 5,
      orderBy: { name: 'asc' }
    })

    // --- Career Paths ---
    const pathWhere: Record<string, unknown> = {
      OR: [
        { title: searchFilter },
        { description: searchFilter }
      ]
    }
    if (!isAdmin) pathWhere.status = 'ACTIVE'

    const pathsPromise = prisma.careerPath.findMany({
      where: pathWhere,
      select: { id: true, title: true, description: true },
      take: 5,
      orderBy: { title: 'asc' }
    })

    const [modules, articles, departments, paths] = await Promise.all([
      modulesPromise,
      articlesPromise,
      departmentsPromise,
      pathsPromise
    ])

    const toResult = (
      items: { id: string; title?: string; name?: string; description?: string | null; slug?: string; body?: string | null }[],
      type: SearchResult['type'],
      linkFn: (item: { id: string; slug?: string }) => string,
      descField: 'description' | 'body' = 'description'
    ): SearchResult[] =>
      items.map(item => ({
        id: item.id,
        title: (item.title || item.name) as string,
        type,
        description: truncate(descField === 'body' ? (item as { body?: string | null }).body : item.description),
        link: linkFn(item)
      }))

    res.json({
      modules: toResult(modules, 'module', m => `/modules/${m.id}`),
      articles: toResult(articles as { id: string; title: string; slug: string; body?: string | null }[], 'article', a => `/kb/${a.slug}`, 'body'),
      departments: toResult(departments.map(d => ({ ...d, title: d.name })), 'department', d => `/departments/${d.id}`),
      paths: toResult(paths, 'path', p => `/career/${p.id}`)
    })
  } catch {
    res.status(500).json({ error: 'Search failed' })
  }
})

export default router
