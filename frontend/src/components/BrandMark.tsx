import { useId } from 'react'

/**
 * Lernvo brand mark — a briefcase whose closure line carries the clasp check:
 * the object of the work, validated. The closure is knocked out (mask), so the
 * mark keeps working on any ground.
 *
 * tone:
 *  - "chip"  dark rounded square + amber mark (default on light UI, and the app icon)
 *  - "amber" flat amber mark, for dark grounds
 *  - "navy"  flat navy mark, for paper and documents
 *  - "white" flat white mark, for navy/photo grounds
 * variant "compact" drops the closure line and keeps one bold check — use below ~20px.
 */
export type BrandTone = 'chip' | 'amber' | 'navy' | 'white'

const AMBER = '#F5B700'
const DARK = '#0E1116'
const NAVY = '#163A6B'

const HANDLE = 'M25 11h14a5 5 0 0 1 5 5v4h-5.5v-2.5a1.5 1.5 0 0 0-1.5-1.5h-10a1.5 1.5 0 0 0-1.5 1.5V20H20v-4a5 5 0 0 1 5-5z'
const CLOSURE_FULL = 'M5 35H16M35 35H59 M17.5 35l5 5 16-12.5'
const CLOSURE_COMPACT = 'M18 36.5l7.5 7.5L47 28'

export default function BrandMark({
  size = 36,
  tone = 'chip',
  compact,
  className,
  title = 'Lernvo',
}: {
  size?: number
  tone?: BrandTone
  compact?: boolean
  className?: string
  title?: string
}) {
  const maskId = useId()
  // La variante 3 (fermoir-coche) est la marque. La variante simplifiée n'intervient que
  // lorsque la ligne de fermeture ne peut plus se lire — sous ~22 px — ou si on la force.
  const useCompact = compact ?? size < 22
  const fill = tone === 'navy' ? NAVY : tone === 'white' ? '#FFFFFF' : AMBER

  const briefcase = (
    <>
      <mask id={maskId}>
        <rect width="64" height="64" fill="#000" />
        <g fill="#fff">
          <path d={HANDLE} />
          <rect x="5" y="20" width="54" height="33" rx="5" />
        </g>
        <path
          d={useCompact ? CLOSURE_COMPACT : CLOSURE_FULL}
          fill="none"
          stroke="#000"
          strokeWidth={useCompact ? 6.4 : 5}
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
      </mask>
      <rect width="64" height="64" fill={fill} mask={`url(#${maskId})`} />
    </>
  )

  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} role="img" aria-label={title}>
      {tone === 'chip' ? (
        <>
          <rect width="64" height="64" rx="14" fill={DARK} />
          <g transform="translate(8.48 8.48) scale(0.735)">{briefcase}</g>
        </>
      ) : (
        briefcase
      )}
    </svg>
  )
}
