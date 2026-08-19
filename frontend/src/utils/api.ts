import axios from 'axios'
import { useAuthStore } from '../store/auth'

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Single shared promise so concurrent 401s trigger only one refresh request.
// Without this, 6 simultaneous expired-token requests would each call
// POST /api/auth/refresh, the first invalidates the others → spurious logouts.
let refreshPromise: Promise<string> | null = null

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const { refreshToken, setAuth, clearAuth, user } = useAuthStore.getState()
      if (!refreshToken) {
        clearAuth()
        window.location.href = '/login'
        return Promise.reject(error)
      }
      try {
        if (!refreshPromise) {
          refreshPromise = axios.post('/api/auth/refresh', { refreshToken })
            .then(({ data }) => {
              if (user) setAuth(user, data.accessToken, refreshToken)
              return data.accessToken as string
            })
            .finally(() => { refreshPromise = null })
        }
        const accessToken = await refreshPromise
        original.headers.Authorization = `Bearer ${accessToken}`
        return api(original)
      } catch {
        clearAuth()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(' ')
