import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Newspaper, Plus, ImagePlus, X, Loader2, Building2, Trash2 } from 'lucide-react'
import { api } from '../utils/api'
import { useAuthStore } from '../store/auth'

type CompanyUnit = { id: string; name: string; slug: string; isActive: boolean }
type Announcement = {
  id: string
  body: string | null
  imageUrl: string | null
  createdAt: string
  authorId: string
  isUnread: boolean
  company: { id: string; name: string; slug: string }
  author: { firstName: string; lastName: string; avatarUrl: string | null }
}

function formatPostedAt(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export default function AnnouncementsPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const canManageUnits = ['PLATFORM_MANAGER', 'HR'].includes(user?.role || '')
  const [filter, setFilter] = useState('')
  const [composer, setComposer] = useState(false)
  const [companyUnitId, setCompanyUnitId] = useState('')
  const [body, setBody] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [newUnitName, setNewUnitName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: unitsData } = useQuery<{ units: CompanyUnit[] }>({
    queryKey: ['company-units'],
    queryFn: () => api.get('/announcements/company-units').then(r => r.data)
  })
  const units = (unitsData?.units ?? []).filter(u => u.isActive)

  const { data, isLoading } = useQuery<{ announcements: Announcement[]; unreadCount: number }>({
    queryKey: ['announcements', filter],
    queryFn: () => api.get(`/announcements${filter ? `?companyUnitId=${encodeURIComponent(filter)}` : ''}`).then(r => r.data)
  })
  const items = data?.announcements ?? []

  useEffect(() => {
    api.post('/announcements/read', {}).then(() => {
      queryClient.invalidateQueries({ queryKey: ['announcements-unread'] })
    }).catch(() => {})
  }, [queryClient])

  const publish = useMutation({
    mutationFn: async () => {
      const form = new FormData()
      form.append('companyUnitId', companyUnitId)
      if (body.trim()) form.append('body', body.trim())
      if (image) form.append('image', image)
      return api.post('/announcements', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      queryClient.invalidateQueries({ queryKey: ['announcements-unread'] })
      setComposer(false)
      setBody('')
      setImage(null)
      setPreview(null)
      setError('')
    },
    onError: (err: unknown) => {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Publication impossible')
    }
  })

  const addUnit = useMutation({
    mutationFn: () => api.post('/announcements/company-units', { name: newUnitName.trim() }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-units'] })
      setNewUnitName('')
    }
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/announcements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      queryClient.invalidateQueries({ queryKey: ['announcements-unread'] })
    }
  })

  function pickImage(file: File | undefined) {
    if (!file) return
    setImage(file)
    setPreview(URL.createObjectURL(file))
  }

  function openComposer() {
    setComposer(true)
    setError('')
    setCompanyUnitId(filter || units[0]?.id || '')
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Newspaper size={20} className="text-primary-600" /> Actualités
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Succursales, promotions, partenaires, équipements — tout le monde reste informé.
          </p>
        </div>
        <button onClick={openComposer} className="btn-primary text-sm flex items-center gap-1.5 shrink-0">
          <Plus size={14} /> Publier
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilter('')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${!filter ? 'bg-primary-700 text-white border-primary-700' : 'bg-white text-gray-600 border-gray-200'}`}
        >
          Toutes
        </button>
        {units.map(u => (
          <button
            key={u.id}
            onClick={() => setFilter(u.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${filter === u.id ? 'bg-primary-700 text-white border-primary-700' : 'bg-white text-gray-600 border-gray-200'}`}
          >
            {u.name}
          </button>
        ))}
      </div>

      {canManageUnits && (
        <div className="card p-3 flex flex-col sm:flex-row gap-2 sm:items-center">
          <Building2 size={14} className="text-gray-400 shrink-0" />
          <span className="text-xs text-gray-500 shrink-0">Entités / marques</span>
          <input
            className="input text-sm flex-1"
            placeholder="Ajouter une entité (ex. une filiale)"
            value={newUnitName}
            onChange={e => setNewUnitName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newUnitName.trim()) addUnit.mutate() } }}
          />
          <button
            className="btn-ghost text-xs"
            disabled={!newUnitName.trim() || addUnit.isPending}
            onClick={() => addUnit.mutate()}
          >
            Ajouter
          </button>
        </div>
      )}

      {composer && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Nouvelle actualité</h2>
            <button onClick={() => setComposer(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
          <div>
            <label className="label">Entité concernée *</label>
            <select className="input" value={companyUnitId} onChange={e => setCompanyUnitId(e.target.value)}>
              <option value="">Choisir…</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Texte (optionnel)</label>
            <textarea
              className="input min-h-[100px]"
              placeholder="Ouverture d'une succursale, nouveau partenaire, changement de prix, équipement disponible…"
              value={body}
              onChange={e => setBody(e.target.value)}
              maxLength={8000}
            />
          </div>
          <div>
            <label className="label">Image (optionnelle)</label>
            {preview ? (
              <div className="relative">
                <img src={preview} alt="" className="rounded-xl max-h-56 w-full object-cover" />
                <button
                  type="button"
                  className="absolute top-2 right-2 bg-white/90 rounded-full p-1 shadow"
                  onClick={() => { setImage(null); setPreview(null) }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border border-dashed border-gray-300 rounded-xl py-6 text-sm text-gray-500 hover:border-primary-400 hover:text-primary-700 flex flex-col items-center gap-1"
              >
                <ImagePlus size={20} />
                Ajouter une photo
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e => pickImage(e.target.files?.[0])} />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            className="btn-primary text-sm flex items-center justify-center gap-1.5"
            disabled={publish.isPending || !companyUnitId || (!body.trim() && !image)}
            onClick={() => publish.mutate()}
          >
            {publish.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Publier pour tout le monde
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-10 text-gray-400"><Loader2 className="animate-spin" size={22} /></div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="card p-8 text-center text-sm text-gray-500">
          Aucune actualité pour l’instant. Soyez le premier à informer l’équipe.
        </div>
      )}

      <div className="space-y-3">
        {items.map(a => {
          const canDelete = a.authorId === user?.id || canManageUnits
          return (
            <article key={a.id} className={`card overflow-hidden ${a.isUnread ? 'ring-1 ring-primary-200' : ''}`}>
              <div className="p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0 overflow-hidden">
                  {a.author.avatarUrl
                    ? <img src={a.author.avatarUrl} alt="" className="w-full h-full object-cover" />
                    : <>{a.author.firstName[0]}{a.author.lastName[0]}</>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {a.author.firstName} {a.author.lastName}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {formatPostedAt(a.createdAt)} · {a.company.name}
                      </div>
                    </div>
                    {canDelete && (
                      <button
                        className="text-gray-300 hover:text-red-500"
                        title="Supprimer"
                        onClick={() => { if (confirm('Supprimer cette actualité ?')) remove.mutate(a.id) }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  {a.body && <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{a.body}</p>}
                </div>
              </div>
              {a.imageUrl && (
                <img src={a.imageUrl} alt="" className="w-full max-h-[420px] object-cover bg-gray-100" />
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
