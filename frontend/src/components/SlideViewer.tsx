import { useState, useCallback, useEffect, useRef } from 'react'
import {
  ChevronLeft, ChevronRight, Presentation, MessageSquare,
  Maximize2, Minimize2, Lightbulb, Target, AlertTriangle,
  CheckCircle2, Users, BarChart3, Shield, Zap, BookOpen, ArrowRight
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface SlideViewerProps {
  body: string
  title: string
  sectionIndex?: number
  totalSections?: number
  onComplete?: () => void
}

interface Slide {
  title: string
  bullets: string[]
  presenterNote: string
  bulletIcons: string[] // keyword-based icon hints
}

// Detect icon based on bullet keywords
function detectBulletIcon(text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes('objectif') || lower.includes('but') || lower.includes('cible')) return 'target'
  if (lower.includes('important') || lower.includes('attention') || lower.includes('critique') || lower.includes('urgent')) return 'alert'
  if (lower.includes('étape') || lower.includes('processus') || lower.includes('procédure')) return 'zap'
  if (lower.includes('équipe') || lower.includes('agent') || lower.includes('responsable') || lower.includes('acteur') || lower.includes('chef')) return 'users'
  if (lower.includes('résultat') || lower.includes('performance') || lower.includes('taux') || lower.includes('rapport')) return 'chart'
  if (lower.includes('sécurité') || lower.includes('protection') || lower.includes('conformité')) return 'shield'
  if (lower.includes('conseil') || lower.includes('astuce') || lower.includes('recommandation')) return 'lightbulb'
  if (lower.includes('succès') || lower.includes('réussi') || lower.includes('complété') || lower.includes('validé')) return 'check'
  if (lower.includes('formation') || lower.includes('connaissance') || lower.includes('apprendre')) return 'book'
  return 'arrow'
}

const ICON_MAP: Record<string, typeof Target> = {
  target: Target,
  alert: AlertTriangle,
  zap: Zap,
  users: Users,
  chart: BarChart3,
  shield: Shield,
  lightbulb: Lightbulb,
  check: CheckCircle2,
  book: BookOpen,
  arrow: ArrowRight,
}

const ICON_COLORS: Record<string, string> = {
  target: 'text-orange-400',
  alert: 'text-amber-400',
  zap: 'text-blue-400',
  users: 'text-indigo-400',
  chart: 'text-emerald-400',
  shield: 'text-rose-400',
  lightbulb: 'text-yellow-400',
  check: 'text-green-400',
  book: 'text-cyan-400',
  arrow: 'text-blue-300',
}

// Gradient themes for slides to add variety
const SLIDE_THEMES = [
  'from-slate-900 via-blue-950 to-slate-900',
  'from-gray-900 via-indigo-950 to-gray-900',
  'from-slate-900 via-emerald-950 to-slate-900',
  'from-gray-900 via-purple-950 to-gray-900',
  'from-slate-900 via-cyan-950 to-slate-900',
  'from-gray-900 via-rose-950 to-gray-900',
]

function parseSlides(body: string): Slide[] {
  const slideBlocks = body.split(/###?\s*Slide\s*\d+\s*:\s*/i).filter(Boolean)

  return slideBlocks.map(block => {
    const lines = block.trim().split('\n')
    const title = lines[0]?.replace(/^#+\s*/, '').trim() || ''

    let presenterNote = ''
    const bullets: string[] = []
    const bulletIcons: string[] = []

    let inNote = false
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()

      if (line.match(/^>\s*Note\s*présentateur\s*:/i) || line.match(/^>\s*Note:/i)) {
        inNote = true
        presenterNote = line.replace(/^>\s*Note\s*présentateur\s*:\s*/i, '').replace(/^>\s*Note:\s*/i, '')
        continue
      }

      if (inNote) {
        if (line.startsWith('>')) {
          presenterNote += ' ' + line.replace(/^>\s*/, '')
        } else if (line === '') {
          inNote = false
        } else {
          presenterNote += ' ' + line
        }
        continue
      }

      if (line.startsWith('-') || line.startsWith('*') || line.startsWith('•')) {
        const text = line.replace(/^[-*•]\s*/, '')
        bullets.push(text)
        bulletIcons.push(detectBulletIcon(text))
      } else if (line.length > 0) {
        bullets.push(line)
        bulletIcons.push(detectBulletIcon(line))
      }
    }

    return { title, bullets, presenterNote: presenterNote.trim(), bulletIcons }
  })
}

export default function SlideViewer({ body, title, sectionIndex = 0, totalSections = 1, onComplete }: SlideViewerProps) {
  const slides = parseSlides(body)
  const [current, setCurrent] = useState(0)
  const [showNotes, setShowNotes] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [visitedSlides, setVisitedSlides] = useState<Set<number>>(new Set([0]))
  const containerRef = useRef<HTMLDivElement>(null)

  // Track visited slides
  useEffect(() => {
    setVisitedSlides(prev => new Set([...prev, current]))
  }, [current])

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        setCurrent(c => Math.min(slides.length - 1, c + 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setCurrent(c => Math.max(0, c - 1))
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      } else if (e.key === 'f' || e.key === 'F') {
        setIsFullscreen(f => !f)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [slides.length, isFullscreen])

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen && containerRef.current) {
      containerRef.current.requestFullscreen?.()
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.()
    }
    setIsFullscreen(f => !f)
  }, [isFullscreen])

  // Listen for native fullscreen changes
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setIsFullscreen(false)
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  if (slides.length === 0) {
    return (
      <div className="p-6">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>
    )
  }

  const slide = slides[current]
  const isLast = current === slides.length - 1
  const allVisited = visitedSlides.size >= slides.length
  const theme = SLIDE_THEMES[(sectionIndex + current) % SLIDE_THEMES.length]
  const progress = ((current + 1) / slides.length) * 100

  return (
    <div
      ref={containerRef}
      className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-black' : ''}`}
    >
      {/* Progress bar */}
      <div className="h-1 bg-gray-200 w-full">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Slide area */}
      <div
        className={`relative bg-gradient-to-br ${theme} text-white overflow-hidden ${
          isFullscreen ? 'flex-1' : 'rounded-t-xl'
        }`}
        style={{ minHeight: isFullscreen ? '100%' : 520 }}
      >
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/[0.02]" />
          <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-white/[0.015]" />
          <div className="absolute top-1/2 right-0 w-px h-32 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
          <div className="absolute top-0 left-1/3 w-px h-16 bg-gradient-to-b from-white/10 to-transparent" />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '30px 30px'
          }} />
        </div>

        {/* Top bar */}
        <div className="relative flex items-center justify-between px-6 pt-5">
          <div className="flex items-center gap-2.5 text-white/40">
            <Presentation size={14} />
            <span className="text-xs font-medium tracking-wide uppercase">
              Section {sectionIndex + 1}/{totalSections}
            </span>
            <span className="text-white/20">—</span>
            <span className="text-xs text-white/50 truncate max-w-[300px]">{title}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="bg-white/10 backdrop-blur-sm rounded-full px-3.5 py-1 text-xs text-white/70 font-medium">
              {current + 1} / {slides.length}
            </span>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
              title={isFullscreen ? 'Quitter le plein écran (Esc)' : 'Plein écran (F)'}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </div>

        {/* Slide content */}
        <div className={`flex flex-col justify-center items-center px-8 ${
          isFullscreen ? 'py-12' : 'py-10'
        }`} style={{ minHeight: isFullscreen ? 'calc(100vh - 140px)' : 440 }}>

          {/* Slide title with decorative line */}
          <div className="text-center mb-10 max-w-3xl">
            <div className="w-12 h-0.5 bg-gradient-to-r from-blue-400 to-indigo-400 mx-auto mb-5 rounded-full" />
            <h2 className={`font-bold text-white leading-tight ${
              isFullscreen ? 'text-4xl' : 'text-2xl'
            }`}>
              {slide.title}
            </h2>
          </div>

          {/* Bullet points with icons */}
          <div className={`space-y-5 w-full ${isFullscreen ? 'max-w-4xl' : 'max-w-2xl'}`}>
            {slide.bullets.map((bullet, i) => {
              const iconKey = slide.bulletIcons[i] || 'arrow'
              const Icon = ICON_MAP[iconKey]
              const iconColor = ICON_COLORS[iconKey]

              return (
                <div
                  key={i}
                  className="flex items-start gap-4 group"
                  style={{
                    animation: `slideIn 0.4s ease-out ${i * 0.1}s both`
                  }}
                >
                  <div className={`shrink-0 mt-0.5 p-2 rounded-xl bg-white/[0.07] backdrop-blur-sm border border-white/[0.05] group-hover:bg-white/[0.12] transition-colors`}>
                    <Icon size={isFullscreen ? 18 : 15} className={iconColor} />
                  </div>
                  <div className={`${isFullscreen ? 'text-lg' : 'text-base'} leading-relaxed text-white/85`}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <span>{children}</span>,
                        strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                        em: ({ children }) => <em className="text-blue-300">{children}</em>,
                        code: ({ children }) => <code className="text-amber-300 bg-white/10 px-1.5 py-0.5 rounded text-sm">{children}</code>,
                      }}
                    >
                      {bullet}
                    </ReactMarkdown>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Click zones for navigation (invisible) */}
        <div className="absolute inset-y-0 left-0 w-16 cursor-pointer opacity-0 hover:opacity-100 flex items-center justify-center"
          onClick={() => setCurrent(c => Math.max(0, c - 1))}
        >
          {current > 0 && (
            <div className="bg-white/10 rounded-full p-2">
              <ChevronLeft size={20} className="text-white/70" />
            </div>
          )}
        </div>
        <div className="absolute inset-y-0 right-0 w-16 cursor-pointer opacity-0 hover:opacity-100 flex items-center justify-center"
          onClick={() => setCurrent(c => Math.min(slides.length - 1, c + 1))}
        >
          {!isLast && (
            <div className="bg-white/10 rounded-full p-2">
              <ChevronRight size={20} className="text-white/70" />
            </div>
          )}
        </div>
      </div>

      {/* Presenter notes (collapsible) */}
      {slide.presenterNote && !isFullscreen && (
        <div className="border-x border-gray-200">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="w-full flex items-center gap-2 px-5 py-3 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <MessageSquare size={12} />
            <span className="font-medium">Notes du présentateur</span>
            <ChevronRight size={12} className={`ml-auto transition-transform duration-200 ${showNotes ? 'rotate-90' : ''}`} />
          </button>
          {showNotes && (
            <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 bg-amber-50/30">
              <p className="pt-3">{slide.presenterNote}</p>
            </div>
          )}
        </div>
      )}

      {/* Navigation bar */}
      {!isFullscreen && (
        <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50 rounded-b-xl border border-gray-200">
          <button
            onClick={() => setCurrent(Math.max(0, current - 1))}
            disabled={current === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft size={16} /> Précédent
          </button>

          {/* Slide dots with visited indicator */}
          <div className="flex gap-2 items-center">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === current
                    ? 'bg-blue-600 w-8'
                    : visitedSlides.has(i)
                    ? 'bg-blue-300 w-2 hover:bg-blue-400'
                    : 'bg-gray-300 w-2 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>

          {isLast ? (
            allVisited && onComplete ? (
              <button
                onClick={onComplete}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
              >
                <CheckCircle2 size={14} /> Section terminée
              </button>
            ) : (
              <span className="text-xs text-gray-400 px-3 italic">
                {allVisited ? 'Fin' : 'Consultez toutes les slides'}
              </span>
            )
          ) : (
            <button
              onClick={() => setCurrent(Math.min(slides.length - 1, current + 1))}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-600 font-semibold hover:bg-blue-50 rounded-lg transition-all"
            >
              Suivant <ChevronRight size={16} />
            </button>
          )}
        </div>
      )}

      {/* Fullscreen bottom nav */}
      {isFullscreen && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm px-8 py-4 flex items-center justify-between">
          <button
            onClick={() => setCurrent(Math.max(0, current - 1))}
            disabled={current === 0}
            className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={18} /> Précédent
          </button>

          <div className="flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  i === current
                    ? 'bg-white w-10'
                    : visitedSlides.has(i)
                    ? 'bg-white/50 w-2.5'
                    : 'bg-white/20 w-2.5'
                }`}
              />
            ))}
          </div>

          {isLast ? (
            allVisited && onComplete ? (
              <button
                onClick={() => { setIsFullscreen(false); onComplete() }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                <CheckCircle2 size={14} /> Section terminée
              </button>
            ) : (
              <span className="text-white/40 text-sm px-4">Fin</span>
            )
          ) : (
            <button
              onClick={() => setCurrent(Math.min(slides.length - 1, current + 1))}
              className="flex items-center gap-2 px-4 py-2 text-white/90 hover:text-white transition-colors"
            >
              Suivant <ChevronRight size={18} />
            </button>
          )}
        </div>
      )}

      {/* CSS animation */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
