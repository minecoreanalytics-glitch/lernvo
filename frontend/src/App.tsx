import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
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

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user)
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const user = useAuthStore(s => s.user)
  if (!user || !roles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
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
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<SmartDashboard />} />
        <Route path="departments" element={<DepartmentsPage />} />
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
