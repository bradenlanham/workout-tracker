// Batch 16c — RPE (Rate of Perceived Exertion) capture for individual sets.
//
// Per spec §3.7, RPE is the single largest accuracy improvement available
// to the recommender: `effectiveRepsBeaten = repsHit + estimatedRIR
// − targetReps`. Optional is critical — forced entry kills adherence.
//
// This file exports two components:
//   RpePill   — the inline chip rendered on each set row (editable) or
//               ghost row (read-only). Empty state shows "RPE" in a
//               muted pill; set state shows the number in bold.
//   RpePicker — the bottom-sheet picker with 1–10 buttons + Clear.
//               Rendered via createPortal so it stacks above the numpad
//               and RestTimer. Includes a short explainer so users who
//               don't know RPE can learn it inline.

import { useState } from 'react'
import { createPortal } from 'react-dom'

// ── RpePill — the tappable chip on each set row ───────────────────────────

export function RpePill({ value, onChange, readOnly = false }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const hasValue = typeof value === 'number' && value >= 1 && value <= 10

  // Ghost-row / read-only: just render the value, no tap behavior. If unset,
  // render an invisible placeholder so ghost-row widths match the editable
  // row's widths for clean column alignment.
  if (readOnly) {
    if (!hasValue) return <div className="w-11 h-9 shrink-0" aria-hidden="true" />
    return (
      <div className="w-11 h-9 rounded-lg bg-item text-c-dim text-sm font-semibold flex items-center justify-center shrink-0 tabular-nums">
        {value}
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className={`w-11 h-10 rounded-lg text-sm font-bold shrink-0 transition-colors flex items-center justify-center tabular-nums ${
          hasValue
            ? 'bg-fuchsia-500/20 border border-fuchsia-500/40 text-fuchsia-300'
            : 'bg-item text-c-faint'
        }`}
        style={{ fontSize: hasValue ? 16 : 10 }}
        title="RPE — how hard was this set (tap to set)"
      >
        {hasValue ? value : 'RPE'}
      </button>
      <RpePicker
        open={pickerOpen}
        value={hasValue ? value : null}
        onClose={() => setPickerOpen(false)}
        onChange={v => { onChange(v); setPickerOpen(false) }}
      />
    </>
  )
}

// ── RpePicker — bottom-sheet 1–10 selector ────────────────────────────────

const RPE_DESCRIPTIONS = {
  6:  '3 reps in reserve — easy',
  7:  '3 reps in reserve — easy',
  8:  '2 reps in reserve — challenging',
  9:  '1 rep in reserve — hard',
  10: 'nothing left — max effort',
}

function RpePicker({ open, value, onClose, onChange }) {
  if (!open) return null
  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex: 250 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-lg bg-card rounded-t-3xl border-t border-x border-white/10 shadow-2xl p-5"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-c-faint">Optional</div>
            <h3 className="text-base font-bold text-c-primary">How hard was this set?</h3>
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
        <p className="text-xs text-c-muted mb-4 leading-relaxed">
          RPE = reps in reserve. 10 is all-out failure; 8 means "2 more reps possible." Helps the coach
          prescribe next session.
        </p>

        <div className="grid grid-cols-5 gap-2 mb-3">
          {[6, 7, 8, 9, 10].map(n => {
            const selected = value === n
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={`py-3 rounded-xl text-lg font-extrabold tabular-nums transition-colors ${
                  selected
                    ? 'bg-fuchsia-500 text-white border border-fuchsia-400'
                    : 'bg-item text-c-primary border border-transparent hover:bg-hover'
                }`}
              >
                {n}
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-5 gap-2 mb-4">
          {[1, 2, 3, 4, 5].map(n => {
            const selected = value === n
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={`py-3 rounded-xl text-lg font-extrabold tabular-nums transition-colors ${
                  selected
                    ? 'bg-fuchsia-500 text-white border border-fuchsia-400'
                    : 'bg-item text-c-primary border border-transparent hover:bg-hover opacity-70'
                }`}
              >
                {n}
              </button>
            )
          })}
        </div>

        {value && RPE_DESCRIPTIONS[value] && (
          <div className="text-center text-xs text-c-muted mb-4">{RPE_DESCRIPTIONS[value]}</div>
        )}

        <button
          type="button"
          onClick={() => onChange(null)}
          className="w-full py-3 rounded-xl bg-item text-c-muted text-sm font-semibold"
        >
          Clear
        </button>
      </div>
    </div>,
    document.body
  )
}
