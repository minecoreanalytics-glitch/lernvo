import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Award, Download, ExternalLink, Search } from 'lucide-react'
import { useState } from 'react'
import { api } from '../utils/api'

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

type Certificate = {
  id: string
  title: string
  certNumber: string
  score: number | null
  issuedAt: string
  expiresAt: string | null
  downloadUrl: string | null
  module?: { id: string; title: string } | null
  path?: { id: string; title: string } | null
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function CertificatesPage() {
  const [verifyNumber, setVerifyNumber] = useState('')
  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean; recipientName: string; title: string; issuedAt: string; score?: number
  } | null>(null)
  const [verifyError, setVerifyError] = useState('')

  const { data: certificates = [], isLoading } = useQuery<Certificate[]>({
    queryKey: ['my-certificates'],
    queryFn: () => api.get('/certificates').then(r => r.data)
  })

  async function handleVerify() {
    if (!verifyNumber.trim()) return
    setVerifyError('')
    setVerifyResult(null)
    try {
      const { data } = await api.get(`/certificates/verify/${verifyNumber.trim()}`)
      setVerifyResult(data)
    } catch {
      setVerifyError('Certificat non trouvé')
    }
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">

      {/* Header */}
      <motion.div variants={item} className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-yellow-100 flex items-center justify-center">
          <Award size={20} className="text-yellow-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Mes Certificats</h1>
          <p className="text-xs text-gray-500">Certificats obtenus pour vos formations complétées</p>
        </div>
      </motion.div>

      {/* Certificates list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : certificates.length === 0 ? (
        <motion.div variants={item} className="card p-10 text-center">
          <Award size={48} className="mx-auto mb-4 text-gray-200" />
          <p className="text-sm text-gray-500 font-medium">Aucun certificat pour le moment</p>
          <p className="text-xs text-gray-400 mt-1">Complétez une formation pour obtenir votre premier certificat</p>
        </motion.div>
      ) : (
        <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {certificates.map(cert => (
            <div key={cert.id} className="card p-4 border-l-4 border-l-yellow-400 hover:shadow-card-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-800 line-clamp-1">{cert.title}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {cert.module ? '📚 Formation' : '🛤️ Parcours'} · {formatDate(cert.issuedAt)}
                  </div>
                </div>
                <span className="text-[10px] font-mono text-primary-500 bg-primary-50 px-2 py-0.5 rounded-full shrink-0">
                  {cert.certNumber}
                </span>
              </div>

              {cert.score !== null && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="progress-track h-1.5 flex-1">
                    <div className="progress-fill" style={{ width: `${cert.score}%` }} />
                  </div>
                  <span className="text-xs font-bold text-primary-600">{Math.round(cert.score)}%</span>
                </div>
              )}

              <div className="flex items-center gap-2 mt-3">
                {cert.downloadUrl && (
                  <a href={cert.downloadUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-medium text-primary-600 bg-primary-50 px-2.5 py-1.5 rounded-lg hover:bg-primary-100 transition-colors">
                    <Download size={12} /> Télécharger
                  </a>
                )}
                <a href={`/api/certificates/${cert.id}/download`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <ExternalLink size={12} /> Ouvrir
                </a>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Verify section */}
      <motion.div variants={item} className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Search size={14} className="text-gray-400" /> Vérifier un certificat
        </h2>
        <div className="flex gap-2">
          <input
            value={verifyNumber}
            onChange={e => setVerifyNumber(e.target.value.toUpperCase())}
            placeholder="LERNVO-2026-XXXXX"
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
            onKeyDown={e => e.key === 'Enter' && handleVerify()}
          />
          <button onClick={handleVerify} className="btn-primary px-4 text-sm">
            Vérifier
          </button>
        </div>

        {verifyResult && (
          <div className={`mt-3 p-3 rounded-xl ${verifyResult.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center gap-2">
              {verifyResult.valid ? (
                <span className="text-green-600 text-sm font-semibold">✅ Certificat valide</span>
              ) : (
                <span className="text-red-600 text-sm font-semibold">❌ Certificat expiré</span>
              )}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              <strong>{verifyResult.recipientName}</strong> · {verifyResult.title} · {formatDate(verifyResult.issuedAt)}
              {verifyResult.score && ` · Score: ${Math.round(verifyResult.score)}%`}
            </div>
          </div>
        )}

        {verifyError && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200">
            <span className="text-red-600 text-sm font-semibold">❌ {verifyError}</span>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
