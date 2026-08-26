import { Link } from 'react-router-dom'
import { Newspaper, ChevronRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../utils/api'

export default function AnnouncementsUnreadBanner() {
  const { data } = useQuery<{ unreadCount: number }>({
    queryKey: ['announcements-unread'],
    queryFn: () => api.get('/announcements/unread-count').then(r => r.data),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true
  })
  const n = data?.unreadCount ?? 0
  if (n <= 0) return null

  return (
    <Link
      to="/actualites"
      className="block card p-4 border-l-4 border-l-primary-500 bg-primary-50/60 hover:bg-primary-50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
          <Newspaper size={16} className="text-primary-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-primary-900">
            {n} actualité{n > 1 ? 's' : ''} non lue{n > 1 ? 's' : ''}
          </div>
          <p className="text-xs text-primary-700 mt-0.5">Ouvertures, partenaires, équipements — à lire maintenant</p>
        </div>
        <ChevronRight size={16} className="text-primary-400 shrink-0" />
      </div>
    </Link>
  )
}
