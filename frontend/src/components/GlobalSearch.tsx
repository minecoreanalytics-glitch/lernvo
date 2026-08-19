import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Loader2, BookOpen, FileText, Building2, Route } from 'lucide-react'
import { api } from '../utils/api'

interface SearchResult {
  id: string
  title: string
  type: 'module' | 'article' | 'department' | 'path'
  description: string
  link: string
}

interface SearchResponse {
  modules: SearchResult[]
  articles: SearchResult[]
  departments: SearchResult[]
  paths: SearchResult[]
}

const TYPE_CONFIG = {
  module: { label: 'Formations', icon: BookOpen, color: 'text-blue-600' },
  article: { label: 'Donnees', icon: FileText, color: 'text-emerald-600' },
  department: { label: 'Departements', icon: Building2, color: 'text-purple-600' },
  path: { label: 'Parcours', icon: Route, color: 'text-orange-600' },
} as const

type ResultType = keyof typeof TYPE_CONFIG

export default function GlobalSearch({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Build flat list for keyboard navigation
  const flatResults = results
    ? ([
        ...results.modules,
        ...results.articles,
        ...results.departments,
        ...results.paths,
      ] as SearchResult[])
    : []

  const totalResults = flatResults.length

  // Debounced search
  const doSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) {
      setResults(null)
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get<SearchResponse>('/search', { params: { q: q.trim() } })
        setResults(res.data)
        setActiveIndex(-1)
      } catch {
        setResults(null)
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    doSearch(val)
  }

  function navigateTo(link: string) {
    onClose()
    navigate(link)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(prev => (prev < totalResults - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(prev => (prev > 0 ? prev - 1 : totalResults - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0 && activeIndex < totalResults) {
      e.preventDefault()
      navigateTo(flatResults[activeIndex].link)
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose()
  }

  const hasQuery = query.trim().length >= 2
  const hasResults = totalResults > 0
  const showEmpty = hasQuery && !loading && !hasResults

  // Track cumulative index for keyboard nav
  let cumulativeIndex = 0

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] sm:pt-[15vh] px-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher formations, articles, departements..."
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
          />
          {loading && <Loader2 size={16} className="text-gray-400 animate-spin shrink-0" />}
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {showEmpty && (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-400">Aucun resultat</p>
            </div>
          )}

          {hasResults && (
            <div className="py-2">
              {(Object.keys(TYPE_CONFIG) as ResultType[]).map(type => {
                const items = results![`${type === 'module' ? 'modules' : type === 'article' ? 'articles' : type === 'department' ? 'departments' : 'paths'}`] as SearchResult[]
                if (!items || items.length === 0) return null
                const config = TYPE_CONFIG[type]
                const Icon = config.icon
                const startIdx = cumulativeIndex
                cumulativeIndex += items.length

                return (
                  <div key={type}>
                    <div className="px-4 py-1.5 flex items-center gap-2">
                      <Icon size={13} className={config.color} />
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                        {config.label}
                      </span>
                    </div>
                    {items.map((item, i) => {
                      const globalIdx = startIdx + i
                      return (
                        <button
                          key={item.id}
                          onClick={() => navigateTo(item.link)}
                          className={`w-full text-left px-4 py-2.5 flex flex-col gap-0.5 transition-colors ${
                            globalIdx === activeIndex ? 'bg-primary-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-sm font-medium text-gray-800 truncate">{item.title}</span>
                          {item.description && (
                            <span className="text-xs text-gray-400 truncate">{item.description}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}

          {!hasQuery && !loading && (
            <div className="py-10 text-center">
              <p className="text-xs text-gray-400">
                Tapez au moins 2 caracteres pour rechercher
              </p>
              <p className="text-[11px] text-gray-300 mt-1">
                ESC pour fermer
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {hasResults && (
          <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4">
            <span className="text-[11px] text-gray-400">
              {totalResults} resultat{totalResults > 1 ? 's' : ''}
            </span>
            <span className="text-[11px] text-gray-300 ml-auto">
              Fleches pour naviguer &middot; Entree pour ouvrir
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
