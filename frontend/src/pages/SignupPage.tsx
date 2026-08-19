import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { api } from '../utils/api'
import BrandMark from '../components/BrandMark'

export default function SignupPage() {
  const [companyName, setCompanyName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(''); setSuccessMessage('')
    try {
      const { data } = await api.post('/auth/signup', {
        companyName,
        firstName,
        lastName,
        email,
        password,
      })
      setSuccessMessage(data.message || 'Votre demande a été enregistrée.')
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Une erreur est survenue. Veuillez réessayer.'
      )
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
          <BrandMark size={64} className="rounded-3xl shadow-card-md mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Lernvo</h1>
          <p className="text-sm text-gray-500 mt-1">Créer un compte entreprise</p>
        </div>

        {/* Card */}
        <div className="card p-6 space-y-5">
          {successMessage ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-4 text-sm text-green-700">
                {successMessage}
              </div>
              <p className="text-sm text-gray-500 text-center">
                Retourner à la{' '}
                <Link to="/login" className="text-primary-700 hover:underline font-medium">
                  page de connexion
                </Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Nom de l'entreprise</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Acme Inc."
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Prénom</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Jean"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Nom</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Dupont"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Adresse email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="jean.dupont@entreprise.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">Mot de passe</label>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div className="bg-danger-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <button type="submit" className="btn-full" disabled={loading}>
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Création...' : 'Créer mon compte'}
              </button>

              <p className="text-sm text-gray-500 text-center">
                Déjà un compte ?{' '}
                <Link to="/login" className="text-primary-700 hover:underline font-medium">
                  Se connecter
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
