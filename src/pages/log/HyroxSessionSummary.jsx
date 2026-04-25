// Batch 45 — HYROX session summary screen (mockup 4).
//
// Routes at /log/hyrox/:exerciseId/summary. Renders after the final round's
// station leg fires Done in HyroxRoundLogger. Composes the saved-session
// shape from `activeSession.hyrox.completedLegs[]`, then displays:
//
//   [HYROX COMPLETE]              ← yellow pill
//
//        00 : 22 : 14             ← hero total time
//
//   ┌──────────────┬────────────┐
//   │ FASTEST      │ VS LAST    │
//   │ R2  5:12     │ −1:14      │
//   └──────────────┴────────────┘
//
//   Per-round comparison chart (yellow solid + white dashed prior)
//   ────────────────────────────────────────
//   ROUND #  RUN + STATION   TOTAL  VS LAST
//      1    Run 4:08 · SkiErg 5:42  9:50  −0:14
//      2    Run 3:58 · SkiErg 5:12  9:10  −0:32
//      3    Run 4:12 · SkiErg 5:34  9:46  +0:02
//      4    Run 4:01 · SkiErg 5:28  9:29  −0:18
//   ────────────────────────────────────────
//
//   [ Back to lift → ]            ← branching CTA
//
// Branching CTA per §16.1:
//   - Workout has unfinished Lift exercises → "Back to lift →" navigates to
//     /log/bb/:type (the HYROX section preview now shows ✓ done state via
//     the round[] data we just persisted).
//   - All Lift work complete OR HYROX-only workout → "Finish workout →"
//     navigates to /log/bb/:type. (B45 doesn't auto-open the finish modal;
//     B46 will.)
//
// Cold start (§14.4): when ALL today's stations are first-time logged, the
// chart legend collapses + sidebar of bests replaces the chart. Mixed
// history renders the chart with partial dashed series.

import { useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import useStore from '../../store/useStore'
import GymClock from '../../components/GymClock'
import {
  buildSyntheticPriorSeries,
  composeHyroxRoundsForSave,
  computeBranchingCta,
  computeRoundDelta,
  formatDuration,
  getHyroxBests,
  getHyroxSessionTotalTime,
  getLastHyroxRoundSession,
} from '../../utils/helpers'
import { HYROX_STATIONS } from '../../data/hyroxStations'

const YELLOW = '#EAB308'
const YELLOW_FAINT = 'rgba(234,179,8,0.12)'
const YELLOW_DIM = 'rgba(234,179,8,0.4)'

function stationName(id) {
  if (!id) return ''
  return HYROX_STATIONS.find(s => s.id === id)?.name || ''
}

function StatTile({ eyebrow, primary, secondary }) {
  return (
    <div
      className="flex-1 rounded-2xl p-4"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div
        className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: 'rgba(255,255,255,0.5)' }}
      >
        {eyebrow}
      </div>
      <div className="text-2xl font-bold tabular-nums" style={{ color: '#fff' }}>
        {primary}
      </div>
      {secondary && (
        <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {secondary}
        </div>
      )}
    </div>
  )
}

// Inline SVG line chart per design doc §14.3. Today yellow solid + prior
// white dashed. Pace-fallback prior renders hollow. Cold-start hides the
// dashed series.
function ComparisonChart({ series }) {
  const width = 280
  const height = 140
  const padX = 28
  const padY = 16
  const innerW = width - padX * 2
  const innerH = height - padY * 2

  if (!series || series.length === 0) return null

  const todayValues = series.map(s => s.todayTotalSec).filter(v => v > 0)
  const priorValues = series.map(s => s.priorTotalSec).filter(v => v !== null && v > 0)
  const allValues = [...todayValues, ...priorValues]
  if (allValues.length === 0) return null

  const minV = Math.min(...allValues)
  const maxV = Math.max(...allValues)
  const range = Math.max(1, maxV - minV)
  // Padding ~10% of range so points don't sit on the axes.
  const pad = range * 0.15
  const yMin = Math.max(0, minV - pad)
  const yMax = maxV + pad
  const yRange = Math.max(1, yMax - yMin)

  const xFor = (i) =>
    series.length === 1
      ? padX + innerW / 2
      : padX + (i / (series.length - 1)) * innerW
  const yFor = (v) => padY + innerH - ((v - yMin) / yRange) * innerH

  const todayPoints = series.map((s, i) => ({
    x: xFor(i),
    y: s.todayTotalSec > 0 ? yFor(s.todayTotalSec) : null,
    paceFallback: s.priorPaceFallback,
    roundIndex: s.roundIndex,
  }))
  const priorPoints = series.map((s, i) =>
    s.priorTotalSec !== null && s.priorTotalSec > 0
      ? { x: xFor(i), y: yFor(s.priorTotalSec), paceFallback: s.priorPaceFallback }
      : null
  )

  // Build polyline strings (skip nulls).
  const todayPath = todayPoints
    .filter(p => p.y !== null)
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
  // Prior series can have gaps — split into runs.
  const priorRuns = []
  let currentRun = []
  for (const p of priorPoints) {
    if (p) {
      currentRun.push(p)
    } else if (currentRun.length > 0) {
      priorRuns.push(currentRun)
      currentRun = []
    }
  }
  if (currentRun.length > 0) priorRuns.push(currentRun)

  // Y-axis labels at top + bottom of range (formatted M:SS).
  const yTopLabel = formatDuration(Math.round(yMax))
  const yBottomLabel = formatDuration(Math.round(yMin))

  return (
    <svg
      width={width}
      height={height}
      style={{ display: 'block', maxWidth: '100%' }}
      role="img"
      aria-label="Per-round comparison chart"
    >
      {/* Y-axis tick labels */}
      <text
        x={padX - 6}
        y={padY + 4}
        textAnchor="end"
        style={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}
      >
        {yTopLabel}
      </text>
      <text
        x={padX - 6}
        y={padY + innerH + 4}
        textAnchor="end"
        style={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}
      >
        {yBottomLabel}
      </text>
      {/* Bottom axis line */}
      <line
        x1={padX}
        y1={padY + innerH}
        x2={padX + innerW}
        y2={padY + innerH}
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={1}
      />

      {/* Prior dashed line (white) */}
      {priorRuns.map((run, idx) => (
        <polyline
          key={`prior-${idx}`}
          points={run.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      ))}
      {/* Prior dots */}
      {priorPoints.map((p, i) =>
        p ? (
          <circle
            key={`pdot-${i}`}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={p.paceFallback ? 'transparent' : 'rgba(255,255,255,0.7)'}
            stroke="rgba(255,255,255,0.7)"
            strokeWidth={p.paceFallback ? 1.5 : 0}
          />
        ) : null
      )}

      {/* Today solid line (yellow) */}
      {todayPath && (
        <path
          d={todayPath}
          fill="none"
          stroke={YELLOW}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {/* Today dots */}
      {todayPoints.map((p, i) =>
        p.y !== null ? (
          <circle
            key={`tdot-${i}`}
            cx={p.x}
            cy={p.y}
            r={4}
            fill={YELLOW}
            stroke="#0a0a0a"
            strokeWidth={1.5}
          />
        ) : null
      )}

      {/* X-axis round labels */}
      {todayPoints.map((p, i) => (
        <text
          key={`xlabel-${i}`}
          x={p.x}
          y={padY + innerH + 16}
          textAnchor="middle"
          style={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)', fontWeight: 600 }}
        >
          R{p.roundIndex + 1}
        </text>
      ))}
    </svg>
  )
}

// Round breakdown table — one row per round per §14.3. VS LAST cell uses
// computeRoundDelta from B44 (same three-branch logic the flash overlay
// uses).
function RoundBreakdown({ rounds, completedLegs, sessions, prescription }) {
  if (!Array.isArray(rounds) || rounds.length === 0) return null

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Header */}
      <div
        className="grid items-center text-[10px] font-bold uppercase tracking-wider"
        style={{
          gridTemplateColumns: '32px 1fr 60px 64px',
          gap: 8,
          padding: '10px 12px',
          color: 'rgba(255,255,255,0.5)',
          background: 'rgba(255,255,255,0.04)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div>Rd</div>
        <div>Run + Station</div>
        <div className="text-right">Total</div>
        <div className="text-right">vs Last</div>
      </div>
      {/* Rows */}
      {rounds.map((r, idx) => {
        const runLeg = r.legs.find(l => l.type === 'run')
        const stationLeg = r.legs.find(l => l.type === 'station')
        const total = (runLeg?.timeSec || 0) + (stationLeg?.timeSec || 0)
        const stName = stationName(stationLeg?.stationId)

        const delta = computeRoundDelta(
          r.roundIndex,
          completedLegs,
          sessions,
          { ...prescription, exerciseId: prescription?.exerciseId }
        )

        let vsLast = '—'
        let vsLastColor = 'rgba(255,255,255,0.4)'
        let isFirstTime = false
        if (delta?.mode === 'cold') {
          vsLast = '—'
          isFirstTime = true
        } else if (delta && typeof delta.deltaSec === 'number') {
          if (delta.deltaSec === 0) {
            vsLast = '0:00'
            vsLastColor = 'rgba(255,255,255,0.6)'
          } else if (delta.deltaSec < 0) {
            vsLast = `−${formatDuration(Math.abs(delta.deltaSec))}`
            vsLastColor = '#34D399' // emerald
          } else {
            vsLast = `+${formatDuration(delta.deltaSec)}`
            vsLastColor = '#F59E0B' // amber
          }
        }

        return (
          <div
            key={r.roundIndex}
            className="grid items-center text-xs"
            style={{
              gridTemplateColumns: '32px 1fr 60px 64px',
              gap: 8,
              padding: '12px',
              color: 'rgba(255,255,255,0.85)',
              borderBottom:
                idx < rounds.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}
          >
            <div className="font-bold tabular-nums" style={{ color: YELLOW }}>
              R{r.roundIndex + 1}
            </div>
            <div className="truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {runLeg?.timeSec != null && (
                <span className="tabular-nums">Run {formatDuration(runLeg.timeSec)}</span>
              )}
              {runLeg?.timeSec != null && stationLeg?.timeSec != null && (
                <span style={{ color: 'rgba(255,255,255,0.3)' }}> · </span>
              )}
              {stationLeg?.timeSec != null && (
                <span className="tabular-nums">
                  {stName ? `${stName} ` : ''}
                  {formatDuration(stationLeg.timeSec)}
                </span>
              )}
              {isFirstTime && (
                <span
                  className="ml-1.5 tabular-nums"
                  style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                >
                  · first time
                </span>
              )}
            </div>
            <div
              className="text-right font-semibold tabular-nums"
              style={{ color: '#fff' }}
            >
              {formatDuration(total)}
            </div>
            <div
              className="text-right font-semibold tabular-nums"
              style={{ color: vsLastColor }}
            >
              {vsLast}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Cold-start sidebar of session bests per §14.4. Replaces the comparison
// chart when ALL stations are first-time logged.
function ColdStartBests({ bests }) {
  if (!bests) return null
  const items = []
  if (bests.fastestRound) {
    items.push({
      key: 'round',
      eyebrow: 'Fastest round',
      value: formatDuration(bests.fastestRound.timeSec),
      label: bests.fastestRound.label,
    })
  }
  if (bests.fastestRunLeg) {
    items.push({
      key: 'run',
      eyebrow: 'Fastest run leg',
      value: formatDuration(bests.fastestRunLeg.timeSec),
      label: bests.fastestRunLeg.label,
    })
  }
  if (bests.fastestStationLeg) {
    items.push({
      key: 'station',
      eyebrow: 'Fastest station leg',
      value: formatDuration(bests.fastestStationLeg.timeSec),
      label: bests.fastestStationLeg.label,
    })
  }
  if (items.length === 0) return null

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div
        className="text-[10px] font-bold uppercase tracking-wider mb-3"
        style={{ color: 'rgba(255,255,255,0.5)' }}
      >
        Today's bests
      </div>
      <div className="grid grid-cols-1 gap-3">
        {items.map(it => (
          <div key={it.key} className="flex items-baseline justify-between">
            <div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {it.eyebrow}
              </div>
              <div
                className="text-[11px] mt-0.5"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                {it.label}
              </div>
            </div>
            <div
              className="text-lg font-bold tabular-nums"
              style={{ color: YELLOW }}
            >
              {it.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HyroxSessionSummary() {
  const params = useParams()
  const navigate = useNavigate()
  const exerciseId = decodeURIComponent(params.exerciseId || '')

  const activeSession = useStore(s => s.activeSession)
  const sessions = useStore(s => s.sessions)
  const exerciseLibrary = useStore(s => s.exerciseLibrary)
  const splits = useStore(s => s.splits)
  const activeSplitId = useStore(s => s.activeSplitId)
  const saveActiveSession = useStore(s => s.saveActiveSession)

  const libraryEntry = useMemo(() => {
    if (!Array.isArray(exerciseLibrary) || !exerciseId) return null
    return (
      exerciseLibrary.find(e => e.id === exerciseId)
      || exerciseLibrary.find(e => e.name === exerciseId)
      || null
    )
  }, [exerciseLibrary, exerciseId])

  const hyrox = activeSession?.hyrox || null
  const prescription = useMemo(() => {
    if (!hyrox?.prescription) return null
    // Add exerciseId in form helpers expect (computeRoundDelta reads it).
    return { ...hyrox.prescription, exerciseId: libraryEntry?.id || hyrox.exerciseId || null }
  }, [hyrox, libraryEntry])

  // ── Mount-only effect: persist composed rounds[] into activeSession.exercises ─
  //
  // BbLogger's saveActiveSession writes a FLAT shape during a live session:
  //   { type, exercises, sessionNotes, sessionStarted, startTimestamp, ... }
  // Top-level `exercises` is the authoritative array while a session is in
  // progress. The B38 schema's nested `session.data.exercises` shape only
  // appears AFTER `addSession` commits at finish-modal save time.
  //
  // So the mount-effect updates `activeSession.exercises` in place — finds the
  // HYROX placeholder seeded by BbLogger's `templateExercises` builder and
  // writes `rounds[] + completedAt + prescribed* fields` onto it. The B41
  // section preview's `✓ done` state auto-detects via `exercise.rounds.length
  // >= roundCount` after this, so Back-to-lift now lights up correctly.
  //
  // Idempotent: skips when the matching exercise already has a non-empty
  // rounds[]. Fires AFTER render commit (per B42's lesson) so Zustand
  // subscribers don't trip "Cannot update a component while rendering."
  const persistedRef = useRef(false)
  useEffect(() => {
    if (persistedRef.current) return
    if (!activeSession || !hyrox?.completedLegs?.length || !libraryEntry) return

    const existingExercises = Array.isArray(activeSession.exercises)
      ? activeSession.exercises
      : []
    const existing = existingExercises.find(
      ex => ex?.exerciseId === libraryEntry.id
        || (ex?.name && ex.name === libraryEntry.name)
    )
    // Skip when the entry already has rounds populated (re-mount after reload).
    if (existing && Array.isArray(existing.rounds) && existing.rounds.length > 0) {
      persistedRef.current = true
      return
    }

    const composed = composeHyroxRoundsForSave(hyrox.completedLegs, hyrox.prescription)
    if (composed.length === 0) {
      persistedRef.current = true
      return
    }

    const updates = {
      name: libraryEntry.name,
      exerciseId: libraryEntry.id,
      rounds: composed,
      prescribedRoundCount: hyrox.prescription?.roundCount,
      prescribedStationId: hyrox.prescription?.stationId,
      prescribedRunDistanceMeters: hyrox.prescription?.runDistanceMeters,
      completedAt: hyrox.completedAt
        ? new Date(hyrox.completedAt).getTime()
        : Date.now(),
    }

    let nextExercises
    if (existing) {
      // Update the placeholder in place — preserves order in the section.
      nextExercises = existingExercises.map(ex =>
        ex === existing ? { ...ex, ...updates } : ex
      )
    } else {
      // No placeholder existed (defensive — shouldn't happen with B41 seeding).
      // Append a new entry rather than skipping the persistence.
      nextExercises = [...existingExercises, updates]
    }

    saveActiveSession({
      ...activeSession,
      exercises: nextExercises,
    })
    persistedRef.current = true
  }, [activeSession, hyrox, libraryEntry, saveActiveSession])

  // ── Computed-once values ───────────────────────────────────────────────
  const composedRounds = useMemo(() => {
    if (!hyrox?.completedLegs?.length) return []
    return composeHyroxRoundsForSave(hyrox.completedLegs, hyrox.prescription)
  }, [hyrox])

  const totalTimeSec = useMemo(
    () => getHyroxSessionTotalTime(composedRounds),
    [composedRounds]
  )

  const lastSession = useMemo(() => {
    if (!libraryEntry) return null
    return getLastHyroxRoundSession(sessions, libraryEntry.id)
      || getLastHyroxRoundSession(sessions, libraryEntry.name)
  }, [sessions, libraryEntry])

  // Fastest round (today) — sum legs per round, find min.
  const fastestRound = useMemo(() => {
    if (!composedRounds.length) return null
    let best = null
    for (const r of composedRounds) {
      if (!Array.isArray(r.legs)) continue
      const total = r.legs.reduce(
        (sum, l) => sum + (typeof l?.timeSec === 'number' ? l.timeSec : 0),
        0
      )
      if (total > 0 && (best === null || total < best.timeSec)) {
        best = { timeSec: total, roundIndex: r.roundIndex }
      }
    }
    return best
  }, [composedRounds])

  const vsLastDelta = useMemo(() => {
    if (!lastSession || totalTimeSec <= 0) return null
    return totalTimeSec - lastSession.totalTimeSec
  }, [lastSession, totalTimeSec])

  // Synthetic prior series for the chart. Pre-finish, activeSession isn't in
  // sessions[] — pass null currentSessionId; self-exclusion is a no-op.
  const series = useMemo(() => {
    if (!composedRounds.length) return []
    return buildSyntheticPriorSeries(composedRounds, sessions, prescription, null)
  }, [composedRounds, sessions, prescription])

  // Cold-start detection: ALL series points have priorTotalSec === null.
  const isColdStart = useMemo(() => {
    if (!series.length) return false
    return series.every(s => s.priorTotalSec === null)
  }, [series])

  const bests = useMemo(
    () => getHyroxBests(composedRounds, prescription),
    [composedRounds, prescription]
  )

  // Branching CTA — needs the workout from the active split. During a live
  // session, BbLogger's saveActiveSession writes `activeSession.exercises`
  // at top level (the flat shape — see the mount-effect comment above).
  const cta = useMemo(() => {
    const split = (splits || []).find(s => s?.id === activeSplitId)
    const workout = split?.workouts?.find(w => w?.id === activeSession?.type)
    return computeBranchingCta(workout, activeSession?.exercises || [])
  }, [splits, activeSplitId, activeSession])

  // ── Defensive empty state ──────────────────────────────────────────────
  if (!hyrox || !hyrox.completedLegs?.length) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          background: '#0a0a0a',
          color: '#fff',
          padding: 24,
        }}
      >
        <div className="max-w-md mx-auto">
          <div className="text-base mb-4">No HYROX session in progress.</div>
          <button
            type="button"
            onClick={() => navigate('/dashboard', { replace: true })}
            className="rounded-xl px-4 py-2 text-sm font-bold"
            style={{ background: YELLOW, color: '#0a0a0a' }}
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  const handleCta = () => {
    if (!activeSession?.type) {
      navigate('/dashboard', { replace: true })
      return
    }
    navigate(`/log/bb/${encodeURIComponent(activeSession.type)}`, { replace: true })
  }

  const lastSessionSummary = lastSession
    ? `${formatDuration(lastSession.totalTimeSec)} · ${lastSession.roundCount} ${lastSession.roundCount === 1 ? 'round' : 'rounds'}`
    : null

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#0a0a0a',
        color: '#fff',
        // Yellow radial-glow at the top, matching StartHyroxOverlay (B42).
        backgroundImage: `radial-gradient(ellipse 70% 35% at 50% 0%, rgba(234,179,8,0.16) 0%, rgba(234,179,8,0) 100%)`,
      }}
    >
      <div className="max-w-md mx-auto" style={{ padding: '24px 20px 80px' }}>
        {/* HYROX COMPLETE pill */}
        <div className="flex justify-center mb-6">
          <div
            className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
            style={{
              background: YELLOW_FAINT,
              color: YELLOW,
              border: `1px solid ${YELLOW_DIM}`,
            }}
          >
            HYROX Complete
          </div>
        </div>

        {/* Round template name */}
        <div className="text-center mb-2">
          <div className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {libraryEntry?.name || exerciseId}
          </div>
        </div>

        {/* Hero total time — gym clock visual */}
        <div className="flex justify-center mb-6">
          <GymClock
            elapsedSec={totalTimeSec}
            mode="up"
            eyebrowOverride="Total time"
          />
        </div>

        {/* Two stat tiles */}
        <div className="flex gap-3 mb-5">
          <StatTile
            eyebrow="Fastest round"
            primary={fastestRound ? formatDuration(fastestRound.timeSec) : '—'}
            secondary={fastestRound ? `R${fastestRound.roundIndex + 1}` : null}
          />
          <StatTile
            eyebrow="vs Last"
            primary={
              vsLastDelta === null
                ? '—'
                : vsLastDelta === 0
                  ? '0:00'
                  : vsLastDelta < 0
                    ? `−${formatDuration(Math.abs(vsLastDelta))}`
                    : `+${formatDuration(vsLastDelta)}`
            }
            secondary={lastSessionSummary || 'No prior session'}
          />
        </div>

        {/* Comparison chart OR cold-start sidebar */}
        <div className="mb-5">
          {isColdStart ? (
            <ColdStartBests bests={bests} />
          ) : (
            <div
              className="rounded-2xl p-4"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: 'rgba(255,255,255,0.5)' }}
                >
                  Per-round splits
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <div
                      style={{
                        width: 12,
                        height: 2,
                        background: YELLOW,
                        borderRadius: 1,
                      }}
                    />
                    <span style={{ color: 'rgba(255,255,255,0.6)' }}>Today</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      style={{
                        width: 12,
                        height: 0,
                        borderTop: '2px dashed rgba(255,255,255,0.5)',
                      }}
                    />
                    <span style={{ color: 'rgba(255,255,255,0.6)' }}>Prior</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-center">
                <ComparisonChart series={series} />
              </div>
            </div>
          )}
        </div>

        {/* Round breakdown table */}
        <div className="mb-6">
          <RoundBreakdown
            rounds={composedRounds}
            completedLegs={hyrox.completedLegs}
            sessions={sessions}
            prescription={prescription}
          />
        </div>

        {/* Branching CTA */}
        <button
          type="button"
          onClick={handleCta}
          className="w-full rounded-xl py-3.5 font-bold text-base transition-transform active:scale-[0.98]"
          style={{
            background: YELLOW,
            color: '#0a0a0a',
            boxShadow: '0 8px 30px rgba(234,179,8,0.35)',
          }}
        >
          {cta.label}
        </button>
      </div>
    </div>
  )
}
