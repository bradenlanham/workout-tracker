// Batch 16b — UI surfaces for the recommendation engine (Batch 16a).
//
// Three components:
//   RecommendationHint     — inline "Try: 185×10" text snippet for the
//                            collapsed exercise card (non-interactive —
//                            the collapsed card already handles tap-to-
//                            expand).
//   RecommendationBanner   — prominent tappable banner inside the expanded
//                            card; opens the sheet.
//   RecommendationSheet    — bottom-sheet modal with all three mode
//                            prescriptions, reasoning, confidence, and
//                            the e1RM / last-session context. Rendered
//                            via createPortal so it sits above the sticky
//                            footer and the CustomNumpad.
//
// The recommendation is computed in the parent (ExerciseItem) via useMemo
// and passed down — these components are pure display.

import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { recommendNextLoad } from '../../utils/helpers'

// ── Confidence styling ─────────────────────────────────────────────────────
// Colors chosen per plan §9.4 Option C (green / amber / gray + one-word label).
// Inline styles (not Tailwind classes) so the colored dot renders identically
// on both obsidian and daylight themes without touching the theme palette.

const CONFIDENCE_STYLES = {
  high:     { color: '#10b981', label: 'Solid' },  // emerald-500
  moderate: { color: '#f59e0b', label: 'Maybe' },  // amber-500
  building: { color: '#6b7280', label: 'New'   },  // gray-500
}

function confidenceStyle(confidence) {
  return CONFIDENCE_STYLES[confidence] || null
}

// Format "+2.1%/wk" (or "–1.3%/wk"). Absolute rate below 0.1% renders as "flat"
// to avoid noise when the fit returns effectively-zero progression.
function formatWeeklyRate(rate) {
  const pct = Number(rate) * 100
  if (Math.abs(pct) < 0.1) return 'flat'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%/wk`
}

// ── RecommendationHint — collapsed card inline snippet ────────────────────
//
// Renders `· ● Try: 185 × 10` (with a colored dot) to be appended inline
// next to the existing "Last: 175×11" text. If confidence is 'none' or the
// recommendation has no prescription, renders nothing so the card falls back
// to its existing "Last:" display untouched.

export function RecommendationHint({ recommendation }) {
  if (!recommendation || !recommendation.prescription) return null
  const style = confidenceStyle(recommendation.confidence)
  if (!style) return null                          // confidence === 'none'
  const { weight, reps } = recommendation.prescription
  return (
    <span style={{ fontSize: 10 }} className="text-c-dim ml-1.5">
      <span style={{ color: style.color }} aria-hidden="true">●</span>{' '}
      Try: {weight}×{reps}
    </span>
  )
}

// ── RecommendationBanner — expanded card prominent CTA ─────────────────────
//
// Button-styled banner, renders above the Plates/Uni toolbar. Tapping opens
// the RecommendationSheet. Shows the prescription and a short trend line.

export function RecommendationBanner({ recommendation, onTap }) {
  if (!recommendation || !recommendation.prescription) return null
  const style = confidenceStyle(recommendation.confidence)
  // Low-confidence cold-start is filtered above — but if the caller wants to
  // hint "build more data" for n=1 / n=2, show the bare prescription without
  // a trend line and no style dot.
  const { weight, reps } = recommendation.prescription
  const { meta, reasoning } = recommendation

  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-item border border-white/5 hover:bg-hover active:bg-hover transition-colors text-left"
      title="Tap for coaching details"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-c-faint text-[11px] font-semibold uppercase tracking-wider">Try</span>
          <span className="text-c-primary text-base font-extrabold tabular-nums">
            {weight} × {reps}
          </span>
        </div>
        <div className="text-[11px] text-c-muted truncate mt-0.5">
          {style && (
            <>
              <span style={{ color: style.color }} aria-hidden="true">●</span>{' '}
              <span style={{ color: style.color }} className="font-semibold">{style.label}</span>
              <span> · </span>
            </>
          )}
          <span className="truncate">{reasoning}</span>
        </div>
      </div>
      <span className="shrink-0 text-c-faint text-sm">›</span>
    </button>
  )
}

// ── RecommendationSheet — bottom sheet modal ───────────────────────────────
//
// Shows all three mode prescriptions side-by-side so the user can compare
// (push / maintain / deload). Tapping a mode chip swaps the headline display
// + reasoning to match. Includes full context: e1RM, last session, fit stats.

export function RecommendationSheet({
  open,
  onClose,
  exerciseName,
  history,
  targetReps,
  progressionClass,
  loadIncrement,
  now = Date.now(),
}) {
  // Recompute per mode. History doesn't change inside the sheet, so useMemo
  // here is pure optimization; the sheet opens/closes faster.
  const recs = useMemo(() => ({
    push:     recommendNextLoad({ history, targetReps, mode: 'push',     progressionClass, loadIncrement, now }),
    maintain: recommendNextLoad({ history, targetReps, mode: 'maintain', progressionClass, loadIncrement, now }),
    deload:   recommendNextLoad({ history, targetReps, mode: 'deload',   progressionClass, loadIncrement, now }),
  }), [history, targetReps, progressionClass, loadIncrement, now])

  // Default to 'push' so the sheet opens aligned with the inline banner
  // (the banner renders `recs.push` output regardless of auto-deload). Each
  // mode chip indexes into recs[mode] — e.g. DELOAD shows user-selected
  // deload (65% of e1RM) even if push auto-deloaded (10% off last, per
  // decision rule 3). Distinct numbers, distinct reasoning — intentional.
  const [selectedMode, setSelectedMode] = useState('push')

  if (!open) return null

  // Last session context for the footer
  const last = history[history.length - 1]
  const selected  = recs[selectedMode] || recs.push
  const style     = confidenceStyle(selected.confidence)

  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex: 250 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-lg bg-card rounded-t-3xl border-t border-x border-white/10 shadow-2xl animate-slide-up p-5 pb-6"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-c-faint">Coach's call</div>
            <h3 className="text-lg font-bold text-c-primary truncate">{exerciseName}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-item text-c-secondary flex items-center justify-center text-lg"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* ── Headline prescription ─────────────────────────────────── */}
        <div className="rounded-2xl bg-item p-5 mb-4 text-center">
          {selected.prescription ? (
            <>
              <div className="text-4xl font-extrabold text-c-primary tabular-nums tracking-tight">
                {selected.prescription.weight} × {selected.prescription.reps}
              </div>
              <div className="text-xs text-c-muted mt-1.5">
                {style && (
                  <>
                    <span style={{ color: style.color }} aria-hidden="true">●</span>{' '}
                    <span style={{ color: style.color }} className="font-semibold">{style.label} confidence</span>
                  </>
                )}
                {!style && <span className="font-semibold">Not enough data</span>}
              </div>
            </>
          ) : (
            <div className="text-c-muted text-sm py-4">
              Log a few more sessions and I'll start prescribing loads.
            </div>
          )}
        </div>

        {/* ── Mode comparison chips ─────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {['push', 'maintain', 'deload'].map(m => {
            const r = recs[m]
            const isSelected = selectedMode === m
            const MODE_LABELS = { push: 'Push', maintain: 'Maintain', deload: 'Deload' }
            const MODE_EMOJI  = { push: '↑',    maintain: '→',        deload: '↓'      }
            return (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedMode(m)}
                className={`py-2.5 px-2 rounded-xl text-center transition-colors ${
                  isSelected
                    ? 'bg-white/10 border border-white/20 text-c-primary'
                    : 'bg-item border border-transparent text-c-secondary hover:bg-hover'
                }`}
              >
                <div className="text-[10px] uppercase tracking-wider text-c-faint flex items-center justify-center gap-1">
                  <span>{MODE_EMOJI[m]}</span> {MODE_LABELS[m]}
                </div>
                <div className="text-sm font-bold text-c-primary mt-0.5 tabular-nums">
                  {r.prescription ? `${r.prescription.weight}×${r.prescription.reps}` : '—'}
                </div>
              </button>
            )
          })}
        </div>

        {/* ── Reasoning ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-white/5 bg-base/30 px-4 py-3 mb-4">
          <div className="text-[10px] uppercase tracking-wider text-c-faint mb-1">Why</div>
          <div className="text-sm text-c-secondary leading-relaxed">{selected.reasoning}</div>
        </div>

        {/* ── Stats / context ───────────────────────────────────────── */}
        <div className="space-y-1.5 text-xs">
          {selected.meta?.currentE1RM > 0 && (
            <ContextRow label="Current e1RM" value={`${selected.meta.currentE1RM} lbs`} />
          )}
          {last && (
            <ContextRow
              label="Last session"
              value={`${last.weight} × ${last.reps}  ·  ${daysAgoLabel(last.date, now)}`}
            />
          )}
          {selected.meta?.n >= 3 && (
            <ContextRow
              label="Progression fit"
              value={`${selected.meta.n} session${selected.meta.n === 1 ? '' : 's'}, R²=${(selected.meta.rSquared).toFixed(2)}${
                selected.meta.usedFit ? `, ${formatWeeklyRate(selected.meta.progressionRate)}` : '  ·  fallback rate'
              }`}
            />
          )}
          {selected.meta?.layer2Weight > 0 && (
            <ContextRow
              label={`Target @ ${targetReps} reps`}
              value={`${selected.meta.layer2Weight} lbs (e1RM × ${Math.round(selected.meta.layer2Weight / Math.max(selected.meta.currentE1RM || 1, 1) * 100)}%)`}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

function ContextRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-c-faint">{label}</span>
      <span className="text-c-secondary text-right">{value}</span>
    </div>
  )
}

function daysAgoLabel(dateString, now) {
  const days = Math.max(0, Math.round((now - new Date(dateString).getTime()) / 86400000))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
