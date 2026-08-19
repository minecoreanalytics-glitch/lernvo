import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import ApprovalPanel from '../components/approval/ApprovalPanel'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  BookOpen, Search, Eye, ArrowLeft, Plus, FolderPlus, X, Loader2,
  Package, FileText, Tag, Megaphone, Pencil, Save
} from 'lucide-react'
import { api } from '../utils/api'
import { useAuthStore } from '../store/auth'
import type { KbArticle } from '../types'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

type KbGroup = {
  id: string; name: string; icon?: string; color?: string
  _count: { kbArticles: number }
}

// ─── Document type config ─────────────────────────────────────────────────────
const DOC_TYPES = [
  { key: '',           label: 'Tous',        icon: BookOpen,   color: 'text-gray-600' },
  { key: 'produit',    label: 'Produits',    icon: Package,    color: 'text-blue-600' },
  { key: 'procédure',  label: 'Procédures',  icon: FileText,   color: 'text-green-600' },
  { key: 'promotion',  label: 'Promotions',  icon: Megaphone,  color: 'text-orange-500' },
]

function stripFrontmatter(body: string): string {
  return body.replace(/^---[\s\S]*?---\n?/, '').trim()
}

function getDocType(article: KbArticle): string {
  const tags = article.tags?.map(t => t.toLowerCase()) ?? []
  if (tags.some(t => t.includes('promo'))) return 'promotion'
  if (tags.some(t => t.includes('procédure') || t.includes('procedure') || t.includes('process'))) return 'procédure'
  return 'produit'
}

function DocTypeBadge({ type }: { type: string }) {
  if (type === 'promotion') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 text-orange-600">
      <Megaphone size={9} /> Promotion
    </span>
  )
  if (type === 'procédure') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-600">
      <FileText size={9} /> Procédure
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600">
      <Package size={9} /> Produit
    </span>
  )
}

export default function KnowledgePage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'PLATFORM_MANAGER' || user?.role === 'HR'

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [selectedType, setSelectedType] = useState<string>('')
  const [selected, setSelected] = useState<KbArticle | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editPublished, setEditPublished] = useState(true)
  const [editPublic, setEditPublic] = useState(false)
  const [showCreateArticle, setShowCreateArticle] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)

  // Forms
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupIcon, setNewGroupIcon] = useState('📁')
  const [articleTitle, setArticleTitle] = useState('')
  const [articleBody, setArticleBody] = useState('')
  const [articleCategoryId, setArticleCategoryId] = useState('')
  const [articleTags, setArticleTags] = useState('')

  const { data: groups = [] } = useQuery<KbGroup[]>({
    queryKey: ['kb-groups'],
    queryFn: () => api.get('/kb/groups').then(r => r.data)
  })

  const { data, isLoading } = useQuery<{ articles: KbArticle[]; total: number }>({
    queryKey: ['kb', debounced, selectedGroup],
    queryFn: () => {
      const params = new URLSearchParams()
      if (debounced) params.set('search', debounced)
      if (selectedGroup) params.set('category', selectedGroup)
      return api.get(`/kb?${params}&limit=100`).then(r => r.data)
    }
  })

  const { data: article } = useQuery<KbArticle>({
    queryKey: ['kb-article', selected?.slug],
    queryFn: () => api.get(`/kb/${selected?.slug}`).then(r => r.data),
    enabled: !!selected?.slug
  })

  const updateArticle = useMutation({
    mutationFn: (payload: { slug: string; data: Record<string, unknown> }) =>
      api.put(`/kb/${payload.slug}`, payload.data).then(r => r.data as KbArticle),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['kb'] })
      queryClient.invalidateQueries({ queryKey: ['kb-groups'] })
      queryClient.setQueryData(['kb-article', updated.slug], updated)
      setSelected(updated)
      setIsEditing(false)
    }
  })

  function startEditing(a: KbArticle) {
    setEditTitle(a.title)
    setEditBody(a.body ?? '')
    setEditTags(a.tags.join(', '))
    setEditPublished(a.isPublished)
    setEditPublic(!!a.isPublic)
    setIsEditing(true)
  }

  function handleSaveEdit(a: KbArticle) {
    updateArticle.mutate({
      slug: a.slug,
      data: {
        title: editTitle.trim(),
        body: editBody.trim(),
        tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
        isPublished: editPublished,
        isPublic: editPublic,
        categoryId: a.category?.id || undefined,
      }
    })
  }

  const createGroup = useMutation({
    mutationFn: (data: { name: string; icon: string }) =>
      api.post('/kb/groups', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb-groups'] })
      setShowCreateGroup(false)
      setNewGroupName('')
    }
  })

  const createArticle = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/kb', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb'] })
      queryClient.invalidateQueries({ queryKey: ['kb-groups'] })
      setShowCreateArticle(false)
      setArticleTitle(''); setArticleBody(''); setArticleCategoryId(''); setArticleTags('')
    }
  })

  function handleSearch(v: string) {
    setSearch(v)
    clearTimeout((window as unknown as { _kbst?: ReturnType<typeof setTimeout> })._kbst)
    ;(window as unknown as { _kbst?: ReturnType<typeof setTimeout> })._kbst = setTimeout(() => setDebounced(v), 300)
  }

  const allArticles = data?.articles ?? []

  // Deep link: /kb?slug=xxx (notifications, dashboard "À valider")
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const s = searchParams.get('slug')
    if (!s || selected?.slug === s) return
    api.get(`/kb/${s}`).then(({ data }) => setSelected(data as KbArticle)).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Filter by doc type client-side
  const articles = useMemo(() => {
    if (!selectedType) return allArticles
    return allArticles.filter(a => getDocType(a) === selectedType)
  }, [allArticles, selectedType])

  // ─── Article reader ──────────────────────────────────────────
  if (selected && article) {
    const docType = getDocType(article)
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => { setSelected(null); setIsEditing(false); if (searchParams.get('slug')) setSearchParams({}) }} className="btn-ghost text-sm flex items-center gap-1.5">
            <ArrowLeft size={14} /> Base de connaissances
          </button>
          {isAdmin && !isEditing && (
            <button onClick={() => startEditing(article)} className="btn-outline text-sm flex items-center gap-1.5">
              <Pencil size={14} /> Modifier
            </button>
          )}
        </div>
        <ApprovalPanel entityType="kb" entityId={article.id} />
        {isEditing ? (
          <div className="card p-6 space-y-4">
            <div>
              <label className="label">Titre</label>
              <input className="input" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </div>
            <div>
              <label className="label">Contenu (Markdown)</label>
              <textarea className="input font-mono text-xs min-h-[420px]" value={editBody} onChange={e => setEditBody(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Tags (séparés par des virgules)</label>
                <input className="input" value={editTags} onChange={e => setEditTags(e.target.value)} />
              </div>
              <div className="space-y-2 mt-6">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={editPublished} onChange={e => setEditPublished(e.target.checked)} />
                  Publié (visible par les employés)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700" title="Exposé en lecture par l'API publique (site web) une fois approuvé">
                  <input type="checkbox" checked={editPublic} onChange={e => setEditPublic(e.target.checked)} />
                  Publiable sur le site web (API publique, après approbation)
                </label>
              </div>
            </div>
            {updateArticle.isError && <p className="text-xs text-red-600">Enregistrement impossible. Réessayez.</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setIsEditing(false)} className="btn-ghost text-sm">Annuler</button>
              <button onClick={() => handleSaveEdit(article)} disabled={!editTitle.trim() || !editBody.trim() || updateArticle.isPending}
                className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50">
                {updateArticle.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
              </button>
            </div>
          </div>
        ) : (
        <div className="card p-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <DocTypeBadge type={docType} />
            {article.category && (
              <span className="text-xs text-gray-400 font-medium">
                {article.category.icon} {article.category.name}
              </span>
            )}
            {article.isPublic && <span className="chip bg-teal-50 text-teal-700 border border-teal-200 text-[9px]">Public (site web)</span>}
            <span className="text-xs text-gray-300">·</span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Eye size={10} /> {article._count?.views ?? 0} vues
            </span>
            <span className="text-xs text-gray-400">
              · mis à jour {formatDistanceToNow(new Date(article.updatedAt), { addSuffix: true, locale: fr })}
            </span>
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-4">{article.title}</h1>
          <hr className="border-gray-100 mb-5" />

          <div className="kb-body text-gray-700 text-sm leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({children}) => <h1 className="text-xl font-bold text-gray-900 mt-6 mb-3 first:mt-0">{children}</h1>,
                h2: ({children}) => <h2 className="text-base font-bold text-gray-800 mt-5 mb-2 pb-1 border-b border-gray-100">{children}</h2>,
                h3: ({children}) => <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-1.5">{children}</h3>,
                p: ({children}) => <p className="mb-3 text-gray-600 leading-relaxed">{children}</p>,
                ul: ({children}) => <ul className="mb-3 space-y-1 pl-4">{children}</ul>,
                ol: ({children}) => <ol className="mb-3 space-y-1 pl-4 list-decimal">{children}</ol>,
                li: ({children}) => <li className="text-gray-600 flex gap-2 items-start"><span className="text-primary-400 mt-1 shrink-0">•</span><span>{children}</span></li>,
                table: ({children}) => <div className="overflow-x-auto mb-4"><table className="w-full text-xs border-collapse">{children}</table></div>,
                thead: ({children}) => <thead className="bg-gray-50">{children}</thead>,
                th: ({children}) => <th className="text-left px-3 py-2 font-semibold text-gray-700 border border-gray-200">{children}</th>,
                td: ({children}) => <td className="px-3 py-2 text-gray-600 border border-gray-200 align-top">{children}</td>,
                tr: ({children}) => <tr className="hover:bg-gray-50 transition-colors">{children}</tr>,
                strong: ({children}) => <strong className="font-semibold text-gray-800">{children}</strong>,
                blockquote: ({children}) => <blockquote className="border-l-4 border-primary-200 pl-3 py-1 my-3 bg-primary-50 rounded-r-lg text-xs text-primary-700">{children}</blockquote>,
                code: ({children}) => <code className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                hr: () => <hr className="border-gray-100 my-4" />,
                a: ({href, children}) => <a href={href ?? '#'} className="text-primary-600 underline hover:text-primary-800">{children}</a>,
              }}
            >
              {stripFrontmatter(article.body ?? '')}
            </ReactMarkdown>
          </div>

          {article.tags.filter(t => !['produit','procédure','promotion'].includes(t)).length > 0 && (
            <div className="flex gap-1.5 mt-6 pt-4 border-t border-gray-100 flex-wrap">
              <Tag size={12} className="text-gray-300 mt-0.5" />
              {article.tags.filter(t => !['produit','procédure','promotion'].includes(t)).map(t => (
                <span key={t} className="chip chip-gray text-[9px]">{t}</span>
              ))}
            </div>
          )}
        </div>
        )}
      </div>
    )
  }

  // ─── Create forms ────────────────────────────────────────────
  if (showCreateArticle && isAdmin) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Plus size={18} className="text-primary-600" /> Nouveau document
          </h1>
          <button onClick={() => setShowCreateArticle(false)} className="btn-ghost p-2"><X size={16} /></button>
        </div>
        <div className="card p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Titre *</label>
            <input value={articleTitle} onChange={e => setArticleTitle(e.target.value)}
              placeholder="Titre du document"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Catégorie</label>
            <select value={articleCategoryId} onChange={e => setArticleCategoryId(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50">
              <option value="">Aucune catégorie</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Type de document</label>
            <select value={articleTags.includes('procédure') ? 'procédure' : articleTags.includes('promotion') ? 'promotion' : 'produit'}
              onChange={e => setArticleTags(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50">
              <option value="produit">📦 Produit</option>
              <option value="procédure">📋 Procédure</option>
              <option value="promotion">📣 Promotion</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Contenu * (markdown)</label>
            <textarea value={articleBody} onChange={e => setArticleBody(e.target.value)}
              placeholder="Contenu du document..."
              rows={12}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50 resize-none" />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createArticle.mutate({
                title: articleTitle, body: articleBody,
                categoryId: articleCategoryId || undefined,
                tags: [articleTags].filter(Boolean),
                isPublished: true
              })}
              disabled={!articleTitle.trim() || !articleBody.trim() || createArticle.isPending}
              className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {createArticle.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Publier
            </button>
            <button
              onClick={() => createArticle.mutate({
                title: articleTitle, body: articleBody,
                categoryId: articleCategoryId || undefined,
                tags: [articleTags].filter(Boolean),
                isPublished: false
              })}
              disabled={!articleTitle.trim() || !articleBody.trim()}
              className="btn-ghost py-2.5 text-sm px-4">Brouillon</button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Main layout ─────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen size={20} className="text-primary-600" /> Base de connaissances
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.total ?? 0} documents disponibles</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setShowCreateGroup(true)}
              className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1">
              <FolderPlus size={13} /> Groupe
            </button>
            <button onClick={() => setShowCreateArticle(true)}
              className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
              <Plus size={13} /> Document
            </button>
          </div>
        )}
      </div>

      {/* Create group inline */}
      <AnimatePresence>
        {showCreateGroup && isAdmin && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="card p-4 flex items-end gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-600 block mb-1">Nom du groupe</label>
              <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                placeholder="Ex: Procédures Techniques"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="w-16">
              <label className="text-xs font-semibold text-gray-600 block mb-1">Icône</label>
              <input value={newGroupIcon} onChange={e => setNewGroupIcon(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-gray-50 text-center" />
            </div>
            <button onClick={() => createGroup.mutate({ name: newGroupName, icon: newGroupIcon })}
              disabled={!newGroupName.trim() || createGroup.isPending}
              className="btn-primary text-xs px-4 py-2 disabled:opacity-50">
              {createGroup.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Créer'}
            </button>
            <button onClick={() => setShowCreateGroup(false)} className="btn-ghost p-2"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Rechercher un document, produit, procédure..."
          value={search} onChange={e => handleSearch(e.target.value)} />
      </div>

      {/* Doc type filter */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-hide">
        {DOC_TYPES.map(dt => {
          const Icon = dt.icon
          const count = dt.key === '' ? allArticles.length : allArticles.filter(a => getDocType(a) === dt.key).length
          return (
            <button key={dt.key}
              onClick={() => setSelectedType(dt.key)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                selectedType === dt.key
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}>
              <Icon size={12} />
              {dt.label}
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                selectedType === dt.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
              }`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Mobile category picker */}
      {!debounced && groups.length > 0 && (
        <div className="md:hidden">
          <select
            value={selectedGroup}
            onChange={e => setSelectedGroup(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">Tous les documents ({data?.total ?? 0})</option>
            {groups.filter(g => g._count.kbArticles > 0).map(g => (
              <option key={g.id} value={g.id}>{g.icon} {g.name} ({g._count.kbArticles})</option>
            ))}
          </select>
        </div>
      )}

      {/* Main content: sidebar + articles */}
      <div className="flex gap-4 items-start">

        {/* Left sidebar — desktop only */}
        {!debounced && groups.length > 0 && (
          <div className="hidden md:block w-48 shrink-0 space-y-1">
            {/* All */}
            <button
              onClick={() => setSelectedGroup('')}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-between ${
                !selectedGroup ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}>
              <span className="flex items-center gap-1.5"><BookOpen size={12} /> Tous les documents</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${!selectedGroup ? 'bg-white/20' : 'bg-gray-100 text-gray-400'}`}>
                {data?.total ?? 0}
              </span>
            </button>

            {/* Categories */}
            {groups.filter(g => g._count.kbArticles > 0).map(g => (
              <button key={g.id}
                onClick={() => setSelectedGroup(g.id)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all flex items-center justify-between ${
                  selectedGroup === g.id
                    ? 'font-semibold bg-primary-600 text-white'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}>
                <span className="flex items-center gap-1.5 truncate">
                  {g.icon && <span>{g.icon}</span>}
                  <span className="truncate">{g.name}</span>
                </span>
                <span className={`text-[10px] px-1 rounded shrink-0 ${selectedGroup === g.id ? 'text-white/70' : 'text-gray-400'}`}>
                  {g._count.kbArticles}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Articles */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-20" />)}
            </div>
          ) : articles.length === 0 ? (
            <div className="card p-12 text-center">
              <BookOpen size={36} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-400">
                {search ? 'Aucun document trouvé' : 'Aucun document dans cette catégorie'}
              </p>
              {isAdmin && !search && (
                <button onClick={() => setShowCreateArticle(true)}
                  className="btn-primary mt-4 text-xs inline-flex items-center gap-1">
                  <Plus size={12} /> Ajouter un document
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {articles.map((a, i) => {
                const docType = getDocType(a)
                return (
                  <motion.button key={a.id} onClick={() => setSelected(a)}
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                    className="card p-4 w-full text-left hover:shadow-card-md transition-all group">
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base"
                        style={{ backgroundColor: (a.category?.color ?? '#0057A8') + '18' }}>
                        {a.category?.icon ?? '📄'}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-gray-800 group-hover:text-primary-700 transition-colors line-clamp-1 flex-1">
                            {a.title}
                          </h3>
                          <DocTypeBadge type={docType} />
                          {!a.isPublished && (
                            <span className="chip bg-yellow-50 text-yellow-600 text-[9px]">Brouillon</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                          {a.category && (
                            <span className="font-medium" style={{ color: a.category.color ?? '#6B7280' }}>
                              {a.category.name}
                            </span>
                          )}
                          <span className="flex items-center gap-1"><Eye size={10} /> {a._count?.views ?? 0}</span>
                          <span>{formatDistanceToNow(new Date(a.updatedAt), { addSuffix: true, locale: fr })}</span>
                        </div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        className="text-gray-300 shrink-0 mt-0.5 group-hover:text-primary-400 transition-colors">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
