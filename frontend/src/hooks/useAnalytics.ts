import { useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../utils/api'

const SESSION_KEY = 'lernvo_session_id'

function getDevice(): string {
  const w = window.innerWidth
  if (w < 768) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

export function useAnalytics() {
  const location = useLocation()
  const sessionIdRef = useRef<string | null>(sessionStorage.getItem(SESSION_KEY))
  const lastPageRef = useRef<string>(location.pathname)

  const logEvent = useCallback(async (
    event: string,
    referenceId?: string,
    metadata?: Record<string, unknown>
  ) => {
    try {
      await api.post('/analytics/event', {
        sessionId: sessionIdRef.current,
        event,
        page: location.pathname,
        referenceId,
        metadata
      })
    } catch { /* fire-and-forget */ }
  }, [location.pathname])

  // Start session on mount
  useEffect(() => {
    if (sessionIdRef.current) return // already have a session this tab
    const start = async () => {
      try {
        const res = await api.post('/analytics/session/start', {
          entryPage: location.pathname,
          device: getDevice()
        })
        sessionIdRef.current = res.data.sessionId
        sessionStorage.setItem(SESSION_KEY, res.data.sessionId)
      } catch { /* ignore */ }
    }
    start()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Track page views on navigation
  useEffect(() => {
    if (!sessionIdRef.current) return
    if (location.pathname === lastPageRef.current) return
    lastPageRef.current = location.pathname
    api.post('/analytics/event', {
      sessionId: sessionIdRef.current,
      event: 'PAGE_VIEW',
      page: location.pathname
    }).catch(() => {})
  }, [location.pathname])

  // End session on tab close / navigate away
  useEffect(() => {
    const handleUnload = () => {
      const sid = sessionIdRef.current
      if (!sid) return
      // Use sendBeacon so it fires even during page close
      const payload = JSON.stringify({ sessionId: sid, exitPage: location.pathname })
      const baseUrl = (api.defaults.baseURL ?? '').replace(/\/$/, '')
      navigator.sendBeacon(`${baseUrl}/analytics/session/end`, new Blob([payload], { type: 'application/json' }))
      sessionStorage.removeItem(SESSION_KEY)
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [location.pathname])

  return { logEvent, sessionId: sessionIdRef.current }
}

// Standalone helpers (used in ModuleDetailPage, etc.)
export async function trackCourseStarted(sessionId: string | null, moduleId: string, page: string) {
  try {
    await api.post('/analytics/event', { sessionId, event: 'COURSE_STARTED', page, referenceId: moduleId })
  } catch { /* ignore */ }
}

export async function trackCourseExited(sessionId: string | null, moduleId: string, page: string) {
  try {
    await api.post('/analytics/event', { sessionId, event: 'COURSE_EXITED', page, referenceId: moduleId })
  } catch { /* ignore */ }
}

export async function trackCourseCompleted(sessionId: string | null, moduleId: string, page: string) {
  try {
    await api.post('/analytics/event', { sessionId, event: 'COURSE_COMPLETED', page, referenceId: moduleId })
  } catch { /* ignore */ }
}

export function getSessionId(): string | null {
  return sessionStorage.getItem(SESSION_KEY)
}
