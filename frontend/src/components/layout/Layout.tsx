import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'
import TopBar from './TopBar'
import NetworkStatus from '../ui/NetworkStatus'
import PwaInstallPrompt from '../ui/PwaInstallPrompt'
import WelcomeModal from '../WelcomeModal'
import ChatBot from '../ChatBot'
import { useAnalytics } from '../../hooks/useAnalytics'
import { useAuthStore } from '../../store/auth'

export default function Layout() {
  const { user } = useAuthStore()
  const isPlatformAdmin = user?.role === 'PLATFORM_MANAGER'
  useAnalytics() // démarre la session + tracking pages

  return (
    <div className="flex h-dvh overflow-hidden bg-gray-50">
      {/* Network status banner */}
      <NetworkStatus />

      {/* PWA install prompt (mobile only) */}
      <PwaInstallPrompt />

      {/* Daily welcome summary — employees only */}
      {!isPlatformAdmin && <WelcomeModal />}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-white border-r border-gray-200">
        <Sidebar />
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 lg:pb-6" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="w-full max-w-4xl mx-auto px-4 sm:px-5 lg:px-6 pt-5 sm:pt-6 pb-4 sm:pb-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />

      {/* AI chatbot — available on all pages */}
      <ChatBot />
    </div>
  )
}
