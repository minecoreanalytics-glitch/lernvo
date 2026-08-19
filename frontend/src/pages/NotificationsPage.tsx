import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Bell, Check, Archive, Trash2 } from 'lucide-react'
import { api } from '../utils/api'

type Notification = {
  id: string
  title: string
  message: string
  type: string
  icon: string
  isRead: boolean
  createdAt: string
  actionUrl?: string
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const { data: response, isLoading, refetch } = useQuery<{ notifications: Notification[] }>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data)
  })

  const notifications = response?.notifications || []
  const unreadCount = notifications.filter(n => !n.isRead).length

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`, {}),
    onSuccess: () => refetch()
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/archive`, {}),
    onSuccess: () => refetch()
  })

  const deleteAllMutation = useMutation({
    mutationFn: () => api.delete('/notifications', {}),
    onSuccess: () => refetch()
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch('/notifications/mark-all-read', {}),
    onSuccess: () => refetch()
  })

  const filtered = filter === 'unread'
    ? notifications.filter(n => !n.isRead)
    : notifications

  const typeColors: Record<string, string> = {
    ASSIGNMENT: 'bg-blue-100 text-blue-700',
    COMPLETION: 'bg-green-100 text-green-700',
    DEADLINE: 'bg-red-100 text-red-700',
    ACHIEVEMENT: 'bg-purple-100 text-purple-700',
    REMINDER: 'bg-orange-100 text-orange-700',
  }

  const typeIcons: Record<string, React.ReactNode> = {
    ASSIGNMENT: '📚',
    COMPLETION: '✅',
    DEADLINE: '⏰',
    ACHIEVEMENT: '🏆',
    REMINDER: '🔔',
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-400">Chargement des notifications...</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-100 flex items-center justify-center">
            <Bell size={20} className="text-primary-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-500">{unreadCount} non lu{unreadCount !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="text-xs px-3 py-2 rounded-lg text-primary-700 hover:bg-primary-50 transition-colors disabled:opacity-50"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      {notifications.length > 0 && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Tous ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'unread'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Non lus ({unreadCount})
          </button>
        </div>
      )}

      {/* Notifications List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Bell size={48} className="mx-auto text-gray-200 mb-4" />
          <p className="text-gray-400 mb-2">
            {filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
          </p>
          {notifications.length > 0 && filter === 'unread' && (
            <button
              onClick={() => setFilter('all')}
              className="text-sm text-primary-700 hover:underline"
            >
              Afficher tout
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((notif, idx) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`p-4 rounded-lg border transition-all ${
                notif.isRead
                  ? 'bg-white border-gray-200'
                  : 'bg-primary-50 border-primary-200'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="text-2xl mt-1">
                  {typeIcons[notif.type] || '📢'}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-semibold ${notif.isRead ? 'text-gray-700' : 'text-gray-900'}`}>
                        {notif.title}
                      </h3>
                      {!notif.isRead && (
                        <div className="w-2 h-2 bg-primary-500 rounded-full shrink-0" />
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {new Date(notif.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>

                  <p className={`text-sm ${notif.isRead ? 'text-gray-600' : 'text-gray-700'}`}>
                    {notif.message}
                  </p>

                  {/* Type badge */}
                  <div className="mt-2 inline-flex">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${typeColors[notif.type] || 'bg-gray-100 text-gray-700'}`}>
                      {notif.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {!notif.isRead && (
                    <button
                      onClick={() => markReadMutation.mutate(notif.id)}
                      disabled={markReadMutation.isPending}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                      title="Marquer comme lu"
                    >
                      <Check size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => archiveMutation.mutate(notif.id)}
                    disabled={archiveMutation.isPending}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                    title="Archiver"
                  >
                    <Archive size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Clear all button */}
      {notifications.length > 0 && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={() => {
              if (window.confirm('Supprimer toutes les notifications ?')) {
                deleteAllMutation.mutate()
              }
            }}
            disabled={deleteAllMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 text-sm"
          >
            <Trash2 size={16} />
            Supprimer toutes les notifications
          </button>
        </div>
      )}
    </div>
  )
}
