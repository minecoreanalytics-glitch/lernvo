import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { api } from '../utils/api'

interface VideoPlayerProps {
  contentId: string
  url: string
  initialProgress?: { watchedSeconds: number; progressPct: number }
}

const PLAYBACK_SPEEDS = [0.5, 1, 1.25, 1.5, 2]

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function VideoPlayer({ contentId, url, initialProgress }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const lastSaveRef = useRef(0)
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [hasStarted, setHasStarted] = useState(false)

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0

  // Save progress to backend
  const saveProgress = useCallback(
    (time: number, dur: number) => {
      if (dur <= 0) return
      const pct = Math.round((time / dur) * 100)
      api.post(`/content/${contentId}/progress`, {
        progressPct: pct,
        watchedSeconds: Math.round(time),
      }).catch(() => {})
    },
    [contentId]
  )

  // Auto-save progress every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const video = videoRef.current
      if (video && !video.paused && video.duration > 0) {
        const now = Date.now()
        if (now - lastSaveRef.current >= 10000) {
          lastSaveRef.current = now
          saveProgress(video.currentTime, video.duration)
        }
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [saveProgress])

  // Resume from initial progress
  useEffect(() => {
    const video = videoRef.current
    if (video && initialProgress && initialProgress.watchedSeconds > 0) {
      const handleCanPlay = () => {
        if (video.currentTime < 1) {
          video.currentTime = initialProgress.watchedSeconds
        }
        video.removeEventListener('loadedmetadata', handleCanPlay)
      }
      video.addEventListener('loadedmetadata', handleCanPlay)
      return () => video.removeEventListener('loadedmetadata', handleCanPlay)
    }
  }, [initialProgress])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return

      const video = videoRef.current
      if (!video) return

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault()
          togglePlay()
          break
        case 'arrowleft':
          e.preventDefault()
          video.currentTime = Math.max(0, video.currentTime - 10)
          break
        case 'arrowright':
          e.preventDefault()
          video.currentTime = Math.min(video.duration, video.currentTime + 10)
          break
        case 'f':
          e.preventDefault()
          toggleFullscreen()
          break
        case 'm':
          e.preventDefault()
          toggleMute()
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Fullscreen change listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setShowControls(true)
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current)
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => setShowControls(false), 3000)
    }
  }, [isPlaying])

  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true)
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current)
    } else {
      resetHideTimer()
    }
  }, [isPlaying, resetHideTimer])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play()
    } else {
      video.pause()
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  const toggleFullscreen = () => {
    const container = containerRef.current
    if (!container) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      container.requestFullscreen()
    }
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current
    const bar = progressBarRef.current
    if (!video || !bar || duration <= 0) return
    const rect = bar.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    video.currentTime = pct * duration
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return
    const val = parseFloat(e.target.value)
    video.volume = val
    setVolume(val)
    if (val === 0) {
      video.muted = true
      setIsMuted(true)
    } else if (isMuted) {
      video.muted = false
      setIsMuted(false)
    }
  }

  const changeSpeed = (speed: number) => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = speed
    setPlaybackSpeed(speed)
    setShowSpeedMenu(false)
  }

  // Video event handlers
  const onPlay = () => {
    setIsPlaying(true)
    setHasStarted(true)
  }
  const onPause = () => {
    setIsPlaying(false)
    // Save progress when pausing
    const video = videoRef.current
    if (video && video.duration > 0) {
      saveProgress(video.currentTime, video.duration)
    }
  }
  const onTimeUpdate = () => {
    const video = videoRef.current
    if (video) setCurrentTime(video.currentTime)
  }
  const onLoadedMetadata = () => {
    const video = videoRef.current
    if (video) setDuration(video.duration)
  }
  const onWaiting = () => setIsBuffering(true)
  const onCanPlay = () => setIsBuffering(false)
  const onError = () => setHasError(true)
  const onEnded = () => {
    setIsPlaying(false)
    const video = videoRef.current
    if (video && video.duration > 0) {
      saveProgress(video.duration, video.duration)
    }
  }

  if (hasError) {
    return (
      <div className="relative w-full bg-gray-900 rounded-2xl shadow-card overflow-hidden" style={{ aspectRatio: '16/9' }}>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3">
          <AlertTriangle size={48} className="text-red-400" />
          <p className="text-sm text-gray-300">Impossible de charger la video</p>
          <button
            onClick={() => {
              setHasError(false)
              videoRef.current?.load()
            }}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
          >
            Reessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black rounded-2xl shadow-card overflow-hidden group"
      style={{ aspectRatio: '16/9' }}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false)
      }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={url}
        className="w-full h-full object-contain"
        onClick={togglePlay}
        onPlay={onPlay}
        onPause={onPause}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onWaiting={onWaiting}
        onCanPlay={onCanPlay}
        onError={onError}
        onEnded={onEnded}
        playsInline
        preload="metadata"
      />

      {/* Buffering spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 size={48} className="text-white animate-spin" />
        </div>
      )}

      {/* Big center play button (before first play) */}
      {!hasStarted && !isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center cursor-pointer" onClick={togglePlay}>
          <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
            <Play size={36} className="text-white ml-1" />
          </div>
        </div>
      )}

      {/* Big center play/pause on click (after started, shown briefly) */}
      {hasStarted && !isPlaying && !isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center cursor-pointer" onClick={togglePlay}>
          <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
            <Play size={36} className="text-white ml-1" />
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-12 pb-3 px-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Progress bar */}
        <div
          ref={progressBarRef}
          className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 group/progress hover:h-2.5 transition-all"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-primary-500 rounded-full relative"
            style={{ width: `${progressPct}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow opacity-0 group-hover/progress:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Bottom controls */}
        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button onClick={togglePlay} className="text-white hover:text-primary-300 transition-colors">
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>

          {/* Volume */}
          <div className="flex items-center gap-1.5 group/vol">
            <button onClick={toggleMute} className="text-white hover:text-primary-300 transition-colors">
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-0 group-hover/vol:w-20 transition-all duration-200 accent-primary-500 h-1 cursor-pointer"
            />
          </div>

          {/* Time */}
          <span className="text-white/80 text-xs font-mono tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Speed */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="text-white/80 hover:text-white text-xs font-medium px-2 py-1 rounded hover:bg-white/10 transition-colors"
            >
              {playbackSpeed}x
            </button>
            {showSpeedMenu && (
              <div className="absolute bottom-full mb-2 right-0 bg-gray-900/95 backdrop-blur-sm rounded-lg shadow-lg py-1 min-w-[80px]">
                {PLAYBACK_SPEEDS.map((speed) => (
                  <button
                    key={speed}
                    onClick={() => changeSpeed(speed)}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                      speed === playbackSpeed
                        ? 'text-primary-400 bg-white/10'
                        : 'text-white/80 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="text-white hover:text-primary-300 transition-colors">
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </div>
    </div>
  )
}
