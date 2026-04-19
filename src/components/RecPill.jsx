import { formatRec } from '../utils/helpers'

// Batch 17h — shared rec pill (Step 9). Renders `exercise.rec` in any
// supported shape (null / legacy string / structured {sets, reps, note}).
// Empty state shows a subtle "+ Rec" chip; set state shows the blue pill.
// `onTap` opens the RecEditor in the consumer (WorkoutEditSheet uses the
// full editor; BbLogger's RecInline keeps its inline-input path for speed
// but still displays via `formatRec`).

export default function RecPill({ rec, onTap, size = 'sm', className = '' }) {
  const text = formatRec(rec)
  const sizeCls = size === 'xs'
    ? 'text-[10px] px-1.5 py-0.5'
    : 'text-xs px-2 py-0.5'

  if (!text) {
    return (
      <button
        type="button"
        onClick={onTap}
        aria-label="Add coach's prescription"
        className={`shrink-0 inline-flex items-center gap-1 rounded-lg font-semibold bg-base text-c-faint ${sizeCls} ${className}`}
        title="Coach's prescription (tap to set)"
      >
        <span aria-hidden="true">📋</span>
        <span>Rec</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`Coach's prescription: ${text}. Tap to edit.`}
      className={`shrink-0 inline-flex items-center gap-1 rounded-lg font-semibold bg-blue-500/15 border border-blue-500/40 text-blue-300 max-w-[10rem] ${sizeCls} ${className}`}
      title="Coach's prescription (tap to edit)"
    >
      <span aria-hidden="true">📋</span>
      <span className="truncate">{text}</span>
    </button>
  )
}
