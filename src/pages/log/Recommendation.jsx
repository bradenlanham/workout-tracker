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

  const W = 300, H = 90, padX = 10, padTop = 16, padBottom = 10
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

  // Simple trend line from first-point projection using the supplied rate
  // (avoids re-regressing). Dashed + subtle.
  const trendFirst = points[0]
  const daysSpan   = (new Date(window[window.length - 1].date) - new Date(window[0].date)) / 86400000
  const trendEndE  = (window[0].e1RM || 0) * (1 + (rate || 0) * (daysSpan / 7))
  const trendEndY  = yFor(trendEndE)
  const trendLast  = [points[points.length - 1][0], trendEndY]

  const rateLabel = formatWeeklyRate(rate)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`e1RM trend, ${rateLabel} over ${window.length} sessions`}>
      {/* Trend line (dashed, subtle) */}
      <line
        x1={trendFirst[0]} y1={trendFirst[1]}
        x2={trendLast[0]}  y2={trendLast[1]}
        stroke={accentColor} strokeWidth="1" strokeDasharray="3 3" opacity="0.4"
      />
      {/* Connecting polyline */}
      <polyline points={polylinePts} fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Data points */}
      {points.map(([x, y], i) => {
        const isLast = i === points.length - 1
        return (
          <circle
            key={i}
            cx={x} cy={y}
            r={isLast ? 4 : 3}
            fill={accentColor}
            stroke={isLast ? accentColor : 'none'}
            strokeWidth="2"
            opacity={isLast ? 1 : 0.7}
          />
        )
      })}
      {/* Rate label, top-right */}
      <text
        x={W - padX} y={12}
        textAnchor="end"
        fill={accentColor}
        fontSize="11"
        fontWeight="700"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        {rateLabel}
      </text>
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
        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-c-faint">Coach's call</div>
            <h3 className="text-lg font-bold text-c-primary truncate">{exerciseName}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-item text-c-secondary flex items-center justify-center text-lg shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* ── Headline prescription ─────────────────────────────────── */}
        <div className="rounded-2xl bg-item p-5 mb-4 text-center">
          {selected.prescription ? (
            <>
              <div className="text-[10px] uppercase tracking-wider text-c-faint mb-1">Top set</div>
              <div className="text-4xl font-extrabold text-c-primary tabular-nums tracking-tight">
                {selected.prescription.weight} × {selected.prescription.reps}
              </div>
            </>
          ) : (
            <div className="text-c-muted text-sm py-4">
              Log a few more sessions and I'll start prescribing loads.
            </div>
          )}
        </div>

        {/* ── e1RM sparkline (only when we have ≥ 2 data points) ───── */}
        {history.length >= 2 && (
          <div className="rounded-xl bg-base/30 border border-white/5 px-3 py-2 mb-4">
            <E1RMSparkline
              history={history}
              accentColor={accentColor}
              rate={selected.meta?.progressionRate ?? 0}
            />
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-c-faint mt-1">
              <span>e1RM trend</span>
              <span>{Math.min(history.length, 6)} sessions</span>
            </div>
          </div>
        )}

        {/* ── Mode chips ──────────────────────────────────────────────
            2 chips by default (Maintain | Push). When the user's readiness
            goal was Recover, a Deload chip joins so they can compare the
            65%-of-e1RM recovery prescription against the alternatives. */}
        <div className={`grid ${showDeloadChip ? 'grid-cols-3' : 'grid-cols-2'} gap-2 mb-4`}>
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
            {selected.meta?.thisSessionNudgePct > 0 && selectedMode === 'push' && (
              <ContextRow
                label="This session's nudge"
                value={`+${selected.meta.thisSessionNudgePct.toFixed(1)}%`}
                hint={
                  "How much weight we're adding this session, based on your progression rate.\n" +
                  "Capped at 3% per elapsed week. It's a hard limit that applies every session, even when your e1RM trend is climbing faster (like +10%/wk). Protects you from chasing a single-PR outlier into injury or a plateau."
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
      className={`py-3 px-3 rounded-xl text-center transition-colors border ${tintBg} ${tintBorder}`}
    >
      <div className="flex items-center justify-center gap-1.5 mb-0.5" style={{ color: selected ? cfg.color : 'var(--text-faint)' }}>
        <cfg.Icon className="w-5 h-3" color="currentColor" />
        <span className="text-[10px] uppercase tracking-wider font-semibold">{cfg.label}</span>
      </div>
      <div className="text-base font-bold text-c-primary tabular-nums">
        {r.prescription ? `${r.prescription.weight}×${r.prescription.reps}` : '—'}
      </div>
      <div className="text-[10px] text-c-faint mt-0.5">{cfg.sub}</div>
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
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
