// Batch 44 — Post-round flash overlay (design doc §14.2 + §15).
//
// Renders for ~2.5s after a non-final round's station leg is stamped Done.
// Centered headline + station-anchored comparison detail per the three
// branches in `computeRoundDelta`:
//
//   - 'round-position' (same template + same station + same round position):
//       headline "Round N done · 5:42"
//       subheadline "0:18 faster than last time"
//
//   - 'station-anchored' (same station, different position OR template —
//     the headline B43 invariant carries through):
//       headline "Round N done · SkiErg 5:34"
//       subheadline "0:14 faster than your last SkiErg"
//
//   - 'cold' (station never logged before):
//       headline "Round N done · 5:42"
//       subheadline null (omitted)
//
// Tap anywhere or wait 2.5s to advance — both call `onAdvance`. Pure
// presentational; the parent (HyroxRoundLogger) owns the phase transition
// and absolute timestamps for background-survival.
//
// Visual identity: yellow-on-black flash matching the HYROX takeover. No
// animation cost — just a fade-in via inline keyframes (matches the
// StartHyroxOverlay headline fade pattern from B42).

import { useEffect } from 'react'

const YELLOW_500 = '#EAB308'
const YELLOW_200 = '#FEF08A'

const KEYFRAMES = `
@keyframes b44-flash-in {
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}
`

export default function PostRoundFlash({
  delta,           // { headline, subheadline, mode, deltaSec } | null
  durationMs = 2500,
  onAdvance,
}) {
  // Auto-advance after `durationMs`. We rely on the parent's
  // flashStartTimestamp to clamp the visible window even on reload — see
  // HyroxRoundLogger's mount-time elapsed check. Here we simply fire onAdvance
  // after the requested duration; if the parent has already decided we're
  // overdue, it advances synchronously without ever rendering this view.
  useEffect(() => {
    if (typeof onAdvance !== 'function') return
    const safeDuration = Math.max(0, durationMs)
    if (safeDuration === 0) {
      onAdvance()
      return
    }
    const id = setTimeout(onAdvance, safeDuration)
    return () => clearTimeout(id)
  }, [onAdvance, durationMs])

  const handleTapAdvance = () => {
    if (typeof onAdvance === 'function') onAdvance()
  }

  const headline = delta?.headline || 'Round done'
  const subheadline = delta?.subheadline || null

  return (
    <div
      role="dialog"
      aria-label="round complete"
      onClick={handleTapAdvance}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center text-white text-center px-6 cursor-pointer"
      style={{
        background: '#000',
        backgroundImage:
          'radial-gradient(ellipse 80% 50% at 50% 35%, rgba(234,179,8,0.28) 0%, rgba(234,179,8,0.10) 35%, rgba(0,0,0,0) 75%)',
      }}
    >
      <style>{KEYFRAMES}</style>

      {/* Yellow context chip echoes the round logger header for continuity. */}
      <div
        className="text-[10px] uppercase tracking-[0.18em] font-bold px-3 py-1 rounded-full mb-6"
        style={{
          background: 'rgba(234,179,8,0.16)',
          color: YELLOW_200,
          border: `1px solid rgba(234,179,8,0.45)`,
          animation: 'b44-flash-in 0.22s ease-out both',
        }}
      >
        Round complete
      </div>

      {/* Headline — primary line in big bright yellow. */}
      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
          color: YELLOW_200,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          maxWidth: 320,
          animation: 'b44-flash-in 0.28s ease-out 0.08s both',
        }}
      >
        {headline}
      </div>

      {/* Subheadline — comparison detail. Hidden on cold-start mode. */}
      {subheadline && (
        <div
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.85)',
            marginTop: 16,
            maxWidth: 320,
            lineHeight: 1.35,
            animation: 'b44-flash-in 0.32s ease-out 0.18s both',
          }}
        >
          {subheadline}
        </div>
      )}

      {/* Quiet hint that we'll advance to rest in a moment. */}
      <div
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
        style={{
          fontSize: 11,
          letterSpacing: '0.18em',
          color: 'rgba(234,179,8,0.7)',
          textTransform: 'uppercase',
          fontWeight: 700,
          animation: 'b44-flash-in 0.4s ease-out 0.32s both',
        }}
      >
        Tap to continue · rest is next
      </div>
    </div>
  )
}
