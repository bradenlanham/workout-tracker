// Batch 58 — bottom-sheet drill-down for the Volume tile on /progress.
//
// Mirrors ExerciseHistorySheet's structural pattern: portal at z-260,
// rounded-t-3xl, max-h-92vh, scroll containment, backdrop tap dismiss.
//
// Renders three chart slots Progress.jsx supplies as React nodes (rather
// than importing WeeklyLoadChart / RadarChart directly): a `weeklyLoadNode`
// (the 3-week stacked-bar comparison, NOT picker-scoped — anchored to now),
// a `radarNode` (per-muscle-group radar over the picker's window), and the
// `byWorkoutType` array (rendered as a per-type volume list at the bottom).
//
// All hooks live BEFORE the early `if (!open) return null` return per the
// pre-flight checklist's hooks-after-early-return defense.
//
// Props:
//   open              — boolean
//   rangeLabel        — short label for the current picker (e.g. "Last 3 months")
//   byWorkoutType     — [{ type, volume, count }, ...] from buildVolumeTileData
//   weeklyLoadNode    — React node (the WeeklyLoadChart instance Progress wraps)
//   radarNode         — React node (the RadarChart instance Progress wraps)
//   resolveTypeName   — (type) => string, maps workout-id to display name
//   onClose           — () => void
//

import { createPortal } from 'react-dom'

function formatVolumeShort(n) {
  const v = Number(n) || 0
  if (v >= 100000) return `${Math.round(v / 1000)}k`
  if (v >= 10000)  return `${(v / 1000).toFixed(1)}k`
  if (v >= 1000)   return `${(v / 1000).toFixed(1)}k`
  return String(Math.round(v))
}

export default function VolumeDrillSheet({
  open,
  rangeLabel = '',
  byWorkoutType = [],
  weeklyLoadNode = null,
  radarNode = null,
  resolveTypeName = t => t,
  onClose,
}) {
  if (!open) return null

  const totalListVolume = byWorkoutType.reduce((s, t) => s + (t.volume || 0), 0)
  const hasTypes = byWorkoutType.length > 0

  return createPortal(
    <div
      className="fixed inset-0 flex items-end md:items-center justify-center"
      style={{ zIndex: 260 }}
      onClick={onClose}
      role="dialog"
      aria-label="Volume breakdown"
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
              Volume breakdown
            </div>
            <h3 className="text-lg font-bold text-c-primary truncate">
              {rangeLabel || 'All sessions'}
            </h3>
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

        {/* Slot 1 — Last 3 weeks by workout type (anchored to now, NOT picker-scoped) */}
        {weeklyLoadNode && (
          <div style={{ background: 'var(--bg-item)', borderRadius: 14, padding: '14px 14px 10px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Last 3 weeks by workout type
            </div>
            {weeklyLoadNode}
          </div>
        )}

        {/* Slot 2 — Per-muscle-group radar (picker-scoped) */}
        {radarNode && (
          <div style={{ background: 'var(--bg-item)', borderRadius: 14, padding: '14px 14px 10px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Muscle group balance — {rangeLabel.toLowerCase() || 'all sessions'}
            </div>
            {radarNode}
          </div>
        )}

        {/* Slot 3 — Per-workout-type volume list (picker-scoped) */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>
            By workout type
          </div>
          {!hasTypes && (
            <div style={{ fontSize: 13, color: 'var(--text-faint)', padding: '12px 0' }}>
              No sessions in this window.
            </div>
          )}
          {hasTypes && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {byWorkoutType.map(t => {
                const pct = totalListVolume > 0 ? (t.volume / totalListVolume) * 100 : 0
                return (
                  <div
                    key={t.type}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px 12px',
                      background: 'var(--bg-item)',
                      borderRadius: 10,
                      gap: 8,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {resolveTypeName(t.type)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {t.count} session{t.count === 1 ? '' : 's'}
                        <span style={{ color: 'var(--text-faint)' }}> · {Math.round(pct)}% of total</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {formatVolumeShort(t.volume)} lb
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
