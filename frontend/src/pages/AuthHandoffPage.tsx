import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import axios from 'axios'
import { useAuthStore } from '../store/auth'
import BrandMark from '../components/BrandMark'

/**
 * Arrivée sur <slug>.lernvo.com après une connexion faite sur l'apex.
 * Le jeton de rafraîchissement est dans le fragment d'URL : on l'échange ici contre une session
 * complète — /auth/refresh est verrouillé sur l'hôte, donc un jeton d'une autre entreprise est
 * refusé — puis on efface l'URL pour qu'il ne reste ni dans l'historique ni dans un partage.
 */
export default function AuthHandoffPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const [failed, setFailed] = useState(false)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const token = decodeURIComponent(window.location.hash.slice(1))
    window.history.replaceState(null, '', '/auth/handoff')
    if (!token) { navigate('/login', { replace: true }); return }
    ;(async () => {
      try {
        const { data } = await axios.post('/api/auth/refresh', { refreshToken: token })
        const me = await axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${data.accessToken}` } })
        setAuth(me.data, data.accessToken, data.refreshToken)
        navigate('/dashboard', { replace: true })
      } catch {
        setFailed(true)
      }
    })()
  }, [navigate, setAuth])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 text-gray-700">
      <BrandMark size={44} />
      {failed ? (
        <>
          <p className="text-sm">La connexion n'a pas pu être transférée.</p>
          <button onClick={() => navigate('/login', { replace: true })} className="btn-primary px-4 py-2 text-sm">Se reconnecter</button>
        </>
      ) : (
        <p className="flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Ouverture de votre espace…</p>
      )}
    </div>
  )
}
