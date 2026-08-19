import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Timer, CheckCircle, XCircle, ArrowLeft, RotateCcw, History } from 'lucide-react'
import { api } from '../utils/api'
import type { Quiz, Question } from '../types'

type QuizAttemptSummary = {
  id: string
  score: number
  passed: boolean
  pointsEarned: number
  timeTaken: number | null
  startedAt: string
  completedAt: string | null
}

export default function QuizPage() {
  const { moduleId, quizId } = useParams<{ moduleId: string; quizId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [startTime, setStartTime] = useState(Date.now())
  const [result, setResult] = useState<{ score: number; passed: boolean; pointsEarned: number; answers: Array<{ questionId: string; isCorrect: boolean }> } | null>(null)
  const hasAutoSubmitted = useRef(false)

  const { data: quiz, isLoading, isError, error, refetch } = useQuery<Quiz & { questions: Question[]; canAttempt?: boolean }>({
    queryKey: ['quiz', quizId],
    queryFn: () => api.get(`/quizzes/${quizId}`).then(r => r.data),
    retry: 1
  })

  const { data: attempts = [] } = useQuery<QuizAttemptSummary[]>({
    queryKey: ['quiz-attempts', quizId],
    queryFn: () => api.get(`/quizzes/${quizId}/attempts`).then(r => r.data),
    enabled: !!quizId
  })

  const submitMutation = useMutation({
    mutationFn: (d: { answers: Array<{ questionId: string; selectedOptionId: string }>; timeTaken: number }) =>
      api.post(`/quizzes/${quizId}/submit`, d),
    onSuccess: (res) => {
      setResult(res.data)
      qc.invalidateQueries({ queryKey: ['quiz-attempts', quizId] })
      qc.invalidateQueries({ queryKey: ['quiz', quizId] })
    }
  })

  const handleSubmit = useCallback(() => {
    if (!quiz || submitMutation.isPending) return
    submitMutation.mutate({
      answers: quiz.questions.map(q => ({ questionId: q.id, selectedOptionId: answers[q.id] || '' })),
      timeTaken: Math.round((Date.now() - startTime) / 1000)
    })
  }, [quiz, answers, startTime, submitMutation])

  function handleRetry() {
    setResult(null)
    setAnswers({})
    setCurrent(0)
    setStartTime(Date.now())
    hasAutoSubmitted.current = false
    if (quiz?.timeLimit) setTimeLeft(quiz.timeLimit)
  }

  // Initialize and run countdown timer (timeLimit is in seconds)
  useEffect(() => {
    if (!quiz?.timeLimit) return
    setTimeLeft(quiz.timeLimit)
    const t = setInterval(() => setTimeLeft(p => {
      if (p === null || p <= 1) {
        clearInterval(t)
        return 0
      }
      return p - 1
    }), 1000)
    return () => clearInterval(t)
  }, [quiz?.timeLimit, startTime])

  // Auto-submit when timer reaches 0
  useEffect(() => {
    if (timeLeft === 0 && !hasAutoSubmitted.current && !result) {
      hasAutoSubmitted.current = true
      handleSubmit()
    }
  }, [timeLeft, handleSubmit, result])

  if (isLoading) return <div className="text-center text-gray-400 py-12 text-sm">Chargement du quiz...</div>

  if (isError) {
    const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
    return (
      <div className="text-center py-12 space-y-4 max-w-md mx-auto">
        <p className="text-gray-600 font-medium">Impossible de charger le quiz</p>
        <p className="text-sm text-gray-400">
          {message || 'Erreur serveur. Si le problème persiste, contactez l\'administrateur.'}
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => refetch()} className="btn-primary text-sm">Réessayer</button>
          <button onClick={() => navigate(`/modules/${moduleId}`)} className="btn-outline text-sm inline-flex items-center gap-1.5">
            <ArrowLeft size={14} /> Retour au module
          </button>
        </div>
      </div>
    )
  }

  if (!quiz) return (
    <div className="text-center py-12 space-y-4">
      <p className="text-gray-400">Quiz introuvable ou temporairement inaccessible.</p>
      <button onClick={() => navigate(`/modules/${moduleId}`)} className="btn-outline text-sm inline-flex items-center gap-1.5">
        <ArrowLeft size={14} /> Retour au module
      </button>
    </div>
  )

  const questions = quiz.questions ?? []

  if (questions.length === 0) return (
    <div className="text-center py-12 space-y-4">
      <p className="text-gray-400 text-sm">Ce quiz ne contient pas encore de questions.</p>
      <button onClick={() => navigate(`/modules/${moduleId}`)} className="btn-outline text-sm inline-flex items-center gap-1.5">
        <ArrowLeft size={14} /> Retour au module
      </button>
    </div>
  )

  const q = questions[current]

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  /* ── Results ── */
  if (result) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto space-y-4 py-8">
        <div className={`card p-8 text-center border-2 ${result.passed ? 'border-success-500' : 'border-red-300'}`}>
          <div className="text-6xl mb-4">{result.passed ? '🎉' : '😔'}</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">{result.passed ? 'Réussi !' : 'Essayez encore'}</h2>
          <p className="text-gray-500 text-sm">Score : <span className="font-bold text-gray-800">{result.score.toFixed(0)}%</span> / {quiz.passingScore}% requis</p>

          <div className="grid grid-cols-2 gap-3 mt-6">
            <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-200">
              <div className="text-xl font-bold text-yellow-500">+{result.pointsEarned}</div>
              <div className="text-xs text-gray-400 mt-0.5">points gagnés</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-200">
              <div className="text-xl font-bold text-primary-700">
                {result.answers.filter(a => a.isCorrect).length}/{questions.length}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">bonnes réponses</div>
            </div>
          </div>

          <div className="mt-5 text-left space-y-2 max-h-52 overflow-y-auto">
            {questions.map((question) => {
              const r = result.answers.find(a => a.questionId === question.id)
              return (
                <div key={question.id} className={`flex items-start gap-2 text-sm p-2.5 rounded-xl ${r?.isCorrect ? 'bg-success-50 border border-green-200' : 'bg-danger-50 border border-red-200'}`}>
                  {r?.isCorrect
                    ? <CheckCircle size={14} className="text-success-500 mt-0.5 shrink-0" />
                    : <XCircle size={14} className="text-danger-500 mt-0.5 shrink-0" />}
                  <span className="text-gray-700 text-xs line-clamp-2">{question.text}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Attempts archive */}
        {attempts.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <History size={14} className="text-gray-500" />
              <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wide">Historique des tentatives</h3>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {attempts.map((a, i) => (
                <div key={a.id} className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg ${a.passed ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <span className="text-gray-500">#{attempts.length - i} · {formatDate(a.startedAt)}</span>
                  <span className={`font-semibold ${a.passed ? 'text-green-600' : 'text-red-500'}`}>
                    {a.score.toFixed(0)}% {a.passed ? '✓ Réussi' : '✗ Échoué'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => navigate(`/modules/${moduleId}`)} className="btn-outline flex-1">
            <ArrowLeft size={14} /> Module
          </button>
          {!result.passed && (
            <button onClick={handleRetry} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
              <RotateCcw size={14} /> Réessayer
            </button>
          )}
        </div>
      </motion.div>
    )
  }

  /* ── Quiz already passed ── */
  if (quiz.canAttempt === false && attempts.some(a => a.passed)) {
    return (
      <div className="max-w-md mx-auto space-y-4 py-8">
        <div className="card p-8 text-center border-2 border-success-500">
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Quiz déjà réussi</h2>
          <p className="text-sm text-gray-500">Vous avez validé cet examen final.</p>
        </div>

        {attempts.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <History size={14} className="text-gray-500" />
              <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wide">Historique des tentatives</h3>
            </div>
            <div className="space-y-1.5">
              {attempts.map((a, i) => (
                <div key={a.id} className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg ${a.passed ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <span className="text-gray-500">#{attempts.length - i} · {formatDate(a.startedAt)}</span>
                  <span className={`font-semibold ${a.passed ? 'text-green-600' : 'text-red-500'}`}>
                    {a.score.toFixed(0)}% {a.passed ? '✓ Réussi' : '✗ Échoué'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={() => navigate(`/modules/${moduleId}`)} className="btn-outline w-full">
          <ArrowLeft size={14} /> Retour au module
        </button>
      </div>
    )
  }

  /* ── Quiz ── */
  return (
    <div className="max-w-xl mx-auto space-y-5">
      {attempts.length > 0 && (
        <div className="card p-3 flex items-center gap-2 text-xs text-gray-500">
          <History size={13} />
          <span>{attempts.length} tentative{attempts.length > 1 ? 's' : ''} précédente{attempts.length > 1 ? 's' : ''}</span>
          {attempts[0] && !attempts[0].passed && (
            <span className="ml-auto text-red-500 font-medium">Dernier score : {attempts[0].score.toFixed(0)}%</span>
          )}
        </div>
      )}

      {timeLeft !== null && (
        <div className="sticky top-0 z-50 flex justify-end py-2">
          <div
            className={`
              flex items-center gap-1.5 text-sm font-mono font-bold px-4 py-2 rounded-xl border shadow-sm backdrop-blur-sm
              ${timeLeft < 60
                ? 'bg-danger-50/95 text-danger-500 border-red-300'
                : 'bg-white/95 text-gray-600 border-gray-200'
              }
              ${timeLeft < 30 ? 'animate-pulse' : ''}
            `}
          >
            <Timer size={14} className={timeLeft < 60 ? 'text-danger-500' : ''} />
            {formatTime(timeLeft)}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={() => navigate(`/modules/${moduleId}`)} className="btn-ghost text-sm">
          <ArrowLeft size={14} /> Quitter
        </button>
      </div>

      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span>Question {current + 1} / {questions.length}</span>
          <span>{Object.keys(answers).length} répondu(s)</span>
        </div>
        <div className="progress-track h-2">
          <div className="progress-fill" style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={q.id}
          initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
          className="card p-6 space-y-5">
          {q.imageUrl && <img src={q.imageUrl} className="w-full rounded-xl" alt="" />}
          <h2 className="text-base font-semibold text-gray-900 leading-relaxed">{q.text}</h2>
          <div className="space-y-2.5">
            {q.options.map(opt => {
              const selected = answers[q.id] === opt.id
              return (
                <button key={opt.id} onClick={() => setAnswers(a => ({ ...a, [q.id]: opt.id }))}
                  className={`w-full text-left px-4 py-3.5 rounded-xl border-2 text-sm font-medium transition-all active:scale-[0.99]
                    ${selected
                      ? 'bg-primary-50 border-primary-500 text-primary-800'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'}`}>
                  {opt.text}
                </button>
              )
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="flex gap-3">
        <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
          className="btn-ghost flex-1 disabled:opacity-30">Précédent</button>
        {current < questions.length - 1 ? (
          <button onClick={() => setCurrent(c => c + 1)} disabled={!answers[q.id]}
            className="btn-primary flex-1 disabled:opacity-40">Suivant</button>
        ) : (
          <button onClick={handleSubmit} disabled={!questions.every(qq => answers[qq.id]) || submitMutation.isPending}
            className="btn-primary flex-1 disabled:opacity-40">
            {submitMutation.isPending ? 'Envoi...' : 'Soumettre'}
          </button>
        )}
      </div>
    </div>
  )
}
