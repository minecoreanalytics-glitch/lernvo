import clsx from 'clsx'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular' | 'card'
  width?: string | number
  height?: string | number
  lines?: number
}

export function Skeleton({ className, variant = 'text', width, height, lines = 1 }: SkeletonProps) {
  const style = { width, height }

  if (variant === 'card') {
    return (
      <div className={clsx('bg-white rounded-2xl border border-gray-200 p-4 animate-pulse', className)}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-200 rounded-full w-3/4" />
            <div className="h-2.5 bg-gray-200 rounded-full w-1/2" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-2.5 bg-gray-200 rounded-full w-full" />
          <div className="h-2.5 bg-gray-200 rounded-full w-5/6" />
          <div className="h-2.5 bg-gray-200 rounded-full w-2/3" />
        </div>
        <div className="mt-4 h-2 bg-gray-200 rounded-full w-full" />
      </div>
    )
  }

  if (variant === 'circular') {
    return (
      <div
        className={clsx('rounded-full bg-gray-200 animate-pulse', className)}
        style={style}
      />
    )
  }

  if (variant === 'rectangular') {
    return (
      <div
        className={clsx('rounded-xl bg-gray-200 animate-pulse', className)}
        style={style}
      />
    )
  }

  // text variant — can render multiple lines
  return (
    <div className={clsx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 bg-gray-200 rounded-full animate-pulse"
          style={{
            width: i === lines - 1 && lines > 1 ? '60%' : width ?? '100%',
            height,
          }}
        />
      ))}
    </div>
  )
}

/** Full page skeleton for loading states */
export function PageSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Title */}
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width={40} height={40} />
        <Skeleton lines={2} className="flex-1" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} variant="rectangular" className="h-20" />
        ))}
      </div>

      {/* Cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    </div>
  )
}

/** Module card skeleton */
export function ModuleCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 animate-pulse">
      <Skeleton variant="rectangular" className="h-32 mb-3" />
      <Skeleton className="mb-2" width="70%" />
      <Skeleton lines={2} />
      <div className="mt-3 flex items-center gap-2">
        <Skeleton variant="rectangular" className="h-6 w-16" />
        <Skeleton variant="rectangular" className="h-6 w-20" />
      </div>
    </div>
  )
}
