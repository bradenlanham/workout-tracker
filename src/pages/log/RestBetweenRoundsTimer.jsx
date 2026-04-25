// Batch 44 — Full-screen rest countdown between HYROX rounds (design doc
// §15 + plan B44).
//
// Auto-fires after PostRoundFlash dismisses (or skipped). Same gym-clock
// visual as B43 but counting DOWN from the prescription's `restSec`. Eyebrow
// reads "REST" via GymClock's `mode='rest'`. Bottom buttons: `Skip rest` /
// `Add 30s`. On hit zero → caller's `onComplete` advances to round N+1's
// run leg in HyroxRoundLogger.
//
// Background-survival: parent owns `restEndTimestamp` (absolute ms). On
// reload mid-rest the parent reads the timestamp from `activeSession.hyrox`
// and either passes a fresh remaining count (still resting) or auto-advances
// (already past zero). This component just renders what it's told and ticks
// every 100ms while `restEndTimestamp` is in the future.
//
// Skip / Add 30s are both surfaced via callback props so the parent can
// commit them to the store atomically (Add 30s shifts the timestamp; Skip
// clears it + advances).

import { useEffect, useState } from 'react'
import GymClock from '../../components/GymClock'

const YELLOW_500 = '#EAB308'
const YELLOW_200 = '#FEF08A'

export default function RestBetweenRoundsTimer({
  restEndTimestamp,        // absolute ms — required
  totalRounds,
  nextRoundIdx,
  onSkip,
  onAddSeconds,            // (deltaSec: number) => void
  onComplete,
}) {
  // 100ms tick — mirrors the round-clock tick rate from B43's HyroxRoundLogger.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (typeof restEndTimestamp !== 'number') return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [restEndTimestamp])

  const remainingMs =
    typeof restEndTimestamp === 'number' ? restEndTimestamp - now : 0
  const remainingSec = Math.max(0, remainingMs / 1000)

  // Auto-complete when the countdown crosses zero. We don't fire onComplete
  // synchronously during render — wrap in a useEffect so the parent's
  // setState (advance to next round) can't tangle with our ongoing render.
  useEffect(() => {
    if (typeof onComplete !== 'function') return
    if (typeof restEndTimestamp !== 'number') return
    if (remainingMs <= 0) onComplete()
  }, [remainingMs, restEndTimestamp, onComplete])

  const handleSkip = () => {
    if (typeof onSkip === 'function') onSkip()
  }
  const handleAdd30 = () => {
    if (typeof onAddSeconds === 'function') onAddSeconds(30)
  }

  return (
    <div
      role="dialog"
      aria-label="rest between rounds"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-between text-white text-center"
      style={{
        background: '#000',
        backgroundImage:
          'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(234,179,8,0.18) 0%, rgba(234,179,8,0.08) 35%, rgba(0,0,0,0) 70%)',
        padding: '32px 24px',
      }}
    >
      {/* Top context — yellow chip + round target */}
      <div className="flex flex-col items-center" style={{ gap: 12 }}>
        <div
          className="text-[10px] uppercase tracking-[0.18em] font-bold px-3 py-1 rounded-full"
          style={{
            background: 'rgba(234,179,8,0.16)',
            color: YELLOW_200,
            border: `1px solid rgba(234,179,8,0.45)`,
          }}
        >
          Rest between rounds
        </div>
        {typeof totalRounds === 'number' && typeof nextRoundIdx === 'number' && (
          <div
            className="tabular-nums"
            style={{
              fontSize: 14,
              color: 'rgba(255,255,255,0.7)',
              fontWeight: 500,
            }}
          >
            Round {nextRoundIdx + 1} of {totalRounds} starts soon
          </div>
        )}
      </div>

      {/* Centered gym clock — counts DOWN via remaining seconds */}
      <div className="flex flex-col items-center" style={{ gap: 12 }}>
        <GymClock elapsedSec={remainingSec} mode="rest" />
        <div
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: '0.05em',
          }}
        >
          Walk it off — clock auto-advances at zero
        </div>
      </div>

      {/* Bottom action row — Skip rest + Add 30s */}
      <div className="w-full max-w-md flex" style={{ gap: 10 }}>
        <button
          type="button"
          onClick={handleSkip}
          className="flex-1 rounded-2xl py-4 font-bold text-base active:scale-[0.98] transition-transform"
          style={{
            background: 'rgba(255,255,255,0.08)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.18)',
          }}
        >
          Skip rest
        </button>
        <button
          type="button"
          onClick={handleAdd30}
          className="flex-1 rounded-2xl py-4 font-bold text-base active:scale-[0.98] transition-transform"
          style={{
            background: 'rgba(234,179,8,0.18)',
            color: YELLOW_200,
            border: `1px solid rgba(234,179,8,0.45)`,
          }}
        >
          + 30 sec
        </button>
      </div>
    </div>
  )
}
