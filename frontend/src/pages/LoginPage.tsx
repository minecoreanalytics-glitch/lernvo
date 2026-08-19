import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Loader2, GraduationCap } from 'lucide-react'
import { useBranding } from '../hooks/useBranding'
import { useAuthStore } from '../store/auth'
import { api } from '../utils/api'

export default function LoginPage() {
  const branding = useBranding()
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { data } = await api.post('/auth/login', { email, password })
      setAuth(data.user, data.accessToken, data.refreshToken)
      navigate('/dashboard')
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Identifiants incorrects')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col items-center justify-center p-4">
      {/* Subtle top accent */}
      <div className="fixed top-0 inset-x-0 h-1 bg-gradient-to-r from-primary-700 via-primary-500 to-teal-500" />

      <div className="w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.displayName} className="h-16 max-w-[220px] object-contain mb-4" />
          ) : (
            <div className="w-16 h-16 rounded-3xl bg-primary-700 flex items-center justify-center shadow-card-md mb-4">
              <GraduationCap size={28} className="text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{branding.displayName}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {branding.isTenantHost ? `Plateforme de formation · ${branding.platformName}` : 'Plateforme de formation'}
          </p>
        </div>

        {/* Card */}
        <div className="card p-6 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Adresse email</label>
              <input
                type="email" className="input"
                placeholder="prenom.nom@entreprise.com"
                value={email} onChange={e => setEmail(e.target.value)}
                required autoFocus
              />
            </div>

            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'} className="input pr-10"
                  placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-danger-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button type="submit" className="btn-full" disabled={loading}>
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>

            <p className="text-sm text-gray-500 text-center">
              Pas encore de compte ?{' '}
              <Link to="/signup" className="text-primary-700 hover:underline font-medium">
                Créer un compte entreprise
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
