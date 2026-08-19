import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import DashboardPage from './pages/DashboardPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import ModulesPage from './pages/ModulesPage'
import ModuleDetailPage from './pages/ModuleDetailPage'
import QuizPage from './pages/QuizPage'
import CareerPage from './pages/CareerPage'
import KnowledgePage from './pages/KnowledgePage'
import LeaderboardPage from './pages/LeaderboardPage'
import ProfilePage from './pages/ProfilePage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminContentPage from './pages/admin/AdminContentPage'
import AIGeneratorPage from './pages/admin/AIGeneratorPage'
import CertificatesPage from './pages/CertificatesPage'
import DepartmentsPage from './pages/DepartmentsPage'
import AssignmentsPage from './pages/AssignmentsPage'
import TeamPage from './pages/TeamPage'
import ReportsPage from './pages/admin/ReportsPage'
import AnalyticsPage from './pages/admin/AnalyticsPage'
import NotificationsPage from './pages/NotificationsPage'
import TenantsPage from './pages/admin/TenantsPage'
import ApprovalsPage from './pages/admin/ApprovalsPage'

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
  )
}
