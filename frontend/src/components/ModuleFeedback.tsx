import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Star, Send, User as UserIcon } from 'lucide-react'
import { api } from '../utils/api'
import { useAuthStore } from '../store/auth'

interface FeedbackUser {
  id: string
  firstName: string
  lastName: string
  avatarUrl?: string | null
}

interface Feedback {
  id: string
  moduleId: string
  userId: string
  rating: number
  comment?: string | null
  createdAt: string
  user: FeedbackUser
}

interface FeedbackResponse {
  feedbacks: Feedback[]
  averageRating: number | null
  feedbackCount: number
}

function StarRating({
  value,
  onChange,
  readonly = false,
  size = 20,
}: {
  value: number
  onChange?: (rating: number) => void
  readonly?: boolean
  size?: number
}) {
  const [hovered, setHovered] = useState(0)

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = readonly ? star <= Math.round(value) : star <= (hovered || value)
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            className={`transition-colors ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => !readonly && setHovered(0)}
          >
            <Star
              size={size}
              className={filled ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
            />
          </button>
        )
      })}
    </div>
  )
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function ModuleFeedback({ moduleId }: { moduleId: string }) {
  const qc = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')

  const { data, isLoading } = useQuery<FeedbackResponse>({
    queryKey: ['module-feedback', moduleId],
    queryFn: () => api.get(`/modules/${moduleId}/feedback`).then((r) => r.data),
  })

  const submitMutation = useMutation({
    mutationFn: (payload: { rating: number; comment?: string }) =>
      api.post(`/modules/${moduleId}/feedback`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['module-feedback', moduleId] })
      qc.invalidateQueries({ queryKey: ['module', moduleId] })
      setRating(0)
      setComment('')
    },
  })

  const existingFeedback = data?.feedbacks.find((f) => f.userId === currentUser?.id)

  const handleSubmit = () => {
    if (rating < 1) return
    submitMutation.mutate({ rating, comment: comment.trim() || undefined })
  }

  if (isLoading) {
    return (
      <div className="card p-6 animate-pulse space-y-4">
        <div className="h-5 bg-gray-200 rounded w-1/3" />
        <div className="h-20 bg-gray-200 rounded" />
      </div>
    )
  }

  const feedbacks = data?.feedbacks ?? []
  const averageRating = data?.averageRating ?? 0
  const feedbackCount = data?.feedbackCount ?? 0

  return (
    <div className="card overflow-hidden">
      {/* Header with average rating */}
      <div className="p-5 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Avis et notations</h3>
        {feedbackCount > 0 ? (
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">
                {averageRating.toFixed(1)}
              </div>
              <StarRating value={averageRating} readonly size={16} />
              <div className="text-xs text-gray-400 mt-1">
                {feedbackCount} avis
              </div>
            </div>
            {/* Rating distribution would go here in a future enhancement */}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Aucun avis pour le moment. Soyez le premier !</p>
        )}
      </div>

      {/* Submit feedback form (only if user has not already submitted) */}
      {!existingFeedback ? (
        <div className="p-5 border-b border-gray-100 bg-gray-50/50">
          <div className="text-xs font-medium text-gray-600 mb-2">Votre avis</div>
          <div className="flex items-center gap-2 mb-3">
            <StarRating value={rating} onChange={setRating} size={24} />
            {rating > 0 && (
              <span className="text-xs text-gray-400">
                {rating === 1 && 'Mauvais'}
                {rating === 2 && 'Moyen'}
                {rating === 3 && 'Bien'}
                {rating === 4 && 'Tres bien'}
                {rating === 5 && 'Excellent'}
              </span>
            )}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Laissez un commentaire (optionnel)..."
            rows={3}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent resize-none"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSubmit}
              disabled={rating < 1 || submitMutation.isPending}
              className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={14} />
              {submitMutation.isPending ? 'Envoi...' : 'Envoyer'}
            </button>
          </div>
          {submitMutation.isError && (
            <p className="text-xs text-red-500 mt-2">Erreur lors de l'envoi. Veuillez reessayer.</p>
          )}
        </div>
      ) : (
        <div className="p-5 border-b border-gray-100 bg-green-50/50">
          <div className="text-xs font-medium text-green-700 mb-1">Votre avis</div>
          <div className="flex items-center gap-2">
            <StarRating value={existingFeedback.rating} readonly size={18} />
            <span className="text-xs text-gray-500">
              {formatDate(existingFeedback.createdAt)}
            </span>
          </div>
          {existingFeedback.comment && (
            <p className="text-sm text-gray-600 mt-2">{existingFeedback.comment}</p>
          )}
        </div>
      )}

      {/* Feedback list */}
      {feedbacks.length > 0 && (
        <div className="divide-y divide-gray-100">
          {feedbacks.map((fb) => (
            <div key={fb.id} className="p-4 flex gap-3">
              <div className="shrink-0">
                {fb.user.avatarUrl ? (
                  <img
                    src={fb.user.avatarUrl}
                    alt={`${fb.user.firstName} ${fb.user.lastName}`}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <UserIcon size={14} className="text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-gray-800">
                    {fb.user.firstName} {fb.user.lastName}
                  </span>
                  <StarRating value={fb.rating} readonly size={12} />
                  <span className="text-[10px] text-gray-400">{formatDate(fb.createdAt)}</span>
                </div>
                {fb.comment && (
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">{fb.comment}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
