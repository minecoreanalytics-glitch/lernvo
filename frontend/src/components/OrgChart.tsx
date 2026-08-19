import { useMemo, useState } from 'react'
import { Users, BookOpen, User, ChevronRight, Search, Building2 } from 'lucide-react'

export type FlatDept = {
  id: string; name: string; parentId: string | null
  icon?: string | null; color?: string | null; managerName?: string | null; mission?: string | null; order: number
  _count: { users: number; modules: number; children: number }
}

type Node = FlatDept & { children: Node[] }

/** Build a tree from the flat department list (tenant-agnostic: any depth). */
export function buildTree(flat: FlatDept[]): Node[] {
  const map = new Map<string, Node>()
  flat.forEach(d => map.set(d.id, { ...d, children: [] }))
  const roots: Node[] = []
  map.forEach(n => {
    if (n.parentId && map.has(n.parentId)) map.get(n.parentId)!.children.push(n)
    else roots.push(n)
  })
  const sort = (arr: Node[]) => { arr.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)); arr.forEach(n => sort(n.children)) }
  sort(roots)
  return roots
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function DeptCard({ d, onClick, parentName }: { d: Node; onClick: (id: string) => void; parentName?: string }) {
  const color = d.color || '#3B82F6'
  return (
    <button type="button" onClick={() => onClick(d.id)}
      className="card p-3 text-left hover:shadow-card-md transition-shadow group flex items-center gap-3 w-full">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: color + '18' }}>
        {d.icon || '🏛️'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-gray-800 group-hover:text-primary-700 truncate">{d.name}</div>
        {d.managerName && <div className="text-[11px] text-gray-400 flex items-center gap-1 truncate"><User size={10} /> {d.managerName}</div>}
        {parentName && <div className="text-[10px] text-gray-400 truncate">↳ {parentName}</div>}
        <div className="flex gap-3 text-[11px] text-gray-400 mt-0.5">
          <span className="flex items-center gap-1"><Users size={10} /> {d._count.users}</span>
          <span className="flex items-center gap-1"><BookOpen size={10} /> {d._count.modules}</span>
        </div>
      </div>
      <ChevronRight size={14} className="text-gray-300 shrink-0" />
    </button>
  )
}

function SectionHeader({ d, onClick }: { d: Node; onClick: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onClick(d.id)} className="flex items-center gap-2 group text-left">
      <span className="w-6 h-6 rounded-md flex items-center justify-center text-sm" style={{ backgroundColor: (d.color || '#3B82F6') + '18' }}>{d.icon || '🏛️'}</span>
      <span className="text-sm font-bold text-gray-800 group-hover:text-primary-700">{d.name}</span>
      {d.managerName && <span className="text-[11px] text-gray-400 hidden sm:inline">· {d.managerName}</span>}
    </button>
  )
}

/**
 * Generic org chart, all on one page: for each root (e.g. "Direction Générale") the level-2 nodes
 * (directions) become stacked sections, each listing its departments in a 2-column grid; roots without
 * children (subsidiaries, sites…) form a final section. Search filters by name / manager, accent-insensitive.
 * No company-specific layout — everything comes from the tenant's parentId hierarchy.
 */
export default function OrgChart({ flat, onSelect, mode = 'tree' }: { flat: FlatDept[]; onSelect: (id: string) => void; mode?: 'tree' | 'all' }) {
  const [q, setQ] = useState('')
  const roots = useMemo(() => buildTree(flat), [flat])
  const nq = normalize(q.trim())
  const match = (d: Node) => !nq || normalize(d.name).includes(nq) || normalize(d.managerName || '').includes(nq)

  const structured = roots.filter(r => r.children.length > 0)
  const entities = roots.filter(r => r.children.length === 0)

  if (flat.length === 0) return <div className="card p-6 text-sm text-gray-500">Aucun département.</div>

  const searchBox = (
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un département…" className="input pl-9" />
    </div>
  )

  // ── Mode "all": every department, flat, alphabetical, with its parent ──
  if (mode === 'all') {
    const byId = new Map(flat.map(d => [d.id, d]))
    const all = [...flat].map(d => ({ ...d, children: [] as Node[] }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      .filter(match)
    return (
      <div className="space-y-4">
        {searchBox}
        <div className="text-xs text-gray-400">{all.length} département{all.length > 1 ? 's' : ''}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {all.map(d => <DeptCard key={d.id} d={d} onClick={onSelect} parentName={d.parentId ? byId.get(d.parentId)?.name : undefined} />)}
        </div>
      </div>
    )
  }

  const grid = (nodes: Node[]) => {
    const shown = nodes.filter(match)
    if (shown.length === 0) return null
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {shown.map(n => <DeptCard key={n.id} d={n} onClick={onSelect} />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {searchBox}

      {structured.map(root => {
        const sections = root.children.filter(c => c.children.length > 0)
        const leaves = root.children.filter(c => c.children.length === 0)
        return (
          <div key={root.id} className="space-y-5">
            {!nq && (
              <button type="button" onClick={() => onSelect(root.id)} className="card p-4 w-full max-w-md text-left flex items-center gap-3 hover:shadow-card-md transition-shadow group">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: (root.color || '#3B82F6') + '18' }}>{root.icon || '🏛️'}</div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-gray-900 group-hover:text-primary-700">{root.name}</div>
                  {root.managerName && <div className="text-[11px] text-gray-400 flex items-center gap-1"><User size={10} /> {root.managerName}</div>}
                  <div className="text-[11px] text-gray-400 flex items-center gap-1"><Building2 size={10} /> {sections.length + leaves.length} sous-départements</div>
                </div>
              </button>
            )}
            {sections.map(sec => {
              const body = grid(sec.children)
              if (!body && nq && !match(sec)) return null
              return (
                <section key={sec.id} className="space-y-2.5">
                  <SectionHeader d={sec} onClick={onSelect} />
                  {body ?? <p className="text-xs text-gray-400 pl-8">Aucun département dans cette direction.</p>}
                </section>
              )
            })}
            {leaves.length > 0 && grid(leaves) && (
              <section className="space-y-2.5">
                <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold flex items-center gap-1"><Building2 size={11} /> Rattachés à {root.name}</div>
                {grid(leaves)}
              </section>
            )}
          </div>
        )
      })}

      {entities.length > 0 && grid(entities) && (
        <section className="space-y-2.5">
          <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold flex items-center gap-1"><Building2 size={11} /> {structured.length > 0 ? 'Filiales & entités' : 'Départements'}</div>
          {grid(entities)}
        </section>
      )}
    </div>
  )
}
