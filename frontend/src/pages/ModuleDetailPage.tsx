import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Play, FileText, Headphones, ChevronRight, CheckCircle, Clock, ArrowLeft,
  Presentation, Brain, Lock, Users, X, Search, CheckCircle2,
  ChevronDown, ChevronUp, UserMinus, Pencil, Save, Loader2
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import SlideViewer from '../components/SlideViewer'
import { api } from '../utils/api'
import VideoPlayer from '../components/VideoPlayer'
import ModuleFeedback from '../components/ModuleFeedback'
import { useAuthStore } from '../store/auth'
import type { Module, Content } from '../types'
import { trackCourseStarted, trackCourseExited, trackCourseCompleted, getSessionId } from '../hooks/useAnalytics'

type ModuleDetail = Module & {
  contents: Content[]
  quizzes: { id: string; title: string; passingScore: number }[]
  userEnrollment?: { status: string; progressPct: number } | null
  format?: string | null
  prerequisite?: { id: string; title: string } | null
  prerequisiteMet?: boolean
}

const TYPE_ICONS = { VIDEO: Play, AUDIO: Headphones, TEXT: FileText, PDF: FileText, SCORM: FileText, PRESENTATION: Presentation }
const TYPE_LABELS = { VIDEO: 'Vidéo', AUDIO: 'Audio', TEXT: 'Texte', PDF: 'PDF', SCORM: 'SCORM', PRESENTATION: 'Diaporama' }

// ─── Module Content Editor (admin) ────────────────────────────────────────
type EditSection = { id: string; title: string; body: string }

function ModuleContentEditor({
  title,
  description,
  sections,
  onChangeTitle,
  onChangeDescription,
  onChangeSection,
  onSave,
  onCancel,
  isSaving,
  saveError
}: {
  title: string
  description: string
  sections: EditSection[]
  onChangeTitle: (v: string) => void
  onChangeDescription: (v: string) => void
  onChangeSection: (id: string, field: 'title' | 'body', value: string) => void
  onSave: () => void
  onCancel: () => void
  isSaving: boolean
  saveError?: string
}) {
  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Pencil size={16} className="text-primary-600" />
          <h2 className="text-sm font-bold text-gray-800">Modifier le module</h2>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Titre *</label>
          <input
            value={title}
            onChange={e => onChangeTitle(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Description</label>
          <textarea
            value={description}
            onChange={e => onChangeDescription(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50 resize-none"
          />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Sections ({sections.length})</h3>
        {sections.map((section, idx) => (
          <div key={section.id} className="card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-gray-400">{idx + 1}.</span>
              <input
                value={section.title}
                onChange={e => onChangeSection(section.id, 'title', e.target.value)}
                className="flex-1 text-sm font-semibold text-gray-800 bg-transparent border-b border-gray-200 focus:border-primary-500 focus:outline-none px-1 py-1"
                placeholder="Titre de la section"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 block mb-1">Contenu (markdown)</label>
              <textarea
                value={section.body}
                onChange={e => onChangeSection(section.id, 'body', e.target.value)}
                rows={12}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50 resize-y min-h-[200px]"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 sticky bottom-4 bg-white/90 backdrop-blur-sm p-3 rounded-2xl border border-gray-200 shadow-lg">
        {saveError && <p className="text-xs text-red-500 flex-1">{saveError}</p>}
        <button onClick={onCancel} className="btn-ghost text-sm" disabled={isSaving}>Annuler</button>
        <button onClick={onSave} disabled={isSaving || !title.trim()}
          className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50">
          {isSaving ? <><Loader2 size={14} className="animate-spin" /> Enregistrement...</> : <><Save size={14} /> Enregistrer</>}
        </button>
      </div>
    </div>
  )
}

// ─── Enrolled Users List ───────────────────────────────────────────────────
type EnrolledUser = {
  id: string
  status: string
  progressPct: number
  dueAt: string | null
  completedAt: string | null
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    role: string
    avatarUrl?: string | null
    department?: { name: string; icon?: string } | null
  }
}

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Non commencé',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Complété',
  FAILED: 'Échoué'
}
const STATUS_CLASS: Record<string, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-500',
  IN_PROGRESS: 'bg-blue-50 text-blue-600',
  COMPLETED: 'bg-green-50 text-green-600',
  FAILED: 'bg-red-50 text-red-500'
}

function EnrolledUsersList({ moduleId }: { moduleId: string }) {
  const [open, setOpen] = useState(true)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data: enrollments = [], isLoading } = useQuery<EnrolledUser[]>({
    queryKey: ['module-enrollments', moduleId],
    queryFn: () => api.get(`/modules/${moduleId}/enrollments`).then(r => r.data)
  })

  const unassignMutation = useMutation({
    mutationFn: (enrollmentId: string) => api.delete(`/assignments/${enrollmentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['module-enrollments', moduleId] })
      qc.invalidateQueries({ queryKey: ['assignments'] })
      setConfirmId(null)
    }
  })

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users size={14} className="text-primary-600" />
          <span className="text-sm font-semibold text-gray-700">
            Personnes assignées
          </span>
          {!isLoading && (
            <span className="text-xs bg-primary-50 text-primary-700 font-bold px-2 py-0.5 rounded-full">
              {enrollments.length}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {open && (
        isLoading ? (
          <div className="p-6 text-center text-xs text-gray-400 animate-pulse">Chargement...</div>
        ) : enrollments.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-400">Aucune personne assignée à ce module.</div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {enrollments.map(e => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0">
                  {e.user.firstName[0]}{e.user.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-800 truncate">
                    {e.user.firstName} {e.user.lastName}
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">
                    {e.user.department?.icon} {e.user.department?.name ?? e.user.role.replace(/_/g, ' ')}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CLASS[e.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_LABEL[e.status] ?? e.status}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500 rounded-full" style={{ width: `${e.progressPct}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-400">{e.progressPct}%</span>
                  </div>
                  {e.dueAt && (
                    <span className="text-[9px] text-gray-300">
                      {new Date(e.dueAt) < new Date() && e.status !== 'COMPLETED'
                        ? <span className="text-red-400">⚠ {new Date(e.dueAt).toLocaleDateString('fr-FR')}</span>
                        : new Date(e.dueAt).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                </div>

                {/* Désassigner */}
                {confirmId === e.id ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => unassignMutation.mutate(e.id)}
                      disabled={unassignMutation.isPending}
                      className="text-[10px] font-semibold bg-red-500 text-white px-2 py-1 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      Confirmer
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="text-[10px] text-gray-400 hover:text-gray-600 px-1 py-1"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(e.id)}
                    title="Désassigner"
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <UserMinus size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

// ─── Main Page Component ──────────────────────────────────────────────────
export default function ModuleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'PLATFORM_MANAGER' || user?.role === 'HR'
  const canAssign = isAdmin || user?.role === 'MANAGER' || user?.role === 'SUPERVISOR'
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editSections, setEditSections] = useState<EditSection[]>([])
  const [editError, setEditError] = useState('')
  const location = useLocation()
  const qc = useQueryClient()
  const [activeContent, setActiveContent] = useState<Content | null>(null)
  const [videoUploadProgress, setVideoUploadProgress] = useState<number | null>(null)
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null)

  // Track section states: 'slides' | 'passed'
  const [sectionStates, setSectionStates] = useState<Record<number, 'slides' | 'passed'>>({ 0: 'slides' })

  const { data: module, isLoading } = useQuery<ModuleDetail>({
    queryKey: ['module', id],
    queryFn: () => api.get(`/modules/${id}`).then(r => r.data),
  })

  // Tracks which module we already fired COURSE_STARTED for — fires once per module per mount
  const courseStartedForModuleRef = useRef<string | null>(null)

  useEffect(() => {
    if (module?.contents?.[0] && !activeContent) setActiveContent(module.contents[0])
    if (module?.id && courseStartedForModuleRef.current !== module.id) {
      courseStartedForModuleRef.current = module.id
      trackCourseStarted(getSessionId(), module.id, location.pathname)
    }
  // location.pathname intentionally omitted: we don't want a new COURSE_STARTED on every re-render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module?.id, module?.contents])

  const { data: contents = [] } = useQuery<Content[]>({
    queryKey: ['content', id],
    queryFn: () => api.get(`/content/module/${id}`).then(r => r.data),
    enabled: !!id
  })

  // Auto-claim certificate after module completion
  const claimCertMutation = useMutation({
    mutationFn: () => api.post(`/certificates/module/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['certificates'] })
    }
  })

  // Tracks which module id we already claimed a cert for, to avoid re-firing on re-renders
  const certClaimedForModuleRef = useRef<string | null>(null)

  // Track course completion and auto-claim certificate when enrollment status becomes COMPLETED
  useEffect(() => {
    if (
      module?.id &&
      module?.userEnrollment?.status === 'COMPLETED' &&
      certClaimedForModuleRef.current !== module.id
    ) {
      certClaimedForModuleRef.current = module.id
      trackCourseCompleted(getSessionId(), module.id, location.pathname)
      claimCertMutation.mutate()
    }
  // claimCertMutation intentionally excluded: its reference changes on every render
  // and including it causes an infinite POST loop that exhausts the rate limiter
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module?.userEnrollment?.status, module?.id, location.pathname])

  // Track course exit on unload and on navigation away
  useEffect(() => {
    const moduleId = module?.id
    if (!moduleId) return
    const handleExit = () => {
      trackCourseExited(getSessionId(), moduleId, location.pathname)
    }
    window.addEventListener('beforeunload', handleExit)
    return () => {
      window.removeEventListener('beforeunload', handleExit)
      // Track exit on navigation away (React cleanup)
      if (module?.userEnrollment?.status !== 'COMPLETED') {
        trackCourseExited(getSessionId(), moduleId, location.pathname)
      }
    }
  }, [module?.id, module?.userEnrollment?.status, location.pathname])

  // Initialize section states based on content progress
  useEffect(() => {
    if (contents.length === 0) return

    const states: Record<number, 'slides' | 'passed'> = {}
    contents.forEach((c, idx) => {
      if (c.progress?.completed) {
        states[idx] = 'passed'
      } else if (idx === 0 || contents[idx - 1]?.progress?.completed) {
        states[idx] = 'slides'
      }
    })

    if (!states[0]) states[0] = 'slides'
    setSectionStates(states)
  }, [contents])

  const enrollMutation = useMutation({
    mutationFn: () => api.post(`/modules/${id}/enroll`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['module', id] })
  })

  const progressMutation = useMutation({
    mutationFn: (data: { contentId: string; progressPct: number; watchedSeconds: number }) =>
      api.post(`/content/${data.contentId}/progress`, { progressPct: data.progressPct, watchedSeconds: data.watchedSeconds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content', id] })
      qc.invalidateQueries({ queryKey: ['module', id] })
      qc.invalidateQueries({ queryKey: ['my-stats'] })
      qc.invalidateQueries({ queryKey: ['assignments'] })
      qc.invalidateQueries({ queryKey: ['dashboard-modules'] })
    }
  })

  const saveEditMutation = useMutation({
    mutationFn: async () => {
      await api.put(`/modules/${id}`, { title: editTitle.trim(), description: editDescription.trim() })
      await Promise.all(editSections.map(s =>
        api.put(`/content/${s.id}`, { title: s.title.trim(), body: s.body })
      ))
    },
    onSuccess: () => {
      setIsEditing(false)
      setEditError('')
      qc.invalidateQueries({ queryKey: ['module', id] })
      qc.invalidateQueries({ queryKey: ['content', id] })
    },
    onError: () => setEditError('Erreur lors de la sauvegarde. Réessayez.')
  })

  // Admin: upload a .mp4 to an existing VIDEO section that has no url yet
  function handleVideoUpload(contentId: string, file: File) {
    setVideoUploadProgress(0)
    setVideoUploadError(null)
    const formData = new FormData()
    formData.append('file', file)
    api
      .post(`/content/${contentId}/upload-video`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) {
            setVideoUploadProgress(Math.round((e.loaded / e.total) * 100))
          }
        }
      })
      .then(() => {
        setVideoUploadProgress(null)
        qc.invalidateQueries({ queryKey: ['content', id] })
      })
      .catch((err) => {
        setVideoUploadProgress(null)
        setVideoUploadError(err.response?.data?.error || 'Échec du téléversement')
      })
  }

  function openEditor() {
    if (!module) return
    setEditTitle(module.title)
    setEditDescription(module.description || '')
    setEditSections(contents.map(c => ({ id: c.id, title: c.title, body: c.body || '' })))
    setEditError('')
    setIsEditing(true)
  }

  function updateEditSection(sectionId: string, field: 'title' | 'body', value: string) {
    setEditSections(prev => prev.map(s => s.id === sectionId ? { ...s, [field]: value } : s))
  }


  // When slides are completed → unlock next section
  function handleSlidesComplete(idx: number, contentId: string) {
    progressMutation.mutate({ contentId, progressPct: 100, watchedSeconds: 0 })
    setSectionStates(prev => {
      const next = { ...prev, [idx]: 'passed' as const }
      if (idx + 1 < contents.length && !prev[idx + 1]) {
        next[idx + 1] = 'slides'
      }
      return next
    })
  }

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded-xl w-1/2" />
      <div className="h-64 bg-gray-200 rounded-2xl" />
    </div>
  )

  if (!module) return <div className="text-center text-gray-400 py-12">Module introuvable</div>

  // ─── PREREQUISITE GATE ────────────────────────────────────────────────
  if (module.prerequisite && module.prerequisiteMet === false) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-6">
        <Link to="/modules" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-8 transition-colors justify-center">
          <ArrowLeft size={14} /> Retour aux formations
        </Link>
        <div className="w-20 h-20 mx-auto bg-amber-100 rounded-full flex items-center justify-center">
          <Lock size={32} className="text-amber-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Formation verrouillée</h2>
        <p className="text-gray-500 text-lg">
          Vous devez d'abord compléter la formation prérequise :
        </p>
        <Link
          to={`/modules/${module.prerequisite.id}`}
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
        >
          <Play size={16} />
          {module.prerequisite.title}
          <ChevronRight size={16} />
        </Link>
      </div>
    )
  }

  const isEnrolled = !!module.userEnrollment
  const isPresentation = module.format === 'Diaporama' || contents.some(c => c.type === 'PRESENTATION')

  // ─── ADMIN EDIT MODE ──────────────────────────────────────────────────
  if (isEditing && isAdmin) {
    return (
      <div className="space-y-4">
        <Link to="/modules" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <ArrowLeft size={14} /> Retour aux formations
        </Link>
        <ModuleContentEditor
          title={editTitle}
          description={editDescription}
          sections={editSections}
          onChangeTitle={setEditTitle}
          onChangeDescription={setEditDescription}
          onChangeSection={updateEditSection}
          onSave={() => saveEditMutation.mutate()}
          onCancel={() => setIsEditing(false)}
          isSaving={saveEditMutation.isPending}
          saveError={editError}
        />
      </div>
    )
  }

  // ─── PRESENTATION LAYOUT (gated vertical flow) ─────────────────────────
  if (isPresentation) {
    const passedCount = Object.values(sectionStates).filter(s => s === 'passed').length

    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <Link to="/modules" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors">
            <ArrowLeft size={14} /> Retour aux formations
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Presentation size={18} className="text-indigo-600" />
                <h1 className="text-xl font-bold text-gray-900">{module.title}</h1>
              </div>
              {module.description && <p className="text-sm text-gray-500 mt-1">{module.description}</p>}
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Clock size={11} /> {module.estimatedMinutes} min</span>
                <span>{contents.length} sections</span>
                {module.quizzes?.[0] && (
                  <span className="flex items-center gap-1">
                    <Brain size={11} /> Quiz final · {module.quizzes[0].passingScore}% requis
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button onClick={openEditor}
                  className="btn-secondary shrink-0 flex items-center gap-1.5 text-sm">
                  <Pencil size={14} /> Modifier
                </button>
              )}
              {canAssign && (
                <button onClick={() => setShowAssignModal(true)}
                  className="btn-outline shrink-0 flex items-center gap-1.5 text-sm">
                  <Users size={14} /> Assigner
                </button>
              )}
              {!isEnrolled && (
                <button onClick={() => enrollMutation.mutate()} disabled={enrollMutation.isPending}
                  className="btn-primary shrink-0">
                  {isAdmin ? 'Tester' : 'Commencer'}
                </button>
              )}
            </div>
          </div>

          {/* Global progress */}
          {isEnrolled && (
            <div className="mt-4">
              <div className="progress-track h-2">
                <div
                  className="progress-fill"
                  style={{ width: `${contents.length > 0 ? Math.round((passedCount / contents.length) * 100) : 0}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {passedCount}/{contents.length} sections complétées
              </div>
            </div>
          )}
        </div>

        {/* Sections flow */}
        {contents.map((content, idx) => {
          const state = sectionStates[idx]
          const isLocked = !state

          return (
            <div key={content.id} className="space-y-4">
              {/* Section header */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  state === 'passed'
                    ? 'bg-green-100 text-green-700'
                    : isLocked
                    ? 'bg-gray-100 text-gray-400'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {state === 'passed' ? <CheckCircle size={16} /> : isLocked ? <Lock size={14} /> : idx + 1}
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-gray-800">{content.title}</h2>
                  <span className="text-xs text-gray-400">
                    {state === 'passed' && '✓ Section validée'}
                    {state === 'slides' && TYPE_LABELS[content.type]}
                    {isLocked && 'Complétez la section précédente pour débloquer'}
                  </span>
                </div>
              </div>

              {/* SLIDES (visible only in 'slides' state) */}
              {state === 'slides' && content.type === 'PRESENTATION' && content.body && (
                <div className="card overflow-hidden">
                  <SlideViewer
                    body={content.body}
                    title={content.title}
                    sectionIndex={idx}
                    totalSections={contents.length}
                    onComplete={isEnrolled
                      ? () => handleSlidesComplete(idx, content.id)
                      : undefined}
                  />
                </div>
              )}

              {/* TEXT fallback */}
              {state === 'slides' && (content.type === 'TEXT' || content.type === 'PDF') && content.body && (
                <div className="card p-6">
                  <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content.body}</ReactMarkdown>
                  </div>
                  {isEnrolled && (
                    <button
                      onClick={() => handleSlidesComplete(idx, content.id)}
                      className="btn-primary mt-4"
                    >
                      Section terminée — Continuer
                    </button>
                  )}
                </div>
              )}

              {/* PASSED — compact summary */}
              {state === 'passed' && (
                <div className="card px-5 py-3 bg-green-50/50 border-green-200 flex items-center gap-3">
                  <CheckCircle size={16} className="text-green-600 shrink-0" />
                  <span className="text-sm text-green-700 font-medium">
                    Section {idx + 1} validée
                  </span>
                </div>
              )}

              {/* LOCKED */}
              {isLocked && (
                <div className="card p-8 text-center text-gray-400 bg-gray-50/50">
                  <Lock size={24} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Complétez la section {idx} pour débloquer</p>
                </div>
              )}
            </div>
          )
        })}

        {/* Full quiz link at bottom */}
        {passedCount === contents.length && module.quizzes?.map(quiz => (
          <Link key={quiz.id} to={`/modules/${id}/quiz/${quiz.id}`}
            className="card p-5 flex items-center gap-3 hover:border-indigo-300 hover:shadow-card-md transition-all group border-2 border-indigo-200 bg-indigo-50/30">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Brain size={20} className="text-indigo-600" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-800">{quiz.title}</div>
              <div className="text-xs text-gray-400">Examen final · Score requis: {quiz.passingScore}%</div>
            </div>
            <ChevronRight size={14} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
          </Link>
        ))}

        {canAssign && <EnrolledUsersList moduleId={id!} />}

        <ModuleFeedback moduleId={id!} />

        {/* Quick Assign Modal */}
        {showAssignModal && <QuickAssignModal moduleId={id!} moduleTitle={module.title} onClose={() => setShowAssignModal(false)} canBulk={isAdmin} />}
      </div>
    )
  }

  // ─── STANDARD LAYOUT (sidebar + content) ─────────────────────────────────
  const selected = activeContent || contents[0]

  return (
    <div className="space-y-6">
      <div>
        <Link to="/modules" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors">
          <ArrowLeft size={14} /> Retour aux formations
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{module.title}</h1>
            {module.description && <p className="text-sm text-gray-500 mt-1">{module.description}</p>}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              <span className="flex items-center gap-1"><Clock size={11} /> {module.estimatedMinutes} min</span>
              <span>{contents.length} contenus</span>
              {module.quizzes?.length > 0 && <span>🧠 {module.quizzes.length} quiz</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button onClick={openEditor}
                className="btn-secondary shrink-0 flex items-center gap-1.5 text-sm">
                <Pencil size={14} /> Modifier
              </button>
            )}
            {canAssign && (
              <button onClick={() => setShowAssignModal(true)}
                className="btn-outline shrink-0 flex items-center gap-1.5 text-sm">
                <Users size={14} /> Assigner
              </button>
            )}
            {!isEnrolled && (
              <button onClick={() => enrollMutation.mutate()} disabled={enrollMutation.isPending}
                className="btn-primary shrink-0">{isAdmin ? 'Tester' : 'Commencer'}</button>
            )}
          </div>
          {isEnrolled && module.userEnrollment?.status === 'COMPLETED' && (
            <span className="chip chip-success">✅ Complété</span>
          )}
        </div>
        {isEnrolled && (
          <div className="mt-4">
            <div className="progress-track h-2">
              <div className="progress-fill" style={{ width: `${module.userEnrollment?.progressPct ?? 0}%` }} />
            </div>
            <div className="text-xs text-gray-400 mt-1">{module.userEnrollment?.progressPct ?? 0}% complété</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {selected && (
            <div className="card overflow-hidden">
              {selected.type === 'VIDEO' && selected.url && (
                <VideoPlayer contentId={selected.id} url={selected.url}
                  initialProgress={selected.progress ? { watchedSeconds: selected.progress.watchedSeconds, progressPct: selected.progress.progressPct } : undefined} />
              )}
              {selected.type === 'VIDEO' && !selected.url && selected.body && (
                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">{selected.title}</h3>
                  {isAdmin && (
                    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm font-medium text-amber-800 mb-2">
                        Aucune vidéo attachée — script IA uniquement.
                      </p>
                      <label className={`inline-flex items-center gap-2 cursor-pointer btn-primary text-sm px-3 py-2 ${videoUploadProgress !== null ? 'opacity-50 pointer-events-none' : ''}`}>
                        📹 Téléverser la vidéo (.mp4)
                        <input
                          type="file"
                          accept="video/mp4,video/*"
                          className="hidden"
                          disabled={videoUploadProgress !== null}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleVideoUpload(selected.id, file)
                            e.target.value = ''
                          }}
                        />
                      </label>
                      {videoUploadProgress !== null && (
                        <p className="mt-2 text-sm text-amber-700 font-medium">
                          Téléversement: {videoUploadProgress}%
                        </p>
                      )}
                      {videoUploadError && (
                        <p className="mt-2 text-sm text-red-600 font-medium">{videoUploadError}</p>
                      )}
                    </div>
                  )}
                  <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.body}</ReactMarkdown>
                  </div>
                </div>
              )}
              {selected.type === 'AUDIO' && (
                <div className="p-6 flex flex-col items-center gap-4">
                  <div className="w-24 h-24 rounded-full bg-primary-50 flex items-center justify-center">
                    <Headphones size={40} className="text-primary-600" />
                  </div>
                  <audio controls src={selected.url ?? undefined} className="w-full" />
                </div>
              )}
              {selected.type === 'PRESENTATION' && selected.body && (
                <SlideViewer body={selected.body} title={selected.title}
                  onComplete={isEnrolled && !selected.progress?.completed
                    ? () => progressMutation.mutate({ contentId: selected.id, progressPct: 100, watchedSeconds: 0 })
                    : undefined} />
              )}
              {(selected.type === 'TEXT' || selected.type === 'PDF') && (
                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">{selected.title}</h3>
                  {selected.body && (
                    <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.body}</ReactMarkdown>
                    </div>
                  )}
                  {selected.url && selected.type === 'PDF' && (
                    <iframe src={selected.url} className="w-full h-[500px] rounded-xl mt-4 border border-gray-200" />
                  )}
                  {isEnrolled && !selected.progress?.completed && (
                    <button onClick={() => progressMutation.mutate({ contentId: selected.id, progressPct: 100, watchedSeconds: 0 })}
                      className="btn-primary mt-4">Marquer comme lu</button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="p-3 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Contenu ({contents.length})
            </div>
            <div className="divide-y divide-gray-100">
              {contents.map((c) => {
                const Icon = TYPE_ICONS[c.type]
                const isActive = selected?.id === c.id
                const isDone = c.progress?.completed
                return (
                  <button key={c.id} onClick={() => setActiveContent(c)}
                    className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-gray-50 ${isActive ? 'bg-primary-50' : ''}`}>
                    <div className={`shrink-0 ${isDone ? 'text-success-500' : isActive ? 'text-primary-600' : 'text-gray-300'}`}>
                      {isDone ? <CheckCircle size={16} /> : <Icon size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-700 truncate">{c.title}</div>
                      <div className="text-[10px] text-gray-400">{TYPE_LABELS[c.type]}{c.duration ? ` · ${Math.round(c.duration / 60)}min` : ''}</div>
                    </div>
                    {c.progress && !isDone && (
                      <div className="text-[10px] text-primary-600 font-medium">{c.progress.progressPct}%</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {module.quizzes?.map(quiz => (
            <Link key={quiz.id} to={`/modules/${id}/quiz/${quiz.id}`}
              className="card p-4 flex items-center gap-3 hover:border-primary-300 hover:shadow-card-md transition-all group">
              <div className="text-2xl">🧠</div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">{quiz.title}</div>
                <div className="text-xs text-gray-400">Score requis: {quiz.passingScore}%</div>
              </div>
              <ChevronRight size={14} className="text-gray-300 group-hover:text-primary-500 transition-colors" />
            </Link>
          ))}
        </div>
      </div>

      {canAssign && <EnrolledUsersList moduleId={id!} />}

      <ModuleFeedback moduleId={id!} />

      {/* Quick Assign Modal */}
      {showAssignModal && <QuickAssignModal moduleId={id!} moduleTitle={module.title} onClose={() => setShowAssignModal(false)} canBulk={isAdmin} />}
    </div>
  )
}

// ─── Quick Assign Modal ─────────────────────────────────────────────────────
type AssignTab = 'individual' | 'group'

function QuickAssignModal({ moduleId, moduleTitle, onClose, canBulk }: {
  moduleId: string; moduleTitle: string; onClose: () => void; canBulk: boolean
}) {
  const [tab, setTab] = useState<AssignTab>('individual')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDept, setBulkDept] = useState('')
  const [bulkRole, setBulkRole] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [error, setError] = useState('')
  const defaultDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const [dueAt, setDueAt] = useState(defaultDue)
  const qc = useQueryClient()

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['assignments'] })
    qc.invalidateQueries({ queryKey: ['dashboard-modules'] })
    qc.invalidateQueries({ queryKey: ['all-modules'] })
    qc.invalidateQueries({ queryKey: ['assignment-summary'] })
  }

  const { data: usersData } = useQuery<{ users: Array<{ id: string; firstName: string; lastName: string; email: string; department?: { name: string } }> }>({
    queryKey: ['users-for-assign', search],
    queryFn: () => api.get(`/users?search=${search}&limit=100`).then(r => r.data),
    enabled: tab === 'individual'
  })

  const { data: deptData } = useQuery<Array<{ id: string; name: string; _count?: { users: number } }>>({
    queryKey: ['assign-departments'],
    queryFn: () => api.get('/departments').then(r => r.data),
    enabled: tab === 'group'
  })

  const assignMutation = useMutation({
    mutationFn: () => api.post('/assignments', { moduleId, userIds: Array.from(selected), dueAt: new Date(dueAt).toISOString() }),
    onSuccess: (res) => {
      invalidateAll()
      setSuccessMsg(`Formation assignée à ${res.data.assigned} utilisateur${res.data.assigned > 1 ? 's' : ''}`)
      setTimeout(onClose, 1500)
    },
    onError: () => setError("Erreur lors de l'assignation")
  })

  const bulkMutation = useMutation({
    mutationFn: () => api.post('/assignments/bulk', {
      moduleId,
      ...(bulkDept ? { departmentId: bulkDept } : {}),
      ...(bulkRole ? { role: bulkRole } : {}),
      dueAt: new Date(dueAt).toISOString()
    }),
    onSuccess: (res) => {
      invalidateAll()
      setSuccessMsg(`Formation assignée à ${res.data.assigned} utilisateur${res.data.assigned > 1 ? 's' : ''}`)
      setTimeout(onClose, 1500)
    },
    onError: () => setError("Erreur lors de l'assignation en masse")
  })

  const users = usersData?.users ?? []
  const departments = [...(deptData ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  const isPending = assignMutation.isPending || bulkMutation.isPending

  const toggle = (uid: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(uid) ? next.delete(uid) : next.add(uid)
    return next
  })

  const handleSubmit = () => {
    setError('')
    if (tab === 'individual') {
      if (selected.size === 0) return setError('Sélectionnez au moins un utilisateur')
      assignMutation.mutate()
    } else {
      if (!bulkDept && !bulkRole) return setError('Sélectionnez au moins un filtre')
      bulkMutation.mutate()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">Assigner la formation</h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[280px]">{moduleTitle}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Tabs — only show group tab if canBulk */}
        {canBulk && (
          <div className="flex border-b border-gray-100 px-5 gap-4">
            {(['individual', 'group'] as AssignTab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t === 'individual' ? 'Individuel' : 'Groupe / Département'}
              </button>
            ))}
          </div>
        )}

        {/* INDIVIDUAL tab */}
        {tab === 'individual' && (
          <>
            <div className="px-5 py-3 border-b border-gray-100">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Rechercher un utilisateur..." value={search}
                  onChange={e => setSearch(e.target.value)} className="input pl-9 text-sm" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
              {users.map(u => (
                <button key={u.id} onClick={() => toggle(u.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${selected.has(u.id) ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${selected.has(u.id) ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {selected.has(u.id) ? <CheckCircle2 size={16} /> : `${u.firstName[0]}${u.lastName[0]}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{u.firstName} {u.lastName}</div>
                    <div className="text-xs text-gray-400 truncate">{u.department?.name ?? '—'}</div>
                  </div>
                </button>
              ))}
              {users.length === 0 && <p className="text-center text-xs text-gray-400 py-6">Aucun utilisateur trouvé</p>}
            </div>
          </>
        )}

        {/* GROUP tab */}
        {tab === 'group' && (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <p className="text-xs text-gray-500">Assigner à tous les utilisateurs correspondant aux filtres ci-dessous.</p>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Département</label>
              <select value={bulkDept} onChange={e => setBulkDept(e.target.value)} className="input text-sm">
                <option value="">Tous les départements</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name} {d._count ? `(${d._count.users})` : ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Rôle</label>
              <select value={bulkRole} onChange={e => setBulkRole(e.target.value)} className="input text-sm">
                <option value="">Tous les rôles</option>
                <option value="AGENT">Agent</option>
                <option value="SUPERVISOR">Superviseur</option>
                <option value="MANAGER">Manager</option>
                <option value="HR">RH</option>
                <option value="PLATFORM_MANAGER">Gestionnaire plateforme</option>
              </select>
            </div>

          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Date limite</label>
            <input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} className="input text-sm" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          {successMsg && <p className="text-xs text-green-600 font-medium">{successMsg}</p>}
          <button onClick={handleSubmit} disabled={isPending}
            className="btn-primary w-full disabled:opacity-50">
            {isPending ? 'Assignation...' : tab === 'group' ? 'Assigner au groupe' : `Assigner à ${selected.size} utilisateur${selected.size > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
