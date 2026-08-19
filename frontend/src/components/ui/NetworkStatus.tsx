import { useState, useEffect } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import clsx from 'clsx'

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [showBanner, setShowBanner] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      if (wasOffline) {
        setShowBanner(true)
        setTimeout(() => setShowBanner(false), 3000)
      }
    }
    const handleOffline = () => {
      setIsOnline(false)
      setWasOffline(true)
      setShowBanner(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [wasOffline])

  if (!showBanner) return null

  return (
    <div
      className={clsx(
        'fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium transition-all duration-300 animate-slide-up safe-top',
        isOnline
          ? 'bg-success-500 text-white'
          : 'bg-danger-500 text-white'
      )}
    >
      {isOnline ? (
        <>
          <Wifi size={16} />
          <span>Connexion rétablie</span>
        </>
      ) : (
        <>
          <WifiOff size={16} />
          <span>Pas de connexion internet</span>
        </>
      )}
    </div>
  )
}
