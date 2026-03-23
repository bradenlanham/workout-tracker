import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useStore from '../../store/useStore'
import { BB_EXERCISE_GROUPS, BB_WORKOUT_NAMES, BB_WORKOUT_EMOJI } from '../../data/exercises'
import {
  getLastBbSession, getExercisePRs,
} from '../../utils/helpers'
import { getTheme } from '../../theme'
import ShareCard from './ShareCard'

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

const PLATE_OPTIONS = [45, 35, 25, 10, 5, 2.5]
const BAR_CYCLE = [45, 0, 25]
const CIRCLED = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨']
const circled = n => n >= 1 && n <= 9 ? CIRCLED[n - 1] : `×${n}`
const emptyPlates = () => ({ 45: 0, 35: 0, 25: 0, 10: 0, 5: 0, 2.5: 0 })
const calcTotal = (plates, barWeight) =>
  Object.entries(plates).reduce((s, [w, c]) => s + Number(w) * c * 2, 0) + barWeight
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
  { id: 'warmup',  label: 'Warm' },
]

function SetTypeBtn({ value, onChange, theme }) {
  const current = SET_TYPES.find(t => t.id === value) || SET_TYPES[0]
  const next    = SET_TYPES[(SET_TYPES.indexOf(current) + 1) % SET_TYPES.length]
  const color      = current.id === 'working' ? `${theme.bg} text-white` : 'bg-amber-500 text-white'
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

// ── Previous-session ghost row (non-interactive) ───────────────────────────────

function PrevSetRow({ set }) {
  const plateText = set.plates ? formatPlateBreakdown(set.plates) : null
  return (
    <div className="flex items-center gap-2 opacity-35 pointer-events-none select-none">
      <div className="w-14 h-9 rounded-lg bg-item text-c-dim text-xs font-bold flex items-center justify-center shrink-0">
        {set.type === 'warmup' ? 'Warm' : 'Work'}
      </div>
      {plateText ? (
        <div className="flex-1 h-9 rounded-lg bg-item text-c-dim text-xs font-semibold flex items-center justify-center gap-1 px-2">
          <span>{plateText}</span>
          <span className="opacity-50">=</span>
          <span>{set.weight}</span>
        </div>
      ) : (
        <div className="w-20 h-9 rounded-lg bg-item text-c-dim text-sm font-semibold flex items-center justify-center">
          {set.weight ? `${set.weight}` : '—'}
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

// ── Plate calculator (per-exercise) ───────────────────────────────────────────

function PlateCalc({ exercise, onUpdate }) {
  const { plateWeight = 45, barWeight = 45, platesPerSide = 2 } = exercise
  const total = Math.round((platesPerSide * plateWeight * 2 + barWeight) * 10) / 10

  const applyToSets = () => {
    onUpdate({
      ...exercise,
      sets: exercise.sets.map(s =>
        s.type === 'working' ? { ...s, weight: String(total) } : s
      ),
    })
  }

  return (
    <div className="bg-item-dim rounded-xl p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">Plate Calculator</p>
        <p className="text-base font-bold">{total} lbs</p>
      </div>
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <p className="text-xs text-c-muted mb-1">Plates/side</p>
          <input
            type="number"
            inputMode="decimal"
            value={platesPerSide}
            onChange={e => onUpdate({ ...exercise, platesPerSide: parseFloat(e.target.value) || 0 })}
            className="w-full bg-item text-c-primary rounded-lg px-2 py-2 text-center text-base font-semibold"
            min={0}
            step={0.5}
          />
        </div>
        <div className="flex-1">
          <p className="text-xs text-c-muted mb-1">Plate wt (lbs)</p>
          <input
            type="number"
            inputMode="decimal"
            value={plateWeight}
            onChange={e => onUpdate({ ...exercise, plateWeight: parseFloat(e.target.value) || 0 })}
            className="w-full bg-item text-c-primary rounded-lg px-2 py-2 text-center text-base font-semibold"
            min={0}
          />
        </div>
        <div className="flex-1">
          <p className="text-xs text-c-muted mb-1">Bar (lbs)</p>
          <input
            type="number"
            inputMode="decimal"
            value={barWeight}
            onChange={e => onUpdate({ ...exercise, barWeight: parseFloat(e.target.value) || 0 })}
            className="w-full bg-item text-c-primary rounded-lg px-2 py-2 text-center text-base font-semibold"
            min={0}
          />
        </div>
      </div>
      <p className="text-xs text-c-muted mt-1.5 text-center">
        {platesPerSide} × {plateWeight} × 2 + {barWeight} = {total} lbs
      </p>
      <button
        type="button"
        onClick={applyToSets}
        className="w-full mt-2 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold"
      >
        Apply {total} lbs to working sets
      </button>
    </div>
  )
}

// ── Plate-loaded set row ───────────────────────────────────────────────────────

function PlateSetRow({ set, exerciseName, allSessions, onChange, onDelete, theme }) {
  const { maxWeight, maxReps } = getExercisePRs(allSessions, exerciseName)
  const plates    = set.plates    ?? emptyPlates()
  const barWeight = set.barWeight ?? 45
  const total     = calcTotal(plates, barWeight)
  const r         = parseInt(set.reps) || 0
  const isPR      = (total > maxWeight && total > 0) || (r > maxReps && r > 0)

  const update = (newPlates, newBar) => {
    const newTotal = calcTotal(newPlates, newBar)
    onChange({ ...set, plates: newPlates, barWeight: newBar, weight: String(newTotal), plateLoaded: true })
  }
  const addPlate    = plate => update({ ...plates, [plate]: (plates[plate] || 0) + 1 }, barWeight)
  const removePlate = plate => update({ ...plates, [plate]: Math.max(0, (plates[plate] || 0) - 1) }, barWeight)
  const cycleBar    = () => {
    const idx = BAR_CYCLE.indexOf(barWeight)
    update(plates, BAR_CYCLE[(idx + 1) % BAR_CYCLE.length])
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
          type="number"
          inputMode="numeric"
          value={set.reps}
          onChange={e => onChange({ ...set, reps: e.target.value, plates, barWeight, weight: String(total) })}
          placeholder={set.prevReps || 'reps'}
          className="w-16 min-w-0 bg-item text-c-primary rounded-lg px-1 py-2 text-center text-base font-semibold h-10"
          min={0}
        />
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
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={cycleBar}
          className="h-8 px-2.5 rounded-lg bg-item text-c-secondary text-xs font-semibold shrink-0"
        >
          Bar:{barWeight === 0 ? '—' : barWeight}
        </button>
        {PLATE_OPTIONS.map(plate => {
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
        })}
      </div>
    </div>
  )
}

// ── Active set row ─────────────────────────────────────────────────────────────

function SetRow({ set, exerciseName, allSessions, onChange, onDelete, theme, plateLoaded }) {
  if (plateLoaded) {
    return (
      <PlateSetRow
        set={set}
        exerciseName={exerciseName}
        allSessions={allSessions}
        onChange={onChange}
        onDelete={onDelete}
        theme={theme}
      />
    )
  }

  const { maxWeight, maxReps } = getExercisePRs(allSessions, exerciseName)
  const w   = parseFloat(set.weight) || 0
  const r   = parseInt(set.reps)     || 0
  const isPR = (w > maxWeight && w > 0) || (r > maxReps && r > 0)

  return (
    <div className="flex items-center gap-2">
      <SetTypeBtn value={set.type} onChange={val => onChange({ ...set, type: val })} theme={theme} />
      {/* Weight FIRST */}
      <input
        type="number"
        inputMode="decimal"
        value={set.weight}
        onChange={e => onChange({ ...set, weight: e.target.value })}
        placeholder={set.prevWeight || 'lbs'}
        className="w-20 min-w-0 bg-item text-c-primary rounded-lg px-1 py-2 text-center text-base font-semibold h-10"
        min={0}
      />
      {/* Reps SECOND */}
      <input
        type="number"
        inputMode="numeric"
        value={set.reps}
        onChange={e => onChange({ ...set, reps: e.target.value })}
        placeholder={set.prevReps || 'reps'}
        className="w-16 min-w-0 bg-item text-c-primary rounded-lg px-1 py-2 text-center text-base font-semibold h-10"
        min={0}
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
  isFirst, isLast, onMoveUp, onMoveDown, reorderMode,
}) {
  const [expanded, setExpanded] = useState(false)
  const { settings, setRestEndTimestamp } = useStore()

  const addSet = () => {
    const lastSet = exercise.sets[exercise.sets.length - 1]
    const prevSet = lastSessionEx?.sets?.[exercise.sets.length]
    const newSet = {
      type:       'working',
      reps:       '',
      weight:     '',
      prevWeight: prevSet?.weight ? String(prevSet.weight) : '',
      prevReps:   prevSet?.reps   ? String(prevSet.reps)   : '',
    }
    if (exercise.plateLoaded) {
      newSet.plates    = prevSet?.plates    ?? emptyPlates()
      newSet.barWeight = prevSet?.barWeight ?? 45
      if (prevSet?.weight) newSet.weight = String(prevSet.weight)
    }
    onUpdate({ ...exercise, sets: [...exercise.sets, newSet] })
    if (settings.autoStartRest && lastSet?.type === 'working' && (lastSet.reps || lastSet.weight)) {
      setRestEndTimestamp(Date.now() + settings.restTimerDuration * 1000)
    }
  }

  const updateSet = (i, newSet) => {
    const sets = [...exercise.sets]
    sets[i] = newSet
    onUpdate({ ...exercise, sets })
  }

  const deleteSet = (i) => {
    const sets = exercise.sets.filter((_, idx) => idx !== i)
    onUpdate({ ...exercise, sets: sets.length ? sets : [{ type: 'warmup', reps: '', weight: '' }] })
  }

  const markDone = () => {
    onUpdate({ ...exercise, done: true })
    setExpanded(false)
  }

  const hasPR = allSessions.length > 0 && exercise.sets.some(s => {
    const { maxWeight, maxReps } = getExercisePRs(allSessions, exercise.name)
    return (parseFloat(s.weight) > maxWeight && parseFloat(s.weight) > 0) ||
      (parseInt(s.reps) > maxReps && parseInt(s.reps) > 0)
  })

  const topSet     = exercise.sets.find(s => s.reps || s.weight)
  const lastTopSet = lastSessionEx?.sets?.[0]
  const prevSets   = lastSessionEx?.sets || []

  const lastExNotes = (() => {
    const prev = [...allSessions]
      .filter(s => s.mode === 'bb' && s.data?.exercises?.some(e => e.name === exercise.name))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
    if (!prev.length) return null
    const ex = prev[0].data.exercises.find(e => e.name === exercise.name)
    return ex?.notes || null
  })()

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
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex-1 flex items-center justify-between p-4 text-left min-w-0"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {exercise.done && <span className="text-emerald-400 text-lg leading-none">✓</span>}
              <p className="font-semibold text-base truncate">{exercise.name}</p>
              {hasPR && !exercise.done && <span className="text-amber-400 text-sm">🏆</span>}
            </div>
            {!expanded && !exercise.done && lastTopSet && (
              <p style={{ fontSize: 10 }} className="text-c-faint opacity-50 mt-0.5 leading-none">
                {lastTopSet.plates && formatPlateBreakdown(lastTopSet.plates)
                  ? `Last: ${formatPlateBreakdown(lastTopSet.plates)} = ${lastTopSet.weight}`
                  : `Last: ${lastTopSet.weight || '—'}${lastTopSet.reps ? `×${lastTopSet.reps}` : ''}`}
              </p>
            )}
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
        </button>

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

          {/* Plate mode toggles */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onUpdate({ ...exercise, plateLoaded: !exercise.plateLoaded })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                exercise.plateLoaded
                  ? `${theme.bgSubtle} border ${theme.border} ${theme.text}`
                  : 'bg-item text-c-dim'
              }`}
            >
              <span>🏋️</span> Plates
            </button>
            <button
              type="button"
              onClick={() => onUpdate({ ...exercise, plateMode: !exercise.plateMode })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                exercise.plateMode
                  ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                  : 'bg-item text-c-dim'
              }`}
            >
              <span>🧮</span> Calc
            </button>
          </div>

          {/* Plate calculator panel */}
          {exercise.plateMode && (
            <PlateCalc exercise={exercise} onUpdate={onUpdate} />
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
          {prevSets.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <p className="text-xs text-c-faint uppercase tracking-widest font-semibold shrink-0">Last</p>
                <div className="flex-1 h-px bg-item" />
              </div>
              {prevSets.map((s, i) => <PrevSetRow key={i} set={s} />)}
              <div className="flex items-center gap-2">
                <p className="text-xs text-c-faint uppercase tracking-widest font-semibold shrink-0">Today</p>
                <div className="flex-1 h-px bg-item" />
              </div>
            </>
          )}

          {/* Active set rows */}
          {exercise.sets.map((set, i) => (
            <SetRow
              key={i}
              set={set}
              exerciseName={exercise.name}
              allSessions={allSessions}
              onChange={newSet => updateSet(i, newSet)}
              onDelete={() => deleteSet(i)}
              theme={theme}
              plateLoaded={exercise.plateLoaded}
            />
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
    </div>
  )
}

// ── Group section label ────────────────────────────────────────────────────────

function GroupLabel({ label, isCompleted, onReorder, isReordering }) {
  return (
    <div className={`flex items-center gap-2 px-1 pt-2 pb-1 ${isCompleted ? 'text-emerald-400' : 'text-c-muted'}`}>
      <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-current opacity-20" />
      {!isCompleted && onReorder && (
        isReordering ? (
          <button
            onClick={onReorder}
            className="text-xs font-semibold text-emerald-400 px-2.5 py-1 bg-emerald-500/20 rounded-lg shrink-0"
          >
            Done
          </button>
        ) : (
          <button
            onClick={onReorder}
            className="text-xs text-c-muted underline shrink-0"
          >
            Reorder
          </button>
        )
      )}
    </div>
  )
}

// ── Add exercise panel ─────────────────────────────────────────────────────────

function AddExercisePanel({ onAdd, onClose, theme }) {
  const [query, setQuery] = useState('')

  const suggestions = [
    'Barbell Row', 'Pull-ups', 'Face Pulls', 'Tricep Pushdown', 'Preacher Curl',
    'Lat Pulldown', 'Cable Row', 'Chest Fly', 'Skull Crushers', 'Arnold Press',
    'Incline Curl', 'Rope Pushdown', 'Sumo Deadlift', 'Hip Thrust', 'Glute Bridge',
  ]

  const filtered = query.trim()
    ? suggestions.filter(e => e.toLowerCase().includes(query.toLowerCase()))
    : suggestions

  return (
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
          onKeyDown={e => {
            if (e.key === 'Enter' && query.trim()) { onAdd(query.trim()); onClose() }
          }}
        />
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {query.trim() && (
            <button
              onClick={() => { onAdd(query.trim()); onClose() }}
              className={`w-full text-left px-4 py-3 rounded-xl ${theme.bg} text-white font-semibold`}
              style={{ color: theme.contrastText }}
            >
              + Add "{query.trim()}"
            </button>
          )}
          {filtered.slice(0, 8).map(name => (
            <button
              key={name}
              onClick={() => { onAdd(name); onClose() }}
              className="w-full text-left px-4 py-3 rounded-xl bg-item text-c-secondary text-base"
            >
              {name}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-full mt-3 py-3 rounded-xl bg-item text-c-dim font-semibold">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Finish session modal ───────────────────────────────────────────────────────

const GRADES = ['D', 'C', 'B', 'A', 'A+']

const CARDIO_TYPES = ['Running', 'Cycling', 'Elliptical', 'StairMaster', 'Rowing', 'Jump Rope', 'Swimming', 'Other']

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

function FinishModal({ loggedSets, exerciseCount, elapsed, onSave, onCancel, theme }) {
  const [grade, setGrade] = useState(null)
  const [cardioCompleted, setCardioCompleted] = useState(null)
  const [cardioType, setCardioType] = useState('')
  const [cardioDuration, setCardioDuration] = useState('')
  const [cardioHR, setCardioHR] = useState('')
  const [cardioNotes, setCardioNotes] = useState('')

  const handleSave = () => {
    const cardio = cardioCompleted
      ? {
          completed: true,
          type: cardioType || 'Other',
          duration: parseInt(cardioDuration) || null,
          heartRate: parseInt(cardioHR) || null,
          notes: cardioNotes,
        }
      : { completed: false }

    onSave({ grade, completedCardio: !!cardioCompleted, cardio })
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
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setCardioCompleted(cardioCompleted === true ? null : true)}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
              cardioCompleted === true ? 'bg-emerald-500 text-white' : 'bg-item text-c-dim'
            }`}
          >
            ✓ Yes
          </button>
          <button
            onClick={() => setCardioCompleted(cardioCompleted === false ? null : false)}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
              cardioCompleted === false ? 'bg-hover text-c-secondary' : 'bg-item text-c-dim'
            }`}
          >
            ✗ No
          </button>
        </div>

        {/* Cardio details — only shown when yes is selected */}
        {cardioCompleted === true && (
          <div className="bg-item-dim rounded-2xl p-3 mb-3 space-y-2">
            {/* Type selector */}
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
              <div className="flex-1">
                <p className="text-xs text-c-muted mb-1">Avg HR (bpm)</p>
                <input
                  type="number"
                  inputMode="numeric"
                  value={cardioHR}
                  onChange={e => setCardioHR(e.target.value)}
                  placeholder="optional"
                  className="w-full bg-item text-c-primary rounded-lg px-2 py-2 text-center text-sm font-semibold"
                  min={1}
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
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-item text-c-secondary py-3.5 rounded-2xl font-semibold"
          >
            Keep Going
          </button>
          <button
            onClick={handleSave}
            className={`flex-1 ${theme.bg} text-white py-3.5 rounded-2xl font-bold`}
            style={{ color: theme.contrastText }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main BbLogger ──────────────────────────────────────────────────────────────

export default function BbLogger() {
  const { type }   = useParams()
  const navigate   = useNavigate()
  const {
    sessions, settings, addSession,
    activeSession, saveActiveSession, clearActiveSession,
    customTemplates, splits, activeSplitId,
  } = useStore()
  const theme = getTheme(settings.accentColor)

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

  const defaultExercises = groups.flatMap(group =>
    group.exercises.map((name, i) => ({
      id:    `${group.label}-${name}-${i}`,
      name,
      group: group.label,
      sets:  [{ type: 'warmup', reps: '', weight: '' }],
      notes: '',
      done:  false,
      plateMode: false,
      platesPerSide: 2,
      plateWeight: 45,
      barWeight: 45,
    }))
  )

  const [exercises,      setExercises]      = useState(() => savedSession?.exercises || defaultExercises)
  const [sessionNotes,   setSessionNotes]   = useState(() => savedSession?.sessionNotes || '')
  const [showAddPanel,   setShowAddPanel]   = useState(false)
  const [showConfirm,    setShowConfirm]    = useState(false)
  const [reorderSection, setReorderSection] = useState(null)
  const [showSummary,    setShowSummary]    = useState(false)
  const [summaryData,    setSummaryData]    = useState(null)

  // ── Session timer (timestamp-based — survives backgrounding) ─────────────

  const startTimestamp = useRef(savedSession?.startTimestamp || Date.now())
  const [elapsedSeconds, setElapsedSeconds] = useState(
    Math.floor((Date.now() - startTimestamp.current) / 1000)
  )

  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimestamp.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Recalc on app return from background
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        setElapsedSeconds(Math.floor((Date.now() - startTimestamp.current) / 1000))
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // ── Persist active session on every change ───────────────────────────────

  useEffect(() => {
    saveActiveSession({
      type,
      exercises,
      sessionNotes,
    })
  }, [exercises, sessionNotes]) // eslint-disable-line

  // ── Session helpers ──────────────────────────────────────────────────────

  const lastSession = getLastBbSession(sessions, type)

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

  const addExercise = (name) => {
    setExercises(prev => [...prev, {
      id:    `custom-${name}-${Date.now()}`,
      name,
      group: 'Custom',
      sets:  [{ type: 'warmup', reps: '', weight: '' }],
      notes: '',
      done:  false,
      plateMode: false,
      platesPerSide: 2,
      plateWeight: 45,
      barWeight: 45,
    }])
  }

  const saveSession = ({ grade, completedCardio, cardio }) => {
    const duration = Math.round(elapsedSeconds / 60)

    const exerciseData = exercises
      .map(ex => {
        const filledSets = ex.sets.filter(s => s.reps || s.weight)
        if (!filledSets.length) return null
        return {
          name:  ex.name,
          notes: ex.notes,
          sets: filledSets.map(s => {
            const { maxWeight, maxReps } = getExercisePRs(sessions, ex.name)
            const w = parseFloat(s.weight) || 0
            const r = parseInt(s.reps)     || 0
            return { type: s.type, reps: r, weight: w, isNewPR: (w > maxWeight && w > 0) || (r > maxReps && r > 0) }
          }),
        }
      })
      .filter(Boolean)

    addSession({
      date:            new Date().toISOString(),
      mode:            'bb',
      type:            isCustomTemplate ? `tpl_${templateId}` : type,
      duration,
      grade,
      completedCardio,
      cardio,
      notes:           sessionNotes,
      data:            { workoutType: type, exercises: exerciseData },
    })

    clearActiveSession()

    // Build share card summary
    const totalVolume = exerciseData.reduce((t, ex) =>
      t + ex.sets.reduce((s, set) => s + set.reps * set.weight, 0), 0)
    const totalSets = exerciseData.reduce((t, ex) => t + ex.sets.length, 0)
    const totalPRs = exerciseData.reduce((t, ex) => t + ex.sets.filter(s => s.isNewPR).length, 0)
    const exerciseSummary = exerciseData.map(ex => {
      const bestSet = ex.sets.reduce((best, set) => {
        if (!best) return set
        if (set.weight > best.weight) return set
        if (set.weight === best.weight && set.reps > best.reps) return set
        return best
      }, null)
      return { name: ex.name, bestSet, hasPR: ex.sets.some(s => s.isNewPR), notes: ex.notes }
    })
    const h = Math.floor(elapsedSeconds / 3600)
    const m = Math.floor((elapsedSeconds % 3600) / 60)
    const s = elapsedSeconds % 60
    const durationStr = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

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
      theme,
    })
    setShowConfirm(false)
    setShowSummary(true)
  }

  // ── Render helpers ───────────────────────────────────────────────────────

  const loggedSets    = exercises.reduce((t, ex) => t + ex.sets.filter(s => s.reps || s.weight).length, 0)
  const completedExes = exercises.filter(ex => ex.done)
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
    <div className="pb-40 min-h-screen bg-base">

      {/* ── Clipboard header (sticky) ────────────────────────────────────── */}
      <div
        className="sticky top-0 z-30"
        style={{
          backgroundColor: theme.hex,
          paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0.75rem))',
          color: theme.contrastText,
        }}
      >
        <div className="flex justify-center pb-1">
          <ClipGraphic />
        </div>

        <div className="flex items-center justify-between px-4 pb-2" style={{ paddingRight: '4rem' }}>
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-black/25"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold" style={{ opacity: 0.7 }}>
            {loggedSets} set{loggedSets !== 1 ? 's' : ''} logged
          </span>
          <div className="bg-black/25 rounded-full px-3 py-1.5">
            <span className="text-sm font-mono font-bold text-white">
              {formatElapsed(elapsedSeconds)}
            </span>
          </div>
        </div>

        <div className="px-5 pb-4">
          <h1 className="text-2xl font-bold leading-tight">
            {workoutEmoji} {workoutName}
          </h1>
          {savedSession && (
            <p className="text-xs mt-0.5" style={{ opacity: 0.6 }}>Resumed from saved session</p>
          )}
        </div>
      </div>

      {/* ── Exercise groups ──────────────────────────────────────────────── */}
      <div className="px-4 pt-3 space-y-2">
        {renderGroups.map(group => {
          const isReordering = !group.isCompleted && reorderSection === group.label
          return (
            <div key={group.label}>
              <GroupLabel
                label={group.isCompleted ? '✓ Completed' : group.label}
                isCompleted={group.isCompleted}
                onReorder={!group.isCompleted ? () => setReorderSection(isReordering ? null : group.label) : undefined}
                isReordering={isReordering}
              />
              <div className="space-y-2">
                {group.exercises.map((ex, idx) => {
                  const groupExes = group.exercises
                  return (
                    <ExerciseItem
                      key={ex.id}
                      exercise={ex}
                      lastSessionEx={lastSession?.data?.exercises?.find(e => e.name === ex.name)}
                      allSessions={sessions}
                      onUpdate={updated => updateExercise(ex.id, updated)}
                      theme={theme}
                      isFirst={idx === 0}
                      isLast={idx === groupExes.length - 1}
                      onMoveUp={() => moveExercise(ex.id, 'up')}
                      onMoveDown={() => moveExercise(ex.id, 'down')}
                      reorderMode={isReordering}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Add exercise */}
        <button
          onClick={() => setShowAddPanel(true)}
          className="w-full py-4 mt-2 rounded-2xl border-2 border-dashed border-c-base text-c-muted font-semibold flex items-center justify-center gap-2"
        >
          <span className="text-xl">+</span> Add Exercise
        </button>

        {/* Session notes */}
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
      </div>

      {/* ── Sticky footer ────────────────────────────────────────────────── */}
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
      </div>

      {/* ── Panels & modals ──────────────────────────────────────────────── */}
      {showAddPanel && (
        <AddExercisePanel
          onAdd={addExercise}
          onClose={() => setShowAddPanel(false)}
          theme={theme}
        />
      )}

      {showConfirm && (
        <FinishModal
          loggedSets={loggedSets}
          exerciseCount={exercises.filter(ex => ex.sets.some(s => s.reps || s.weight)).length}
          elapsed={elapsedSeconds > 0 ? formatElapsed(elapsedSeconds) : null}
          onSave={saveSession}
          onCancel={() => setShowConfirm(false)}
          theme={theme}
        />
      )}

      {showSummary && summaryData && (
        <ShareCard
          data={summaryData}
          onDone={() => navigate('/dashboard')}
        />
      )}
    </div>
  )
}
