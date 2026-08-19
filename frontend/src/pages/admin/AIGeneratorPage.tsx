import { useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, BookOpen, Brain, Loader2, CheckCircle, AlertCircle, Upload, X, FileText,
  Music, Video, ChevronRight, ChevronLeft, Eye, Save, RotateCcw,
  Settings2, Wand2, ClipboardList, Package, Wrench, Megaphone, FileSliders, MonitorPlay, Presentation,
  ChevronDown, ChevronUp, Building2
} from 'lucide-react'
import { api } from '../../utils/api'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data?.error
    if (typeof apiError === 'string' && apiError.trim()) return apiError
    if (error.response?.status === 429) return 'Trop de requêtes IA. Réessayez dans quelques instants.'
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

// ─── Types ──────────────────────────────────────────────────────────────────

type Category = { id: string; name: string; icon?: string }

type TrainingPurpose = 'Processus' | 'Produit' | 'Dépannage' | 'Promotion'
type TrainingFormat = 'Texte' | 'Vidéo' | 'Diaporama'

type AnalysisResult = {
  sessionId: string
  purpose: TrainingPurpose
  format: TrainingFormat
  summary: string
  suggestedTitle: string
  transcription: string
  fileInfo?: { name: string; size: number; type: string }
}

type GeneratedSection = { title: string; body: string; order: number }
type GeneratedQuestion = {
  text: string
  options: Array<{ id: string; text: string; isCorrect: boolean }>
  explanation: string
  difficulty: number
  points: number
  order: number
}

type GenerateResult = {
  preview: boolean
  generated: {
    module: {
      title: string
      description: string
      estimatedMinutes: number
      sections: GeneratedSection[]
    }
    quiz: {
      title: string
      description: string
      timeLimit: number
      passingScore: number
      questions: GeneratedQuestion[]
    }
  }
}

type SaveResult = {
  message: string
  module: { id: string; title: string; description: string; sectionsCount: number }
  quiz: { id: string; title: string; questionsCount: number }
  departmentAssignment?: { departmentId: string; departmentName: string; enrolled: number }
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PURPOSE_OPTIONS: Array<{ value: TrainingPurpose; label: string; desc: string; icon: typeof ClipboardList; color: string }> = [
  { value: 'Processus', label: 'Processus', desc: 'Procédures, workflows, étapes', icon: ClipboardList, color: 'blue' },
  { value: 'Produit', label: 'Produit', desc: 'Fonctionnalités, avantages, cas d\'usage', icon: Package, color: 'green' },
  { value: 'Dépannage', label: 'Dépannage', desc: 'Diagnostic, résolution, troubleshooting', icon: Wrench, color: 'orange' },
  { value: 'Promotion', label: 'Promotion', desc: 'Vente, pitch, objections', icon: Megaphone, color: 'purple' },
]

const FORMAT_OPTIONS: Array<{ value: TrainingFormat; label: string; desc: string; icon: typeof FileSliders }> = [
  { value: 'Texte', label: 'Texte', desc: 'Formation écrite avec sections détaillées', icon: FileSliders },
  { value: 'Vidéo', label: 'Vidéo', desc: 'Script vidéo avec notes visuelles', icon: MonitorPlay },
  { value: 'Diaporama', label: 'Diaporama', desc: 'Slides avec notes présentateur', icon: Presentation },
]

const STEPS = [
  { num: 1, label: 'Source' },
  { num: 2, label: 'Analyse' },
  { num: 3, label: 'Génération' },
  { num: 4, label: 'Révision' },
]

const FILE_ACCEPT = '.txt,.md,.csv,.pdf,.docx,.mp3,.wav,.m4a,.aac,.ogg,.mp4,.webm,.mov'

function getFileIcon(mimetype: string) {
  if (mimetype.startsWith('audio/')) return Music
  if (mimetype.startsWith('video/')) return Video
  return FileText
}

function getFileTypeLabel(mimetype: string) {
  if (mimetype.startsWith('audio/')) return 'Audio'
  if (mimetype.startsWith('video/')) return 'Vidéo'
  return 'Document'
}

// ─── Animation variants ─────────────────────────────────────────────────────

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }
const slideIn = { initial: { opacity: 0, x: 30 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -30 } }

// ─── Component ──────────────────────────────────────────────────────────────

export default function AIGeneratorPage() {
  const [searchParams] = useSearchParams()
  const departmentId = searchParams.get('departmentId') || ''
  const [step, setStep] = useState(1)

  // Step 1 state
  const [file, setFile] = useState<File | null>(null)
  const [prompt, setPrompt] = useState('')
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 2 state
  const [purpose, setPurpose] = useState<TrainingPurpose>('Processus')
  const [format, setFormat] = useState<TrainingFormat>('Texte')
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate')
  const [numSections, setNumSections] = useState(4)
  const [numQuestions, setNumQuestions] = useState(10)
  const [sessionId, setSessionId] = useState('')
  const [analysisSummary, setAnalysisSummary] = useState('')
  const [suggestedTitle, setSuggestedTitle] = useState('')

  // Step 4 state
  const [editedModule, setEditedModule] = useState<GenerateResult['generated']['module'] | null>(null)
  const [editedQuiz, setEditedQuiz] = useState<GenerateResult['generated']['quiz'] | null>(null)
  const [categoryId, setCategoryId] = useState('')
  const [autoPublish, setAutoPublish] = useState(false)
  const [saveValidationError, setSaveValidationError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set())
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set())
  const [sectionPreviewMode, setSectionPreviewMode] = useState<Record<number, boolean>>({})

  // ─── Queries ────────────────────────────────────────────────────────────

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => api.get('/ai/status').then(r => r.data)
  })

  const { data: kbData } = useQuery<{ articles: Array<{ id: string; title: string; category?: { name: string } }> }>({
    queryKey: ['kb-articles-for-ai'],
    queryFn: () => api.get('/kb?limit=100').then(r => r.data)
  })
  const kbArticles = kbData?.articles ?? []

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/modules').then(r => {
      const cats = new Map<string, Category>()
      for (const m of r.data.modules || []) {
        if (m.category) cats.set(m.category.id, m.category)
      }
      return Array.from(cats.values())
    })
  })

  const { data: targetDepartment } = useQuery<{ id: string; name: string }>({
    queryKey: ['department-for-ai', departmentId],
    queryFn: () => api.get(`/departments/${departmentId}`).then(r => ({ id: r.data.id, name: r.data.name })),
    enabled: !!departmentId
  })

  // ─── Mutations ──────────────────────────────────────────────────────────

  const analyze = useMutation({
    mutationFn: (formData: FormData) =>
      api.post('/ai/analyze-content', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000
      }).then(r => r.data as AnalysisResult),
    onSuccess: (data) => {
      setPurpose(data.purpose)
      setFormat(data.format)
      setSessionId(data.sessionId)
      setAnalysisSummary(data.summary)
      setSuggestedTitle(data.suggestedTitle)
      setStep(2)
    }
  })

  const generate = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/ai/generate-module', body, { timeout: 120000 }).then(r => r.data as GenerateResult),
    onSuccess: (data) => {
      setEditedModule(data.generated.module)
      setEditedQuiz(data.generated.quiz)
      // Expand first section by default
      setExpandedSections(new Set([0]))
      setStep(4)
    }
  })

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/ai/save-preview', body).then(r => r.data as SaveResult)
  })

  // ─── Handlers ───────────────────────────────────────────────────────────

  function handleAnalyze() {
    const formData = new FormData()
    if (file) formData.append('file', file)
    if (prompt.trim()) formData.append('prompt', prompt.trim())
    if (selectedKbIds.length > 0) formData.append('kbArticleIds', JSON.stringify(selectedKbIds))
    analyze.mutate(formData)
  }

  function handleGenerate() {
    generate.mutate({
      prompt: suggestedTitle || prompt,
      purpose,
      format,
      difficulty,
      numSections,
      numQuestions,
      sessionId,
      preview: true,
      kbArticleIds: selectedKbIds.length > 0 ? selectedKbIds : undefined
    })
    setStep(3) // show loading
  }

  function handleSave() {
    if (!editedModule || !editedQuiz) return
    setSaveValidationError(null)
    // Validate module has required fields before sending
    if (!editedModule.title || !editedModule.sections?.length || !editedModule.estimatedMinutes) {
      setSaveValidationError('Le module généré est incomplet (titre, sections ou durée manquants). Veuillez régénérer le contenu.')
      return
    }
    if (!editedQuiz.questions?.length) {
      setSaveValidationError('Le quiz est incomplet (aucune question). Veuillez régénérer le contenu.')
      return
    }
    save.mutate({
      module: editedModule,
      quiz: editedQuiz,
      categoryId: categoryId || undefined,
      autoPublish,
      purpose,
      format,
      departmentId: departmentId || undefined
    })
  }

  function handleReset() {
    setStep(1)
    setFile(null)
    setPrompt('')
    setSelectedKbIds([])
    setSessionId('')
    setAnalysisSummary('')
    setSuggestedTitle('')
    setEditedModule(null)
    setEditedQuiz(null)
    setCategoryId('')
    setAutoPublish(false)
    setExpandedSections(new Set())
    setExpandedQuestions(new Set())
    analyze.reset()
    generate.reset()
    save.reset()
    setSaveValidationError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function toggleSection(idx: number) {
    setExpandedSections(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  function toggleQuestion(idx: number) {
    setExpandedQuestions(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  function updateSectionTitle(idx: number, title: string) {
    if (!editedModule) return
    const sections = [...editedModule.sections]
    sections[idx] = { ...sections[idx], title }
    setEditedModule({ ...editedModule, sections })
  }

  function updateSectionBody(idx: number, body: string) {
    if (!editedModule) return
    const sections = [...editedModule.sections]
    sections[idx] = { ...sections[idx], body }
    setEditedModule({ ...editedModule, sections })
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5 max-w-3xl mx-auto">

      {/* Header */}
      <motion.div variants={item} className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center">
          <Sparkles size={20} className="text-purple-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Générateur IA</h1>
          <p className="text-xs text-gray-600">Créez une formation intelligente en 4 étapes</p>
        </div>
      </motion.div>

      {/* Department context */}
      {departmentId && targetDepartment && (
        <motion.div variants={item} className="card p-4 border-l-4 border-l-primary-500 bg-primary-50/40">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-primary-600" />
            <p className="text-sm text-primary-800 font-medium">
              Formation pour le département <span className="font-bold">{targetDepartment.name}</span>
            </p>
          </div>
          <p className="text-xs text-primary-600 mt-1">
            À l'enregistrement, la formation sera automatiquement assignée à tous les membres actifs du département.
          </p>
        </motion.div>
      )}

      {/* AI Status Warning */}
      {aiStatus && !aiStatus.configured && (
        <motion.div variants={item} className="card p-4 border-l-4 border-l-yellow-400 bg-yellow-50/50">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-yellow-600" />
            <p className="text-sm text-yellow-700 font-medium">Clé API Gemini non configurée</p>
          </div>
          <p className="text-xs text-yellow-600 mt-1">Ajoutez <code className="bg-yellow-100 px-1 rounded">GEMINI_API_KEY</code> dans le fichier .env du serveur</p>
        </motion.div>
      )}

      {/* Stepper */}
      <motion.div variants={item} className="card p-4">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex items-center flex-1">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                  ${step === s.num ? 'bg-primary-600 text-white scale-110 shadow-md' :
                    step > s.num ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {step > s.num ? <CheckCircle size={16} /> : s.num}
                </div>
                <span className={`text-xs font-medium hidden sm:block
                  ${step === s.num ? 'text-primary-700' : step > s.num ? 'text-green-600' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3 rounded transition-colors
                  ${step > s.num ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Step Content */}
      <AnimatePresence mode="wait">

        {/* ═══ STEP 1: Source Material ═══ */}
        {step === 1 && (
          <motion.div key="step1" {...slideIn} className="space-y-4">
            <div className="card p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Upload size={16} className="text-primary-600" />
                <h2 className="text-sm font-bold text-gray-800">Étape 1 — Source du contenu</h2>
              </div>
              <p className="text-xs text-gray-500">Téléversez un fichier source ou décrivez le sujet. L'IA analysera le contenu pour vous suggérer le meilleur type de formation.</p>

              {/* File Upload */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                  Fichier source (audio, vidéo ou document)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={FILE_ACCEPT}
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                {file ? (
                  <div className="flex items-center gap-3 px-4 py-3 bg-primary-50 border border-primary-200 rounded-xl">
                    {(() => { const Icon = getFileIcon(file.type); return <Icon size={20} className="text-primary-600 shrink-0" /> })()}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 font-medium truncate">{file.name}</p>
                      <p className="text-[10px] text-gray-500">{getFileTypeLabel(file.type)} · {(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                    </div>
                    <button onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                      className="p-1 hover:bg-primary-100 rounded-lg transition-colors">
                      <X size={16} className="text-gray-400" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50/30 transition-colors text-gray-400 hover:text-primary-500"
                  >
                    <Upload size={24} />
                    <span className="text-xs font-medium">Glissez ou cliquez pour ajouter un fichier</span>
                    <span className="text-[10px] text-gray-400">MP3, WAV, M4A, MP4, WEBM, TXT, PDF, DOCX, CSV, MD</span>
                  </button>
                )}
              </div>

              {/* Prompt */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                  Description du sujet {!file && <span className="text-red-400">*</span>}
                </label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="Ex: Comment configurer un routeur WiFi pour un client résidentiel..."
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none bg-gray-50"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  {file ? 'Optionnel — ajoutez du contexte supplémentaire' : 'Décrivez le sujet si aucun fichier n\'est fourni'}
                </p>
              </div>

              {/* KB Articles */}
              {kbArticles.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                    Documents KB de référence (optionnel)
                  </label>
                  <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-xl bg-gray-50 p-2 space-y-1">
                    {kbArticles.map(a => (
                      <label key={a.id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white cursor-pointer transition-colors">
                        <input type="checkbox"
                          checked={selectedKbIds.includes(a.id)}
                          onChange={e => {
                            if (e.target.checked) setSelectedKbIds(prev => [...prev, a.id])
                            else setSelectedKbIds(prev => prev.filter(id => id !== a.id))
                          }}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="text-xs text-gray-700 truncate">{a.title}</span>
                        {a.category && <span className="text-[9px] text-gray-400 shrink-0">{a.category.name}</span>}
                      </label>
                    ))}
                  </div>
                  {selectedKbIds.length > 0 && (
                    <p className="text-[10px] text-primary-500 mt-1">{selectedKbIds.length} document(s) sélectionné(s)</p>
                  )}
                </div>
              )}

              {/* Analyze button */}
              <button
                onClick={handleAnalyze}
                disabled={(!file && !prompt.trim()) || analyze.isPending}
                className="btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {analyze.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Analyse en cours...
                  </>
                ) : (
                  <>
                    <Wand2 size={16} />
                    Analyser le contenu
                    <ChevronRight size={16} />
                  </>
                )}
              </button>

              {analyze.isError && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle size={14} className="text-red-500 shrink-0" />
                  <p className="text-xs text-red-600">{getApiErrorMessage(analyze.error, 'Analyse impossible. Réessayez.')}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ═══ STEP 2: Analysis Results ═══ */}
        {step === 2 && (
          <motion.div key="step2" {...slideIn} className="space-y-4">
            <div className="card p-5 space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <Settings2 size={16} className="text-primary-600" />
                <h2 className="text-sm font-bold text-gray-800">Étape 2 — Configuration</h2>
              </div>

              {/* Summary */}
              {analysisSummary && (
                <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Résumé de l'analyse IA</p>
                  <p className="text-xs text-blue-600">{analysisSummary}</p>
                  {suggestedTitle && (
                    <p className="text-xs text-blue-800 font-medium mt-2">Titre suggéré : {suggestedTitle}</p>
                  )}
                </div>
              )}

              {/* Purpose Selection */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-2">
                  Type de formation
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PURPOSE_OPTIONS.map(opt => {
                    const Icon = opt.icon
                    const selected = purpose === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setPurpose(opt.value)}
                        className={`flex items-start gap-2.5 p-3 rounded-xl border-2 transition-all text-left
                          ${selected
                            ? 'border-primary-500 bg-primary-50 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                      >
                        <Icon size={18} className={selected ? 'text-primary-600 mt-0.5' : 'text-gray-400 mt-0.5'} />
                        <div>
                          <p className={`text-xs font-bold ${selected ? 'text-primary-700' : 'text-gray-700'}`}>{opt.label}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{opt.desc}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Format Selection */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-2">
                  Format de sortie
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {FORMAT_OPTIONS.map(opt => {
                    const Icon = opt.icon
                    const selected = format === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setFormat(opt.value)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all
                          ${selected
                            ? 'border-primary-500 bg-primary-50 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                      >
                        <Icon size={20} className={selected ? 'text-primary-600' : 'text-gray-400'} />
                        <p className={`text-xs font-bold ${selected ? 'text-primary-700' : 'text-gray-700'}`}>{opt.label}</p>
                        <p className="text-[9px] text-gray-500 text-center">{opt.desc}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Parameters Row */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Niveau</label>
                  <select value={difficulty} onChange={e => setDifficulty(e.target.value as 'beginner' | 'intermediate' | 'advanced')}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="beginner">Débutant</option>
                    <option value="intermediate">Intermédiaire</option>
                    <option value="advanced">Avancé</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Sections</label>
                  <select value={numSections} onChange={e => setNumSections(+e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500">
                    {[2, 3, 4, 5, 6, 8].map(n => <option key={n} value={n}>{n} sections</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Questions</label>
                  <select value={numQuestions} onChange={e => setNumQuestions(+e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500">
                    {[5, 8, 10, 15, 20].map(n => <option key={n} value={n}>{n} questions</option>)}
                  </select>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="btn-ghost px-4 py-2.5 text-xs flex items-center gap-1"
                >
                  <ChevronLeft size={14} />
                  Retour
                </button>
                <button
                  onClick={handleGenerate}
                  className="btn-primary flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <Sparkles size={16} />
                  Générer la formation
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ STEP 3: Generating ═══ */}
        {step === 3 && (
          <motion.div key="step3" {...slideIn} className="space-y-4">
            <div className="card p-8 flex flex-col items-center justify-center text-center space-y-4">
              {generate.isPending ? (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center">
                    <Loader2 size={32} className="text-purple-600 animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">Génération en cours...</h3>
                    <p className="text-xs text-gray-500 mt-1">L'IA crée votre formation {format} de type {purpose}</p>
                    <p className="text-[10px] text-gray-400 mt-2">Cela peut prendre 30 à 90 secondes</p>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-[10px] font-medium">{difficulty === 'beginner' ? 'Débutant' : difficulty === 'intermediate' ? 'Intermédiaire' : 'Avancé'}</span>
                    <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-medium">{numSections} sections</span>
                    <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-700 text-[10px] font-medium">{numQuestions} questions</span>
                  </div>
                </>
              ) : generate.isError ? (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
                    <AlertCircle size={32} className="text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-red-700">Erreur de génération</h3>
                    <p className="text-xs text-red-500 mt-1">{getApiErrorMessage(generate.error, 'Génération impossible. Réessayez.')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setStep(2)} className="btn-ghost text-xs px-4 py-2">
                      <ChevronLeft size={14} className="mr-1" />
                      Modifier les paramètres
                    </button>
                    <button onClick={handleGenerate} className="btn-primary text-xs px-4 py-2">
                      <RotateCcw size={14} className="mr-1" />
                      Réessayer
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </motion.div>
        )}

        {/* ═══ STEP 4: Review & Save ═══ */}
        {step === 4 && editedModule && editedQuiz && (
          <motion.div key="step4" {...slideIn} className="space-y-4">

            {/* Module Preview */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Eye size={16} className="text-primary-600" />
                <h2 className="text-sm font-bold text-gray-800">Étape 4 — Révision</h2>
                <div className="flex gap-1 ml-auto">
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-medium">{purpose}</span>
                  <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[9px] font-medium">{format}</span>
                </div>
              </div>

              {/* Module Header */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-primary-600" />
                  <span className="text-[10px] font-semibold text-gray-500 uppercase">Module</span>
                </div>
                <input
                  value={editedModule.title}
                  onChange={e => setEditedModule({ ...editedModule, title: e.target.value })}
                  className="w-full text-sm font-bold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary-500 focus:outline-none px-0 py-1"
                />
                <textarea
                  value={editedModule.description}
                  onChange={e => setEditedModule({ ...editedModule, description: e.target.value })}
                  rows={2}
                  className="w-full text-xs text-gray-600 bg-transparent border border-transparent hover:border-gray-200 focus:border-primary-300 focus:outline-none rounded-lg p-1 resize-none"
                />
                <p className="text-[10px] text-gray-400">{editedModule.estimatedMinutes} min · {editedModule.sections.length} sections</p>
              </div>

              {/* Sections */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600">Sections du module</p>
                {editedModule.sections.map((section, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSection(idx)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                    >
                      {expandedSections.has(idx) ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                      <span className="text-[10px] text-gray-400 font-mono">{idx + 1}.</span>
                      <span className="text-xs font-medium text-gray-700 flex-1 truncate">{section.title}</span>
                    </button>
                    {expandedSections.has(idx) && (
                      <div className="px-4 pb-3 space-y-2 border-t border-gray-100">
                        <input
                          value={section.title}
                          onChange={e => updateSectionTitle(idx, e.target.value)}
                          className="w-full text-xs font-semibold text-gray-700 bg-gray-50 rounded-lg px-3 py-2 mt-2 focus:outline-none focus:ring-1 focus:ring-primary-400"
                          placeholder="Titre de la section"
                        />
                        <div className="flex gap-1 text-[10px] font-medium mb-1">
                          <button onClick={() => setSectionPreviewMode(p => ({ ...p, [idx]: false }))}
                            className={`px-2 py-0.5 rounded ${!sectionPreviewMode[idx] ? 'bg-primary-100 text-primary-700' : 'text-gray-400 hover:text-gray-600'}`}>
                            Éditer
                          </button>
                          <button onClick={() => setSectionPreviewMode(p => ({ ...p, [idx]: true }))}
                            className={`px-2 py-0.5 rounded ${sectionPreviewMode[idx] ? 'bg-primary-100 text-primary-700' : 'text-gray-400 hover:text-gray-600'}`}>
                            Aperçu
                          </button>
                        </div>
                        {sectionPreviewMode[idx] ? (
                          <div className="prose prose-sm max-w-none text-gray-700 text-xs leading-relaxed bg-gray-50 rounded-lg px-3 py-2 min-h-[120px]">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.body}</ReactMarkdown>
                          </div>
                        ) : (
                          <textarea
                            value={section.body}
                            onChange={e => updateSectionBody(idx, e.target.value)}
                            rows={8}
                            className="w-full text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-1 focus:ring-primary-400 resize-y"
                          />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Quiz Preview */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Brain size={16} className="text-purple-600" />
                <span className="text-xs font-semibold text-gray-600">Quiz — {editedQuiz.questions.length} questions</span>
                <span className="text-[10px] text-gray-400 ml-auto">Note de passage: {editedQuiz.passingScore}%</span>
              </div>

              <div className="space-y-1.5">
                {editedQuiz.questions.map((q, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleQuestion(idx)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
                    >
                      {expandedQuestions.has(idx) ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
                      <span className="text-[10px] text-gray-400 font-mono">Q{idx + 1}</span>
                      <span className="text-[11px] text-gray-700 flex-1 truncate">{q.text}</span>
                      <span className="text-[9px] text-gray-400">{q.points} pts</span>
                    </button>
                    {expandedQuestions.has(idx) && (
                      <div className="px-3 pb-2 border-t border-gray-100 space-y-1 mt-1">
                        {q.options.map(opt => (
                          <div key={opt.id} className={`text-[11px] px-2 py-1 rounded ${opt.isCorrect ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-600'}`}>
                            {opt.id.toUpperCase()}. {opt.text} {opt.isCorrect && '✓'}
                          </div>
                        ))}
                        <p className="text-[10px] text-gray-500 italic mt-1 pt-1 border-t border-gray-100">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Save Options */}
            <div className="card p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Catégorie</label>
                  <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">Aucune</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={autoPublish} onChange={e => setAutoPublish(e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                    <span className="text-xs text-gray-600">Publier automatiquement</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => { generate.reset(); setStep(2) }}
                  className="btn-ghost px-4 py-2.5 text-xs flex items-center gap-1"
                >
                  <ChevronLeft size={14} />
                  Modifier
                </button>
                <button
                  onClick={() => { generate.reset(); handleGenerate() }}
                  className="btn-ghost px-4 py-2.5 text-xs flex items-center gap-1"
                >
                  <RotateCcw size={14} />
                  Régénérer
                </button>
                <button
                  onClick={handleSave}
                  disabled={save.isPending}
                  className="btn-primary flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {save.isPending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Enregistrer
                    </>
                  )}
                </button>
              </div>

              {(saveValidationError || save.isError) && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle size={14} className="text-red-500 shrink-0" />
                  <p className="text-xs text-red-600">
                    {saveValidationError ?? getApiErrorMessage(save.error, 'Enregistrement impossible.')}
                  </p>
                </div>
              )}
            </div>

            {/* Success */}
            {save.isSuccess && save.data && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-5 border-l-4 border-l-green-400 bg-green-50/30 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle size={18} className="text-green-500" />
                  <h3 className="text-sm font-bold text-green-700">Formation enregistrée !</h3>
                </div>

                {save.data.departmentAssignment && (
                  <p className="text-xs text-green-700">
                    Assignée au département <span className="font-semibold">{save.data.departmentAssignment.departmentName}</span>
                    {' '}— {save.data.departmentAssignment.enrolled} membre{save.data.departmentAssignment.enrolled !== 1 ? 's' : ''} inscrit{save.data.departmentAssignment.enrolled !== 1 ? 's' : ''}.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl p-3 border border-green-200">
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen size={14} className="text-green-600" />
                      <span className="text-xs font-semibold text-gray-700">Module</span>
                    </div>
                    <p className="text-sm font-medium text-gray-800">{save.data.module.title}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{save.data.module.sectionsCount} sections</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-green-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Brain size={14} className="text-purple-600" />
                      <span className="text-xs font-semibold text-gray-700">Quiz</span>
                    </div>
                    <p className="text-sm font-medium text-gray-800">{save.data.quiz.title}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{save.data.quiz.questionsCount} questions</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <a href={`/modules/${save.data.module.id}`}
                    className="btn-primary text-xs px-4 py-2">
                    Voir le module
                  </a>
                  {save.data.departmentAssignment && (
                    <a href={`/departments?departmentId=${save.data.departmentAssignment.departmentId}`}
                      className="btn-ghost text-xs px-4 py-2">
                      Retour au département
                    </a>
                  )}
                  <button onClick={handleReset}
                    className="btn-ghost text-xs px-4 py-2">
                    Créer une autre formation
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </motion.div>
  )
}
