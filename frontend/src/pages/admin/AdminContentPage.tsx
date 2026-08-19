import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, BookOpen, Route, BookMarked, Plus, Sparkles, X, Upload, Loader2, AlertCircle, Wand2, Pencil } from 'lucide-react'
import axios from 'axios'
import { api } from '../../utils/api'
import type { Module, KbArticle, CareerPath } from '../../types'

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data?.error
    if (typeof apiError === 'string' && apiError.trim()) return apiError
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

type Tab = 'modules' | 'paths' | 'kb'

// ─── Create Path Modal ────────────────────────────────────────────────────────
function CreatePathModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.post('/career/paths', { title, description, status: 'DRAFT' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-paths'] })
      onClose()
    }
  })

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Route size={16} className="text-primary-600" /> Nouveau parcours
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Titre *</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Onboarding Technicien FTTH"
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Objectifs du parcours..."
              rows={3}
              className="input w-full resize-none"
            />
          </div>
        </div>
        <div className="px-6 pb-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm">Annuler</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!title.trim() || mutation.isPending}
            className="btn-primary text-sm"
          >
            {mutation.isPending ? 'Création...' : 'Créer le parcours'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Create KB Article Modal ──────────────────────────────────────────────────
function CreateKbModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.post('/kb', {
      title,
      body,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      isPublished: false
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-kb'] })
      onClose()
    }
  })

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <BookMarked size={16} className="text-primary-600" /> Nouvel article KB
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Titre *</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Procédure d'installation FTTH"
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Contenu (Markdown) *</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="# Titre&#10;&#10;Contenu de l'article..."
              rows={6}
              className="input w-full resize-none font-mono text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tags (séparés par des virgules)</label>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="Ex: ftth, installation, technique"
              className="input w-full"
            />
          </div>
        </div>
        <div className="px-6 pb-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm">Annuler</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!title.trim() || !body.trim() || mutation.isPending}
            className="btn-primary text-sm"
          >
            {mutation.isPending ? 'Création...' : 'Créer l\'article'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Import KB from Document Modal ─────────────────────────────────────────────
const KB_FILE_ACCEPT = '.pdf,.txt,.md,.csv'

function ImportKbModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isPublished, setIsPublished] = useState(true)
  const [successTitle, setSuccessTitle] = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      const formData = new FormData()
      if (!file) throw new Error('Aucun fichier sélectionné')
      formData.append('file', file)
      formData.append('isPublished', String(isPublished))
      return api.post('/kb/import-document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000
      }).then(r => r.data as { article: KbArticle })
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin-kb'] })
      qc.invalidateQueries({ queryKey: ['kb'] })
      setSuccessTitle(data.article.title)
    }
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null
    setFile(selected)
    mutation.reset()
    setSuccessTitle('')
  }

  if (successTitle) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <BookMarked size={24} className="text-green-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Article créé !</h2>
            <p className="text-sm text-gray-500 mt-1">« {successTitle} » a été ajouté à la base de connaissances.</p>
          </div>
          <button onClick={onClose} className="btn-primary text-sm w-full">Fermer</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Upload size={16} className="text-primary-600" /> Importer un document
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-xs text-gray-500">
            Uploadez un document (PDF, TXT, MD, CSV). L'IA extraira le contenu et créera automatiquement un article pour la base de connaissances.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept={KB_FILE_ACCEPT}
            className="hidden"
            onChange={handleFileChange}
          />

          {file ? (
            <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <FileText size={20} className="text-primary-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} Mo</p>
              </div>
              <button
                onClick={() => { setFile(null); mutation.reset(); if (fileInputRef.current) fileInputRef.current.value = '' }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-primary-400 hover:bg-primary-50/30 transition-colors"
            >
              <Upload size={28} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">Cliquez pour choisir un document</p>
              <p className="text-xs text-gray-400 mt-1">PDF, TXT, MD, CSV — max 20 Mo</p>
            </button>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={e => setIsPublished(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Publier immédiatement</span>
          </label>

          {mutation.isError && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle size={14} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-600">{getApiErrorMessage(mutation.error, 'Import impossible. Réessayez.')}</p>
            </div>
          )}
        </div>
        <div className="px-6 pb-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm">Annuler</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!file || mutation.isPending}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            {mutation.isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Création en cours...</>
            ) : (
              <><Wand2 size={14} /> Créer l'article</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminContentPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('modules')
  const [showCreatePath, setShowCreatePath] = useState(false)
  const [showCreateKb, setShowCreateKb] = useState(false)
  const [showImportKb, setShowImportKb] = useState(false)

  const { data: modulesData } = useQuery<{ modules: Module[]; total: number }>({
    queryKey: ['admin-modules'],
    queryFn: () => api.get('/modules').then(r => r.data),
    enabled: tab === 'modules'
  })

  const { data: pathsData } = useQuery<CareerPath[]>({
    queryKey: ['admin-paths'],
    queryFn: () => api.get('/career/paths').then(r => r.data),
    enabled: tab === 'paths'
  })

  const { data: kbData } = useQuery<{ articles: KbArticle[]; total: number }>({
    queryKey: ['admin-kb'],
    queryFn: () => api.get('/kb').then(r => r.data),
    enabled: tab === 'kb'
  })

  const tabs = [
    { key: 'modules' as Tab, label: 'Modules', icon: BookOpen, count: modulesData?.total },
    { key: 'paths' as Tab, label: 'Parcours', icon: Route, count: pathsData?.length },
    { key: 'kb' as Tab, label: 'Base de connaissances', icon: BookMarked, count: kbData?.total },
  ]

  function handleCreate() {
    if (tab === 'modules') navigate('/admin/ai')
    else if (tab === 'paths') setShowCreatePath(true)
    else if (tab === 'kb') setShowCreateKb(true)
  }

  const createLabel = tab === 'modules'
    ? <><Sparkles size={14} /> Créer avec l'IA</>
    : <><Plus size={14} /> {tab === 'paths' ? 'Nouveau parcours' : 'Nouvel article'}</>

  return (
    <>
      {showCreatePath && <CreatePathModal onClose={() => setShowCreatePath(false)} />}
      {showCreateKb && <CreateKbModal onClose={() => setShowCreateKb(false)} />}
      {showImportKb && <ImportKbModal onClose={() => setShowImportKb(false)} />}

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={20} className="text-primary-600" /> Gestion des contenus
          </h1>
          <div className="flex items-center gap-2 shrink-0">
            {tab === 'kb' && (
              <button
                onClick={() => setShowImportKb(true)}
                className="btn-secondary text-sm flex items-center gap-1.5"
              >
                <Upload size={14} /> Importer un document
              </button>
            )}
            <button onClick={handleCreate} className="btn-primary text-sm flex items-center gap-1.5">
              {createLabel}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 flex-1 justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key
                  ? 'bg-white text-primary-700 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}>
              <t.icon size={14} /> {t.label}
              {t.count !== undefined && (
                <span className="chip chip-gray text-[10px]">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Modules */}
        {tab === 'modules' && (
          <div className="card divide-y divide-gray-100">
            {(modulesData?.modules ?? []).map(m => (
              <div key={m.id} onClick={() => navigate(`/modules/${m.id}`)} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                  {m.thumbnail
                    ? <img src={m.thumbnail} className="w-full h-full rounded-xl object-cover" alt="" />
                    : <BookOpen size={18} className="text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800">{m.title}</div>
                  <div className="text-xs text-gray-400">{m._count?.contents ?? 0} contenus · {m.estimatedMinutes} min · {m._count?.enrollments ?? 0} inscrits</div>
                </div>
                <span className={m.isPublished ? 'chip chip-success' : 'chip chip-gray'}>
                  {m.isPublished ? 'Publié' : 'Brouillon'}
                </span>
              </div>
            ))}
            {(modulesData?.modules ?? []).length === 0 && (
              <div className="py-12 text-center">
                <BookOpen size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-400 mb-3">Aucun module créé</p>
                <button onClick={handleCreate} className="btn-primary text-xs inline-flex items-center gap-1.5">
                  <Sparkles size={12} /> Créer avec l'IA
                </button>
              </div>
            )}
          </div>
        )}

        {/* Paths */}
        {tab === 'paths' && (
          <div className="card divide-y divide-gray-100">
            {(pathsData ?? []).map(p => (
              <div key={p.id} onClick={() => navigate('/career')} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer">
                <div className="text-2xl">{p.icon || '🎯'}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800">{p.title}</div>
                  <div className="text-xs text-gray-400">{p._count?.modules ?? 0} modules · {p._count?.enrollments ?? 0} inscrits</div>
                </div>
                <span className={p.status === 'ACTIVE' ? 'chip chip-success' : 'chip chip-gray'}>
                  {p.status}
                </span>
              </div>
            ))}
            {(pathsData ?? []).length === 0 && (
              <div className="py-12 text-center">
                <Route size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-400 mb-3">Aucun parcours créé</p>
                <button onClick={handleCreate} className="btn-primary text-xs inline-flex items-center gap-1.5">
                  <Plus size={12} /> Nouveau parcours
                </button>
              </div>
            )}
          </div>
        )}

        {/* KB */}
        {tab === 'kb' && (
          <div className="card divide-y divide-gray-100">
            {(kbData?.articles ?? []).map(a => (
              <div key={a.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => navigate(`/kb?slug=${a.slug}`)}
                >
                  <div className="text-sm font-medium text-gray-800">{a.title}</div>
                  <div className="text-xs text-gray-400">{a.category?.name} · {a.tags.join(', ')}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => navigate(`/kb?slug=${a.slug}&edit=1`)}
                    className="btn-ghost text-xs px-2 py-1 flex items-center gap-1"
                    title="Modifier l'article"
                  >
                    <Pencil size={12} /> Modifier
                  </button>
                  <span className={a.isPublished ? 'chip chip-success' : 'chip chip-gray'}>
                    {a.isPublished ? 'Publié' : 'Brouillon'}
                  </span>
                </div>
              </div>
            ))}
            {(kbData?.articles ?? []).length === 0 && (
              <div className="py-12 text-center">
                <BookMarked size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-400 mb-3">Aucun article créé</p>
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => setShowImportKb(true)} className="btn-secondary text-xs inline-flex items-center gap-1.5">
                    <Upload size={12} /> Importer un document
                  </button>
                  <button onClick={handleCreate} className="btn-primary text-xs inline-flex items-center gap-1.5">
                    <Plus size={12} /> Nouvel article
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
