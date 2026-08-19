import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronLeft, X, GraduationCap, BookOpen, Trophy, Building2, Sparkles, Target, Users } from 'lucide-react'
import { useTourStore } from '../../store/tour'
import { useAuthStore } from '../../store/auth'

interface TourStep {
  target?: string
  title: string
  description: string
  icon: React.ReactNode
  position?: 'top' | 'bottom' | 'center'
  path?: string             // navigate to this page for this step
  showForRoles?: string[]
}

const allSteps: TourStep[] = [
  // ── Welcome (center, dashboard) ──
  {
    title: 'Bienvenue sur Lernvo! 🎓',
    description: 'Votre plateforme de formation et de développement de carrière. Laissez-nous vous faire un tour rapide.',
    icon: <GraduationCap size={28} className="text-white" />,
    position: 'center',
    path: '/dashboard',
  },
  // ── Dashboard: Stats ──
  {
    target: '#tour-stats',
    title: 'Vos statistiques',
    description: 'Suivez votre rang, vos formations complétées et vos badges gagnés. Chaque action vous rapporte des points!',
    icon: <Target size={24} className="text-yellow-400" />,
    position: 'bottom',
    path: '/dashboard',
  },
  // ── Dashboard: Formations en cours ──
  {
    target: '#tour-formations',
    title: 'Continuez vos formations',
    description: 'Retrouvez ici vos formations en cours. Complétez-les pour gagner des points et débloquer des badges.',
    icon: <BookOpen size={24} className="text-primary-400" />,
    position: 'top',
    path: '/dashboard',
  },
  // ── Dashboard: Leaderboard ──
  {
    target: '#tour-leaderboard',
    title: 'Classement',
    description: 'Comparez votre progression avec vos collègues. Les meilleurs gagnent des badges exclusifs!',
    icon: <Trophy size={24} className="text-yellow-400" />,
    position: 'top',
    path: '/dashboard',
  },
  // ── Navigate to: Formations ──
  {
    title: 'Catalogue de formations',
    description: 'Parcourez toutes les formations disponibles. Filtrez par catégorie, inscrivez-vous et commencez à apprendre.',
    icon: <BookOpen size={28} className="text-white" />,
    position: 'center',
    path: '/modules',
  },
  // ── Navigate to: Départements ──
  {
    title: 'Départements',
    description: 'Explorez la structure organisationnelle. Chaque département a ses propres formations et objectifs.',
    icon: <Building2 size={28} className="text-white" />,
    position: 'center',
    path: '/departments',
  },
  // ── Navigate to: Leaderboard ──
  {
    title: 'Classement complet',
    description: 'Consultez le classement de tous les employés. Gagnez des points en complétant des formations et des quiz.',
    icon: <Trophy size={28} className="text-white" />,
    position: 'center',
    path: '/leaderboard',
  },
  // ── Back to dashboard: Profile ──
  {
    target: '#tour-avatar',
    title: 'Votre profil',
    description: 'Accédez à votre profil, vos paramètres et déconnectez-vous depuis ce menu.',
    icon: <Users size={24} className="text-primary-400" />,
    position: 'bottom',
    path: '/dashboard',
  },
  // ── Fin ──
  {
    title: 'Vous êtes prêt! 🚀',
    description: 'Commencez par explorer les formations disponibles et gagnez vos premiers points. Bonne formation!',
    icon: <Sparkles size={28} className="text-yellow-400" />,
    position: 'center',
    path: '/dashboard',
  },
]

function getHighlightRect(selector: string): DOMRect | null {
  const el = document.querySelector(selector)
  if (!el) return null
  return el.getBoundingClientRect()
}

export default function TourOverlay() {
  const { isActive, currentStep, nextStep, prevStep, endTour } = useTourStore()
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const location = useLocation()
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null)
  const [isNavigating, setIsNavigating] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Filter steps based on user role
  const steps = allSteps.filter((s) => {
    if (!s.showForRoles) return true
    return user?.role && s.showForRoles.includes(user.role)
  })

  const step = steps[currentStep]
  const isFirst = currentStep === 0
  const isLast = currentStep === steps.length - 1
  const totalSteps = steps.length

  const updateHighlight = useCallback(() => {
    if (!step?.target) {
      setHighlightRect(null)
      return
    }
    const rect = getHighlightRect(step.target)
    setHighlightRect(rect)
  }, [step])

  // Navigate to the correct page for each step
  useEffect(() => {
    if (!isActive || !step?.path) return

    if (location.pathname !== step.path) {
      setIsNavigating(true)
      navigate(step.path)
      // Wait for page to render before highlighting
      const timer = setTimeout(() => {
        setIsNavigating(false)
        updateHighlight()
      }, 600)
      return () => clearTimeout(timer)
    } else {
      setIsNavigating(false)
    }
  }, [isActive, currentStep, step, location.pathname, navigate, updateHighlight])

  // Update highlight when step changes or page loads
  useEffect(() => {
    if (!isActive || isNavigating) return
    updateHighlight()

    // Scroll target into view
    if (step?.target) {
      const el = document.querySelector(step.target)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(updateHighlight, 400)
      }
    }

    window.addEventListener('resize', updateHighlight)
    window.addEventListener('scroll', updateHighlight, true)
    return () => {
      window.removeEventListener('resize', updateHighlight)
      window.removeEventListener('scroll', updateHighlight, true)
    }
  }, [isActive, isNavigating, currentStep, step, updateHighlight])

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (isLast) endTour()
        else nextStep()
      }
      if (e.key === 'ArrowLeft') prevStep()
      if (e.key === 'Escape') endTour()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isActive, isLast, nextStep, prevStep, endTour])

  if (!isActive || !step || isNavigating) return null

  const isCenter = step.position === 'center' || !step.target || !highlightRect
  const padding = 8

  // Calculate tooltip position — clamped to viewport on mobile
  let tooltipStyle: React.CSSProperties = {}
  if (!isCenter && highlightRect) {
    const viewportHeight = window.innerHeight
    const isAbove = step.position === 'top' || highlightRect.bottom > viewportHeight * 0.6
    const gap = 12
    const margin = 16

    if (isAbove) {
      tooltipStyle = {
        bottom: viewportHeight - highlightRect.top + padding + gap,
        left: margin,
        right: margin,
      }
    } else {
      tooltipStyle = {
        top: highlightRect.bottom + padding + gap,
        left: margin,
        right: margin,
      }
    }

    // On small screens, if not enough space above/below target, fall back to center
    const spaceAbove = highlightRect.top
    const spaceBelow = viewportHeight - highlightRect.bottom
    if ((isAbove && spaceAbove < 200) || (!isAbove && spaceBelow < 200)) {
      tooltipStyle = { left: margin, right: margin, top: '50%', transform: 'translateY(-50%)' }
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200]"
        onClick={(e) => {
          if (e.target === overlayRef.current) endTour()
        }}
      >
        {/* Overlay with cutout */}
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              {highlightRect && !isCenter && (
                <rect
                  x={highlightRect.left - padding}
                  y={highlightRect.top - padding}
                  width={highlightRect.width + padding * 2}
                  height={highlightRect.height + padding * 2}
                  rx={16}
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.65)"
            mask="url(#tour-mask)"
            style={{ pointerEvents: 'all' }}
          />
        </svg>

        {/* Highlight border glow */}
        {highlightRect && !isCenter && (
          <motion.div
            key={`hl-${currentStep}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute rounded-2xl border-2 border-primary-400 shadow-[0_0_20px_rgba(43,108,176,0.3)]"
            style={{
              left: highlightRect.left - padding,
              top: highlightRect.top - padding,
              width: highlightRect.width + padding * 2,
              height: highlightRect.height + padding * 2,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Tooltip / Card */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={`absolute z-[201] ${
            isCenter
              ? 'top-1/2 left-4 right-4 sm:left-1/2 sm:right-auto sm:w-full sm:max-w-sm sm:-translate-x-1/2 -translate-y-1/2'
              : 'max-w-sm mx-auto'
          }`}
          style={isCenter ? {} : tooltipStyle}
        >
          <div className="bg-white rounded-3xl shadow-card-lg overflow-hidden border border-gray-200">
            {/* Header */}
            <div className={`px-4 sm:px-5 pt-4 sm:pt-5 pb-3 flex items-start gap-3 ${isCenter ? 'justify-center flex-col items-center text-center' : ''}`}>
              {isCenter ? (
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-primary-700 to-primary-500 flex items-center justify-center mb-2 shadow-lg">
                  {step.icon}
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-primary-700 flex items-center justify-center shrink-0">
                  {step.icon}
                </div>
              )}
              <div className={isCenter ? '' : 'flex-1 min-w-0'}>
                <h3 className={`font-bold text-gray-900 ${isCenter ? 'text-lg sm:text-xl' : 'text-base'}`}>
                  {step.title}
                </h3>
              </div>
              {!isCenter && (
                <button
                  onClick={endTour}
                  className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 shrink-0"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Description */}
            <div className={`px-4 sm:px-5 pb-4 ${isCenter ? 'text-center' : ''}`}>
              <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
            </div>

            {/* Progress dots + Actions */}
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 flex items-center justify-between gap-2 sm:gap-3">
              {/* Progress dots */}
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === currentStep
                        ? 'w-4 sm:w-5 bg-primary-600'
                        : i < currentStep
                        ? 'w-1.5 bg-primary-300'
                        : 'w-1.5 bg-gray-200'
                    }`}
                  />
                ))}
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2">
                {isFirst && (
                  <button
                    onClick={endTour}
                    className="text-xs text-gray-400 hover:text-gray-600 font-medium px-3 py-2 min-h-[44px] transition-colors"
                  >
                    Passer
                  </button>
                )}
                {!isFirst && (
                  <button
                    onClick={prevStep}
                    className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>
                )}
                <button
                  onClick={isLast ? endTour : nextStep}
                  className="btn-primary !py-2.5 !px-4 !text-sm !rounded-xl !min-h-[44px]"
                >
                  {isFirst ? 'Commencer' : isLast ? 'Terminer' : (
                    <span className="flex items-center gap-1">
                      Suivant <ChevronRight size={16} />
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Step counter */}
            <div className="bg-gray-50 border-t border-gray-100 px-5 py-2 text-center">
              <span className="text-[10px] text-gray-400 font-medium">
                {currentStep + 1} / {totalSteps}
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
