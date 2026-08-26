import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { useBranding } from './hooks/useBranding'
import { api } from './utils/api'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import AuthHandoffPage from './pages/AuthHandoffPage'
const LandingPage = lazy(() => import('./pages/LandingPage'))
const PlatformPage = lazy(() => import('./pages/PlatformPage'))
const SolutionPage = lazy(() => import('./pages/SolutionPage'))
const AiPage = lazy(() => import('./pages/AiPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'))
const ModulesPage = lazy(() => import('./pages/ModulesPage'))
const ModuleDetailPage = lazy(() => import('./pages/ModuleDetailPage'))
const QuizPage = lazy(() => import('./pages/QuizPage'))
const CareerPage = lazy(() => import('./pages/CareerPage'))
const KnowledgePage = lazy(() => import('./pages/KnowledgePage'))
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'))
const AdminContentPage = lazy(() => import('./pages/admin/AdminContentPage'))
const AIGeneratorPage = lazy(() => import('./pages/admin/AIGeneratorPage'))
const CertificatesPage = lazy(() => import('./pages/CertificatesPage'))
const DepartmentsPage = lazy(() => import('./pages/DepartmentsPage'))
const AssignmentsPage = lazy(() => import('./pages/AssignmentsPage'))
const TeamPage = lazy(() => import('./pages/TeamPage'))
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage'))
const AnalyticsPage = lazy(() => import('./pages/admin/AnalyticsPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const TenantsPage = lazy(() => import('./pages/admin/TenantsPage'))
const ApprovalsPage = lazy(() => import('./pages/admin/ApprovalsPage'))
const HrIntegrationsPage = lazy(() => import('./pages/admin/HrIntegrationsPage'))
const InsightsPage = lazy(() => import('./pages/admin/InsightsPage'))
const PricingPage = lazy(() => import('./pages/PricingPage'))
const AnnouncementsPage = lazy(() => import('./pages/AnnouncementsPage'))

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, refreshToken, clearAuth } = useAuthStore()
  const { isTenantHost, baseDomain, isLoading } = useBranding()
  // Session d'un employé ouverte sur l'apex (lernvo.com) : son espace est <slug>.lernvo.com.
  // On lui passe le relais avec le jeton déjà en poche et on nettoie l'apex.
  useEffect(() => {
    if (!user || isLoading || isTenantHost || user.role === 'SUPER_ADMIN' || !refreshToken) return
    if (window.location.hostname === 'localhost') return
    api.get('/auth/me').then(({ data }) => {
      if (!data.tenantSlug) return
      const target = `${window.location.protocol}//${data.tenantSlug}.${baseDomain}/auth/handoff#${encodeURIComponent(refreshToken)}`
      clearAuth()
      window.location.replace(target)
    }).catch(() => {})
  }, [user, refreshToken, isLoading, isTenantHost, baseDomain, clearAuth])
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const user = useAuthStore(s => s.user)
  if (!user || !roles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

/** Apex `/`: marketing landing for visitors; tenant subdomains go straight to the branded login. */
function Home() {
  const user = useAuthStore(s => s.user)
  const { isTenantHost, isLoading } = useBranding()
  if (user) return <Navigate to="/dashboard" replace />
  if (isLoading) return null
  if (isTenantHost) return <Navigate to="/login" replace />
  return <LandingPage />
}

function SmartDashboard() {
  const user = useAuthStore(s => s.user)
  // Only PLATFORM_MANAGER gets the admin-only dashboard (they're not employees)
  if (user?.role === 'PLATFORM_MANAGER') return <AdminDashboardPage />
  // Everyone else (HR, MANAGER, SUPERVISOR, AGENT) = employees who take training
  return <DashboardPage />
}

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-primary-200 border-t-primary-700 animate-spin" /></div>}>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/platform" element={<PlatformPage />} />
      <Route path="/ai" element={<AiPage />} />
      <Route path="/solutions/:slug" element={<SolutionPage />} />
      <Route path="/platform/capabilities/:slug" element={<SolutionPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/auth/handoff" element={<AuthHandoffPage />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="dashboard" element={<SmartDashboard />} />
        <Route path="departments" element={<DepartmentsPage />} />
        <Route path="tarifs" element={<PricingPage />} />
        <Route path="actualites" element={<AnnouncementsPage />} />
        <Route path="modules" element={<ModulesPage />} />
        <Route path="modules/:id" element={<ModuleDetailPage />} />
        <Route path="modules/:moduleId/quiz/:quizId" element={<QuizPage />} />
        <Route path="career" element={<CareerPage />} />
        <Route path="kb" element={<KnowledgePage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="assignments" element={<AssignmentsPage />} />
        <Route path="team" element={
          <RequireRole roles={['PLATFORM_MANAGER', 'HR', 'MANAGER', 'SUPERVISOR']}>
            <TeamPage />
          </RequireRole>
        } />
        <Route path="certificates" element={<CertificatesPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="admin/ai" element={
          <RequireRole roles={['PLATFORM_MANAGER', 'HR']}>
            <AIGeneratorPage />
          </RequireRole>
        } />
        <Route path="admin/users" element={
          <RequireRole roles={['PLATFORM_MANAGER', 'HR']}>
            <AdminUsersPage />
          </RequireRole>
        } />
        <Route path="admin/content" element={
          <RequireRole roles={['PLATFORM_MANAGER', 'HR']}>
            <AdminContentPage />
          </RequireRole>
        } />
        <Route path="admin/approvals" element={
          <RequireRole roles={['PLATFORM_MANAGER', 'HR']}>
            <ApprovalsPage />
          </RequireRole>
        } />
        <Route path="admin/integrations" element={
          <RequireRole roles={['PLATFORM_MANAGER']}>
            <HrIntegrationsPage />
          </RequireRole>
        } />
        <Route path="admin/insights" element={
          <RequireRole roles={['PLATFORM_MANAGER', 'HR', 'MANAGER']}>
            <InsightsPage />
          </RequireRole>
        } />
        <Route path="admin/reports" element={
          <RequireRole roles={['PLATFORM_MANAGER', 'HR']}>
            <ReportsPage />
          </RequireRole>
        } />
        <Route path="admin/analytics" element={
          <RequireRole roles={['PLATFORM_MANAGER', 'HR']}>
            <AnalyticsPage />
          </RequireRole>
        } />
        <Route path="admin/tenants" element={
          <RequireRole roles={['SUPER_ADMIN']}>
            <TenantsPage />
          </RequireRole>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </Suspense>
  )
}
