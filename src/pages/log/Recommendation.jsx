// Batch 16b + 16f — UI surfaces for the recommendation engine.
//
// Three display components:
//   RecommendationHint      — inline "Try: 185×10" chip for the collapsed
//                             exercise card (non-interactive).
//   RecommendationBanner    — prominent tappable banner inside the expanded
//                             card; opens the sheet.
//   RecommendationSheet     — bottom-sheet modal with sparkline, two mode
//                             chips (Maintain / Push), plain-English
//                             reasoning, and an expandable Details section
//                             for the math.
//
// The recommendation is computed in the parent (ExerciseItem) via useMemo
// and passed down — these components are pure display.

import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { recommendNextLoad } from '../../utils/helpers'

// ── Confidence → percent + label helpers ──────────────────────────────────
//
// Users asked for a percentage (and tap-to-explain) rather than an opaque
// "Maybe"/"Solid" label. Percent combines sample size and R²: full data
// (6+ sessions) × R² caps it. Low-sample cases are capped by the data
// weight (e.g. 3 sessions = at most 50%). Returns null when we don't have
// enough data to claim anything (< 3 sessions).

function confidencePct(n, rSquared) {
  if (!(n >= 3)) return null
  const dataWeight = Math.min(1, n / 6)
  return Math.min(99, Math.max(1, Math.round(dataWeight * Math.max(0, rSquared) * 100)))
}

function confidenceColor(pct) {
  if (pct == null) return '#6b7280'      // gray-500
  if (pct >= 80)   return '#10b981'      // emerald-500
  if (pct >= 50)   return '#f59e0b'      // amber-500
  return '#60a5fa'                       // blue-400
}

// For the old RecommendationHint (collapsed card). Keeps the tri-state
// model internally — just used to decide whether to render the inline
// "Try" chip at all.

function hasRenderableHint(confidence) {
  return confidence === 'high' || confidence === 'moderate' || confidence === 'building'
}

function hintDotColor(confidence) {
  if (confidence === 'high')     return '#10b981'
  if (confidence === 'moderate') return '#f59e0b'
  return '#6b7280'
}

function formatWeeklyRate(rate) {
  const pct = Number(rate) * 100
  if (Math.abs(pct) < 0.1) return 'flat'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%/wk`
}

// ── RecommendationHint — collapsed card inline snippet ────────────────────

export function RecommendationHint({ recommendation }) {
  if (!recommendation || !recommendation.prescription) return null
  if (!hasRenderableHint(recommendation.confidence))   return null
  const { weight, reps } = recommendation.prescription
  return (
    <span style={{ fontSize: 10 }} className="text-c-dim ml-1.5">
      <span style={{ color: hintDotColor(recommendation.confidence) }} aria-hidden="true">●</span>{' '}
      Try: {weight}×{reps}
    </span>
  )
}

// ── RecommendationChip — compact Tip chip in the exercise toolbar row ─────
//
// Replaces the wider RecommendationBanner (Batch 16n-1). Sits alongside
// Plates / Uni / Last Time / PR. Sparkle icon signals "AI suggestion";
// confidence-colored dot mirrors the sheet's tap-to-explain percent so
// the user sees trust-level at a glance without opening. Tap → opens sheet.

export function RecommendationChip({ recommendation, onTap }) {
  if (!recommendation || !recommendation.prescription) return null
  return (
    <button
      type="button"
      onClick={onTap}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 transition-colors"
      title="Tap for coach's call"
    >
      <SparkleIcon className="w-3 h-3" color="currentColor" />
      <span>Tip</span>
    </button>
  )
}

function SparkleIcon({ color = 'currentColor', className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.5l1.3 3.2 3.2 1.3-3.2 1.3L8 10.5 6.7 7.3 3.5 6l3.2-1.3L8 1.5zM12.5 10l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6L10.2 12.3l1.6-.7.7-1.6zM3 11l.5 1.1 1.1.5-1.1.5L3 14.2l-.5-1.1L1.4 12.6l1.1-.5L3 11z"
        fill={color}
      />
    </svg>
  )
}

// ── RecommendationBanner — expanded card prominent CTA ─────────────────────

export function RecommendationBanner({ recommendation, onTap }) {
  if (!recommendation || !recommendation.prescription) return null
  const { weight, reps } = recommendation.prescription
  const { reasoning, meta } = recommendation
  const pct = confidencePct(meta?.n, meta?.rSquared)
  const color = confidenceColor(pct)

  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-item border border-white/5 hover:bg-hover active:bg-hover transition-colors text-left"
      title="Tap for coaching details"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-c-faint text-[11px] font-semibold uppercase tracking-wider">Top set</span>
          <span className="text-c-primary text-base font-extrabold tabular-nums">
            {weight} × {reps}
          </span>
        </div>
        <div className="text-[11px] text-c-muted truncate mt-0.5">
          {pct != null && (
            <>
              <span style={{ color }} aria-hidden="true">●</span>{' '}
              <span style={{ color }} className="font-semibold">{pct}% confident</span>
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

// ── E1RMSparkline — inline SVG trend over last 6 sessions ─────────────────
//
// Plots e1RM as points + line, with a subtle linear-fit trend line, and a
// rate label in the top-right. Auto-scales to the window's min/max e1RM.

function E1RMSparkline({ history, accentColor = '#3b82f6', rate = 0 }) {
  const window = history.slice(-6)
  if (window.length < 2) return null

  const W = 300, H = 72, padX = 8, padTop = 10, padBottom = 8
  const values = window.map(p => p.e1RM || 0)
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const spread = Math.max(1, maxV - minV)
  const yMin = minV - spread * 0.15
  const yMax = maxV + spread * 0.15
  const range = yMax - yMin

  const xFor = i => padX + (i / (window.length - 1)) * (W - 2 * padX)
  const yFor = v => H - padBottom - ((v - yMin) / range) * (H - padTop - padBottom)

  const points = window.map((p, i) => [xFor(i), yFor(p.e1RM || 0)])
  const polylinePts = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

  // Subtle dashed trend line projected from the first point at the supplied
  // weekly rate (matches the Growth label below the chart).
  const trendFirst = points[0]
  const daysSpan   = (new Date(window[window.length - 1].date) - new Date(window[0].date)) / 86400000
  const trendEndE  = (window[0].e1RM || 0) * (1 + (rate || 0) * (daysSpan / 7))
  const trendEndY  = yFor(trendEndE)
  const trendLast  = [points[points.length - 1][0], trendEndY]

  const peakIdx = values.indexOf(maxV)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" role="img" aria-label={`Estimated 1-rep max across ${window.length} sessions, peak ${Math.round(maxV)} lbs`}>
      {/* Trend line (dashed, subtle) */}
      <line
        x1={trendFirst[0]} y1={trendFirst[1]}
        x2={trendLast[0]}  y2={trendLast[1]}
        stroke={accentColor} strokeWidth="1" strokeDasharray="3 3" opacity="0.4"
      />
      {/* Connecting polyline */}
      <polyline points={polylinePts} fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Data points — peak + latest emphasized */}
      {points.map(([x, y], i) => {
        const isLast = i === points.length - 1
        const isPeak = i === peakIdx
        return (
          <circle
            key={i}
            cx={x} cy={y}
            r={isPeak ? 4.5 : (isLast ? 3.5 : 2.5)}
            fill={accentColor}
            stroke={isPeak ? accentColor : 'none'}
            strokeWidth="2"
            opacity={isPeak ? 1 : (isLast ? 0.9 : 0.6)}
          />
        )
      })}
    </svg>
  )
}

// ── RecommendationSheet — bottom-sheet modal ───────────────────────────────

export function RecommendationSheet({
  open,
  onClose,
  exerciseName,
  history,
  targetReps,
  progressionClass,
  loadIncrement,
  accentColor = '#3b82f6',
  defaultMode = 'push',
  aggressivenessMultiplier = 1,
  now = Date.now(),
}) {
  // Recompute per mode so chip tap can swap between them without a recalc.
  // aggressivenessMultiplier (Batch 16n) scales push-mode nudging based on
  // the user's readiness answers; maintain/deload ignore it.
  const recs = useMemo(() => ({
    push:     recommendNextLoad({ history, targetReps, mode: 'push',     progressionClass, loadIncrement, aggressivenessMultiplier, now }),
    maintain: recommendNextLoad({ history, targetReps, mode: 'maintain', progressionClass, loadIncrement, now }),
    deload:   recommendNextLoad({ history, targetReps, mode: 'deload',   progressionClass, loadIncrement, now }),
  }), [history, targetReps, progressionClass, loadIncrement, aggressivenessMultiplier, now])

  // When a readiness answer suggests a specific mode, open the sheet aligned
  // with that mode so the user sees the prescription that matches their
  // declared goal. Also surfaces the deload chip when the user picked
  // Recover so they can compare against push/maintain. Falls back to push
  // when no readiness is present.
  const showDeloadChip = defaultMode === 'deload'
  const validInitial   = ['push', 'maintain', 'deload'].includes(defaultMode) ? defaultMode : 'push'
  const [selectedMode,  setSelectedMode]  = useState(validInitial)
  const [detailsOpen,   setDetailsOpen]   = useState(false)
  const [whyOpen,       setWhyOpen]       = useState(false)

  // Re-sync the selected mode to the readiness suggestion each time the sheet
  // opens. useState's initializer only runs on first mount, and this component
  // stays mounted between opens (the parent gates via the `open` prop rather
  // than conditional mount), so without this the user would see stale state.
  useEffect(() => {
    if (open) setSelectedMode(validInitial)
  }, [open, validInitial])

  if (!open) return null

  const selected = recs[selectedMode] || recs.push
  const last     = history[history.length - 1]
  const pct      = confidencePct(selected.meta?.n, selected.meta?.rSquared)
  const color    = confidenceColor(pct)

  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex: 250 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-lg bg-card rounded-t-3xl border-t border-x border-white/10 shadow-2xl p-5 pb-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        {/* ── Exercise name — small heading above the recommendation ───── */}
        <div className="text-[12px] font-semibold text-c-secondary mb-0.5 pl-[18px] truncate">
          {exerciseName}
        </div>

        {/* ── Header: AI-tipped recommendation + last session context ─── */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            {selected.prescription ? (
              <>
                <div className="flex items-baseline gap-2 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 text-sm text-emerald-300 font-semibold shrink-0">
                    <SparkleIcon className="w-3 h-3" color="currentColor" />
                    Recommended top set:
                  </span>
                  <span className="text-2xl font-extrabold text-c-primary tabular-nums tracking-tight">
                    {selected.prescription.weight} × {selected.prescription.reps}
                  </span>
                </div>
                {last && (
                  <div className="text-[11px] text-c-faint mt-0.5 pl-[18px]">
                    Last session's top set: <span className="tabular-nums">{last.weight} × {last.reps}</span>
                  </div>
                )}
              </>
            ) : (
              <span className="text-sm text-c-muted">No prescription yet</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-item text-c-secondary flex items-center justify-center text-lg shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* ── e1RM sparkline with explicit title + stat key ─────────────
            Three variables the viewer needs: what is the line (title),
            what's the highest point (peak), and how fast it's climbing
            (growth rate). Each gets its own labeled field so nothing is
            orphaned on the chart. */}
        {history.length >= 2 && (
          <div className="rounded-xl bg-base/30 border border-white/5 px-3 py-2.5 mb-3">
            {/* Title: what the chart is */}
            <div className="text-[11px] font-semibold text-c-secondary">
              Estimated 1-rep max
              <span className="text-c-faint font-normal"> · last {Math.min(history.length, 6)} sessions</span>
            </div>
            {/* The chart itself (no in-chart labels anymore) */}
            <div className="mt-1.5">
              <E1RMSparkline
                history={history}
                accentColor={accentColor}
                rate={selected.meta?.progressionRate ?? 0}
              />
            </div>
            {/* Key: defines each number explicitly */}
            <div className="flex items-baseline justify-between gap-3 mt-2 text-[11px]">
              <div>
                <span className="text-c-faint">Peak:</span>{' '}
                <span className="text-c-primary font-semibold tabular-nums">
                  {Math.round(Math.max(...history.slice(-6).map(p => p.e1RM || 0)))} lbs
                </span>
              </div>
              <div>
                <span className="text-c-faint">Growth:</span>{' '}
                <span style={{ color: accentColor }} className="font-semibold tabular-nums">
                  {formatWeeklyRate(selected.meta?.progressionRate ?? 0)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Mode chips ──────────────────────────────────────────────
            2 chips by default (Maintain | Push). When the user's readiness
            goal was Recover, a Deload chip joins so they can compare the
            65%-of-e1RM recovery prescription against the alternatives. */}
        <div className={`grid ${showDeloadChip ? 'grid-cols-3' : 'grid-cols-2'} gap-2 mb-3`}>
          {showDeloadChip && (
            <ModeChip
              mode="deload"
              recs={recs}
              selected={selectedMode === 'deload'}
              onSelect={() => setSelectedMode('deload')}
            />
          )}
          <ModeChip
            mode="maintain"
            recs={recs}
            selected={selectedMode === 'maintain'}
            onSelect={() => setSelectedMode('maintain')}
          />
          <ModeChip
            mode="push"
            recs={recs}
            selected={selectedMode === 'push'}
            onSelect={() => setSelectedMode('push')}
          />
        </div>

        {/* ── Reasoning (plain English; no "Why" subheader) ────────── */}
        <div className="rounded-xl border border-white/5 bg-base/30 px-4 py-3 mb-3">
          <div className="text-sm text-c-secondary leading-relaxed">{selected.reasoning}</div>
        </div>

        {/* ── Confidence with tap-to-explain (collapsed by default) ─ */}
        {pct != null && (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setWhyOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-item text-left"
            >
              <div className="flex items-center gap-2">
                <span style={{ color }} aria-hidden="true">●</span>
                <span className="text-sm font-semibold text-c-secondary">
                  Confidence: <span style={{ color }}>{pct}%</span>
                </span>
              </div>
              <span className="text-c-faint">{whyOpen ? '▴' : '▾'}</span>
            </button>
            {whyOpen && (
              <div className="mt-2 px-4 py-3 text-xs text-c-muted leading-relaxed border border-white/5 rounded-xl bg-base/20 space-y-2">
                <p>
                  Based on {selected.meta?.n ?? 0} prior {selected.meta?.n === 1 ? 'session' : 'sessions'}
                  {selected.meta?.rSquared > 0 && (
                    <>. Your e1RM has been tracking {describeFit(selected.meta.rSquared)} against the trend line.</>
                  )}
                </p>
                {(selected.meta?.n ?? 0) < 6 && (
                  <p>Log {6 - (selected.meta?.n ?? 0)} more consistent {6 - (selected.meta?.n ?? 0) === 1 ? 'session' : 'sessions'} and confidence will climb.</p>
                )}
                {(selected.meta?.n ?? 0) >= 6 && selected.meta?.rSquared < 0.9 && (
                  <p>Your recent sessions have varied more than usual. Trend confidence will rise once they settle into a cleaner pattern.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Details toggle — the math for the curious ────────────── */}
        <button
          type="button"
          onClick={() => setDetailsOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-item text-c-secondary"
        >
          <span className="text-xs font-semibold uppercase tracking-wider">Details</span>
          <span className="text-c-faint">{detailsOpen ? '▴' : '▾'}</span>
        </button>

        {detailsOpen && (
          <div className="mt-2 space-y-1.5 text-xs px-1">
            {selected.meta?.currentE1RM > 0 && (
              <ContextRow
                label="Estimated 1-rep max"
                value={`${selected.meta.currentE1RM} lbs`}
                hint={
                  "The heaviest single rep you could probably hit right now, estimated from your top set.\n" +
                  "Epley's formula: w × (1 + reps/30)."
                }
              />
            )}
            {last && (
              <ContextRow
                label="Last session"
                value={`${last.weight} × ${last.reps}  ·  ${daysAgoLabel(last.date, now)}`}
              />
            )}
            {selected.meta?.n >= 3 && (
              <ContextRow
                label="Trend fit"
                value={`${selected.meta.n} sessions · R²=${(selected.meta.rSquared).toFixed(2)} · ${formatWeeklyRate(selected.meta.progressionRate)}${selected.meta.usedFit ? '' : ' (default)'}`}
                hint={
                  "Linear fit of your e1RM across recent sessions. R² (0 to 1) is how cleanly the points land on a straight line.\n" +
                  "Higher = more predictable trend."
                }
              />
            )}
            {last && selected.prescription && (
              <ContextRow
                label="vs last session"
                value={
                  (() => {
                    const deltaLbs = selected.prescription.weight - last.weight
                    const deltaPct = last.weight > 0 ? (deltaLbs / last.weight) * 100 : 0
                    const sign = deltaLbs >= 0 ? '+' : ''
                    return `${sign}${deltaLbs} lbs (${sign}${deltaPct.toFixed(1)}%)`
                  })()
                }
                hint={
                  "How much the prescribed weight changes from last session's top set. This can jump by a lot when your e1RM floor has climbed since last time (most often the case). A smaller per-session cap only kicks in if your e1RM plateaus and the engine is relying on the weekly nudge to push past the stall, not the floor."
                }
              />
            )}
            {selected.meta?.layer2Weight > 0 && (
              <ContextRow
                label={`Floor @ ${targetReps} reps`}
                value={`${selected.meta.layer2Weight} lbs`}
                hint={
                  `Your strength baseline for ${targetReps} reps, based on your current e1RM.\n` +
                  `Standard lifting math says a ${targetReps}-rep max is about ${Math.round(selected.meta.layer2Weight / Math.max(1, selected.meta.currentE1RM) * 100)}% of a 1-rep max. So ${selected.meta.currentE1RM} × ${(selected.meta.layer2Weight / Math.max(1, selected.meta.currentE1RM)).toFixed(2)} ≈ ${selected.meta.layer2Weight} lbs. Push recommendations stay at or above this, so a lighter day doesn't undo your gains.`
                }
              />
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── ModeChip — Maintain / Push chip with distinct color + icon ────────────
// Maintain: flat line icon + blue accent. Push: rising line icon + emerald
// accent. Selected state uses the accent color for bg tint + border.

function ModeChip({ mode, recs, selected, onSelect }) {
  const r = recs[mode]
  const cfg = MODE_CHIP_CONFIG[mode]
  const tintBg     = selected ? cfg.selectedBg     : 'bg-item'
  const tintBorder = selected ? cfg.selectedBorder : 'border-transparent'

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-colors border ${tintBg} ${tintBorder}`}
    >
      <span
        className="inline-flex items-center gap-1"
        style={{ color: selected ? cfg.color : 'var(--text-faint)' }}
      >
        <cfg.Icon className="w-3.5 h-2.5" color="currentColor" />
        <span className="text-[10px] uppercase tracking-wider font-semibold">{cfg.label}</span>
      </span>
      <span className="text-sm font-bold text-c-primary tabular-nums">
        {r.prescription ? `${r.prescription.weight}×${r.prescription.reps}` : '—'}
      </span>
    </button>
  )
}

function FlatLineIcon({ color, className }) {
  return (
    <svg className={className} viewBox="0 0 24 8" fill="none" aria-hidden="true">
      <line x1="2" y1="4" x2="22" y2="4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function RisingLineIcon({ color, className }) {
  return (
    <svg className={className} viewBox="0 0 24 12" fill="none" aria-hidden="true">
      <polyline
        points="2,10 8,7 14,5 22,1"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="18,1 22,1 22,5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DescendingLineIcon({ color, className }) {
  return (
    <svg className={className} viewBox="0 0 24 12" fill="none" aria-hidden="true">
      <polyline
        points="2,1 8,4 14,7 22,10"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="18,10 22,10 22,6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const MODE_CHIP_CONFIG = {
  deload: {
    label:          'Deload',
    sub:            'Recover today',
    Icon:           DescendingLineIcon,
    color:          '#f97316',
    selectedBg:     'bg-orange-500/10',
    selectedBorder: 'border-orange-500/40',
  },
  maintain: {
    label:          'Maintain',
    sub:            'Keep it steady',
    Icon:           FlatLineIcon,
    color:          '#60a5fa',
    selectedBg:     'bg-blue-500/10',
    selectedBorder: 'border-blue-500/40',
  },
  push: {
    label:          'Push',
    sub:            'Go for progress',
    Icon:           RisingLineIcon,
    color:          '#10b981',
    selectedBg:     'bg-emerald-500/10',
    selectedBorder: 'border-emerald-500/40',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────

function describeFit(rSquared) {
  if (rSquared >= 0.9)  return 'very closely'
  if (rSquared >= 0.75) return 'closely'
  if (rSquared >= 0.5)  return 'roughly'
  return 'loosely'
}

function ContextRow({ label, value, hint }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => hint && setOpen(v => !v)}
        className={`w-full flex items-center justify-between gap-3 text-left py-1 ${hint ? 'active:opacity-70' : 'cursor-default'}`}
        style={!hint ? { pointerEvents: 'none' } : undefined}
      >
        <span className="text-c-faint flex items-center gap-1.5">
          {label}
          {hint && <span className="text-c-muted text-[10px] opacity-60">{open ? '▴' : 'ⓘ'}</span>}
        </span>
        <span className="text-c-secondary text-right tabular-nums">{value}</span>
      </button>
      {open && hint && (
        <div className="text-[11px] text-c-muted leading-relaxed pb-1 pr-4 italic whitespace-pre-line">{hint}</div>
      )}
    </div>
  )
}

function daysAgoLabel(dateString, now) {
  const days = Math.max(0, Math.round((now - new Date(dateString).getTime()) / 86400000))
  if (days === 0) return 'earlier today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
