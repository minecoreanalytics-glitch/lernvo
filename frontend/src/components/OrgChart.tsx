import { useMemo } from 'react'
import { Users, BookOpen, User, Building2 } from 'lucide-react'

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

function Card({ d, onClick, size = 'sm' }: { d: Node; onClick: (id: string) => void; size?: 'sm' | 'lg' }) {
  const color = d.color || '#3B82F6'
  return (
    <button type="button" onClick={() => onClick(d.id)}
      className={`card text-left hover:shadow-card-md transition-shadow group flex items-center gap-3 w-full ${size === 'lg' ? 'p-4' : 'p-3'}`}>
      <div className={`${size === 'lg' ? 'w-12 h-12 text-xl' : 'w-9 h-9 text-base'} rounded-xl flex items-center justify-center shrink-0`}
        style={{ backgroundColor: color + '18' }}>
        {d.icon || '🏛️'}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`${size === 'lg' ? 'text-sm' : 'text-xs'} font-semibold text-gray-800 group-hover:text-primary-700 truncate`}>{d.name}</div>
        {d.managerName && <div className="text-[10px] text-gray-400 flex items-center gap-1 truncate"><User size={9} /> {d.managerName}</div>}
        <div className="flex gap-2 text-[10px] text-gray-400 mt-0.5">
          <span className="flex items-center gap-0.5"><Users size={9} /> {d._count.users}</span>
          {d._count.modules > 0 && <span className="flex items-center gap-0.5"><BookOpen size={9} /> {d._count.modules}</span>}
        </div>
      </div>
    </button>
  )
}

/**
 * Generic org chart: each root is a block; its children with sub-departments become columns
 * (direction → departments); leaf children are grouped in one column. Roots without children
 * are shown as a row of entities (subsidiaries, sites…). No company-specific layout.
 */
export default function OrgChart({ flat, onSelect }: { flat: FlatDept[]; onSelect: (id: string) => void }) {
  const roots = useMemo(() => buildTree(flat), [flat])
  const structured = roots.filter(r => r.children.length > 0)
  const entities = roots.filter(r => r.children.length === 0)

  if (flat.length === 0) return <div className="card p-6 text-sm text-gray-500">Aucun département.</div>

  return (
    <div className="space-y-6">
      {structured.map(root => {
        const columns = root.children.filter(c => c.children.length > 0)
        const leaves = root.children.filter(c => c.children.length === 0)
        return (
          <div key={root.id} className="space-y-3">
            <div className="max-w-md"><Card d={root} onClick={onSelect} size="lg" /></div>
            {(columns.length > 0 || leaves.length > 0) && (
              <div className="pl-3 sm:pl-6 border-l-2 border-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {columns.map(col => (
                    <div key={col.id} className="space-y-2">
                      <Card d={col} onClick={onSelect} />
                      <div className="pl-3 border-l border-gray-100 space-y-1.5">
                        {col.children.map(ch => <Card key={ch.id} d={ch} onClick={onSelect} />)}
                      </div>
                    </div>
                  ))}
                  {leaves.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold px-1 flex items-center gap-1"><Building2 size={10} /> Rattachés</div>
                      <div className="space-y-1.5">{leaves.map(ch => <Card key={ch.id} d={ch} onClick={onSelect} />)}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
      {entities.length > 0 && (
        <div className="space-y-2">
          {structured.length > 0 && <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold px-1">Autres entités</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {entities.map(e => <Card key={e.id} d={e} onClick={onSelect} />)}
          </div>
        </div>
      )}
    </div>
  )
}
