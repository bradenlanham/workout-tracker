import { useState, useRef, useEffect, useCallback, useMemo, createContext, useContext } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import useStore from '../../store/useStore'
import { BB_EXERCISE_GROUPS, BB_WORKOUT_NAMES, BB_WORKOUT_EMOJI } from '../../data/exercises'
import {
  getLastBbSession, getExercisePRs, isSetPR, getWorkoutStreak, perSideLoad,
  findSimilarExercises, normalizeExerciseName,
  getExerciseHistory, recommendNextLoad, buildReadiness, buildFatigueSignals,
  detectAnomalies, formatRec, getInstancesForExercise,
  shouldPromptGymTag, isExerciseAvailableAtGym,
} from '../../utils/helpers'
import { getTheme } from '../../theme'
import ShareCard from './ShareCard'
import CustomNumpad from '../../components/CustomNumpad'
import CreateExerciseModal from '../../components/CreateExerciseModal'
import { RecommendationChip, RecommendationSheet, AnomalyBanner, GymTagPrompt } from './Recommendation'
import ReadinessCheckIn from './ReadinessCheckIn'
import SessionGymPill from './SessionGymPill'

// Shared context so SetRow/PlateSetRow can register with the page-level numpad
// without prop drilling through ExerciseItem.
export const NumpadContext = createContext(null)

// ── Per-workout-type accent color and warmup tip ───────────────────────────────

const WORKOUT_COLORS = {
  push:   '#f97316',
  legs1:  '#22c55e',
  pull:   '#3b82f6',
  push2:  '#a855f7',
  legs2:  '#14b8a6',
  custom: '#6b7280',
}

// ── Plate-loaded mode constants ────────────────────────────────────────────────

const PLATE_OPTIONS = [100, 45, 35, 25, 10, 5, 2.5]
const COMMON_PLATES = [100, 45, 35, 25, 10]      // 16h: 100 moves inline; 5/2.5 behind + expand
const RARE_PLATES   = [5, 2.5]
const BAR_CYCLE     = [0, 25, 45]                // 16h: ascending order in popover; 45 remains default
const CIRCLED = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨']
const circled = n => n >= 1 && n <= 9 ? CIRCLED[n - 1] : `×${n}`
const emptyPlates = () => ({ 100: 0, 45: 0, 35: 0, 25: 0, 10: 0, 5: 0, 2.5: 0 })
const calcTotal = (plates, barWeight, multiplier = 2) =>
  Object.entries(plates).reduce((s, [w, c]) => s + Number(w) * c * multiplier, 0) + barWeight
const formatPlateBreakdown = (plates) =>
  Object.entries(plates)
    .filter(([, c]) => c > 0)
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([w, c]) => `${w}${circled(c)}`)
    .join(' ')

// ── Binder clip SVG ────────────────────────────────────────────────────────────

function ClipGraphic() {
  return (
    <svg width="56" height="32" viewBox="0 0 56 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="12" width="54" height="19" rx="6" fill="url(#clipGrad)" />
      <rect x="10" y="18" width="36" height="7" rx="3" fill="rgba(0,0,0,0.30)" />
      <rect x="1" y="12" width="54" height="5" rx="5" fill="rgba(255,255,255,0.25)" />
      <path d="M11 12 L8 2 L17 2 L19 12 Z" fill="url(#clipGrad)" />
      <path d="M45 12 L48 2 L39 2 L37 12 Z" fill="url(#clipGrad)" />
      <defs>
        <linearGradient id="clipGrad" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#e5e7eb" />
          <stop offset="100%" stopColor="#9ca3af" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ── Set type toggle ────────────────────────────────────────────────────────────

const SET_TYPES = [
  { id: 'working', label: 'Work' },
  { id: 'drop',    label: 'Drop' },
  { id: 'warmup',  label: 'Warm' },
]

function SetTypeBtn({ value, onChange, theme }) {
  const current = SET_TYPES.find(t => t.id === value) || SET_TYPES[0]
  const next    = SET_TYPES[(SET_TYPES.indexOf(current) + 1) % SET_TYPES.length]
  const color      = current.id === 'working' ? `${theme.bg} text-white`
                   : current.id === 'warmup'  ? 'bg-amber-500 text-white'
                   : 'bg-orange-500 text-white'
  const colorStyle = current.id === 'working' ? { color: theme.contrastText } : {}
  return (
    <button
      type="button"
      onClick={() => onChange(next.id)}
      className={`w-14 h-10 rounded-lg text-xs font-bold shrink-0 transition-colors ${color}`}
      style={colorStyle}
    >
      {current.label}
    </button>
  )
}

// ── Plate-mode config popover (Batch 16e) ─────────────────────────────────────
// Appears below the Plates toggle when plate mode is active — lets the user
// set Bar weight and 1×/2× multiplier without permanent real estate on the
// card. Outside click or the Turn off button dismisses.

function PlateConfigPopover({ open, onClose, anchorRef, barWeight, multiplier, onBarChange, onMultChange, onTurnOff, onConfirm, theme }) {
  const popoverRef = useRef(null)
  const [pos, setPos] = useState(null)

  // Compute popover position from the anchor (Plates button) whenever the
  // popover opens. Uses fixed positioning via portal so the card's
  // overflow-hidden doesn't clip it.
  useEffect(() => {
    if (!open) { setPos(null); return }
    const rect = anchorRef?.current?.getBoundingClientRect()
    if (!rect) return
    setPos({ top: rect.bottom + 8, left: rect.left })
  }, [open, anchorRef])

  useEffect(() => {
    if (!open) return
    const handler = e => {
      const insidePopover = popoverRef.current?.contains(e.target)
      const insideAnchor  = anchorRef?.current?.contains(e.target)
      if (!insidePopover && !insideAnchor) onClose()
    }
    // Delay attaching so the opening click doesn't immediately dismiss.
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler)
      document.addEventListener('touchstart', handler)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [open, onClose, anchorRef])

  if (!open || !pos) return null

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed bg-card border border-white/10 rounded-xl shadow-xl p-3 w-60"
      style={{ zIndex: 220, top: pos.top, left: pos.left }}
      onClick={e => e.stopPropagation()}
    >
      <div className="text-[10px] uppercase tracking-wider text-c-faint mb-2">Plate setup</div>

      <div className="mb-3">
        <div className="text-xs text-c-muted mb-1.5">Bar weight</div>
        <div className="flex gap-1.5">
          {BAR_CYCLE.map(w => {
            const selected = barWeight === w
            return (
              <button
                key={w}
                type="button"
                onClick={() => onBarChange(w)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                  selected ? `${theme.bgSubtle} border ${theme.border} ${theme.text}` : 'bg-item text-c-dim border border-transparent'
                }`}
              >
                {w === 0 ? 'None' : `${w} lb`}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mb-3">
        <div className="text-xs text-c-muted mb-1.5">Loaded on</div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onMultChange(1)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
              multiplier === 1 ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400' : 'bg-item text-c-dim border border-transparent'
            }`}
          >
            1× one side
          </button>
          <button
            type="button"
            onClick={() => onMultChange(2)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
              multiplier === 2 ? 'bg-blue-500/20 border border-blue-500/40 text-blue-400' : 'bg-item text-c-dim border border-transparent'
            }`}
          >
            2× both sides
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onTurnOff}
          className="flex-1 py-2 rounded-lg bg-item text-c-muted text-xs font-semibold"
          style={{ flexBasis: '0', flexGrow: 2 }}
        >
          Turn off plate mode
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold"
          style={{ flexBasis: '0', flexGrow: 1 }}
        >
          ✓ Confirm
        </button>
      </div>
    </div>,
    document.body
  )
}

// ── Machine / equipment-instance popover (spec §3.4, Batch 19) ─────────────────
//
// Opens below the Machine chip in the exercise toolbar. Shows prior instances
// tapped from this exercise's history (tap to select), a free-text "Other…"
// input that commits on Enter, and a Clear option when one is currently set.
// All state is owned by the parent ExerciseItem via `value` + `onChange`.

function EquipmentInstancePopover({
  open, onClose, anchorRef, value, options, onChange, theme,
}) {
  const popoverRef = useRef(null)
  const [pos, setPos] = useState(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (!open) { setPos(null); setDraft(''); return }
    const rect = anchorRef?.current?.getBoundingClientRect()
    if (!rect) return
    // Anchor the popover's right edge near the button's right edge so the
    // panel stays within the viewport when the chip sits at the end of the
    // toolbar row (common case). 240px panel width matches the design.
    const width = 240
    const left = Math.min(rect.right - width, window.innerWidth - width - 8)
    setPos({ top: rect.bottom + 8, left: Math.max(8, left), width })
  }, [open, anchorRef])

  useEffect(() => {
    if (!open) return
    const handler = e => {
      const insidePopover = popoverRef.current?.contains(e.target)
      const insideAnchor  = anchorRef?.current?.contains(e.target)
      if (!insidePopover && !insideAnchor) onClose()
    }
    const onKey = e => { if (e.key === 'Escape') onClose() }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler)
      document.addEventListener('touchstart', handler)
      document.addEventListener('keydown', onKey)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, anchorRef])

  if (!open || !pos) return null

  // Surface the currently-set value at the top of the options list even if
  // it hasn't been saved to any session yet (e.g. just typed in this session),
  // so the user can see their current choice and the row's selected style.
  const displayOptions = (() => {
    const list = Array.isArray(options) ? [...options] : []
    const hasCurrent = list.some(o => value && o.toLowerCase() === value.toLowerCase())
    if (value && !hasCurrent) list.unshift(value)
    return list
  })()

  const commitDraft = () => {
    const v = (draft || '').trim().slice(0, 40)
    if (!v) return
    onChange(v)
    onClose()
  }

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed bg-card border border-white/10 rounded-xl shadow-xl p-3"
      style={{ zIndex: 220, top: pos.top, left: pos.left, width: pos.width }}
      onClick={e => e.stopPropagation()}
    >
      <div className="text-[10px] uppercase tracking-wider text-c-faint mb-2">
        Which machine?
      </div>

      {displayOptions.length > 0 && (
        <div className="mb-2 space-y-1">
          {displayOptions.map(opt => {
            const selected = value && opt.toLowerCase() === value.toLowerCase()
            return (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); onClose() }}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  selected
                    ? `${theme.bgSubtle} border ${theme.border} ${theme.text}`
                    : 'bg-item text-c-secondary border border-transparent'
                }`}
              >
                {opt}
              </button>
            )
          })}
        </div>
      )}

      <div className="mb-2">
        <div className="text-[11px] text-c-muted mb-1">Other</div>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitDraft() }
            }}
            placeholder="e.g. Cybex"
            maxLength={40}
            className="flex-1 min-w-0 px-2.5 py-2 rounded-lg bg-item border border-white/10 text-xs text-c-primary placeholder-c-faint focus:outline-none focus:border-white/20"
          />
          <button
            type="button"
            onClick={commitDraft}
            disabled={!draft.trim()}
            className={`px-3 py-2 rounded-lg text-xs font-bold ${
              draft.trim()
                ? `${theme.bgSubtle} border ${theme.border} ${theme.text}`
                : 'bg-item text-c-faint border border-transparent'
            }`}
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {value ? (
          <button
            type="button"
            onClick={() => { onChange(''); onClose() }}
            className="flex-1 py-2 rounded-lg bg-item text-c-muted text-xs font-semibold"
          >
            Clear
          </button>
        ) : (
          <div className="flex-1 text-[11px] text-c-faint py-2 text-center">
            Optional — leave blank if not on a machine.
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Previous-session ghost row (non-interactive) ───────────────────────────────

function PrevSetRow({ set }) {
  const plateText = set.plates ? formatPlateBreakdown(set.plates) : null
  return (
    <div className="flex items-center gap-2 opacity-35 pointer-events-none select-none">
      <div className="w-14 h-9 rounded-lg bg-item text-c-dim text-xs font-bold flex items-center justify-center shrink-0">
        {set.type === 'warmup' ? 'Warm' : set.type === 'drop' ? 'Drop' : 'Work'}
      </div>
      {plateText ? (
        <div className="flex-1 h-9 rounded-lg bg-item text-c-dim text-xs font-semibold flex items-center justify-center gap-1 px-2">
          <span>{plateText}</span>
          <span className="opacity-50">=</span>
          <span>{set.rawWeight ?? set.weight}</span>
        </div>
      ) : (
        <div className="w-20 h-9 rounded-lg bg-item text-c-dim text-sm font-semibold flex items-center justify-center">
          {(set.rawWeight ?? set.weight) ? `${set.rawWeight ?? set.weight}` : '—'}
        </div>
      )}
      <div className="w-16 h-9 rounded-lg bg-item text-c-dim text-sm font-semibold flex items-center justify-center shrink-0">
        {set.reps || '—'}
      </div>
      <div className="flex-1 text-center text-sm">
        {set.isNewPR ? '🏆' : ''}
      </div>
      <div className="w-8 shrink-0" />
    </div>
  )
}

// ── Plate-loaded set row ───────────────────────────────────────────────────────

function PlateSetRow({ set, exerciseName, allSessions, onChange, onDelete, onBarChange, theme, plateMultiplier, onToggleMultiplier, repsRef, onAdvance, onDone, setIndex }) {
  const numpadCtx = useContext(NumpadContext)
  const plates    = set.plates    ?? emptyPlates()
  const barWeight = set.barWeight ?? 45
  const mult      = plateMultiplier || 2
  const total     = calcTotal(plates, barWeight, mult)
  const r         = parseInt(set.reps) || 0
  const isPR      = isSetPR(allSessions, exerciseName, total, r)

  // Always-fresh refs so stable callbacks never hold stale closures
  const setRef       = useRef(set)
  const onChgRef     = useRef(onChange)
  const multRef      = useRef(mult)
  const totalRef     = useRef(total)
  const onAdvanceRef = useRef(onAdvance)
  const onDoneRef    = useRef(onDone)
  setRef.current     = set
  onChgRef.current   = onChange
  multRef.current    = mult
  totalRef.current   = total
  onAdvanceRef.current = onAdvance
  onDoneRef.current    = onDone

  // Stable reps onChange for the numpad (never re-created)
  const handleRepsChange = useCallback((v) => {
    const s = setRef.current
    const m = multRef.current
    const t = totalRef.current
    onChgRef.current({ ...s, reps: v, plates: s.plates ?? emptyPlates(), barWeight: s.barWeight ?? 45, weight: String(t), plateMultiplier: m })
  }, [])

  // Advance to next set — numpad passes the freshest reps value directly
  // because React state hasn't flushed yet when onNext fires
  const handleNextSet = useCallback((currentNumpadValue) => {
    const repsVal = currentNumpadValue ?? setRef.current.reps
    if (repsVal && totalRef.current > 0) {
      onAdvanceRef.current?.()
    }
  }, [])

  // Mark exercise done (stable ref so it never goes stale)
  const handleDone = useCallback(() => {
    onDoneRef.current?.()
  }, [])

  const repsFieldKey = `reps-plate-${exerciseName}-${setIndex}`
  const isRepsActive = numpadCtx?.numpadConfig?.fieldKey === repsFieldKey

  const update = (newPlates, newBar) => {
    const newTotal = calcTotal(newPlates, newBar, mult)
    onChange({ ...set, plates: newPlates, barWeight: newBar, weight: String(newTotal), plateLoaded: true, plateMultiplier: mult })
  }
  const addPlate    = plate => update({ ...plates, [plate]: (plates[plate] || 0) + 1 }, barWeight)
  const removePlate = plate => update({ ...plates, [plate]: Math.max(0, (plates[plate] || 0) - 1) }, barWeight)
  const cycleBar    = () => {
    const idx = BAR_CYCLE.indexOf(barWeight)
    const newBar = BAR_CYCLE[(idx + 1) % BAR_CYCLE.length]
    update(plates, newBar)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <SetTypeBtn value={set.type} onChange={val => onChange({ ...set, type: val })} theme={theme} />
        <div className="flex-1 h-10 bg-item rounded-lg flex items-center justify-center gap-1.5 text-sm font-bold min-w-0">
          <span className="text-c-muted text-xs font-normal">Total</span>
          <span>{total} lbs</span>
          {isPR && <span className="text-xs">🏆</span>}
        </div>
        <input
          ref={repsRef}
          type="text"
          inputMode="none"
          value={set.reps}
          onChange={e => onChange({ ...set, reps: e.target.value, plates, barWeight, weight: String(total), plateMultiplier: mult })}
          onFocus={() => numpadCtx?.openNumpad({
            fieldKey: repsFieldKey,
            label: 'Reps',
            isDecimalAllowed: false,
            initialValue: set.reps,
            onChange: handleRepsChange,
            onNext: handleNextSet,
            onDone: handleDone,
            themeHex: theme.hex,
            themeContrastText: theme.contrastText,
          })}
          placeholder="reps"
          className="w-16 min-w-0 bg-item text-c-primary rounded-lg px-1 py-2 text-center text-base font-semibold h-10 outline-none"
          style={isRepsActive ? { boxShadow: `0 0 0 2px ${theme.hex}`, caretColor: 'transparent' } : { caretColor: 'transparent' }}
        />
        {set.reps && total > 0 ? (
          <button
            type="button"
            onClick={() => onAdvance?.()}
            className="w-8 h-10 flex items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={onDelete}
            className="w-8 h-10 flex items-center justify-center rounded-lg bg-item text-c-muted shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <PlatePicker plates={plates} addPlate={addPlate} removePlate={removePlate} theme={theme} />
    </div>
  )
}

// ── Plate picker — compact row w/ expand for rare plates ─────────────────────
// Default: 5 common plates (45/35/25/10/5) + chevron-expand icon.
// Tapping the chevron toggles visibility of rare plates (100, 2.5). Rare
// plates with count > 0 always stay visible regardless of toggle state so
// the user can still decrement them.

function PlatePicker({ plates, addPlate, removePlate, theme }) {
  const [showRare, setShowRare] = useState(false)
  const loadedRare = RARE_PLATES.filter(p => (plates[p] || 0) > 0)
  const hiddenRare = RARE_PLATES.filter(p => (plates[p] || 0) === 0)
  const rareVisible = showRare ? RARE_PLATES : loadedRare
  const expandIcon = showRare ? '×' : '+'

  const renderPlate = plate => {
    const count = plates[plate] || 0
    return (
      <div key={plate} className="relative shrink-0">
        <button
          type="button"
          onClick={() => addPlate(plate)}
          className={`h-8 px-2 rounded-lg text-xs font-bold transition-colors ${
            count > 0 ? `${theme.bg} text-white` : 'bg-item text-c-dim'
          }`}
          style={count > 0 ? { color: theme.contrastText } : {}}
        >
          {plate}{count > 0 ? ` ${circled(count)}` : ''}
        </button>
        {count > 0 && (
          <button
            type="button"
            onClick={() => removePlate(plate)}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-card border border-c-faint text-c-dim flex items-center justify-center"
            style={{ fontSize: '11px', lineHeight: 1 }}
          >
            −
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {COMMON_PLATES.map(renderPlate)}
      {rareVisible.map(renderPlate)}
      {hiddenRare.length > 0 && (
        <button
          type="button"
          onClick={() => setShowRare(v => !v)}
          className="h-8 w-8 rounded-lg bg-item text-c-muted text-sm font-bold shrink-0 flex items-center justify-center"
          title={showRare ? 'Hide rare plates' : 'Show rare plates (100, 2.5)'}
          aria-label={showRare ? 'Hide rare plates' : 'Show rare plates'}
        >
          {expandIcon}
        </button>
      )}
    </div>
  )
}

// ── Active set row ─────────────────────────────────────────────────────────────

function SetRow({ set, exerciseName, allSessions, onChange, onDelete, onBarChange, theme, plateLoaded, plateMultiplier, onToggleMultiplier, weightRef, repsRef, onAdvance, onDone, setIndex }) {
  const numpadCtx    = useContext(NumpadContext)
  const localRepsRef = useRef(null)

  // Always-fresh refs so stable callbacks never hold stale closures
  const setRef        = useRef(set)
  const onChgRef      = useRef(onChange)
  const onAdvanceRef  = useRef(onAdvance)
  const onDoneRef     = useRef(onDone)
  const numpadCtxRef  = useRef(numpadCtx)
  const themeRef      = useRef(theme)
  setRef.current      = set
  onChgRef.current    = onChange
  onAdvanceRef.current = onAdvance
  onDoneRef.current    = onDone
  numpadCtxRef.current = numpadCtx
  themeRef.current     = theme

  // Stable onChange handlers – recreated only when the field context changes
  const handleWeightChange = useCallback((v) => {
    onChgRef.current({ ...setRef.current, weight: v })
  }, [])

  const handleRepsChange = useCallback((v) => {
    onChgRef.current({ ...setRef.current, reps: v })
  }, [])

  // Advance to next set — numpad passes the freshest reps value directly
  // because React state hasn't flushed yet when onNext fires
  const handleNextSet = useCallback((currentNumpadValue) => {
    const repsVal = currentNumpadValue ?? setRef.current.reps
    if (setRef.current.weight && repsVal) {
      onAdvanceRef.current?.()
    }
  }, [])

  // Mark exercise done (stable ref so it never goes stale)
  const handleDone = useCallback(() => {
    onDoneRef.current?.()
  }, [])

  // Focus reps from weight field.
  // We do NOT call .focus() on the reps DOM element. All inputs use
  // inputMode="none" (no system keyboard), and our custom numpad is fully
  // controlled by React state (numpadConfig + numpadIsOpen). Calling .focus()
  // caused a 60ms-delayed click event from the Next button's pointerdown to
  // land on the "Tap to show all exercises" zone after the re-render shifted
  // the layout, which called closeNumpad and collapsed the keyboard.
  // Instead we just swap the numpad config to the reps field — the accent
  // ring shows via isRepsActive (config-driven), and typing goes through
  // handleRepsChange. No DOM focus needed.
  const repsFieldKeyRef = useRef(`reps-${exerciseName}-${setIndex}`)
  repsFieldKeyRef.current = `reps-${exerciseName}-${setIndex}`

  const handleFocusReps = useCallback(() => {
    numpadCtxRef.current?.openNumpad({
      fieldKey: repsFieldKeyRef.current,
      label: 'Reps',
      isDecimalAllowed: false,
      initialValue: setRef.current.reps,
      onChange: handleRepsChange,
      onNext: handleNextSet,
      onDone: handleDone,
      themeHex: themeRef.current.hex,
      themeContrastText: themeRef.current.contrastText,
    })
  }, [handleRepsChange, handleNextSet, handleDone])

  if (plateLoaded) {
    return (
      <PlateSetRow
        set={set}
        exerciseName={exerciseName}
        allSessions={allSessions}
        onChange={onChange}
        onDelete={onDelete}
        onBarChange={onBarChange}
        theme={theme}
        plateMultiplier={plateMultiplier}
        onToggleMultiplier={onToggleMultiplier}
        repsRef={el => { localRepsRef.current = el; if (repsRef) repsRef(el) }}
        onAdvance={onAdvance}
        onDone={onDone}
        setIndex={setIndex}
      />
    )
  }

  const w    = parseFloat(set.weight) || 0
  const r    = parseInt(set.reps)     || 0
  const isPR = isSetPR(allSessions, exerciseName, w, r)

  const weightFieldKey = `weight-${exerciseName}-${setIndex}`
  const repsFieldKey   = `reps-${exerciseName}-${setIndex}`
  const isWeightActive = numpadCtx?.numpadConfig?.fieldKey === weightFieldKey
  const isRepsActive   = numpadCtx?.numpadConfig?.fieldKey === repsFieldKey

  return (
    <div className="flex items-center gap-2">
      <SetTypeBtn value={set.type} onChange={val => onChange({ ...set, type: val })} theme={theme} />
      {/* Weight FIRST */}
      <input
        ref={weightRef}
        type="text"
        inputMode="none"
        value={set.weight}
        onChange={e => onChange({ ...set, weight: e.target.value })}
        onFocus={() => numpadCtx?.openNumpad({
          fieldKey: weightFieldKey,
          label: 'Weight (lbs)',
          isDecimalAllowed: true,
          initialValue: set.weight,
          onChange: handleWeightChange,
          onNext: handleFocusReps,
          onDone: handleDone,
          themeHex: theme.hex,
          themeContrastText: theme.contrastText,
        })}
        placeholder="lbs"
        className="w-20 min-w-0 bg-item text-c-primary rounded-lg px-1 py-2 text-center text-base font-semibold h-10 outline-none"
        style={isWeightActive ? { boxShadow: `0 0 0 2px ${theme.hex}`, caretColor: 'transparent' } : { caretColor: 'transparent' }}
      />
      {/* Reps SECOND */}
      <input
        ref={el => { localRepsRef.current = el; if (repsRef) repsRef(el) }}
        type="text"
        inputMode="none"
        value={set.reps}
        onChange={e => onChange({ ...set, reps: e.target.value })}
        onFocus={() => numpadCtx?.openNumpad({
          fieldKey: repsFieldKey,
          label: 'Reps',
          isDecimalAllowed: false,
          initialValue: set.reps,
          onChange: handleRepsChange,
          onNext: handleNextSet,
          onDone: handleDone,
          themeHex: theme.hex,
          themeContrastText: theme.contrastText,
        })}
        placeholder="reps"
        className="w-16 min-w-0 bg-item text-c-primary rounded-lg px-1 py-2 text-center text-base font-semibold h-10 outline-none"
        style={isRepsActive ? { boxShadow: `0 0 0 2px ${theme.hex}`, caretColor: 'transparent' } : { caretColor: 'transparent' }}
      />
      <span className="flex-1 text-center text-base">{isPR ? '🏆' : ''}</span>
      <button
        type="button"
        onClick={onDelete}
        className="w-8 h-10 flex items-center justify-center rounded-lg bg-item text-c-muted shrink-0"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── Exercise item ──────────────────────────────────────────────────────────────

function ExerciseItem({
  exercise, lastSessionEx, allSessions, onUpdate, theme,
  isFirst, isLast, onMoveUp, onMoveDown, reorderMode, workoutType,
  aggressivenessMultiplier = 1, suggestedMode = 'push',
  fatigueSignals = null, activeSessionId = null,
  currentGymId = null, currentGymLabel = null,
}) {
  const [expanded, setExpanded] = useState(false)
  const [showPrev, setShowPrev] = useState(false)
  const [editingRec, setEditingRec] = useState(false)
  const [recDraft, setRecDraft]     = useState(exercise.rec || '')

  const commitRec = () => {
    const val = (recDraft || '').trim().slice(0, 20)
    if ((exercise.rec || '') !== val) onUpdate({ ...exercise, rec: val })
    setEditingRec(false)
  }

  useEffect(() => {
    if (!expanded && editingRec) commitRec()
    // eslint-disable-next-line
  }, [expanded])
  const { settings, setRestEndTimestamp, dismissAnomaly, dismissGymPrompt } = useStore()
  const addExerciseGymTag    = useStore(s => s.addExerciseGymTag)
  const addSkipGymTagPrompt  = useStore(s => s.addSkipGymTagPrompt)
  const exerciseLibrary = useStore(s => s.exerciseLibrary)
  const numpadCtx = useContext(NumpadContext)
  const [recSheetOpen,    setRecSheetOpen]    = useState(false)
  const [plateConfigOpen, setPlateConfigOpen] = useState(false)
  const [machineOpen,     setMachineOpen]     = useState(false)
  const platesBtnRef      = useRef(null)
  const machineBtnRef     = useRef(null)

  // ── Focus mode: when numpad is open, check if THIS exercise owns the active field.
  // If the numpad is open but the active field belongs to a different exercise,
  // this exercise should auto-collapse to save screen space.
  const activeFieldKey = numpadCtx?.numpadConfig?.fieldKey || ''
  const ownsActiveField = activeFieldKey.includes(exercise.name)
  const numpadOpen = numpadCtx?.numpadIsOpen || false
  const focusCollapsed = numpadOpen && !ownsActiveField

  // Scope session history to the current workout type so that an exercise like
  // "Pull-ups" in Back Day and Full Body tracks PRs and notes independently.
  const scopedSessions = workoutType
    ? allSessions.filter(s => s.mode === 'bb' && s.data?.workoutType === workoutType)
    : allSessions.filter(s => s.mode === 'bb')
  const firstSetType = settings.defaultFirstSetType === 'working' ? 'working' : 'warmup'
  const setWeightRefs = useRef({})
  const setRepsRefs   = useRef({})
  const pendingFocusRef = useRef(null)
  // Populated after recHistory is computed below; read by updateSet's
  // auto-classify branch (§3.8). Ref avoids TDZ since updateSet is declared
  // earlier than recHistory.
  const recHistoryRef = useRef([])

  // Focus the weight (or reps for plate mode) input of a newly added set after render.
  // Use preventScroll to avoid the browser yanking the viewport when the new row appears.
  useEffect(() => {
    if (pendingFocusRef.current !== null) {
      const idx = pendingFocusRef.current
      pendingFocusRef.current = null
      requestAnimationFrame(() => {
        const weightEl = setWeightRefs.current[idx]
        const repsEl   = setRepsRefs.current[idx]
        const target = (exercise.plateLoaded && repsEl) ? repsEl : weightEl
        if (target) target.focus({ preventScroll: true })
      })
    }
  }, [exercise.sets.length, exercise.plateLoaded])

  const addSet = (autoFocus = false) => {
    const lastSet = exercise.sets[exercise.sets.length - 1]
    const prevSet = lastSessionEx?.sets?.[exercise.sets.length]
    const isFirstSet = exercise.sets.length === 0
    const newType = lastSet?.type === 'drop' ? 'drop' : (isFirstSet ? firstSetType : 'working')
    const newSet = {
      type:       newType,
      reps:       '',
      weight:     '',
    }
    if (exercise.plateLoaded) {
      newSet.plates    = emptyPlates()
      newSet.barWeight = exercise.barDefault ?? prevSet?.barWeight ?? 45
    }
    if (autoFocus) pendingFocusRef.current = exercise.sets.length
    onUpdate({ ...exercise, sets: [...exercise.sets, newSet] })
    if (settings.autoStartRest && lastSet?.type === 'working' && (lastSet.reps || lastSet.weight)) {
      setRestEndTimestamp(Date.now() + settings.restTimerDuration * 1000)
    }
  }

  const updateSet = (i, newSet) => {
    const sets = [...exercise.sets]
    const oldSet = sets[i]
    if (newSet.type === 'drop' && oldSet.type !== 'drop') {
      if (exercise.plateLoaded) {
        // Plate-loaded drop: clear plates, carry barDefault
        const barWeight = exercise.barDefault ?? 45
        newSet = { ...newSet, plates: emptyPlates(), barWeight, weight: '' }
      }
    }
    // Auto-classify on weight edits per spec §3.8: weight < 60% of recent
    // top e1RM → warmup, > 80% → working. Middle band keeps the current
    // type. Drop sets are never auto-reclassified. recHistory is declared
    // later in this component so we read it lazily here.
    if (newSet.weight !== oldSet.weight && newSet.type !== 'drop' && recHistoryRef.current?.length) {
      const hist = recHistoryRef.current
      const topE1RM = hist[hist.length - 1]?.e1RM || 0
      const w = parseFloat(newSet.weight) || 0
      if (w > 0 && topE1RM > 0) {
        const pct = w / topE1RM
        if (pct < 0.60)      newSet = { ...newSet, type: 'warmup' }
        else if (pct > 0.80) newSet = { ...newSet, type: 'working' }
      }
    }
    sets[i] = newSet
    // Sync barDefault when barWeight changes on a plate-loaded set (avoids stale closure from separate onBarChange call)
    const patch = { ...exercise, sets }
    if (exercise.plateLoaded && newSet.barWeight !== undefined) {
      patch.barDefault = newSet.barWeight
    }
    onUpdate(patch)
  }

  const deleteSet = (i) => {
    const sets = exercise.sets.filter((_, idx) => idx !== i)
    onUpdate({ ...exercise, sets: sets.length ? sets : [{ type: firstSetType, reps: '', weight: '' }] })
  }

  const markDone = () => {
    numpadCtx?.closeNumpad()
    onUpdate({ ...exercise, done: true, completedAt: Date.now() })
    setExpanded(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Stable ref-backed version for the numpad Done button (avoids stale closures)
  const exerciseRef    = useRef(exercise)
  const onUpdateRef    = useRef(onUpdate)
  const closeNumpadRef = useRef(numpadCtx?.closeNumpad)
  exerciseRef.current    = exercise
  onUpdateRef.current    = onUpdate
  closeNumpadRef.current = numpadCtx?.closeNumpad
  const stableMarkDone = useCallback(() => {
    closeNumpadRef.current?.()
    const ex = exerciseRef.current
    onUpdateRef.current({ ...ex, done: true, completedAt: Date.now() })
    setExpanded(false)
  }, [])

  const exercisePR = getExercisePRs(scopedSessions, exercise.name)
  const hasPR = scopedSessions.length > 0 && exercise.sets.some(s =>
    isSetPR(scopedSessions, exercise.name, parseFloat(s.weight) || 0, parseInt(s.reps) || 0)
  )

  // ── Recommendation (Batch 16b) ───────────────────────────────────────
  // Cross-workout-type by design: if the user does Pec Dec in push and
  // push2, recommendations should see both (spec §1.3 and §3.2). We pass
  // allSessions, not scopedSessions — different scoping from PR logic,
  // which is per workout type by the user's preference.
  const libraryEntry = useMemo(() => {
    if (!exercise.exerciseId && !exercise.name) return null
    return (
      exerciseLibrary.find(e => e.id === exercise.exerciseId) ||
      exerciseLibrary.find(e => e.name === exercise.name)
    )
  }, [exerciseLibrary, exercise.exerciseId, exercise.name])

  const recTargetReps = useMemo(() => {
    const range = libraryEntry?.defaultRepRange
    if (Array.isArray(range) && range.length === 2) {
      return Math.round((range[0] + range[1]) / 2)
    }
    return 10
  }, [libraryEntry])

  // Instance + gym scoping (spec §3.4, §3.5.6). Progressive fallback keyed
  // on the richness of available history:
  //   1. Instance + gym       (most specific — same machine at same gym)
  //   2. Gym only             (same gym, any machine — covers machine swaps within a gym)
  //   3. Instance only        (same machine at any gym — covers gym swaps on identically named machines)
  //   4. Unscoped             (everything — the pre-Batch-19 safety net)
  // Each tier must clear the ≥3-session bar to be used; otherwise we fall
  // to the next tier. Guarantees first-time-at-this-gym or first-time-on-this-machine
  // never cold-starts the recommender into silence.
  const currentInstance = (exercise.equipmentInstance || '').trim()
  const recHistoryId = libraryEntry?.id || exercise.exerciseId
  const recHistory = useMemo(() => {
    const unscoped = getExerciseHistory(allSessions, recHistoryId, exercise.name)
    // Fast path: no scoping to apply
    if (!currentInstance && !currentGymId) return unscoped
    const instScoped = currentInstance
      ? getExerciseHistory(allSessions, recHistoryId, exercise.name, currentInstance)
      : unscoped
    const gymScoped = currentGymId
      ? getExerciseHistory(allSessions, recHistoryId, exercise.name, null, currentGymId)
      : unscoped
    // Tier 1: instance + gym
    if (currentInstance && currentGymId) {
      const both = getExerciseHistory(allSessions, recHistoryId, exercise.name, currentInstance, currentGymId)
      if (both.length >= 3) return both
    }
    // Tier 2: gym alone
    if (currentGymId && gymScoped.length >= 3) return gymScoped
    // Tier 3: instance alone
    if (currentInstance && instScoped.length >= 3) return instScoped
    // Tier 4: unscoped safety net
    return unscoped
  }, [allSessions, recHistoryId, exercise.name, currentInstance, currentGymId])

  // Machine picker options — prior distinct instances for this exercise at
  // the current gym (if set) so the VASA picker doesn't show TR's machines.
  // Falls back to all instances when no gym is set or when the gym-scoped
  // list is empty (so first-time-at-this-gym still surfaces historical picks
  // as a starting point rather than showing an empty list).
  const machineOptions = useMemo(() => {
    const scoped = getInstancesForExercise(allSessions, recHistoryId, exercise.name, currentGymId)
    if (scoped.length > 0) return scoped
    return getInstancesForExercise(allSessions, recHistoryId, exercise.name)
  }, [allSessions, recHistoryId, exercise.name, currentGymId])

  // Machine chip visibility (Batch 19a): only surface for exercises whose
  // library entry is classified as equipment: 'Machine'. For Barbell,
  // Dumbbell, Bodyweight, Kettlebell, Cable, Other — or exercises with no
  // resolvable library entry — the chip is hidden so the toolbar doesn't
  // waste space on an irrelevant prompt. Users who want the chip on an
  // exercise currently classified otherwise can edit the library entry
  // in My Exercises.
  const showMachineChip = libraryEntry?.equipment === 'Machine'

  // Ref so the updateSet closure (declared above) can read the latest
  // recHistory for auto-classify without a temporal-dead-zone ReferenceError.
  recHistoryRef.current = recHistory

  // Recommendation: mode derives from the readiness "goal" answer (Batch 16n,
  // spec §2.5). Defaults to 'push' when no readiness data is present — same
  // behavior as pre-16n. aggressivenessMultiplier scales push-mode nudging.
  // fatigueSignals (Batch 16o, spec §4) adds grade / cardio / rest / gap
  // adjustments on top of readiness — all default to no-op when absent.
  const recommendation = useMemo(() => {
    if (!recHistory.length) return null
    return recommendNextLoad({
      history:          recHistory,
      targetReps:       recTargetReps,
      mode:             suggestedMode,
      progressionClass: libraryEntry?.progressionClass || 'isolation',
      loadIncrement:    libraryEntry?.loadIncrement    || 5,
      aggressivenessMultiplier,
      fatigueSignals:   fatigueSignals || {},
    })
  }, [recHistory, recTargetReps, libraryEntry?.progressionClass, libraryEntry?.loadIncrement, suggestedMode, aggressivenessMultiplier, fatigueSignals])

  // ── Anomaly detection (Batch 16q, step 9 / spec §4.5 + §9.3) ──────────
  // Runs plateau / regression / swing over the same recHistory used by the
  // recommender. Returns the highest-priority hit or null. Dismissal is
  // keyed to the active session's startTimestamp so banners reappear next
  // session until the underlying signal clears.
  const anomaly = useMemo(() => detectAnomalies(recHistory), [recHistory])
  const anomalyKey = exercise.exerciseId || exercise.name
  const dismissedFor = settings.dismissedAnomalies?.[anomalyKey]
  const dismissedThisSession = dismissedFor != null && activeSessionId != null && dismissedFor === activeSessionId
  const showAnomalyBanner = settings.enableAiCoaching && anomaly && !dismissedThisSession

  // ── Gym-tag prompt (Batch 20b, spec §3.5.4) ─────────────────────────────
  // Surface the "Tag X as available at Y?" prompt when the exercise has a
  // library entry, the session has a gym set, the exercise isn't already
  // tagged at this gym, AND the user hasn't opted out of prompts for this
  // (exercise, gym) pair (either via "Always skip" -> skipGymTagPrompt, or
  // via "Not this time" -> dismissedGymPrompts). libraryEntry.id (rather
  // than exercise.exerciseId) is used as the prompt key because
  // template-seeded exercises don't carry exerciseId until save time —
  // using libraryEntry.id matches what addExerciseGymTag expects.
  const promptKey = libraryEntry?.id
    ? `${libraryEntry.id}:${currentGymId}`
    : null
  const gymPromptDismissedFor = promptKey
    ? settings.dismissedGymPrompts?.[promptKey]
    : null
  const gymPromptDismissedThisSession = gymPromptDismissedFor != null && activeSessionId != null && gymPromptDismissedFor === activeSessionId
  const showGymTagPrompt =
    settings.enableAiCoaching &&
    !!libraryEntry &&
    !!currentGymId &&
    shouldPromptGymTag(libraryEntry, currentGymId) &&
    !gymPromptDismissedThisSession

  const topSet     = exercise.sets.find(s => s.reps || s.weight)
  const lastTopSet = lastSessionEx?.sets?.[0]
  const prevSets   = lastSessionEx?.sets || []

  const lastExNotes = (() => {
    const prev = [...scopedSessions]
      .filter(s => s.data?.exercises?.some(e => e.name === exercise.name))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
    if (!prev.length) return null
    const ex = prev[0].data.exercises.find(e => e.name === exercise.name)
    return ex?.notes || null
  })()

  // When the numpad is open and another exercise owns the focus, hide this card entirely
  if (focusCollapsed) return null

  return (
    <div className={`bg-card rounded-2xl overflow-hidden ${exercise.done ? 'opacity-80' : ''}`}>

      {/* ── Collapsed header ──────────────────────────────────────── */}
      <div className="flex items-center">
        {/* Drag handle — left, only in reorder mode */}
        {reorderMode && !exercise.done && (
          <div className="pl-3 pr-1 shrink-0 text-c-muted">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
        )}
        <div
          role="button"
          tabIndex={0}
          onClick={() => { if (!editingRec) setExpanded(v => !v) }}
          className="flex-1 flex items-center justify-between p-4 text-left min-w-0 cursor-pointer select-none"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {exercise.done && <span className="text-emerald-400 text-lg leading-none">✓</span>}
              <p className="font-semibold text-base truncate">{exercise.name}</p>
              {hasPR && !exercise.done && <span className="text-amber-400 text-sm">🏆</span>}
              {expanded && !exercise.done && settings.showRecPill && (
                editingRec ? (
                  <input
                    type="text"
                    value={recDraft}
                    onChange={e => setRecDraft(e.target.value.slice(0, 20))}
                    onBlur={commitRec}
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  { e.preventDefault(); commitRec() }
                      if (e.key === 'Escape') { setRecDraft(exercise.rec || ''); setEditingRec(false) }
                    }}
                    maxLength={20}
                    autoFocus
                    placeholder="e.g. 3x20 (warmup)"
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-item text-c-primary border border-blue-500/50 outline-none w-44"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      // Batch 17h — in-session rec edits stay as strings for
                      // speed. If the value is structured (set via Canvas /
                      // WorkoutEditSheet), pre-fill with the formatted display
                      // so the user sees the full prescription and can tweak.
                      const seed = typeof exercise.rec === 'string'
                        ? exercise.rec
                        : (formatRec(exercise.rec) || '')
                      setRecDraft(seed)
                      setEditingRec(true)
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 max-w-[14rem] ${
                      formatRec(exercise.rec)
                        ? 'bg-blue-500/15 border border-blue-500/40 text-blue-300'
                        : 'bg-item text-c-faint'
                    }`}
                    title="Coach's recommendation (tap to edit)"
                  >
                    <span>📋</span>
                    <span className="truncate">{formatRec(exercise.rec) || 'Rec'}</span>
                  </button>
                )
              )}
            </div>
            {/* Collapsed row: Last / Try hints removed per 16h feedback —
                cleaner collapsed state, all prescription detail lives in the
                expanded banner + sheet. In-progress/completed summaries
                below still render. */}
            {!expanded && !exercise.done && topSet && (topSet.reps || topSet.weight) && (
              <p className={`text-xs ${theme.text} mt-0.5`}>
                {topSet.weight ? `${topSet.weight} lbs` : ''}
                {topSet.weight && topSet.reps ? ' × ' : ''}
                {topSet.reps ? `${topSet.reps} reps` : ''}
                {' · '}{exercise.sets.filter(s => s.reps || s.weight).length} sets
              </p>
            )}
            {!expanded && exercise.done && (
              <p className="text-xs text-emerald-500 mt-0.5">
                {exercise.sets.filter(s => s.reps || s.weight).length} sets completed
              </p>
            )}
          </div>
          <svg
            className={`w-5 h-5 text-c-dim transition-transform shrink-0 ml-2 ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* ── Reorder arrows — right side, only in reorder mode ──────── */}
        {reorderMode && !exercise.done && (
          <div className="flex gap-1.5 pr-3 shrink-0">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={isFirst}
              className={`w-10 h-10 flex items-center justify-center rounded-xl text-lg font-bold transition-colors ${
                isFirst ? 'opacity-20 text-c-faint' : 'bg-item text-c-secondary active:bg-hover'
              }`}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={isLast}
              className={`w-10 h-10 flex items-center justify-center rounded-xl text-lg font-bold transition-colors ${
                isLast ? 'opacity-20 text-c-faint' : 'bg-item text-c-secondary active:bg-hover'
              }`}
            >
              ↓
            </button>
          </div>
        )}
      </div>

      {/* ── Expanded body ─────────────────────────────────────────────── */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">

          {/* Toolbar chips: Plates · Uni · Last · PR · Tip · Machine (wraps when tight) */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                ref={platesBtnRef}
                type="button"
                onClick={() => {
                  // Off→on: turn on AND open popover so the user can configure.
                  // On: re-open popover (don't toggle off — that's what Turn off
                  // plate mode button inside the popover does).
                  if (!exercise.plateLoaded) {
                    onUpdate({
                      ...exercise,
                      plateLoaded:     true,
                      barDefault:      exercise.barDefault      ?? 45,
                      plateMultiplier: exercise.plateMultiplier ?? 2,
                    })
                  }
                  setPlateConfigOpen(true)
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  exercise.plateLoaded
                    ? `${theme.bgSubtle} border ${theme.border} ${theme.text}`
                    : 'bg-item text-c-dim'
                }`}
              >
                Plates
                {exercise.plateLoaded && (
                  <span className="text-[10px] opacity-70 tabular-nums">
                    {exercise.barDefault ?? 45}·{exercise.plateMultiplier ?? 2}×
                  </span>
                )}
              </button>
              <PlateConfigPopover
                open={plateConfigOpen}
                onClose={() => setPlateConfigOpen(false)}
                anchorRef={platesBtnRef}
                barWeight={exercise.barDefault ?? 45}
                multiplier={exercise.plateMultiplier ?? 2}
                onBarChange={newBar => {
                  const mult = exercise.plateMultiplier ?? 2
                  const updatedSets = exercise.sets.map(s => {
                    if (!s.plates) return s
                    const newTotal = calcTotal(s.plates, newBar, mult)
                    return { ...s, barWeight: newBar, weight: String(newTotal) }
                  })
                  onUpdate({ ...exercise, barDefault: newBar, sets: updatedSets })
                }}
                onMultChange={newMult => {
                  const bar = exercise.barDefault ?? 45
                  const updatedSets = exercise.sets.map(s => {
                    if (!s.plates) return s
                    const newTotal = calcTotal(s.plates, s.barWeight ?? bar, newMult)
                    return { ...s, weight: String(newTotal), plateMultiplier: newMult }
                  })
                  onUpdate({ ...exercise, plateMultiplier: newMult, sets: updatedSets })
                }}
                onTurnOff={() => {
                  setPlateConfigOpen(false)
                  onUpdate({ ...exercise, plateLoaded: false })
                }}
                onConfirm={() => setPlateConfigOpen(false)}
                theme={theme}
              />
            </div>
            <button
              type="button"
              onClick={() => onUpdate({ ...exercise, unilateral: !exercise.unilateral })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                exercise.unilateral
                  ? 'bg-purple-500/20 border border-purple-500/40 text-purple-400'
                  : 'bg-item text-c-dim'
              }`}
            >
              Uni
            </button>
            {prevSets.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPrev(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  showPrev
                    ? 'bg-blue-500/20 border border-blue-500/40 text-blue-400'
                    : 'bg-item text-c-dim'
                }`}
              >
                Last
              </button>
            )}
            {exercisePR.maxWeight > 0 && (
              <span
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0 whitespace-nowrap"
                title="All-time PR for this exercise"
              >
                <span className="font-bold">PR</span>
                <span>{exercisePR.maxWeight}×{exercisePR.maxRepsAtMaxWeight}</span>
              </span>
            )}
            {settings.enableAiCoaching && recommendation?.prescription && recommendation.confidence !== 'none' && (
              <RecommendationChip
                recommendation={recommendation}
                onTap={() => setRecSheetOpen(true)}
              />
            )}
            {showMachineChip && (
              <div className="relative">
                <button
                  ref={machineBtnRef}
                  type="button"
                  onClick={() => setMachineOpen(v => !v)}
                  title={currentInstance ? `Machine: ${currentInstance}` : 'Tag a specific machine (optional)'}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap max-w-[10rem] ${
                    currentInstance
                      ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-300'
                      : 'bg-item text-c-faint border border-dashed border-white/10'
                  }`}
                >
                  {currentInstance ? (
                    <span className="truncate">{currentInstance}</span>
                  ) : (
                    <span className="font-bold">Machine</span>
                  )}
                </button>
                <EquipmentInstancePopover
                  open={machineOpen}
                  onClose={() => setMachineOpen(false)}
                  anchorRef={machineBtnRef}
                  value={currentInstance}
                  options={machineOptions}
                  onChange={val => onUpdate({ ...exercise, equipmentInstance: val })}
                  theme={theme}
                />
              </div>
            )}
          </div>

          {/* Gym-tag prompt (Batch 20b) — rendered above AnomalyBanner so
              tagging decisions come first and correctly-scoped history
              reduces false-positive anomaly signals. */}
          {showGymTagPrompt && (
            <GymTagPrompt
              exerciseName={exercise.name}
              gymLabel={currentGymLabel}
              theme={theme}
              onTag={() => addExerciseGymTag(libraryEntry.id, currentGymId)}
              onNotNow={() => dismissGymPrompt(libraryEntry.id, currentGymId)}
              onAlwaysSkip={() => addSkipGymTagPrompt(libraryEntry.id, currentGymId)}
            />
          )}

          {/* Anomaly banner (Batch 16q) — plateau / regression / swing */}
          {showAnomalyBanner && (
            <AnomalyBanner
              anomaly={anomaly}
              exerciseName={exercise.name}
              onDismiss={() => dismissAnomaly(anomalyKey)}
            />
          )}

          {/* Column headers — weight first, reps second */}
          <div className="flex items-center gap-2">
            <div className="w-14 text-center text-xs text-c-muted">Type</div>
            <div className="w-20 text-center text-xs text-c-muted">Lbs</div>
            <div className="w-16 text-center text-xs text-c-muted">Reps</div>
            <div className="flex-1" />
            <div className="w-8" />
          </div>

          {/* Previous session ghost rows */}
          {prevSets.length > 0 && showPrev && (
            <>
              {prevSets.map((s, i) => <PrevSetRow key={i} set={s} />)}
              <div className="flex items-center gap-2">
                <p className="text-xs text-c-faint uppercase tracking-widest font-semibold shrink-0">Today</p>
                <div className="flex-1 h-px bg-item" />
              </div>
            </>
          )}

          {/* Active set rows */}
          {exercise.sets.map((set, i) => (
            <div key={i} className={set.type === 'drop' ? 'pl-2 border-l-2 border-orange-500/50 rounded-sm' : ''}>
              <SetRow
                set={set}
                exerciseName={exercise.name}
                allSessions={scopedSessions}
                onChange={newSet => updateSet(i, newSet)}
                onDelete={() => deleteSet(i)}
                theme={theme}
                plateLoaded={exercise.plateLoaded}
                plateMultiplier={exercise.plateMultiplier || 2}
                onToggleMultiplier={() => {
                  const newMult = (exercise.plateMultiplier || 2) === 2 ? 1 : 2
                  const updatedSets = exercise.sets.map(s => {
                    if (!s.plates) return s
                    const newTotal = calcTotal(s.plates, s.barWeight ?? 45, newMult)
                    return { ...s, weight: String(newTotal), plateMultiplier: newMult }
                  })
                  onUpdate({ ...exercise, plateMultiplier: newMult, sets: updatedSets })
                }}
                weightRef={el => { setWeightRefs.current[i] = el }}
                repsRef={el => { setRepsRefs.current[i] = el }}
                onAdvance={() => addSet(true)}
                onDone={stableMarkDone}
                setIndex={i}
              />
            </div>
          ))}

          <button
            type="button"
            onClick={addSet}
            className="w-full py-2.5 rounded-xl bg-item text-c-secondary text-sm font-semibold flex items-center justify-center gap-2"
          >
            <span className="text-lg leading-none">+</span> Add Set
          </button>

          <input
            type="text"
            value={exercise.notes}
            onChange={e => onUpdate({ ...exercise, notes: e.target.value })}
            placeholder="Notes for this exercise…"
            className="w-full bg-item rounded-xl px-3 py-2.5 text-sm text-c-secondary placeholder-gray-400"
          />
          {lastExNotes && (
            <p className="text-xs text-c-muted mt-1 italic">Last time: {lastExNotes}</p>
          )}

          {!exercise.done ? (
            <button
              type="button"
              onClick={markDone}
              className="w-full py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-sm font-bold flex items-center justify-center gap-2"
            >
              <span>✓</span> Mark as Done
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onUpdate({ ...exercise, done: false })}
              className="w-full py-2.5 rounded-xl bg-item text-c-muted text-sm font-semibold"
            >
              Undo completion
            </button>
          )}
        </div>
      )}

      <RecommendationSheet
        open={recSheetOpen && settings.enableAiCoaching}
        onClose={() => setRecSheetOpen(false)}
        exerciseName={exercise.name}
        history={recHistory}
        targetReps={recTargetReps}
        progressionClass={libraryEntry?.progressionClass || 'isolation'}
        loadIncrement={libraryEntry?.loadIncrement || 5}
        accentColor={theme.hex}
        defaultMode={suggestedMode}
        aggressivenessMultiplier={aggressivenessMultiplier}
        fatigueSignals={fatigueSignals || {}}
      />
    </div>
  )
}

// ── Group section label ────────────────────────────────────────────────────────

function GroupLabel({ label, isCompleted }) {
  return (
    <div className={`flex items-center gap-2 px-1 pt-2 pb-1 ${isCompleted ? 'text-emerald-400' : 'text-c-muted'}`}>
      <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-current opacity-20" />
    </div>
  )
}

// ── Add exercise panel ─────────────────────────────────────────────────────────

function AddExercisePanel({ onAdd, onClose, theme, currentGymId = null, currentGymLabel = null }) {
  const exerciseLibrary     = useStore(s => s.exerciseLibrary)
  const addExerciseToLibrary = useStore(s => s.addExerciseToLibrary)
  const [query, setQuery] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [pendingName, setPendingName] = useState('')
  // Batch 20c (§9.7 Option A): opt-in hard filter, default off. Hidden when
  // no gym is set on the session; untagged entries count as universally
  // available per §3.5.3 so they always pass through.
  const [onlyThisGym, setOnlyThisGym] = useState(false)

  // Suggestions: fuzzy-match when typing, otherwise show a starter set of
  // common compound/isolation exercises from the library.
  const { suggestions, hiddenCount } = useMemo(() => {
    let candidates
    if (!query.trim()) {
      const starterNames = [
        'Barbell Row', 'Pull-ups', 'Face Pulls', 'Tricep Pushdown',
        'Preacher Curl', 'Lat Pulldown', 'Cable Row', 'Chest Fly',
        'Arnold Press', 'Cable Curls', 'Bench Press', 'Pec Dec',
      ]
      candidates = starterNames
        .map(n => exerciseLibrary.find(e => e.name === n))
        .filter(Boolean)
    } else {
      candidates = findSimilarExercises(query, exerciseLibrary, {
        suggestThreshold: 0.25,  // lower bar — inline suggestion list, not auto-apply
        max:              10,
      }).map(m => m.exercise)
    }
    if (!onlyThisGym || !currentGymId) {
      return { suggestions: candidates, hiddenCount: 0 }
    }
    const filtered = candidates.filter(ex => isExerciseAvailableAtGym(ex, currentGymId))
    return { suggestions: filtered, hiddenCount: candidates.length - filtered.length }
  }, [query, exerciseLibrary, onlyThisGym, currentGymId])

  // Handle "Add [typed]" button: if there's a high-similarity match in the
  // library, use it directly (the dedup win). Otherwise open the creation
  // modal so the user provides muscle + equipment up-front (§3.2.1).
  const handleAddTyped = () => {
    const typed = query.trim()
    if (!typed) return
    const topMatch = findSimilarExercises(typed, exerciseLibrary, {
      suggestThreshold: 0.85,
      max:              1,
    })[0]
    if (topMatch) {
      onAdd(topMatch.exercise.name, topMatch.exercise.id)
      onClose()
      return
    }
    setPendingName(typed)
    setCreateModalOpen(true)
  }

  const handleCreateSave = (payload) => {
    try {
      const newEntry = addExerciseToLibrary(payload)
      setCreateModalOpen(false)
      onAdd(newEntry.name, newEntry.id)
      onClose()
    } catch (err) {
      // Validation failed (missing muscle/equipment) — CreateExerciseModal
      // already guards this via disabled Save, so this is a defensive catch.
      console.warn('Exercise creation failed:', err.message)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={onClose}>
        <div className="bg-card w-full max-w-lg mx-auto rounded-t-3xl p-5" onClick={e => e.stopPropagation()}>
          <h3 className="font-bold text-lg mb-3">Add Exercise</h3>
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type exercise name…"
            className="w-full bg-item text-c-primary rounded-xl px-4 py-3 text-base mb-3"
            onKeyDown={e => { if (e.key === 'Enter' && query.trim()) handleAddTyped() }}
          />
          {currentGymId && (
            <label className="flex items-center gap-2 mb-3 px-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={onlyThisGym}
                onChange={e => setOnlyThisGym(e.target.checked)}
                className="w-3.5 h-3.5 accent-current"
                style={{ accentColor: theme.hex }}
              />
              <span className="text-c-secondary">
                Only available at <strong className="text-c-primary">{currentGymLabel || 'this gym'}</strong>
              </span>
              {onlyThisGym && hiddenCount > 0 && (
                <span className="ml-auto text-c-muted tabular-nums">{hiddenCount} hidden</span>
              )}
            </label>
          )}
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {query.trim() && (
              <button
                onClick={handleAddTyped}
                className={`w-full text-left px-4 py-3 rounded-xl ${theme.bg} text-white font-semibold`}
                style={{ color: theme.contrastText }}
              >
                + Add "{query.trim()}"
              </button>
            )}
            {suggestions.map(ex => (
              <button
                key={ex.id}
                onClick={() => { onAdd(ex.name, ex.id); onClose() }}
                className="w-full text-left px-4 py-3 rounded-xl bg-item text-c-secondary text-base flex items-center justify-between gap-3"
              >
                <span className="truncate">{ex.name}</span>
                <span className="text-[10px] text-c-muted shrink-0 uppercase tracking-wide">
                  {ex.primaryMuscles?.[0] || '?'}
                </span>
              </button>
            ))}
          </div>
          <button onClick={onClose} className="w-full mt-3 py-3 rounded-xl bg-item text-c-dim font-semibold">
            Cancel
          </button>
        </div>
      </div>
      <CreateExerciseModal
        open={createModalOpen}
        initialName={pendingName}
        onSave={handleCreateSave}
        onCancel={() => setCreateModalOpen(false)}
        theme={theme}
      />
    </>
  )
}

// ── Session saved confirmation screen ─────────────────────────────────────────

function SessionSaved({ stats, onShare, onDone }) {
  const { settings } = useStore()
  const theme = getTheme(settings.accentColor)
  const fmt = v => v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${v}`
  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center animate-session-saved"
      style={{
        backgroundColor: '#0a0a0a',
        paddingTop: 'max(2rem, env(safe-area-inset-top, 2rem))',
        paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 2rem))',
      }}
    >
      {/* Animated checkmark */}
      <div
        className="animate-check-circle mb-8"
        style={{ filter: `drop-shadow(0 0 20px ${theme.hex}4D)` }}
      >
        <svg width="96" height="96" viewBox="0 0 96 96" fill="none">
          <circle cx="48" cy="48" r="46" fill={theme.hex} />
          <path
            className="animate-check-stroke"
            d="M27 48 L41 62 L69 35"
            stroke="white"
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h1 className="text-3xl font-bold text-white mb-3">Session Saved</h1>

      <p className="text-sm text-gray-500 font-mono mb-14 tracking-wide">
        {stats.exerciseCount} exercise{stats.exerciseCount !== 1 ? 's' : ''} · {stats.setCount} set{stats.setCount !== 1 ? 's' : ''} · {fmt(stats.totalVolume)} lbs total volume
      </p>

      <div className="flex gap-3 w-full max-w-xs px-6">
        <button
          onClick={onDone}
          className="flex-1 py-4 rounded-2xl font-semibold text-base"
          style={{ backgroundColor: '#1c1c1c', color: '#9ca3af' }}
        >
          Done
        </button>
        <button
          onClick={onShare}
          className="flex-1 py-4 rounded-2xl font-bold text-base text-white"
          style={{ backgroundColor: theme.hex }}
        >
          Share
        </button>
      </div>
    </div>
  )
}

// ── Post-session comparison screen ────────────────────────────────────────────

function SessionComparison({ currentExercises, lastSession, theme, onContinue }) {
  if (!lastSession?.data?.exercises?.length) {
    return null
  }

  const lastExMap = {}
  lastSession.data.exercises.forEach(ex => { lastExMap[ex.name] = ex })

  const comparisons = currentExercises
    .filter(ex => ex.sets?.some(s => s.weight > 0 || s.reps > 0))
    .map(ex => {
      const prev = lastExMap[ex.name]
      const curVol = ex.sets.reduce((t, s) => t + (s.weight || 0) * (s.reps || 0), 0)
      if (!prev) return { name: ex.name, curVol, prevVol: 0, isNew: true }
      const prevVol = prev.sets.reduce((t, s) => t + (s.weight || 0) * (s.reps || 0), 0)
      return { name: ex.name, curVol, prevVol }
    })
    .filter(c => c.curVol > 0 || c.prevVol > 0)

  const totalCurVol  = comparisons.reduce((t, c) => t + c.curVol, 0)
  const totalPrevVol = comparisons.reduce((t, c) => t + c.prevVol, 0)
  const totalDiffPct = totalPrevVol > 0 ? ((totalCurVol - totalPrevVol) / totalPrevVol * 100) : null

  const formatVol = (v) => v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${v}`

  return (
    <div
      className="fixed inset-0 z-[60] bg-base flex flex-col items-center overflow-y-auto"
      style={{
        paddingTop: 'max(1.5rem, env(safe-area-inset-top, 1.5rem))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))',
      }}
    >
      <div className="w-full max-w-sm px-4 flex flex-col items-center gap-4">

        {/* Header */}
        <div className="w-full text-center">
          <p className="text-xs text-c-muted font-semibold uppercase tracking-widest mb-1">vs Last Session</p>
          <h2 className="text-2xl font-bold">
            {totalDiffPct !== null ? (
              <span className={totalDiffPct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {totalDiffPct >= 0 ? '↑' : '↓'} {Math.abs(totalDiffPct).toFixed(1)}% Volume
              </span>
            ) : (
              <span className="text-c-primary">First Session Logged</span>
            )}
          </h2>
          {totalDiffPct !== null && (
            <p className="text-sm text-c-dim mt-1">
              {formatVol(totalPrevVol)} → {formatVol(totalCurVol)} lbs
            </p>
          )}
        </div>

        {/* Exercise rows */}
        <div className="w-full bg-card rounded-2xl overflow-hidden">
          {comparisons.map((c, i) => {
            const diff = c.prevVol > 0 ? ((c.curVol - c.prevVol) / c.prevVol * 100) : null
            return (
              <div
                key={i}
                className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-c-base' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{c.name}</p>
                  <p className="text-xs text-c-muted">
                    {c.isNew ? 'New' : `${formatVol(c.prevVol)} → ${formatVol(c.curVol)}`}
                  </p>
                </div>
                {diff !== null ? (
                  <div className={`flex items-center gap-1 shrink-0 ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    <span className="text-sm font-bold">{diff >= 0 ? '↑' : '↓'}</span>
                    <span className="text-sm font-bold">{Math.abs(diff).toFixed(0)}%</span>
                  </div>
                ) : (
                  <span className="text-xs text-c-muted font-semibold shrink-0">NEW</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Continue button */}
        <button
          onClick={onContinue}
          className={`${theme.bg} text-white font-bold py-3.5 px-14 rounded-2xl text-base`}
          style={{ color: theme.contrastText }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

// ── Finish session modal ───────────────────────────────────────────────────────

const GRADES = ['D', 'C', 'B', 'A', 'A+']

const CARDIO_TYPES = ['Running', 'Cycling', 'Elliptical', 'StairMaster', 'Rowing', 'Jump Rope', 'Swimming', 'Other']

const INLINE_INTENSITIES = [
  { id: 'easy',     label: 'Easy' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'hard',     label: 'Hard' },
  { id: 'allout',   label: 'All Out' },
]

function gradeStyle(g, theme, selected) {
  if (!selected) return 'bg-item text-c-dim'
  if (g === 'A+') return `${theme.bg} text-white`
  if (g === 'A')  return 'bg-emerald-500 text-white'
  if (g === 'B')  return 'bg-amber-500 text-white'
  if (g === 'C')  return 'bg-red-500 text-white'
  return 'bg-red-950 text-red-300'
}

function gradeInlineStyle(g, theme, selected) {
  if (selected && g === 'A+') return { color: theme.contrastText }
  return {}
}

function formatCardioDuration(seconds) {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return `${m}m`
  return `${seconds}s`
}

// todayCardio: array of unattached cardio sessions logged today
// onLogNow: saves the workout then navigates to /cardio
function FinishModal({ loggedSets, exerciseCount, elapsed, onSave, onLogNow, onCancel, onDiscard, theme, todayCardio }) {
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [grade, setGrade] = useState(null)

  // Scenario B: null | 'yes' (inline form expanded)
  const [cardioChoice, setCardioChoice] = useState(null)

  // Inline quick-log form state
  const [cardioType, setCardioType]         = useState('')
  const [cardioDuration, setCardioDuration] = useState('')
  const [cardioIntensity, setCardioIntensity] = useState(null)
  const [cardioMinHR, setCardioMinHR]       = useState('')
  const [cardioMaxHR, setCardioMaxHR]       = useState('')
  const [cardioNotes, setCardioNotes]       = useState('')

  const isScenarioA = todayCardio && todayCardio.length > 0
  const firstCardio = todayCardio?.[0]

  // Scenario B — inline confirm
  const handleSaveInline = () => {
    onSave({
      grade,
      cardioAction: 'inlineLog',
      inlineCardio: {
        type:      cardioType || 'Other',
        duration:  (parseInt(cardioDuration) || 0) * 60,
        intensity: cardioIntensity,
        minHR:     parseInt(cardioMinHR) || null,
        maxHR:     parseInt(cardioMaxHR) || null,
        notes:     cardioNotes,
      },
    })
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-5 overflow-y-auto py-10">
      <div className="bg-card rounded-3xl p-6 w-full max-w-sm">
        <h3 className="text-xl font-bold mb-1">Finish Session?</h3>
        <p className="text-c-dim text-sm mb-5">
          {loggedSets} sets · {exerciseCount} exercises{elapsed ? ` · ${elapsed}` : ''}
        </p>

        {/* Grade */}
        <p className="text-xs text-c-dim font-semibold uppercase tracking-wide mb-2">Rate this session</p>
        <div className="flex gap-1.5 mb-5">
          {GRADES.map(g => (
            <button
              key={g}
              onClick={() => setGrade(g)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${gradeStyle(g, theme, grade === g)}`}
              style={gradeInlineStyle(g, theme, grade === g)}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Cardio */}
        <p className="text-xs text-c-dim font-semibold uppercase tracking-wide mb-2">Cardio</p>

        {/* Scenario B tri-state: null = unselected, 'yes' = inline form open,
            'no' = explicitly marked no cardio (Batch 16k — was auto-saving
            before; now just fills in the choice; main Save button below
            commits). */}
        {isScenarioA ? (
          /* ── Scenario A: cardio already logged today ─────────────── */
          <>
            <div className="bg-item-dim rounded-2xl p-3 mb-3">
              <p className="text-sm text-c-secondary">
                You logged <span className="font-semibold">{firstCardio.type}</span>
                {firstCardio.duration ? ` · ${formatCardioDuration(firstCardio.duration)}` : ''} earlier.
                Attach to this workout?
              </p>
            </div>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => onSave({ grade, cardioAction: 'attach', todayCardioId: firstCardio.id, todayCardioData: firstCardio })}
                className={`flex-1 py-2.5 rounded-xl font-semibold text-sm ${theme.bg} text-white`}
                style={{ color: theme.contrastText }}
              >
                Attach
              </button>
              <button
                onClick={() => onSave({ grade, cardioAction: 'keep' })}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-item text-c-dim"
              >
                Keep Separate
              </button>
            </div>
            <button
              onClick={() => onLogNow({ grade })}
              className="w-full py-2.5 rounded-xl font-semibold text-sm bg-item text-c-secondary mb-3"
            >
              Log Another
            </button>
          </>
        ) : (
          /* ── Scenario B: no cardio logged today ───────────────────── */
          <>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setCardioChoice(cardioChoice === 'yes' ? null : 'yes')}
                className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                  cardioChoice === 'yes' ? 'bg-emerald-500 text-white' : 'bg-item text-c-dim'
                }`}
              >
                Yes, done
              </button>
              <button
                onClick={() => onLogNow({ grade })}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-item text-c-secondary"
              >
                Log Now
              </button>
              <button
                onClick={() => setCardioChoice(cardioChoice === 'no' ? null : 'no')}
                className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                  cardioChoice === 'no'
                    ? 'bg-c-secondary text-bg-base border border-white/30'
                    : 'bg-item text-c-dim'
                }`}
                style={cardioChoice === 'no'
                  ? { backgroundColor: 'rgba(255,255,255,0.15)', color: 'var(--text-primary)' }
                  : undefined}
              >
                No
              </button>
            </div>

            {/* Inline quick-log form */}
            {cardioChoice === 'yes' && (
              <div className="bg-item-dim rounded-2xl p-3 mb-3 space-y-2">
                <div>
                  <p className="text-xs text-c-muted mb-1">Type</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CARDIO_TYPES.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setCardioType(t)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          cardioType === t ? `${theme.bg} text-white` : 'bg-item text-c-dim'
                        }`}
                        style={cardioType === t ? { color: theme.contrastText } : undefined}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <p className="text-xs text-c-muted mb-1">Duration (min)</p>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={cardioDuration}
                      onChange={e => setCardioDuration(e.target.value)}
                      placeholder="30"
                      className="w-full bg-item text-c-primary rounded-lg px-2 py-2 text-center text-sm font-semibold"
                      min={1}
                    />
                  </div>
                </div>

                <div>
                  <p className="text-xs text-c-muted mb-1">Intensity</p>
                  <div className="flex gap-1.5">
                    {INLINE_INTENSITIES.map(lvl => (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => setCardioIntensity(cardioIntensity === lvl.id ? null : lvl.id)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                          cardioIntensity === lvl.id ? `${theme.bg} text-white` : 'bg-item text-c-dim'
                        }`}
                        style={cardioIntensity === lvl.id ? { color: theme.contrastText } : {}}
                      >
                        {lvl.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <p className="text-xs text-c-muted mb-1">Min HR</p>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={cardioMinHR}
                      onChange={e => setCardioMinHR(e.target.value)}
                      placeholder="—"
                      className="w-full bg-item text-c-primary rounded-lg px-2 py-2 text-center text-sm font-semibold"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-c-muted mb-1">Max HR</p>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={cardioMaxHR}
                      onChange={e => setCardioMaxHR(e.target.value)}
                      placeholder="—"
                      className="w-full bg-item text-c-primary rounded-lg px-2 py-2 text-center text-sm font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <p className="text-xs text-c-muted mb-1">Notes</p>
                  <input
                    type="text"
                    value={cardioNotes}
                    onChange={e => setCardioNotes(e.target.value)}
                    placeholder="e.g. Zone 2, felt good…"
                    className="w-full bg-item text-c-primary rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <button
                  onClick={handleSaveInline}
                  disabled={!cardioDuration}
                  className={`w-full py-3 rounded-xl font-bold text-sm ${theme.bg} text-white disabled:opacity-40`}
                  style={{ color: theme.contrastText }}
                >
                  Save with Cardio
                </button>
              </div>
            )}
          </>
        )}

        <div className="flex gap-3 mt-1">
          <button
            onClick={onCancel}
            className="flex-1 bg-item text-c-secondary py-3.5 rounded-2xl font-semibold"
          >
            Keep Going
          </button>
          {!isScenarioA && cardioChoice !== 'yes' && (
            <button
              onClick={() => onSave({ grade, cardioAction: 'none' })}
              className={`flex-1 ${theme.bg} text-white py-3.5 rounded-2xl font-bold`}
              style={{ color: theme.contrastText }}
            >
              Save
            </button>
          )}
        </div>

        {/* Discard session */}
        {!confirmDiscard ? (
          <button
            onClick={() => setConfirmDiscard(true)}
            className="w-full mt-3 py-2.5 rounded-2xl text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
          >
            Discard Session
          </button>
        ) : (
          <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-2xl p-3 text-center">
            <p className="text-sm text-red-400 font-semibold mb-2">This will delete all progress. Are you sure?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDiscard(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-item text-c-secondary"
              >
                Never mind
              </button>
              <button
                onClick={onDiscard}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-500 text-white"
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main BbLogger ──────────────────────────────────────────────────────────────

export default function BbLogger() {
  const { type }   = useParams()
  const navigate   = useNavigate()
  const {
    sessions, settings, addSession, updateSession,
    activeSession, saveActiveSession, clearActiveSession,
    customTemplates, splits, activeSplitId, updateSplit,
    cardioSessions, addCardioSession, updateCardioSession,
    restDaySessions,
  } = useStore()
  const theme = getTheme(settings.accentColor)
  const firstSetType = settings.defaultFirstSetType === 'working' ? 'working' : 'warmup'

  // ── Audio unlock on first touch (iOS requires user-gesture before AudioContext) ──
  useEffect(() => {
    const unlock = () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        ctx.resume().then(() => ctx.close())
      } catch (e) { /* ignore */ }
    }
    document.addEventListener('touchstart', unlock, { once: true })
    return () => document.removeEventListener('touchstart', unlock)
  }, [])

  // ── Resolve template (built-in or custom) ────────────────────────────────

  const isCustomTemplate = type.startsWith('tpl_')
  const templateId = isCustomTemplate ? type.slice(4) : null
  const customTemplate = templateId ? customTemplates.find(t => t.id === templateId) : null

  // Active split workout definition (falls back to hardcoded data for compat)
  const activeSplit = splits?.find(s => s.id === activeSplitId) || splits?.[0] || null
  const activeSplitWorkout = activeSplit?.workouts?.find(w => w.id === type) || null

  const workoutName  = isCustomTemplate
    ? (customTemplate?.name || 'Custom Workout')
    : (activeSplitWorkout?.name || BB_WORKOUT_NAMES[type] || 'Custom Workout')

  const workoutEmoji = isCustomTemplate
    ? (customTemplate?.emoji || '✏️')
    : (activeSplitWorkout?.emoji || BB_WORKOUT_EMOJI[type] || '✏️')

  const groups = isCustomTemplate
    ? (customTemplate?.groups || [])
    : (activeSplitWorkout?.sections || BB_EXERCISE_GROUPS[type] || [])

  const wColor = isCustomTemplate ? '#6b7280' : (WORKOUT_COLORS[type] || WORKOUT_COLORS.custom)

  // ── Restore or init exercises from persisted active session ──────────────

  const savedSession = (activeSession && activeSession.type === type) ? activeSession : null

  // Build a map of exercise name → data from the MOST RECENT session that logged it,
  // scanning ALL past sessions of this workout type (newest first).
  // Used for: unilateral/plates init, ghost row "Last Time" data, and extras collection.
  const allPastSessions = sessions
    .filter(s => s.mode === 'bb' && s.type === type && s.data?.exercises?.length)
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  // Batch 20b: prefer the most recent session AT THIS GYM for each exercise
  // name when a gym is set. Falls back to the most recent anywhere if no
  // same-gym session exists yet. This gym-preferring pass is what makes
  // the Machine chip seed to Hoist at VASA and Cybex at TR instead of
  // whichever the user used most recently overall. Other init fields
  // (unilateral / plateLoaded) benefit too — "what plate config did I
  // last use at THIS gym" is usually more relevant than the global most-
  // recent.
  //
  // We read the gym from savedSession or fall back to settings.defaultGymId
  // because this computation runs before the gymId useState — TDZ would
  // crash if we referenced the live state here. Resumed sessions: use
  // savedSession.gymId exactly. Fresh starts: settings.defaultGymId is
  // what the readiness overlay will default to, so it's the most likely
  // gym for this session. A mid-session gym change via the SessionGymPill
  // doesn't re-seed these maps; user can tap the Machine chip to pick a
  // different machine at that point.
  const seedGymId = savedSession?.gymId || settings.defaultGymId || null
  const lastExDataByName = {}
  if (seedGymId) {
    // First pass: same-gym sessions only
    for (const sess of allPastSessions) {
      if (sess.gymId !== seedGymId) continue
      for (const ex of sess.data.exercises) {
        if (!lastExDataByName[ex.name]) lastExDataByName[ex.name] = ex
      }
    }
  }
  // Second pass: fill any remaining names from the broader history so
  // exercises not-yet-done-at-this-gym still get SOME seed rather than
  // starting fully blank.
  for (const sess of allPastSessions) {
    for (const ex of sess.data.exercises) {
      if (!lastExDataByName[ex.name]) lastExDataByName[ex.name] = ex
    }
  }

  const templateExercises = groups.flatMap(group =>
    group.exercises.map((e, i) => {
      const name = typeof e === 'string' ? e : e.name
      const rec  = typeof e === 'string' ? '' : (e.rec || '')
      return {
        id:    `${group.label}-${name}-${i}`,
        name,
        rec,
        group: group.label,
        sets:  [{ type: firstSetType, reps: '', weight: '' }],
        notes: '',
        done:  false,
        plateMode: false,
        platesPerSide: 2,
        plateWeight: 45,
        barWeight: 45,
        unilateral: !!lastExDataByName[name]?.unilateral,
        plateLoaded: !!(lastExDataByName[name]?.plates),
        equipmentInstance: lastExDataByName[name]?.equipmentInstance || '',
      }
    })
  )

  // Merge in ALL exercises ever added across ALL past sessions that aren't in the
  // template — this ensures custom exercises persist permanently, not just one session.
  const defaultExercises = (() => {
    if (!allPastSessions.length) return templateExercises
    const templateNames = new Set(templateExercises.map(e => e.name))
    const extrasSeen = new Set()
    const extras = []
    for (const sess of allPastSessions) {
      for (const ex of sess.data.exercises) {
        if (!templateNames.has(ex.name) && !extrasSeen.has(ex.name)) {
          extrasSeen.add(ex.name)
          const lastEx = lastExDataByName[ex.name]
          extras.push({
            id:    `prev-${ex.name}-${extras.length}`,
            name:  ex.name,
            group: 'Added',
            sets:  [{ type: firstSetType, reps: '', weight: '' }],
            notes: '',
            done:  false,
            plateMode: false,
            platesPerSide: 2,
            plateWeight: 45,
            barWeight: 45,
            unilateral: !!lastEx?.unilateral,
            plateLoaded: !!(lastEx?.plates),
            equipmentInstance: lastEx?.equipmentInstance || '',
          })
        }
      }
    }
    return [...templateExercises, ...extras]
  })()

  // True only when this component mounted with an existing saved session (genuine resume).
  // Captured once at mount — savedSession becomes truthy after the first auto-save even
  // on a fresh session, so we can't rely on it reactively for the subtitle.
  const [isResumed] = useState(() => !!(activeSession && activeSession.type === type))

  const [exercises,      setExercises]      = useState(() => savedSession?.exercises || defaultExercises)
  const [sessionNotes,   setSessionNotes]   = useState(() => savedSession?.sessionNotes || '')
  const [showAddPanel,   setShowAddPanel]   = useState(false)
  const [showConfirm,    setShowConfirm]    = useState(false)

  // ── Custom numpad state ───────────────────────────────────────────────────
  // Single state object so openNumpad is atomic — no intermediate render where
  // isOpen is true but config is stale (or vice-versa). This prevents the iOS
  // race where tapping "Next →" caused a brief close/re-open flicker.
  const [numpad, setNumpad] = useState({ isOpen: false, config: null })
  const numpadIsOpen = numpad.isOpen
  const numpadConfig = numpad.config

  const openNumpad = useCallback((config) => {
    setNumpad({ isOpen: true, config })
  }, [])

  const closeNumpad = useCallback(() => {
    setNumpad(s => ({ ...s, isOpen: false }))
  }, [])

  const numpadCtxValue = { numpadConfig, numpadIsOpen, openNumpad, closeNumpad }
  const reorderSection = null // reorder UI removed
  const [showSaved,          setShowSaved]          = useState(false)
  const [savedStats,         setSavedStats]         = useState(null)
  const [showComparison,     setShowComparison]     = useState(false)
  const [comparisonData,     setComparisonData]     = useState(null)
  const [comparisonPrevSess, setComparisonPrevSess] = useState(null)
  const [showSummary,        setShowSummary]        = useState(false)
  const [summaryData,        setSummaryData]        = useState(null)
  const [savedSessionId,     setSavedSessionId]     = useState(null)

  // ── Session timer (timestamp-based — survives backgrounding) ─────────────

  const [sessionStarted, setSessionStarted] = useState(savedSession?.sessionStarted || false)
  const startTimestamp = useRef(savedSession?.startTimestamp || null)
  const [isPaused, setIsPaused] = useState(savedSession?.isPaused || false)
  const totalPausedMsRef = useRef(savedSession?.totalPausedMs || 0)
  const pauseStartedAtRef = useRef(savedSession?.pauseStartedAt || null)

  // ── Readiness check-in (Batch 16n, spec §2.5) ────────────────────────────
  // Captured once on Start Session and persisted with the active session so
  // it survives reload/backgrounding. null means the user skipped or resumed
  // a pre-16n session — recommender treats it as neutral (multiplier 1.0).
  const [readiness, setReadiness] = useState(savedSession?.readiness || null)
  const [gymId,     setGymId]     = useState(savedSession?.gymId     || null)

  // Label lookup for the gym-tag prompt + any future surface that needs a
  // human-readable name alongside the id. Memo cheap but keeps renders clean.
  const gyms = useStore(s => s.settings.gyms || [])
  const currentGymLabel = useMemo(
    () => (gymId ? gyms.find(g => g.id === gymId)?.label || null : null),
    [gymId, gyms]
  )

  const calcElapsed = () => {
    if (!sessionStarted || !startTimestamp.current) return 0
    let paused = totalPausedMsRef.current
    if (isPaused && pauseStartedAtRef.current) {
      paused += Date.now() - pauseStartedAtRef.current
    }
    return Math.max(0, Math.floor((Date.now() - startTimestamp.current - paused) / 1000))
  }

  const [elapsedSeconds, setElapsedSeconds] = useState(calcElapsed)

  // Called from ReadinessCheckIn. Either { energy, sleep, goal, gymId } on the
  // answered path, or { readiness: null, gymId } on the Skip path. Builds the
  // readiness block (or null) and starts the timer.
  const handleStartSession = (payload = {}) => {
    if (payload.readiness === null) {
      setReadiness(null)
    } else if (payload.energy && payload.sleep && payload.goal) {
      setReadiness(buildReadiness({
        energy: payload.energy,
        sleep:  payload.sleep,
        goal:   payload.goal,
      }))
    }
    if (payload.gymId !== undefined) setGymId(payload.gymId || null)

    startTimestamp.current = Date.now()
    setSessionStarted(true)
    setIsPaused(false)
    totalPausedMsRef.current = 0
    pauseStartedAtRef.current = null
  }

  const handlePause = () => {
    if (!sessionStarted) return
    pauseStartedAtRef.current = Date.now()
    setIsPaused(true)
  }

  const handleResume = () => {
    if (pauseStartedAtRef.current) {
      totalPausedMsRef.current += Date.now() - pauseStartedAtRef.current
      pauseStartedAtRef.current = null
    }
    setIsPaused(false)
  }

  useEffect(() => {
    if (!sessionStarted || isPaused) return
    const id = setInterval(() => {
      setElapsedSeconds(calcElapsed())
    }, 1000)
    return () => clearInterval(id)
  }, [sessionStarted, isPaused]) // eslint-disable-line

  // Recalc on app return from background
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && sessionStarted) {
        setElapsedSeconds(calcElapsed())
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [sessionStarted, isPaused]) // eslint-disable-line

  // ── Persist active session on every change ───────────────────────────────

  useEffect(() => {
    saveActiveSession({
      type,
      exercises,
      sessionNotes,
      sessionStarted,
      startTimestamp: startTimestamp.current,
      isPaused,
      totalPausedMs: totalPausedMsRef.current,
      pauseStartedAt: pauseStartedAtRef.current,
      readiness,
      gymId,
    })
  }, [exercises, sessionNotes, sessionStarted, isPaused, readiness, gymId]) // eslint-disable-line

  // ── Session helpers ──────────────────────────────────────────────────────

  const lastSession = getLastBbSession(sessions, type)
  const scopedSessions = type
    ? sessions.filter(s => s.mode === 'bb' && s.data?.workoutType === type)
    : sessions.filter(s => s.mode === 'bb')

  // Fatigue signals (Batch 16o, spec §4) — resolved once per render from the
  // store slices. Passes into every ExerciseItem's recommender call.
  // `sessionStarted` is in the dep list so the signals refresh when the user
  // finishes + reopens (not strictly needed, but avoids a stale-closure hazard).
  const fatigueSignals = useMemo(
    () => buildFatigueSignals({ sessions, cardioSessions, restDaySessions }),
    [sessions, cardioSessions, restDaySessions, sessionStarted] // eslint-disable-line
  )

  const updateExercise = useCallback((id, updated) =>
    setExercises(prev => prev.map(ex => ex.id === id ? updated : ex)),
  [])

  const moveExercise = useCallback((id, direction) => {
    setExercises(prev => {
      const ex = prev.find(e => e.id === id)
      if (!ex || ex.done) return prev
      const groupExes = prev.filter(e => e.group === ex.group && !e.done)
      const groupIdx = groupExes.findIndex(e => e.id === id)
      const targetIdx = groupIdx + (direction === 'up' ? -1 : 1)
      if (targetIdx < 0 || targetIdx >= groupExes.length) return prev
      const swapWith = groupExes[targetIdx]
      const result = [...prev]
      const i1 = result.findIndex(e => e.id === id)
      const i2 = result.findIndex(e => e.id === swapWith.id)
      ;[result[i1], result[i2]] = [result[i2], result[i1]]
      return result
    })
  }, [])

  const addExercise = (name, exerciseId) => {
    setExercises(prev => [...prev, {
      id:    `custom-${name}-${Date.now()}`,
      name,
      exerciseId,                 // links row to library entry; undefined OK for legacy adds
      group: 'Custom',
      sets:  [{ type: firstSetType, reps: '', weight: '' }],
      notes: '',
      done:  false,
      plateMode: false,
      platesPerSide: 2,
      plateWeight: 45,
      barWeight: 45,
    }])
  }

  // ── Shared: build exercise data array ────────────────────────────────────

  const buildExerciseData = () =>
    exercises
      .map(ex => {
        const filledSets = ex.sets.filter(s => s.reps || s.weight)
        if (!filledSets.length) return null
        const uni = !!ex.unilateral
        // Resolve exerciseId: prefer the row's linked id (from AddExercisePanel
        // selection), fall back to a library lookup by canonical/alias name.
        // If nothing matches, leave undefined — future save-time migrations
        // can resolve it by name as long as the library has an entry.
        const library = useStore.getState().exerciseLibrary || []
        const libEntry = ex.exerciseId
          ? library.find(e => e.id === ex.exerciseId)
          : library.find(e =>
              normalizeExerciseName(e.name) === normalizeExerciseName(ex.name)
              || (e.aliases || []).some(a =>
                normalizeExerciseName(a) === normalizeExerciseName(ex.name)
              )
            )
        const trimmedInstance = typeof ex.equipmentInstance === 'string'
          ? ex.equipmentInstance.trim().slice(0, 40)
          : ''
        return {
          name:       libEntry?.name ?? ex.name,  // canonicalize on save
          exerciseId: libEntry?.id,
          notes: ex.notes,
          completedAt: ex.completedAt || 0,
          unilateral: uni,
          ...(trimmedInstance ? { equipmentInstance: trimmedInstance } : {}),
          plates: ex.plateLoaded ? ex.sets.map(s => s.plates ? { plates: s.plates, barWeight: s.barWeight } : null) : undefined,
          sets: filledSets.map(s => {
            const rawW = parseFloat(s.weight) || 0
            const w = uni ? rawW * 2 : rawW
            const r = parseInt(s.reps)     || 0
            return {
              type: s.type, reps: r, weight: w, rawWeight: rawW,
              isNewPR: isSetPR(scopedSessions, ex.name, rawW, r),
              ...(s.plates ? { plates: s.plates, barWeight: s.barWeight } : {}),
            }
          }),
        }
      })
      .filter(Boolean)

  // ── Shared: persist workout + auto-sync custom exercises to template ──────

  const buildAndSaveWorkout = ({ grade, completedCardio, cardio }) => {
    const duration     = Math.round(elapsedSeconds / 60)
    const exerciseData = buildExerciseData()

    const savedSess = addSession({
      date:            new Date().toISOString(),
      mode:            'bb',
      type:            isCustomTemplate ? `tpl_${templateId}` : type,
      duration,
      grade,
      completedCardio,
      cardio,
      notes:           sessionNotes,
      data:            { workoutType: type, exercises: exerciseData },
      ...(readiness ? { readiness } : {}),
      ...(gymId     ? { gymId     } : {}),
    })

    clearActiveSession()

    // ── Auto-persist custom exercises + rec changes to split template ─────
    if (!isCustomTemplate && activeSplitWorkout) {
      const templateExNames = new Set(
        activeSplitWorkout.sections.flatMap(s =>
          s.exercises.map(e => typeof e === 'string' ? e : e.name)
        )
      )
      const allSessionNames   = exercises.map(ex => ex.name)
      const exerciseDataNames = new Set(exerciseData.map(e => e.name))
      const newExercises = exercises.filter(ex =>
        exerciseDataNames.has(ex.name) && !templateExNames.has(ex.name)
      )

      const liveRecByName = new Map()
      exercises.forEach(ex => { liveRecByName.set(ex.name, ex.rec || '') })

      const hasRecChanges = activeSplitWorkout.sections.some(s =>
        s.exercises.some(e => {
          const name = typeof e === 'string' ? e : e.name
          const templateRec = typeof e === 'string' ? '' : (e.rec || '')
          const liveRec = liveRecByName.get(name)
          return liveRec !== undefined && liveRec !== templateRec
        })
      )

      if (newExercises.length > 0 || hasRecChanges) {
        const sections = activeSplitWorkout.sections.map(s => ({
          ...s,
          exercises: s.exercises.map(e => {
            const name = typeof e === 'string' ? e : e.name
            const liveRec = liveRecByName.get(name)
            const finalRec = liveRec !== undefined
              ? liveRec
              : (typeof e === 'string' ? '' : (e.rec || ''))
            return finalRec ? { name, rec: finalRec } : name
          }),
        }))
        const templatePos = {}
        sections.forEach((s, si) => {
          s.exercises.forEach(e => {
            const name = typeof e === 'string' ? e : e.name
            templatePos[name] = si
          })
        })

        for (const newEx of newExercises) {
          const sessionIdx = allSessionNames.indexOf(newEx.name)
          let insertSi = sections.length - 1
          let insertAfterName = null
          for (let i = sessionIdx - 1; i >= 0; i--) {
            const prevName = allSessionNames[i]
            if (templatePos[prevName] !== undefined) {
              insertSi = templatePos[prevName]
              insertAfterName = prevName
              break
            }
          }
          const section = sections[insertSi]
          let insertIdx
          if (insertAfterName) {
            const afterIdx = section.exercises.findIndex(e => {
              const n = typeof e === 'string' ? e : e.name
              return n === insertAfterName
            })
            insertIdx = afterIdx !== -1 ? afterIdx + 1 : section.exercises.length
          } else {
            insertIdx = section.exercises.length
          }
          const entry = newEx.rec ? { name: newEx.name, rec: newEx.rec } : newEx.name
          section.exercises.splice(insertIdx, 0, entry)
          templatePos[newEx.name] = insertSi
        }

        updateSplit(activeSplitId, {
          workouts: activeSplit.workouts.map(w =>
            w.id === type ? { ...w, sections } : w
          ),
        })
      }
    }

    return { savedSess, exerciseData }
  }

  // ── Save session (from Finish modal) ─────────────────────────────────────
  // cardioAction: 'none' | 'keep' | 'attach' | 'inlineLog'

  const saveSession = ({ grade, cardioAction, todayCardioId, todayCardioData, inlineCardio }) => {
    // Capture the previous session NOW — before addSession mutates the store.
    // After saving, lastSession would return the just-saved session (most recent
    // of this type), making the comparison show 0% diff against itself.
    const prevSession = lastSession

    // Build the legacy `cardio` object used by the share card
    let completedCardio = false
    let cardio = { completed: false }

    if (cardioAction === 'attach' && todayCardioData) {
      completedCardio = true
      cardio = {
        completed: true,
        type:      todayCardioData.type,
        duration:  todayCardioData.duration ? Math.round(todayCardioData.duration / 60) : null,
        heartRate: todayCardioData.maxHR || todayCardioData.minHR || null,
        notes:     todayCardioData.notes || '',
      }
    } else if (cardioAction === 'inlineLog' && inlineCardio) {
      completedCardio = true
      cardio = {
        completed: true,
        type:      inlineCardio.type,
        duration:  inlineCardio.duration ? Math.round(inlineCardio.duration / 60) : null,
        heartRate: inlineCardio.maxHR || inlineCardio.minHR || null,
        notes:     inlineCardio.notes || '',
      }
    }

    const { savedSess, exerciseData } = buildAndSaveWorkout({ grade, completedCardio, cardio })
    setSavedSessionId(savedSess.id)

    // Cardio side effects
    if (cardioAction === 'attach' && todayCardioId) {
      updateCardioSession(todayCardioId, { attachedToSessionId: savedSess.id })
    } else if (cardioAction === 'inlineLog' && inlineCardio) {
      addCardioSession({
        type:               inlineCardio.type,
        duration:           inlineCardio.duration,
        intensity:          inlineCardio.intensity,
        minHR:              inlineCardio.minHR,
        maxHR:              inlineCardio.maxHR,
        notes:              inlineCardio.notes,
        date:               new Date().toISOString().split('T')[0],
        attachedToSessionId: savedSess.id,
      })
    }

    // Build share card summary
    const totalVolume = exerciseData.reduce((t, ex) =>
      t + ex.sets.reduce((s, set) => s + set.reps * set.weight, 0), 0)
    const totalSets = exerciseData.reduce((t, ex) => t + ex.sets.length, 0)
    const totalPRs  = exerciseData.reduce((t, ex) => t + ex.sets.filter(s => s.isNewPR).length, 0)
    const exerciseSummary = [...exerciseData]
      .sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0))
      .map(ex => ({
        name:  ex.name,
        sets:  ex.sets,
        hasPR: ex.sets.some(s => s.isNewPR),
        notes: ex.notes,
      }))
    const h = Math.floor(elapsedSeconds / 3600)
    const m = Math.floor((elapsedSeconds % 3600) / 60)
    const s = elapsedSeconds % 60
    const durationStr = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

    const activeSplit = splits.find(s => s.id === activeSplitId)
    setSummaryData({
      userName: settings.userName || '',
      workoutName,
      workoutEmoji,
      dateStr,
      durationStr,
      totalVolume,
      totalSets,
      totalPRs,
      exerciseSummary,
      grade,
      cardio,
      theme,
      streak: getWorkoutStreak(sessions, cardioSessions, restDaySessions),
    })
    setShowConfirm(false)
    setComparisonData(exerciseData)
    setComparisonPrevSess(prevSession)
    setSavedStats({
      exerciseCount: exerciseData.length,
      setCount:      totalSets,
      totalVolume,
    })
    setShowSaved(true)
  }

  // ── "Share" tapped on the Session Saved screen ───────────────────────────

  const handleShareFromSaved = () => {
    setShowSaved(false)
    // Use the pre-save snapshot of the previous session — comparisonPrevSess
    // was captured before addSession updated the store, so it correctly points
    // to the session BEFORE the one we just saved.
    if (comparisonPrevSess?.data?.exercises?.length) {
      setShowComparison(true)
    } else {
      setShowSummary(true)
    }
  }

  // ── "Log Now" flow: save workout then go to CardioLogger ─────────────────

  const saveAndLogNow = ({ grade }) => {
    const { savedSess } = buildAndSaveWorkout({
      grade,
      completedCardio: false,
      cardio: { completed: false },
    })
    setSavedSessionId(savedSess.id)
    setShowConfirm(false)
    navigate('/cardio', { state: { attachToWorkoutId: savedSess.id } })
  }

  // ── Today's unattached cardio (for Finish modal Scenario A) ───────────────

  const todayStr    = new Date().toISOString().split('T')[0]
  const todayCardio = cardioSessions.filter(s => s.date === todayStr && !s.attachedToSessionId)

  // ── Render helpers ───────────────────────────────────────────────────────

  const loggedSets    = exercises.reduce((t, ex) => t + ex.sets.filter(s => s.reps || s.weight).length, 0)
  const completedExes = exercises.filter(ex => ex.done).sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0))
  const pendingExes   = exercises.filter(ex => !ex.done)

  const formatElapsed = (secs) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const renderGroups = []
  if (completedExes.length > 0)
    renderGroups.push({ label: 'Completed', exercises: completedExes, isCompleted: true })
  groups.forEach(g => {
    const groupExes = pendingExes.filter(ex => ex.group === g.label)
    if (groupExes.length) renderGroups.push({ label: g.label, exercises: groupExes })
  })
  const customPending = pendingExes.filter(ex => !groups.some(g => g.label === ex.group))
  if (customPending.length) renderGroups.push({ label: 'Added', exercises: customPending })

  return (
    <NumpadContext.Provider value={numpadCtxValue}>
    <div className="pb-40 min-h-screen bg-base">

      {/* ── Start Session overlay with readiness check-in (§2.5) ──────────── */}
      {!sessionStarted && (
        <ReadinessCheckIn
          workoutName={workoutName}
          workoutEmoji={workoutEmoji}
          theme={theme}
          onStart={handleStartSession}
          onCancel={() => navigate(-1)}
        />
      )}

      {/* ── Clipboard header (sticky) ────────────────────────────────────── */}
      <div
        className="sticky top-0 z-30"
        style={{
          backgroundColor: 'var(--bg-card)',
          backgroundImage: `linear-gradient(to top, ${theme.hex}E6 0%, ${theme.hex}66 60%, transparent 100%)`,
          paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0.75rem))',
          color: 'var(--text-primary)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        }}
      >
        <div className="flex items-center px-4 pb-1.5 pt-0.5">
          <div className="flex-1 flex justify-start">
            <button
              onClick={() => {
                if (sessionStarted && !isPaused) handlePause()
                navigate(-1)
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full"
              style={{ background: 'var(--bg-item)' }}
            >
              <svg className="w-4 h-4 text-c-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
          <div className="flex-1 flex justify-end items-center gap-2">
            {sessionStarted && (
              <button
                onClick={isPaused ? handleResume : handlePause}
                className="w-7 h-7 flex items-center justify-center rounded-full"
                style={{ background: 'var(--bg-item)' }}
              >
                {isPaused ? (
                  <svg className="w-3.5 h-3.5 text-c-primary" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-c-primary" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                )}
              </button>
            )}
            <div className={`rounded-full px-2.5 py-1 ${isPaused ? 'opacity-60' : ''}`} style={{ background: 'var(--bg-item)' }}>
              <span className="text-sm font-mono font-extrabold tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                {formatElapsed(elapsedSeconds)}
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 pb-2">
          <h1
            className="font-bold leading-tight"
            style={{ fontSize: 21, color: 'var(--text-primary)' }}
          >
            {workoutEmoji} {workoutName}
          </h1>
          {isResumed && (
            <p className="text-xs mt-0.5" style={{ opacity: 0.6 }}>Resumed from saved session</p>
          )}
          {sessionStarted && (
            <div className="mt-1.5">
              <SessionGymPill
                gymId={gymId}
                onChange={setGymId}
                theme={theme}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Exercise groups ──────────────────────────────────────────────── */}
      <div className="px-4 pt-3 space-y-2">
        {renderGroups.map(group => {
          return (
            <div key={group.label}>
              {/* Hide section labels when numpad is open to maximize space */}
              {!numpadIsOpen && (
                <GroupLabel
                  label={group.isCompleted ? '✓ Completed' : group.label}
                  isCompleted={group.isCompleted}
                />
              )}
              <div className="space-y-2">
                {group.exercises.map((ex, idx) => {
                  const groupExes = group.exercises
                  return (
                    <ExerciseItem
                      key={ex.id}
                      exercise={ex}
                      lastSessionEx={lastExDataByName[ex.name]}
                      allSessions={sessions}
                      workoutType={type}
                      onUpdate={updated => updateExercise(ex.id, updated)}
                      theme={theme}
                      isFirst={idx === 0}
                      isLast={idx === groupExes.length - 1}
                      onMoveUp={() => moveExercise(ex.id, 'up')}
                      onMoveDown={() => moveExercise(ex.id, 'down')}
                      reorderMode={false}
                      aggressivenessMultiplier={readiness?.aggressivenessMultiplier ?? 1}
                      suggestedMode={readiness?.suggestedMode ?? 'push'}
                      fatigueSignals={fatigueSignals}
                      activeSessionId={startTimestamp.current || null}
                      currentGymId={gymId}
                      currentGymLabel={currentGymLabel}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Add exercise – hidden when numpad is open to save space */}
        {!numpadIsOpen && (
          <button
            onClick={() => setShowAddPanel(true)}
            className="w-full py-4 mt-2 rounded-2xl border-2 border-dashed border-c-base text-c-muted font-semibold flex items-center justify-center gap-2"
          >
            <span className="text-xl">+</span> Add Exercise
          </button>
        )}

        {/* Focus mode exit zone – tap to dismiss numpad and return to full list.
            Uses onPointerDown (not onClick) so that ghost/delayed click events
            from the numpad's "Next →" button can never accidentally trigger this
            and collapse the numpad mid-transition. */}
        {numpadIsOpen && (
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); closeNumpad() }}
            className="w-full flex flex-col items-center justify-center gap-2 py-8 mt-2 rounded-2xl"
            style={{ backgroundColor: 'transparent' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.3 }}>
              <path d="M7 14L12 9L17 14" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-c-muted text-xs font-semibold tracking-wide">Tap to show all exercises</span>
          </button>
        )}

        {/* Session notes – hidden when numpad is open */}
        {!numpadIsOpen && (
        <div className="bg-card rounded-2xl p-4">
          <p className="text-xs text-c-muted mb-2 font-semibold uppercase tracking-wide">Session Notes</p>
          <textarea
            value={sessionNotes}
            onChange={e => setSessionNotes(e.target.value)}
            placeholder="How did the session go? Any notes…"
            rows={3}
            className="w-full bg-item text-c-secondary rounded-xl px-3 py-2.5 text-sm placeholder-gray-400 resize-none"
          />
        </div>
        )}
      </div>

      {/* ── Sticky footer – hidden when numpad is open ───────────────────── */}
      {!numpadIsOpen && createPortal(
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-base/95 backdrop-blur border-t border-c-subtle px-3 pt-3 safe-bottom z-40">
          {loggedSets === 0 ? (
            <p className="text-center text-sm text-c-muted py-1">Log at least one set to save</p>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              className={`w-full ${theme.bg} text-white py-4 rounded-2xl font-bold text-lg`}
              style={{ color: theme.contrastText }}
            >
              Finish Session · {loggedSets} sets
            </button>
          )}
        </div>,
        document.body
      )}

      {/* ── Panels & modals ──────────────────────────────────────────────── */}
      {showAddPanel && (
        <AddExercisePanel
          onAdd={addExercise}
          onClose={() => setShowAddPanel(false)}
          theme={theme}
          currentGymId={gymId}
          currentGymLabel={currentGymLabel}
        />
      )}

      {showConfirm && (
        <FinishModal
          loggedSets={loggedSets}
          exerciseCount={exercises.filter(ex => ex.sets.some(s => s.reps || s.weight)).length}
          elapsed={elapsedSeconds > 0 ? formatElapsed(elapsedSeconds) : null}
          onSave={saveSession}
          onLogNow={saveAndLogNow}
          onCancel={() => setShowConfirm(false)}
          onDiscard={() => { clearActiveSession(); navigate('/dashboard'); }}
          theme={theme}
          todayCardio={todayCardio}
        />
      )}

      {showSaved && savedStats && (
        <SessionSaved
          stats={savedStats}
          onShare={handleShareFromSaved}
          onDone={() => navigate('/dashboard')}
        />
      )}

      {showComparison && comparisonData && (
        <SessionComparison
          currentExercises={comparisonData}
          lastSession={comparisonPrevSess}
          theme={theme}
          onContinue={() => { setShowComparison(false); setShowSummary(true) }}
        />
      )}

      {showSummary && summaryData && (
        <ShareCard
          data={summaryData}
          onDone={() => navigate('/dashboard')}
          sessionId={savedSessionId}
          onUpdateSession={updateSession}
        />
      )}

      {/* Custom numpad – always in DOM for slide animation */}
      <CustomNumpad config={numpadConfig} isOpen={numpadIsOpen} onClose={closeNumpad} />
    </div>
    </NumpadContext.Provider>
  )
}
