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
  durationMs = 4500,
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
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center text-white text-center"
      style={{
        background: '#000',
        // Batch 46 — glow recentered to 50% 50% so it sits behind the headline
        // (was 50% 35% which left it visually high). The content stack is
        // also wrapped in a single column so the headline + subheadline +
        // CTA all share the same vertical anchor and don't drift apart.
        backgroundImage:
          'radial-gradient(ellipse 80% 50% at 50% 50%, rgba(234,179,8,0.28) 0%, rgba(234,179,8,0.10) 35%, rgba(0,0,0,0) 75%)',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
      }}
    >
      <style>{KEYFRAMES}</style>

      <div className="flex flex-col items-center px-6 w-full" style={{ maxWidth: 360 }}>
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
              lineHeight: 1.35,
              animation: 'b44-flash-in 0.32s ease-out 0.18s both',
            }}
          >
            {subheadline}
          </div>
        )}

        {/* Batch 46 — primary "Next →" button. Replaces the tiny absolute-
            positioned hint that was hard to find at the bottom of the screen.
            Center-anchored so it stays close to the headline. */}
        <button
          type="button"
          onClick={handleTapAdvance}
          className="mt-10 px-8 py-3 rounded-full text-sm font-bold uppercase tracking-[0.15em] active:scale-[0.97] transition-transform"
          style={{
            background: YELLOW_500,
            color: '#0a0a0a',
            boxShadow: '0 8px 24px rgba(234,179,8,0.4)',
            animation: 'b44-flash-in 0.4s ease-out 0.32s both',
          }}
        >
          Next →
        </button>
        <div
          className="mt-3 text-[10px] uppercase tracking-[0.2em]"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          Rest is next
        </div>
      </div>
    </div>
  )
}
