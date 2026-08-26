import { Link } from 'react-router-dom'
import { Tag, ChevronRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../utils/api'

const brandLabel = (b: string) => b.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())

type PricingAlert = {
  id: string
  brand: string
  summary: string
  uploadId: string
  createdAt: string
  upload: {
    changeCount: number
    fileName: string
  }
}

export default function PricingAlertsBanner() {
  const { data } = useQuery<{ alerts: PricingAlert[] }>({
    queryKey: ['pricing-alerts'],
    queryFn: () => api.get('/pricing/alerts').then(r => r.data),
    refetchInterval: 60_000
  })

  const alerts = data?.alerts ?? []
  if (alerts.length === 0) return null

  return (
    <div className="space-y-2">
      {alerts.map(alert => (
        <Link
          key={alert.id}
          to={`/tarifs?brand=${encodeURIComponent(alert.brand)}&upload=${alert.uploadId}`}
          className="block card p-4 border-l-4 border-l-amber-400 bg-amber-50/50 hover:bg-amber-50 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <Tag size={16} className="text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-amber-800">
                Mise à jour des tarifs — {brandLabel(alert.brand)}
              </div>
              <pre className="text-xs text-amber-700 mt-1 whitespace-pre-wrap font-sans line-clamp-3">
                {alert.summary}
              </pre>
              <div className="text-[10px] text-amber-500 mt-1">
                {new Date(alert.createdAt).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </div>
            </div>
            <ChevronRight size={16} className="text-amber-400 shrink-0 mt-1" />
          </div>
        </Link>
      ))}
    </div>
  )
}
