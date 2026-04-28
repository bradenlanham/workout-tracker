// Batch 57 — bottom-sheet drill-down for a single exercise's strength history.
//
// Surfaces from the Strength tile on /progress. Reuses E1RMSparkline from
// Recommendation.jsx (the same chart the recommender uses) at full-history
// depth so the visual language stays identical between coach + tile drill.
//
// Layout (top to bottom):
//   - Header: exercise name + close ×
//   - Full E1RMSparkline (300×72, tap-to-select dots, all sessions)
//   - 4 stat tiles: Current e1RM / Weekly growth / Sessions / All-time PR
//   - Recent sessions list (newest first, up to 20 visible, Show all toggle)
//
// Z-stack: 260, peer with ExerciseEditSheet. Above RecommendationSheet (250).
//
// All hooks are called BEFORE the early `if (!open) return null` return so
// React's hook-count invariant holds across open/close transitions.
//
// Props:
//   open              — boolean
//   exercise          — { id, name, fullHistory, rate, currentE1RM, totalSessions, libraryEntry }
//   sessions          — full sessions[] from store (for getExercisePRs lookup)
//   accentColor       — theme.hex, threaded into the sparkline
//   onClose           — () => void
//

import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { E1RMSparkline } from '../pages/log/Recommendation'
import { getExercisePRs, formatRelativeDate } from '../utils/helpers'

const RECENT_SESSIONS_INITIAL = 20

function StatTile({ label, value, sublabel }) {
  return (
    <div
      style={{
        background: 'var(--bg-item)',
        borderRadius: 12,
        padding: '10px 12px',
        flex: 1,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}
      </div>
      {sublabel && (
        <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {sublabel}
        </div>
      )}
    </div>
  )
}

function formatRatePct(rate) {
  const pct = (Number(rate) || 0) * 100
  if (Math.abs(pct) < 0.1) return 'Flat'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%/wk`
}

function rateColor(rate) {
  const r = Number(rate) || 0
  if (r >= 0.005) return '#10b981'   // emerald-500
  if (r < 0)     return '#f59e0b'    // amber-500
  return 'var(--text-secondary)'
}

export default function ExerciseHistorySheet({ open, exercise, sessions, accentColor = '#3b82f6', onClose }) {
  // Hooks BEFORE any early return — Rules of Hooks invariant.
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [showAll, setShowAll]         = useState(false)

  const prInfo = useMemo(() => {
    if (!exercise || !Array.isArray(sessions)) return { maxWeight: 0, maxRepsAtMaxWeight: 0 }
    return getExercisePRs(sessions, exercise.name || '')
  }, [exercise, sessions])

  // Reverse chronological for the recent-sessions list. fullHistory is
  // chronological ascending; we want newest first for the user.
  const reverseHistory = useMemo(() => {
    if (!exercise || !Array.isArray(exercise.fullHistory)) return []
    return [...exercise.fullHistory].reverse()
  }, [exercise])

  if (!open || !exercise) return null

  const visibleHistory = showAll ? reverseHistory : reverseHistory.slice(0, RECENT_SESSIONS_INITIAL)
  const hasMore = reverseHistory.length > RECENT_SESSIONS_INITIAL

  // For "🏆 PR" badge on each row — the row is a PR if it matches the
  // all-time max weight + max-reps-at-max-weight. Cheaper than calling
  // isSetPR per row since we already have the PR info computed.
  const isRowPR = (entry) => {
    if (!prInfo.maxWeight) return false
    return entry.weight === prInfo.maxWeight && entry.reps === prInfo.maxRepsAtMaxWeight
  }

  return createPortal(
    <div
      className="fixed inset-0 flex items-end md:items-center justify-center"
      style={{ zIndex: 260 }}
      onClick={onClose}
      role="dialog"
      aria-label={`${exercise.name} history`}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-lg bg-card rounded-t-3xl md:rounded-3xl border-t border-x md:border border-white/10 shadow-2xl p-5 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        style={{
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0 flex-1 pr-3">
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
              Strength history
            </div>
            <h3 className="text-lg font-bold text-c-primary truncate">{exercise.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-item text-c-secondary flex items-center justify-center text-lg shrink-0"
            aria-label="Close"
            type="button"
          >
            ×
          </button>
        </div>

        {/* Full sparkline — pass entire history via a high windowSize so all
            sessions render. Tappable dots feed selectedIdx state which the
            sparkline uses to highlight that point; the inline label below
            updates to show that session's stats. */}
        <div style={{ background: 'var(--bg-item)', borderRadius: 14, padding: '14px 14px 10px', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 6 }}>
            Estimated 1-rep max · all {exercise.totalSessions} sessions
          </div>
          <E1RMSparkline
            history={exercise.fullHistory || []}
            accentColor={accentColor}
            rate={exercise.rate}
            selectedIdx={selectedIdx}
            onPointSelect={setSelectedIdx}
            windowSize={Math.max(2, exercise.totalSessions || 6)}
          />
          {(() => {
            // Selected-dot label, when a dot is tapped. Otherwise show peak.
            const list = exercise.fullHistory || []
            const visibleSlice = list.slice(-Math.max(2, exercise.totalSessions || 6))
            if (visibleSlice.length < 2) return null
            const e1rmValues = visibleSlice.map(p => p.e1RM || 0)
            const peakIdx    = e1rmValues.indexOf(Math.max(...e1rmValues))
            const labelIdx   = selectedIdx != null ? selectedIdx : peakIdx
            const point      = visibleSlice[labelIdx]
            if (!point) return null
            const isPeak = labelIdx === peakIdx && selectedIdx == null
            const date   = point.date ? formatRelativeDate(point.date) : ''
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                <span>
                  <strong style={{ color: 'var(--text-secondary)' }}>{isPeak ? 'Peak' : 'Session'}:</strong>{' '}
                  {Math.round(point.e1RM || 0)} lbs · {point.weight}×{point.reps}
                  {date && <span style={{ color: 'var(--text-faint)' }}> · {date}</span>}
                </span>
                <span style={{ color: rateColor(exercise.rate), fontWeight: 600 }}>
                  Weekly growth: {formatRatePct(exercise.rate)}
                </span>
              </div>
            )
          })()}
        </div>

        {/* 4 stat tiles */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <StatTile
            label="Current e1RM"
            value={`${Math.round(exercise.currentE1RM || 0)} lb`}
          />
          <StatTile
            label="Weekly growth"
            value={formatRatePct(exercise.rate)}
            sublabel={exercise.n ? `from ${exercise.n} sessions` : null}
          />
          <StatTile
            label="Sessions"
            value={String(exercise.totalSessions || 0)}
          />
          <StatTile
            label="All-time PR"
            value={prInfo.maxWeight > 0 ? `${prInfo.maxWeight}×${prInfo.maxRepsAtMaxWeight}` : '—'}
          />
        </div>

        {/* Recent sessions list */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>
            Recent sessions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {visibleHistory.map((entry, i) => {
              const isPR = isRowPR(entry)
              const dateLabel = entry.date ? formatRelativeDate(entry.date) : ''
              const e1 = Math.round(entry.e1RM || 0)
              const sublabelParts = []
              if (entry.equipmentInstance) sublabelParts.push(entry.equipmentInstance)
              if (entry.gymId) sublabelParts.push(entry.gymId)
              return (
                <div
                  key={`${entry.date}-${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 12px',
                    background: 'var(--bg-item)',
                    borderRadius: 10,
                    marginBottom: 6,
                    gap: 8,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {entry.weight}×{entry.reps}
                      {isPR && <span style={{ marginLeft: 6, color: '#fbbf24', fontSize: 13 }} aria-label="Personal record">🏆</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {dateLabel}
                      {sublabelParts.length > 0 && (
                        <span style={{ color: 'var(--text-faint)' }}> · {sublabelParts.join(' · ')}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {e1} lb
                  </div>
                </div>
              )
            })}
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll(v => !v)}
              style={{
                marginTop: 4,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                background: 'transparent',
                padding: '8px 0',
                width: '100%',
                textAlign: 'center',
              }}
            >
              {showAll ? 'Show fewer ←' : `Show all ${reverseHistory.length} →`}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
