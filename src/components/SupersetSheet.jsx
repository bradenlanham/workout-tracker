import { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'

// Batch 36 — Superset initiate / re-pair / active bottom sheet.
// Pure presentation surface driven by props. Parent (BbLogger's ExerciseItem)
// owns the state and passes in the variant + data. Three variants:
//
//   initiate   — no prior superset history, no active group. Picker only.
//   repair     — prior history exists. Show "Last time…" + re-pair button +
//                Customize (expands picker).
//   active     — exercise is currently in a live superset. Show members +
//                End button.
//
// z-index 245 — between RecommendationSheet (250) and PlateConfigPopover (220).

const SUPERSET_MAX = 3  // Max members in a superset (trigger + up to 2 partners)

export default function SupersetSheet({
  open,
  onClose,
  variant,              // 'initiate' | 'repair' | 'active'
  exerciseName,
  workoutExercises = [],  // [{id, name, group, done}]
  priorPartners = null,
  priorDate = null,
  activeMembers = null,   // [{id, name, supersetOrder}]
  onBegin,               // (partnerIds: string[]) => void
  onRepair,              // () => void
  onEnd,                 // () => void
  theme,
}) {
  const [selected, setSelected] = useState([])  // partner ids in selection order
  const [showPicker, setShowPicker] = useState(false)

  // Reset local state whenever the sheet opens so stale selections never leak
  // from a previous flow.
  useEffect(() => {
    if (open) {
      setSelected([])
      setShowPicker(variant === 'initiate')
    }
  }, [open, variant])

  // Escape to dismiss
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Re-pair partner resolution — check which partner names are still in the
  // current workout. Missing ones disable the Re-pair button.
  const priorPartnerResolution = useMemo(() => {
    if (!priorPartners?.length) return null
    const availableNames = new Set(workoutExercises.map(e => e.name))
    const missing = priorPartners.filter(n => !availableNames.has(n))
    const matchedIds = priorPartners
      .map(n => workoutExercises.find(e => e.name === n)?.id)
      .filter(Boolean)
    return { missing, matchedIds, allResolved: missing.length === 0 && matchedIds.length === priorPartners.length }
  }, [priorPartners, workoutExercises])

  // Group picker entries by section label, preserving workout order.
  // NOTE: All hooks must run unconditionally — the early `if (!open) return`
  // sits below this so React's hook-call order stays stable across renders.
  const grouped = useMemo(() => {
    const groups = []
    const seen = new Map()
    for (const ex of workoutExercises) {
      const g = ex.group || 'Other'
      if (!seen.has(g)) {
        const entry = { label: g, items: [] }
        groups.push(entry)
        seen.set(g, entry)
      }
      seen.get(g).items.push(ex)
    }
    return groups
  }, [workoutExercises])

  if (!open) return null

  const maxPartners = SUPERSET_MAX - 1  // trigger counts as 1
  const togglePartner = (id) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= maxPartners) return prev  // silent cap
      return [...prev, id]
    })
  }

  const selectedCount = selected.length
  const canBegin = selectedCount >= 1

  const formattedPriorDate = (() => {
    if (!priorDate) return ''
    try {
      const d = new Date(priorDate)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch { return '' }
  })()

  const handleBegin = () => {
    if (!canBegin) return
    onBegin?.(selected)
  }

  const renderActiveVariant = () => {
    const members = Array.isArray(activeMembers) ? activeMembers : []
    const sorted = [...members].sort((a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0))
    return (
      <>
        <p className="text-sm text-c-secondary mb-3">
          Cycling through: <strong className="text-c-primary">{sorted.map(m => m.name).join(' → ')}</strong>
        </p>
        <p className="text-xs text-c-muted mb-5">
          Each time you finish a set, the next exercise's weight input auto-focuses.
          The rest timer fires only after a full round.
        </p>
        <button
          type="button"
          onClick={onEnd}
          className="w-full py-3 rounded-xl bg-item text-c-secondary text-sm font-bold border border-c-subtle"
        >
          End superset
        </button>
      </>
    )
  }

  const renderPartnerPicker = () => (
    <>
      {workoutExercises.length === 0 ? (
        <p className="text-sm text-c-muted py-6 text-center">
          Add more exercises to the workout before you can superset.
        </p>
      ) : (
        <>
          <p className="text-xs text-c-muted mb-3">
            Pair <strong className="text-c-primary">{exerciseName}</strong> with up to {maxPartners} other exercise{maxPartners > 1 ? 's' : ''}.
            You'll cycle through them set by set.
          </p>
          <div className="max-h-64 overflow-y-auto -mx-1 pr-1 space-y-3 mb-3">
            {grouped.map(g => (
              <div key={g.label}>
                <p className="text-[10px] uppercase tracking-widest text-c-faint font-bold px-1 mb-1">{g.label}</p>
                <div className="space-y-1">
                  {g.items.map(ex => {
                    const isSelected = selected.includes(ex.id)
                    const atCap = !isSelected && selectedCount >= maxPartners
                    return (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => togglePartner(ex.id)}
                        disabled={atCap}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-colors ${
                          isSelected
                            ? 'bg-indigo-500/20 border border-indigo-500/50 text-indigo-200'
                            : atCap
                              ? 'bg-item text-c-faint opacity-50'
                              : 'bg-item text-c-secondary border border-transparent'
                        }`}
                      >
                        <span className="truncate font-semibold">{ex.name}</span>
                        {isSelected && <span className="text-indigo-300 text-xs font-bold shrink-0">✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          {selectedCount >= maxPartners && (
            <p className="text-[11px] text-c-muted text-center mb-2">
              Superset capped at {SUPERSET_MAX} exercises.
            </p>
          )}
        </>
      )}
      <button
        type="button"
        onClick={handleBegin}
        disabled={!canBegin}
        className={`w-full py-3 rounded-xl text-sm font-bold transition-colors ${
          canBegin
            ? 'bg-indigo-500 text-white'
            : 'bg-item text-c-faint cursor-not-allowed'
        }`}
      >
        Begin
      </button>
    </>
  )

  const renderRepairVariant = () => {
    if (!priorPartnerResolution) return null
    const { missing, allResolved } = priorPartnerResolution
    if (showPicker) return renderPartnerPicker()
    return (
      <>
        <p className="text-sm text-c-secondary mb-3">
          Last time{formattedPriorDate ? ` (${formattedPriorDate})` : ''} you paired{' '}
          <strong className="text-c-primary">{exerciseName}</strong> with{' '}
          <strong className="text-c-primary">{priorPartners.join(' + ')}</strong>.
        </p>
        {!allResolved && missing.length > 0 && (
          <p className="text-xs text-amber-400 mb-3">
            Missing from this workout: {missing.join(', ')}. Tap Customize to pick fresh partners.
          </p>
        )}
        <div className="space-y-2">
          <button
            type="button"
            onClick={allResolved ? onRepair : undefined}
            disabled={!allResolved}
            className={`w-full py-3 rounded-xl text-sm font-bold transition-colors ${
              allResolved
                ? 'bg-indigo-500 text-white'
                : 'bg-item text-c-faint cursor-not-allowed'
            }`}
          >
            Re-pair with same partners
          </button>
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="w-full py-2.5 rounded-xl bg-item text-c-secondary text-sm font-semibold border border-c-subtle"
          >
            Customize partners
          </button>
        </div>
      </>
    )
  }

  const title =
    variant === 'active' ? 'Active superset'
    : variant === 'repair' ? 'Superset'
    : 'Initiate superset'

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 flex items-end"
      style={{ zIndex: 245 }}
      onClick={onClose}
    >
      <div
        className="bg-card w-full max-w-lg mx-auto rounded-t-3xl p-5"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span className="text-indigo-400">↔</span>
            <span>{title}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-item text-c-muted"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {variant === 'active' && renderActiveVariant()}
        {variant === 'repair' && renderRepairVariant()}
        {variant === 'initiate' && renderPartnerPicker()}
      </div>
    </div>,
    document.body
  )
}
