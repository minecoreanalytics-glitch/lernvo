import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Tag, Upload, Loader2, X, ChevronDown, CheckCircle, AlertTriangle,
  Plus, Minus, ArrowRight, History, FileSpreadsheet
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../utils/api'
import { useAuthStore } from '../store/auth'

type PricingItem = {
  id: string
  serviceName: string
  description?: string
  price: string
  priceNumeric?: number
  currency: string
  unit?: string
  features: string[]
}

type PricingCategory = {
  id: string
  brand: string
  name: string
  sheetName?: string
  items: PricingItem[]
}

type PricingBrand = { brand: string; label: string; categoryCount: number }

type PricingChange = {
  id: string
  categoryName: string
  serviceName: string
  changeType: 'added' | 'updated' | 'removed'
  oldPrice?: string
  newPrice?: string
}

type PricingUpload = {
  id: string
  brand: string
  fileName: string
  itemCount: number
  changeCount: number
  createdAt: string
  uploadedBy: { firstName: string; lastName: string }
}

const FALLBACK_BRANDS: PricingBrand[] = []

const BRAND_PALETTE = ['#3B82F6', '#0EA5E9', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#EC4899', '#14B8A6']
function brandColor(brand: string) {
  let h = 0
  for (let i = 0; i < brand.length; i++) h = (h * 31 + brand.charCodeAt(i)) >>> 0
  return BRAND_PALETTE[h % BRAND_PALETTE.length]
}

const CHANGE_ICONS = {
  added: { icon: Plus, className: 'text-green-600 bg-green-50' },
  updated: { icon: ArrowRight, className: 'text-amber-600 bg-amber-50' },
  removed: { icon: Minus, className: 'text-red-600 bg-red-50' }
}

export default function PricingPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeBrand, setActiveBrand] = useState(searchParams.get('brand') || '')
  const [showUpload, setShowUpload] = useState(false)
  const [uploadMode, setUploadMode] = useState<'auto' | 'single'>('auto')
  const [uploadBrand, setUploadBrand] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [showChanges, setShowChanges] = useState<string | null>(searchParams.get('upload') || null)
  const fileRef = useRef<HTMLInputElement>(null)

  const canUpload = ['PLATFORM_MANAGER', 'HR', 'MANAGER'].includes(user?.role || '')

  const { data: pricingData, isLoading } = useQuery<{ categories: PricingCategory[]; brands: PricingBrand[] }>({
    queryKey: ['pricing', activeBrand],
    queryFn: () => api.get(`/pricing${activeBrand ? `?brand=${encodeURIComponent(activeBrand)}` : ''}`).then(r => r.data)
  })

  const { data: uploadsData } = useQuery<{ uploads: PricingUpload[] }>({
    queryKey: ['pricing-uploads'],
    queryFn: () => api.get('/pricing/uploads').then(r => r.data),
    enabled: canUpload
  })

  const { data: changesData, isLoading: changesLoading } = useQuery<{ changes: PricingChange[] }>({
    queryKey: ['pricing-changes', showChanges],
    queryFn: () => api.get(`/pricing/uploads/${showChanges}/changes`).then(r => r.data),
    enabled: !!showChanges
  })

  const uploadMutation = useMutation({
    mutationFn: async ({ file, brand }: { file: File; brand?: string }) => {
      const form = new FormData()
      form.append('file', file)
      if (brand) form.append('brand', brand)
      return api.post('/pricing/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      }).then(r => r.data as {
        batchId: string
        totalItems: number
        totalChanges: number
        brands: Array<{ brand: string; brandLabel: string; itemCount: number; changeCount: number; uploadId: string }>
        uploadId?: string
        changeCount: number
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pricing'] })
      queryClient.invalidateQueries({ queryKey: ['pricing-uploads'] })
      queryClient.invalidateQueries({ queryKey: ['pricing-alerts'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setShowUpload(false)
      setSelectedFile(null)
      setUploadError('')
      const summary = data.brands.map(b =>
        `${b.brandLabel}: ${b.itemCount} tarif(s)${b.changeCount > 0 ? `, ${b.changeCount} changement(s)` : ''}`
      ).join(' · ')
      setUploadSuccess(summary)
      if (data.totalChanges > 0 && data.brands[0]) {
        setShowChanges(data.brands[0].uploadId)
        if (data.brands.length === 1) setActiveBrand(data.brands[0].brand)
      }
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setUploadError(msg || 'Erreur lors de l\'import')
    }
  })

  const brands = (pricingData?.brands?.length ? pricingData.brands : FALLBACK_BRANDS)
  const currentBrand = activeBrand || brands[0]?.brand || ''
  const currentBrandColor = brandColor(currentBrand)
  const categories = (pricingData?.categories ?? []).filter(c => !currentBrand || c.brand === currentBrand)

  function switchBrand(brand: string) {
    setActiveBrand(brand)
    setSearchParams({ brand })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Tag size={20} className="text-primary-600" /> Tarifs
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Grille tarifaire centralisée — import Excel et détection IA multi-marques
          </p>
        </div>
        {canUpload && (
          <button
            onClick={() => { setShowUpload(true); setUploadBrand(currentBrand || ''); setUploadError('') }}
            className="btn-primary text-sm flex items-center gap-1.5 shrink-0"
          >
            <Upload size={14} /> Importer Excel
          </button>
        )}
      </div>

      {uploadSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <CheckCircle size={16} className="text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-800">Import réussi</p>
              <p className="text-xs text-green-700 mt-0.5">{uploadSuccess}</p>
            </div>
          </div>
          <button onClick={() => setUploadSuccess(null)} className="text-green-400 hover:text-green-600">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {brands.map(b => (
          <button
            key={b.brand}
            onClick={() => switchBrand(b.brand)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
              currentBrand === b.brand
                ? 'text-white border-transparent'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
            style={currentBrand === b.brand ? { backgroundColor: brandColor(b.brand) } : undefined}
          >
            {b.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
        </div>
      ) : categories.length === 0 ? (
        <div className="card p-10 text-center">
          <FileSpreadsheet size={40} className="mx-auto text-gray-300 mb-3" />
          <h3 className="text-sm font-bold text-gray-700">Aucun tarif pour cette marque</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            {canUpload
              ? 'Importez un fichier Excel. L\'IA analysera chaque feuille et normalisera les données.'
              : 'Les tarifs n\'ont pas encore été publiés.'}
          </p>
          {canUpload && (
            <button
              onClick={() => { setShowUpload(true); setUploadBrand(currentBrand) }}
              className="btn-primary text-sm mt-4 inline-flex items-center gap-1.5"
            >
              <Upload size={14} /> Importer un fichier
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {categories.map(cat => (
            <motion.div key={cat.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between"
                style={{ borderLeftWidth: 4, borderLeftColor: currentBrandColor }}>
                <div>
                  <h2 className="text-sm font-bold text-gray-800">{cat.name}</h2>
                  {cat.sheetName && cat.sheetName !== cat.name && (
                    <p className="text-[10px] text-gray-400">Feuille: {cat.sheetName}</p>
                  )}
                </div>
                <span className="chip chip-gray text-[10px]">{cat.items.length} plan{cat.items.length > 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {cat.items.map(row => (
                  <div key={row.id} className="px-4 py-3 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-gray-800">{row.serviceName}</h3>
                        {row.description && <p className="text-xs text-gray-500 mt-0.5">{row.description}</p>}
                        {row.features.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {row.features.map((f, i) => (
                              <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{f}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-base font-bold" style={{ color: currentBrandColor }}>{row.price}</div>
                        {row.unit && <div className="text-[10px] text-gray-400">{row.unit}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {canUpload && uploadsData?.uploads && uploadsData.uploads.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
            <History size={15} /> Historique des imports
          </h3>
          <div className="space-y-2">
            {uploadsData.uploads.slice(0, 8).map(u => (
              <button
                key={u.id}
                onClick={() => { setShowChanges(u.id); setActiveBrand(u.brand) }}
                className="w-full flex items-center justify-between gap-2 p-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left"
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-700 truncate">
                    {u.brand.replace(/_/g, ' ')} — {u.fileName}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {new Date(u.createdAt).toLocaleDateString('fr-FR')} — {u.uploadedBy.firstName} {u.uploadedBy.lastName}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-gray-500">{u.itemCount} tarifs</span>
                  {u.changeCount > 0 && (
                    <span className="chip bg-amber-50 text-amber-700 text-[10px]">{u.changeCount} changement{u.changeCount > 1 ? 's' : ''}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowUpload(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Upload size={18} className="text-primary-600" /> Importer les tarifs
              </h2>
              <button onClick={() => setShowUpload(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={16} className="text-gray-400" />
              </button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault()
                if (!selectedFile) return
                uploadMutation.mutate({ file: selectedFile, brand: uploadMode === 'single' ? uploadBrand : undefined })
              }}
              className="p-5 space-y-4"
            >
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 space-y-1">
                <p>L'IA lit <strong>toutes les feuilles</strong> du fichier ; chaque feuille devient une marque.</p>
                <p>En mode auto, chaque marque détectée est mise à jour séparément.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-2">Mode d'import</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button type="button" onClick={() => setUploadMode('auto')}
                    className={`p-3 rounded-xl border text-left text-sm ${uploadMode === 'auto' ? 'border-primary-400 bg-primary-50 text-primary-800' : 'border-gray-200'}`}>
                    <div className="font-semibold">Détection automatique</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">Fichier multi-marques</div>
                  </button>
                  <button type="button" onClick={() => setUploadMode('single')}
                    className={`p-3 rounded-xl border text-left text-sm ${uploadMode === 'single' ? 'border-primary-400 bg-primary-50 text-primary-800' : 'border-gray-200'}`}>
                    <div className="font-semibold">Une seule marque</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">Forcer un identifiant</div>
                  </button>
                </div>
              </div>
              {uploadMode === 'single' && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Marque</label>
                  <div className="relative">
                    <select value={uploadBrand} onChange={e => setUploadBrand(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm bg-gray-50 appearance-none pr-8">
                      {brands.map(b => <option key={b.brand} value={b.brand}>{b.label}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Fichier Excel</label>
                <div onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer ${selectedFile ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                    onChange={e => { setSelectedFile(e.target.files?.[0] || null); setUploadError('') }} />
                  {selectedFile ? (
                    <div className="flex flex-col items-center gap-1">
                      <CheckCircle size={24} className="text-green-500" />
                      <p className="text-sm font-medium text-green-700">{selectedFile.name}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <FileSpreadsheet size={24} className="text-gray-400" />
                      <p className="text-sm text-gray-500">Cliquez pour choisir un fichier .xlsx</p>
                    </div>
                  )}
                </div>
              </div>
              {uploadError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5 flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  {uploadError}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={!selectedFile || uploadMutation.isPending}
                  className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {uploadMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Analyse en cours...</> : <><Upload size={14} /> Analyser et importer</>}
                </button>
                <button type="button" onClick={() => setShowUpload(false)} className="btn-ghost py-2.5 text-sm px-4">Annuler</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showChanges && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowChanges(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Détail des changements</h2>
              <button onClick={() => setShowChanges(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={16} className="text-gray-400" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-2">
              {changesLoading ? (
                [...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)
              ) : (changesData?.changes ?? []).length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Aucun changement détecté lors de cet import.</p>
              ) : (
                changesData?.changes.map(c => {
                  const meta = CHANGE_ICONS[c.changeType]
                  const Icon = meta.icon
                  return (
                    <div key={c.id} className={`flex items-start gap-3 p-3 rounded-xl ${meta.className}`}>
                      <Icon size={14} className="shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold">{c.categoryName} — {c.serviceName}</div>
                        <div className="text-xs mt-0.5">
                          {c.changeType === 'added' && <span>Nouveau: {c.newPrice}</span>}
                          {c.changeType === 'removed' && <span>Retiré: {c.oldPrice}</span>}
                          {c.changeType === 'updated' && <span>{c.oldPrice} → {c.newPrice}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
