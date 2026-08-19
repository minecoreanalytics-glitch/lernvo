import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  setAuth: (user: User, accessToken: string, refreshToken: string) => void
  updateUser: (user: Partial<User>) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      updateUser: (partial) => set((s) => ({ user: s.user ? { ...s.user, ...partial } : null })),
      clearAuth: () => {
        set({ user: null, accessToken: null, refreshToken: null })
        // Purge PWA runtime caches so the next user on a shared device never sees cached API responses
        if (typeof caches !== 'undefined') caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {})
      }
    }),
    { name: 'lernvo-auth', partialize: (s) => ({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken }) }
  )
)
