// Batch 43 — HYROX round logger (mockup 3).
//
// Per-leg logger surface routing at /log/hyrox/:exerciseId/round/:roundIdx/:leg.
// Replaces B42's HyroxRoundLoggerStub.jsx. Reads the user's prescription
// off `location.state.prescription` on first mount (delivered by B42's
// Start HYROX overlay), then persists `activeSession.hyrox` to the store
// so reload survives mid-round.
//
// Visual identity: HYROX yellow takeover per §12 (radial-glow background,
// black surround, yellow chrome). Layout per §5.4 + the implementation
// plan B43 spec:
//
//   ┌─────────────────────────────────────┐
//   │ ⏸ pause     HYROX · {round template}    ⋯ │  ← header
//   │                                          │
//   │   ● ● ○ ○                                │  ← round-progress dots
//   │                                          │
//   │   ROUND 2 · STATION                      │
//   │   SkiErg                                 │
//   │   1000m · ⅝ mi                           │
//   │                                          │
//   │       ┌───┐ ┌───┐ ┌───┐                  │
//   │       │ 00│ │ 02│ │ 47│  ← gym clock     │
//   │       │HRS│ │MIN│ │SEC│                  │
//   │       └───┘ └───┘ └───┘                  │
//   │                                          │
//   │   R1: 5:42 (run 4:08 · skierg 5:42)      │  ← recent splits row
//   │                                          │
//   │   ▼ −0:14 vs your last SkiErg at 1000m   │  ← intra-leg comparison
//   │                                          │
//   │   ┌──────────────────────────────────┐   │
//   │   │ ✓ Done · Stamp time              │   │  ← primary CTA (green)
//   │   └──────────────────────────────────┘   │
//   │   Edit time · Skip station               │  ← secondary actions
//   └─────────────────────────────────────────┘
//
// Done flow per implementation plan B43.3 + B44:
// - Done on RUN leg → stamp `timeSec` + `distanceMeters` + `distanceMiles`
//   from prescription, advance to STATION leg of same round (no clock
//   reset; round clock keeps running).
// - Done on STATION leg of NON-final round → stamp `timeSec` + station-
//   specific dimensions, then enter the B44 transient phases: PostRoundFlash
//   for ~2.5s, then RestBetweenRoundsTimer counting down from prescribed
//   `restSec`. Round/leg clocks DO NOT reset until rest hits zero (or skip).
// - Done on STATION leg of FINAL round → stamp the leg, mark hyrox
//   complete, route to the summary at /log/hyrox/:id/summary. Final round
//   skips both flash + rest entirely per design doc §15 + plan B44.
//
// B44 phase state machine on `activeSession.hyrox`:
//   phase: 'logging' (default — render this component's normal layout)
//        | 'flash'   (PostRoundFlash overlay, 2.5s auto-advance)
//        | 'rest'    (RestBetweenRoundsTimer overlay, countdown)
//   flashStartTimestamp: ms — when phase entered 'flash'
//   restEndTimestamp:    ms — absolute target for the countdown (background-survive)
//   restStartTimestamp:  ms — when phase entered 'rest' (B45 reads this for restAfterSec)
//
// Intra-leg comparison band per §14.1: station-anchored. A SkiErg leg's
// reference is every prior SkiErg leg the user has logged, regardless of
// round template OR round position. `buildIntraLegComparison` does the
// matching + pace fallback + cold-start hide.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import useStore from '../../store/useStore'
import GymClock from '../../components/GymClock'
import PostRoundFlash from './PostRoundFlash'
import RestBetweenRoundsTimer from './RestBetweenRoundsTimer'
import {
  buildIntraLegComparison,
  computeRoundDelta,
  formatDuration,
  metersToMiles,
} from '../../utils/helpers'
import { HYROX_STATIONS } from '../../data/hyroxStations'

const FLASH_DURATION_MS = 2500

const YELLOW = '#EAB308'
const YELLOW_BRIGHT = '#FACC15'
const GREEN = '#10B981'

function stationName(stationId) {
  if (!stationId) return null
  return HYROX_STATIONS.find(s => s.id === stationId)?.name || null
}

// Station "primary metric" — what the station's race standard tracks. Used
// to label the leg subtitle. SkiErg + Row + Burpee Broad → distance; Sled
// Push + Sled Pull + Farmers + Sandbag Lunges → distance + weight; Wall
// Balls → reps + weight.
function stationMetric(stationId) {
  const station = HYROX_STATIONS.find(s => s.id === stationId)
  if (!station) return null
  const dims = station.dimensions || []
  return {
    hasDistance: dims.some(d => d.key === 'distance'),
    hasWeight: dims.some(d => d.key === 'weight'),
    hasReps: dims.some(d => d.key === 'reps'),
    raceStandard: station.raceStandard || null,
  }
}

// Round-progress dots — yellow filled = done, yellow ring = current,
// muted ring = upcoming. The hint here is "where am I in this template's
// round count" so the user always knows how much is left.
function ProgressDots({ totalRounds, currentRoundIdx, currentLeg }) {
  const dots = []
  for (let i = 0; i < totalRounds; i++) {
    let style
    if (i < currentRoundIdx) {
      style = { background: YELLOW, border: `2px solid ${YELLOW}` }
    } else if (i === currentRoundIdx) {
      style = {
        background: currentLeg === 'station' ? YELLOW : 'rgba(234,179,8,0.2)',
        border: `2px solid ${YELLOW}`,
      }
    } else {
      style = { background: 'transparent', border: '2px solid rgba(255,255,255,0.2)' }
    }
    dots.push(
      <div
        key={i}
        aria-label={`Round ${i + 1}${i === currentRoundIdx ? ' (current)' : i < currentRoundIdx ? ' (done)' : ''}`}
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          ...style,
        }}
      />
    )
  }
  return <div className="flex items-center justify-center" style={{ gap: 8 }}>{dots}</div>
}

// Recent splits row per design plan: shows the just-stamped run leg + the
// preceding round's totals so the user can pace against themselves
// without hunting for context.
function RecentSplitsRow({ completedLegs, currentRoundIdx, currentLeg }) {
  if (!Array.isArray(completedLegs) || completedLegs.length === 0) return null

  const items = []
  // (a) If currently on station leg, show today's run leg from THIS round.
  if (currentLeg === 'station') {
    const runThisRound = completedLegs.find(l => l.roundIndex === currentRoundIdx && l.type === 'run')
    if (runThisRound && typeof runThisRound.timeSec === 'number') {
      items.push({ key: `r${currentRoundIdx}-run`, label: `R${currentRoundIdx + 1} run`, value: formatDuration(runThisRound.timeSec) })
    }
  }
  // (b) Prior round totals (run + station summed) for up to 2 most recent.
  for (let r = currentRoundIdx - 1; r >= Math.max(0, currentRoundIdx - 2); r--) {
    const legs = completedLegs.filter(l => l.roundIndex === r)
    if (legs.length === 0) continue
    const total = legs.reduce((sum, l) => sum + (typeof l.timeSec === 'number' ? l.timeSec : 0), 0)
    if (total > 0) {
      items.push({ key: `r${r}-total`, label: `R${r + 1} total`, value: formatDuration(total) })
    }
  }

  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap items-center justify-center" style={{ gap: 8 }}>
      {items.map(it => (
        <div
          key={it.key}
          className="tabular-nums"
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.7)',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '4px 8px',
          }}
        >
          <span style={{ color: 'rgba(255,255,255,0.5)', marginRight: 6 }}>{it.label}</span>
          {it.value}
        </div>
      ))}
    </div>
  )
}

// Intra-leg comparison band per §14.1. Green = ahead of last; amber =
// behind; neutral = clock just started or no comparison yet.
function ComparisonBand({ comparison }) {
  if (!comparison) return null

  const colorByStatus = {
    ahead: { fg: '#34D399', bg: 'rgba(52, 211, 153, 0.1)', border: 'rgba(52, 211, 153, 0.4)' },
    behind: { fg: '#FB923C', bg: 'rgba(251, 146, 60, 0.1)', border: 'rgba(251, 146, 60, 0.4)' },
    neutral: { fg: 'rgba(255,255,255,0.7)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)' },
  }
  const c = colorByStatus[comparison.status] || colorByStatus.neutral

  // Format the body line based on mode + status.
  let primary
  let secondary
  if (comparison.mode === 'exact') {
    secondary = `${formatDuration(comparison.lastTimeSec)} last time`
    if (comparison.status === 'neutral') {
      primary = `Match ${formatDuration(comparison.lastTimeSec)}`
    } else {
      const sign = comparison.status === 'ahead' ? '−' : '+'
      const absDelta = Math.abs(Math.round(comparison.deltaSec))
      const formattedDelta = formatDuration(absDelta)
      primary = `${sign}${formattedDelta} vs ${comparison.label}`
    }
  } else {
    // pace
    secondary = `pace: ${comparison.paceSecPer100m}s / 100m`
    if (comparison.status === 'neutral') {
      primary = `Target ${formatDuration(comparison.paceProjectedTimeSec)}`
    } else {
      const sign = comparison.status === 'ahead' ? '−' : '+'
      const absDelta = Math.abs(Math.round(comparison.deltaSec))
      const formattedDelta = formatDuration(absDelta)
      primary = `${sign}${formattedDelta} vs ${comparison.label}`
    }
  }

  return (
    <div
      role="status"
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 10,
        padding: '8px 12px',
      }}
    >
      <div className="tabular-nums" style={{ fontSize: 13, fontWeight: 700, color: c.fg }}>
        {primary}
      </div>
      <div className="tabular-nums" style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
        {secondary}
      </div>
    </div>
  )
}

export default function HyroxRoundLogger() {
  const { exerciseId, roundIdx: roundIdxParam, leg: legParam } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const exerciseLibrary = useStore(s => s.exerciseLibrary)
  const sessions = useStore(s => s.sessions)
  const activeSession = useStore(s => s.activeSession)
  const saveActiveSession = useStore(s => s.saveActiveSession)

  // Resolve the round-template library entry (id-first, name fallback).
  const libraryEntry = useMemo(() => {
    return exerciseLibrary.find(e => e.id === exerciseId)
        || exerciseLibrary.find(e => e.name === exerciseId)
        || null
  }, [exerciseLibrary, exerciseId])

  const isHyroxRound = libraryEntry && libraryEntry.type === 'hyrox-round'

  // ── Hydrate or initialize activeSession.hyrox ──────────────────────────
  //
  // First mount from B42's Begin round 1 button: location.state.prescription
  // is present. Subsequent mounts (reload, back-arrow round-trip): read
  // from activeSession.hyrox.
  //
  // Initialization happens in a useEffect (NOT during render) to avoid the
  // "Cannot update a component while rendering" warning that B42 hit when
  // the lazy initializer called a Zustand setter mid-render.

  const initializedRef = useRef(false)
  useEffect(() => {
    if (initializedRef.current) return
    if (!isHyroxRound) return

    const prescriptionFromState = location.state?.prescription || null
    const existingHyrox = activeSession?.hyrox || null

    // If the existing hyrox state matches THIS exerciseId, keep it (reload).
    if (existingHyrox && existingHyrox.exerciseId === (libraryEntry?.id || exerciseId)) {
      initializedRef.current = true
      return
    }

    // Otherwise, seed from the prescription.
    if (prescriptionFromState) {
      const startTs = Date.now()
      const initial = {
        exerciseId: libraryEntry?.id || exerciseId,
        prescription: prescriptionFromState,
        currentRoundIdx: 0,
        currentLeg: 'run',
        // Round clock keeps running across legs (visual continuity per
        // design doc §5.4); resets only on round-transition. Segment
        // clock resets per leg so each leg's stamped timeSec is
        // segment-specific (handleDone reads `now - legStartTimestamp`).
        roundStartTimestamp: startTs,
        legStartTimestamp: startTs,
        totalPausedMs: 0,
        isPaused: false,
        pauseStartedAt: null,
        completedLegs: [],
        // B44 — phase state machine for the post-round flash + rest sequence.
        // Logging is the default; non-final station-Done flips to 'flash',
        // then 'rest', then back to 'logging' after rest completes.
        phase: 'logging',
        flashStartTimestamp: null,
        restStartTimestamp: null,
        restEndTimestamp: null,
      }
      saveActiveSession({
        ...(activeSession || {}),
        hyrox: initial,
      })
      initializedRef.current = true
      return
    }

    // No prescription, no existing state — direct-URL hit. Bounce.
    // (Stays uninitialized; effect below renders the "no session" fallback.)
    initializedRef.current = true
  }, [isHyroxRound, libraryEntry, exerciseId, activeSession, location.state, saveActiveSession])

  const hyrox = activeSession?.hyrox || null

  // ── Live clock — 100ms tick per §17.2 ───────────────────────────────────
  //
  // Compute elapsed via timestamp diff so background tabs / reload don't
  // lose time (mirror of BbLogger's existing pattern). Pause adds the
  // current-pause-segment's elapsed to totalPausedMs at resume time.

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!hyrox || hyrox.isPaused) return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [hyrox?.isPaused, hyrox?.legStartTimestamp]) // eslint-disable-line

  // Round-clock elapsed (continuous within a round, resets on round-transition).
  // This is what the gym clock displays — design doc §5.4 "keeps running."
  const roundElapsedSec = useMemo(() => {
    if (!hyrox) return 0
    const start = hyrox.roundStartTimestamp || hyrox.legStartTimestamp
    if (!start) return 0
    let paused = hyrox.totalPausedMs || 0
    if (hyrox.isPaused && hyrox.pauseStartedAt) {
      paused += now - hyrox.pauseStartedAt
    }
    return Math.max(0, (now - start - paused) / 1000)
  }, [now, hyrox?.roundStartTimestamp, hyrox?.legStartTimestamp, hyrox?.totalPausedMs, hyrox?.isPaused, hyrox?.pauseStartedAt]) // eslint-disable-line

  // Segment-clock elapsed (resets on every leg transition). Used as the
  // stamped timeSec when handleDone fires AND as the value the comparison
  // band scores against (since "vs your last 800m run" wants run-only time,
  // not run+station).
  const elapsedSec = useMemo(() => {
    if (!hyrox || !hyrox.legStartTimestamp) return 0
    let paused = hyrox.totalPausedMs || 0
    if (hyrox.isPaused && hyrox.pauseStartedAt) {
      paused += now - hyrox.pauseStartedAt
    }
    return Math.max(0, (now - hyrox.legStartTimestamp - paused) / 1000)
  }, [now, hyrox?.legStartTimestamp, hyrox?.totalPausedMs, hyrox?.isPaused, hyrox?.pauseStartedAt]) // eslint-disable-line

  // ── Intra-leg comparison ───────────────────────────────────────────────

  const intraLegComparison = useMemo(() => {
    if (!hyrox) return null
    const station = hyrox.prescription.stationId
    const distance = hyrox.prescription.runDistanceMeters
    if (hyrox.currentLeg === 'run') {
      return buildIntraLegComparison({
        legType: 'run',
        distanceMeters: distance,
        currentTimeSec: elapsedSec,
        sessions,
      })
    }
    return buildIntraLegComparison({
      legType: 'station',
      stationId: station,
      stationName: stationName(station),
      // For v1 we don't yet capture station-specific dimensions per leg
      // beyond what the catalog standard implies, so we match station+ANY
      // dimensions for the most-recent prior. This still anchors to "your
      // last SkiErg" — the right framing per §14.1.
      currentTimeSec: elapsedSec,
      sessions,
    })
  }, [hyrox?.currentLeg, hyrox?.prescription, sessions, elapsedSec]) // eslint-disable-line

  // ── Action handlers ────────────────────────────────────────────────────

  const handlePauseToggle = useCallback(() => {
    if (!hyrox) return
    if (hyrox.isPaused) {
      // Resume — accumulate the pause segment into totalPausedMs.
      const segment = hyrox.pauseStartedAt ? Date.now() - hyrox.pauseStartedAt : 0
      saveActiveSession({
        ...activeSession,
        hyrox: {
          ...hyrox,
          isPaused: false,
          pauseStartedAt: null,
          totalPausedMs: (hyrox.totalPausedMs || 0) + segment,
        },
      })
    } else {
      saveActiveSession({
        ...activeSession,
        hyrox: {
          ...hyrox,
          isPaused: true,
          pauseStartedAt: Date.now(),
        },
      })
    }
  }, [hyrox, activeSession, saveActiveSession])

  const handleDone = useCallback(() => {
    if (!hyrox) return
    const finalElapsed = Math.max(0, Math.round(elapsedSec))
    const isRunLeg = hyrox.currentLeg === 'run'
    const isFinalRound = hyrox.currentRoundIdx >= (hyrox.prescription.roundCount - 1)

    // Build the new completed-leg entry per §17 + the LoggedHyroxRound
    // shape from B38's helpers.js comment block.
    let newLeg
    if (isRunLeg) {
      const dMeters = hyrox.prescription.runDistanceMeters
      newLeg = {
        roundIndex: hyrox.currentRoundIdx,
        type: 'run',
        distanceMeters: dMeters,
        distanceMiles: typeof dMeters === 'number' ? metersToMiles(dMeters) : null,
        timeSec: finalElapsed,
        completedAt: new Date().toISOString(),
      }
    } else {
      const sId = hyrox.prescription.stationId
      const station = HYROX_STATIONS.find(s => s.id === sId)
      // Pull race-standard dimensions onto the leg so getStationHistory's
      // dimension-match path has data to compare against. v1 doesn't
      // surface per-leg dimension input UI yet — the prescription IS the
      // ground truth for SkiErg distance, sled push distance, etc.
      const legDims = {}
      if (station?.raceStandard?.distance) legDims.distanceMeters = station.raceStandard.distance
      if (station?.raceStandard?.weight) legDims.weight = station.raceStandard.weight
      if (station?.raceStandard?.reps) legDims.reps = station.raceStandard.reps
      newLeg = {
        roundIndex: hyrox.currentRoundIdx,
        type: 'station',
        stationId: sId,
        ...legDims,
        timeSec: finalElapsed,
        completedAt: new Date().toISOString(),
      }
    }

    const updatedCompleted = [...(hyrox.completedLegs || []), newLeg]

    if (isRunLeg) {
      // Advance to station leg. Round clock KEEPS running (visual continuity
      // per design doc §5.4); segment clock RESETS so the station's stamped
      // timeSec is station-only.
      saveActiveSession({
        ...activeSession,
        hyrox: {
          ...hyrox,
          currentLeg: 'station',
          completedLegs: updatedCompleted,
          legStartTimestamp: Date.now(),
          // roundStartTimestamp NOT reset — round clock continuity.
          // totalPausedMs reset so segment-clock arithmetic is clean.
          totalPausedMs: 0,
        },
      })
      // Update URL so reload returns to the right leg.
      navigate(
        `/log/hyrox/${encodeURIComponent(exerciseId)}/round/${hyrox.currentRoundIdx + 1}/station`,
        { replace: true }
      )
      return
    }

    // Station leg done.
    if (isFinalRound) {
      // Final round — route to summary stub. (B45 wires the real summary;
      // B44 wires the post-round flash. For B43 we stamp + bounce.)
      saveActiveSession({
        ...activeSession,
        hyrox: {
          ...hyrox,
          completedLegs: updatedCompleted,
          // Mark hyrox complete so a subsequent BbLogger render shows the
          // "✓ done" state on the HYROX section preview card.
          completedAt: new Date().toISOString(),
          isPaused: false,
        },
      })
      navigate(`/log/hyrox/${encodeURIComponent(exerciseId)}/summary`, { replace: true })
      return
    }

    // Non-final round — B44 enters the post-round flash phase. Round/leg
    // clocks are NOT reset yet; they reset when rest completes (or skips)
    // in `handleRestComplete` below. URL also stays at /round/N/station so
    // a reload mid-flash or mid-rest restores into the correct overlay.
    saveActiveSession({
      ...activeSession,
      hyrox: {
        ...hyrox,
        completedLegs: updatedCompleted,
        phase: 'flash',
        flashStartTimestamp: Date.now(),
        restStartTimestamp: null,
        restEndTimestamp: null,
        isPaused: false,
        pauseStartedAt: null,
      },
    })
  }, [hyrox, activeSession, saveActiveSession, elapsedSec, navigate, exerciseId])

  // ── B44 phase-transition handlers ──────────────────────────────────────
  //
  // Each handler reads the current phase from the live store snapshot and
  // bails if the phase has already advanced. Necessary because PostRoundFlash
  // and RestBetweenRoundsTimer both have auto-advance timers AND tap/skip
  // affordances — without an idempotent guard, two firings would shove
  // restEndTimestamp forward (extending rest) or advance two rounds at once.

  const handleFlashAdvance = useCallback(() => {
    const cur = activeSession?.hyrox
    if (!cur || cur.phase !== 'flash') return
    const restSec =
      typeof cur.prescription?.restSec === 'number' && cur.prescription.restSec > 0
        ? cur.prescription.restSec
        : 0
    const nowTs = Date.now()
    saveActiveSession({
      ...activeSession,
      hyrox: {
        ...cur,
        phase: 'rest',
        flashStartTimestamp: null,
        restStartTimestamp: nowTs,
        restEndTimestamp: nowTs + restSec * 1000,
      },
    })
  }, [activeSession, saveActiveSession])

  const advanceToNextRound = useCallback(() => {
    const cur = activeSession?.hyrox
    if (!cur) return
    if (cur.phase !== 'rest' && cur.phase !== 'flash') return
    const nextRound = cur.currentRoundIdx + 1
    const totalRounds = cur.prescription?.roundCount
    if (typeof totalRounds === 'number' && nextRound >= totalRounds) {
      // Defensive — should never reach here for the final round (final round
      // routes straight to summary from handleDone). Bail rather than corrupt.
      return
    }
    const nowTs = Date.now()
    saveActiveSession({
      ...activeSession,
      hyrox: {
        ...cur,
        currentRoundIdx: nextRound,
        currentLeg: 'run',
        roundStartTimestamp: nowTs,
        legStartTimestamp: nowTs,
        totalPausedMs: 0,
        isPaused: false,
        pauseStartedAt: null,
        phase: 'logging',
        flashStartTimestamp: null,
        restStartTimestamp: null,
        restEndTimestamp: null,
      },
    })
    navigate(
      `/log/hyrox/${encodeURIComponent(exerciseId)}/round/${nextRound + 1}/run`,
      { replace: true }
    )
  }, [activeSession, saveActiveSession, navigate, exerciseId])

  const handleRestComplete = useCallback(() => {
    advanceToNextRound()
  }, [advanceToNextRound])

  const handleSkipRest = useCallback(() => {
    advanceToNextRound()
  }, [advanceToNextRound])

  const handleAddRestSeconds = useCallback(
    (deltaSec) => {
      const cur = activeSession?.hyrox
      if (!cur || cur.phase !== 'rest') return
      const delta = typeof deltaSec === 'number' && deltaSec > 0 ? deltaSec : 0
      if (delta === 0) return
      const newEnd =
        (typeof cur.restEndTimestamp === 'number' ? cur.restEndTimestamp : Date.now()) +
        delta * 1000
      saveActiveSession({
        ...activeSession,
        hyrox: {
          ...cur,
          restEndTimestamp: newEnd,
        },
      })
    },
    [activeSession, saveActiveSession]
  )

  const handleSkip = useCallback(() => {
    // Skip the current leg — stamp 0s and advance per the same rules as
    // Done. Useful when the user wants to drop a station for the day
    // (e.g. broken machine) but keep the rest of the round.
    if (!hyrox) return
    if (!confirm(`Skip ${hyrox.currentLeg === 'run' ? 'run leg' : stationName(hyrox.prescription.stationId) || 'station'}?`)) return
    // Force elapsed to 0 by temporarily setting legStartTimestamp = now,
    // then call handleDone. This avoids duplicating the leg-stamp logic.
    saveActiveSession({
      ...activeSession,
      hyrox: { ...hyrox, legStartTimestamp: Date.now(), totalPausedMs: 0, isPaused: false, pauseStartedAt: null },
    })
    // Done flushes synchronously below via the same elapsed=0 path on the
    // next render tick; for the user this reads as "skip" + advance.
    setTimeout(() => handleDone(), 50)
  }, [hyrox, activeSession, saveActiveSession, handleDone])

  const handleBack = useCallback(() => {
    // Pause on back-out so the clock doesn't keep ticking while the user
    // is finishing a Lift exercise. State persists; they can return.
    if (hyrox && !hyrox.isPaused) {
      saveActiveSession({
        ...activeSession,
        hyrox: { ...hyrox, isPaused: true, pauseStartedAt: Date.now() },
      })
    }
    navigate(-1)
  }, [hyrox, activeSession, saveActiveSession, navigate])

  // ── Render ─────────────────────────────────────────────────────────────

  if (!isHyroxRound || !libraryEntry) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black text-white text-center px-6">
        <p className="text-base mb-4">Round template not found.</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-5 py-2 rounded-full text-sm font-semibold"
          style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}
        >
          Go back
        </button>
      </div>
    )
  }

  if (!hyrox) {
    // Initialization in flight (next tick) or direct-URL hit without state.
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black text-white text-center px-6">
        <p className="text-base mb-4">No active HYROX session.</p>
        <p className="text-xs text-white/50 mb-4">
          Start from the workout page → tap Start HYROX.
        </p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-5 py-2 rounded-full text-sm font-semibold"
          style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}
        >
          Go back
        </button>
      </div>
    )
  }

  // ── B44 phase overlays ────────────────────────────────────────────────
  //
  // Render PostRoundFlash or RestBetweenRoundsTimer based on hyrox.phase.
  // Both are full-screen z-70 overlays — the normal logging UI underneath
  // stays mounted but is fully covered. Reload during either phase reads
  // phase from activeSession.hyrox and lands back on the right overlay.

  if (hyrox.phase === 'flash') {
    const elapsedFlashMs =
      typeof hyrox.flashStartTimestamp === 'number'
        ? Math.max(0, Date.now() - hyrox.flashStartTimestamp)
        : 0
    const remainingFlashMs = Math.max(0, FLASH_DURATION_MS - elapsedFlashMs)
    const delta = computeRoundDelta(
      hyrox.currentRoundIdx,
      hyrox.completedLegs,
      sessions,
      {
        exerciseId: hyrox.exerciseId,
        stationId: hyrox.prescription?.stationId,
      }
    )
    return (
      <PostRoundFlash
        delta={delta}
        durationMs={remainingFlashMs}
        onAdvance={handleFlashAdvance}
      />
    )
  }

  if (hyrox.phase === 'rest') {
    return (
      <RestBetweenRoundsTimer
        restEndTimestamp={hyrox.restEndTimestamp}
        totalRounds={hyrox.prescription?.roundCount}
        nextRoundIdx={hyrox.currentRoundIdx + 1}
        onSkip={handleSkipRest}
        onAddSeconds={handleAddRestSeconds}
        onComplete={handleRestComplete}
      />
    )
  }

  const station = hyrox.prescription.stationId
  const stationLabel = stationName(station) || 'Station'
  const runDistance = hyrox.prescription.runDistanceMeters
  const isRunLeg = hyrox.currentLeg === 'run'

  // Subtitle line beneath the leg label.
  let subtitle
  if (isRunLeg) {
    const miles = typeof runDistance === 'number' ? metersToMiles(runDistance) : null
    subtitle = miles
      ? `${runDistance}m · ${miles.toFixed(2)} mi`
      : `${runDistance}m`
  } else {
    const stMetric = stationMetric(station)
    const bits = []
    if (stMetric?.raceStandard) {
      if (stMetric.raceStandard.distance) bits.push(`${stMetric.raceStandard.distance}m`)
      if (stMetric.raceStandard.reps) bits.push(`${stMetric.raceStandard.reps} reps`)
      if (stMetric.raceStandard.weight) bits.push(`${stMetric.raceStandard.weight} lb`)
    }
    subtitle = bits.length > 0 ? bits.join(' · ') : 'Race standard'
  }

  // Param sanity check — we use URL params for navigation continuity, but
  // the SOURCE OF TRUTH for which round/leg the user is on is
  // activeSession.hyrox. The URL just tracks state for back-button
  // semantics. So if URL drifts (e.g. user manually edits), we trust the
  // state and ignore the URL.

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black text-white overflow-y-auto"
      style={{
        backgroundImage: `radial-gradient(ellipse 70% 40% at 50% 0%, rgba(234,179,8,0.18) 0%, rgba(234,179,8,0.08) 35%, rgba(0,0,0,0) 70%)`,
      }}
    >
      <div className="w-full max-w-md mx-auto px-6 pt-6 pb-8 flex flex-col flex-1" style={{ gap: 18 }}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="w-9 h-9 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'white' }}
            aria-label="Back to workout (pauses round clock)"
          >
            ←
          </button>
          <div
            className="text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full truncate max-w-[60%] text-center"
            style={{
              background: 'rgba(234,179,8,0.12)',
              color: YELLOW_BRIGHT,
              border: `1px solid rgba(234,179,8,0.3)`,
            }}
          >
            HYROX · {libraryEntry.name}
          </div>
          <button
            type="button"
            onClick={handlePauseToggle}
            className="w-9 h-9 flex items-center justify-center rounded-full text-base"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'white' }}
            aria-label={hyrox.isPaused ? 'Resume' : 'Pause'}
          >
            {hyrox.isPaused ? '▶' : '⏸'}
          </button>
        </div>

        {/* Round-progress dots */}
        <ProgressDots
          totalRounds={hyrox.prescription.roundCount}
          currentRoundIdx={hyrox.currentRoundIdx}
          currentLeg={hyrox.currentLeg}
        />

        {/* Round + leg label */}
        <div className="text-center" style={{ marginTop: 4 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.18em',
              color: 'rgba(234,179,8,0.85)',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            Round {hyrox.currentRoundIdx + 1} · {isRunLeg ? 'Run' : 'Station'}
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: 'white',
              letterSpacing: '-0.02em',
              marginTop: 4,
            }}
          >
            {isRunLeg ? `${runDistance}m Run` : stationLabel}
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.55)',
              marginTop: 2,
            }}
          >
            {subtitle}
          </div>
        </div>

        {/* Gym clock — round clock per design doc §5.4 (continuous within
            a round, resets only on round-transition). The leg label above
            tells the user which leg they're on; the clock itself is the
            "round clock" visual. */}
        <div className="flex justify-center" style={{ marginTop: 4 }}>
          <GymClock elapsedSec={roundElapsedSec} mode="up" eyebrowOverride="ROUND CLOCK" />
        </div>

        {/* Recent splits */}
        <RecentSplitsRow
          completedLegs={hyrox.completedLegs}
          currentRoundIdx={hyrox.currentRoundIdx}
          currentLeg={hyrox.currentLeg}
        />

        {/* Intra-leg comparison */}
        <ComparisonBand comparison={intraLegComparison} />

        {/* Spacer to push the action buttons toward the bottom */}
        <div className="flex-1" />

        {/* Done · Stamp time (primary CTA). Stamp = segment elapsed (not
            round elapsed) so the user sees the per-leg time they're about
            to commit. The round-total reads off the round clock above. */}
        <button
          type="button"
          onClick={handleDone}
          className="w-full rounded-2xl py-4 font-bold text-lg active:scale-[0.98] transition-transform"
          style={{ background: GREEN, color: '#0a0a0a', boxShadow: `0 8px 30px rgba(16,185,129,0.35)` }}
        >
          ✓ Done · Stamp {formatDuration(Math.max(0, Math.round(elapsedSec)))}
        </button>

        {/* Secondary actions */}
        <div className="flex items-center justify-center" style={{ gap: 16 }}>
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-white/45 underline underline-offset-2"
          >
            Skip {isRunLeg ? 'run' : 'station'}
          </button>
        </div>
      </div>

      {/* Paused overlay banner */}
      {hyrox.isPaused && (
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
          style={{ background: 'rgba(234, 179, 8, 0.85)', color: '#0a0a0a' }}
        >
          Paused
        </div>
      )}
    </div>
  )
}
