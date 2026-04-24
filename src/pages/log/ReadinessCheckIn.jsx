// Batch 16n — Readiness check-in overlay (spec §2.5).
// Batch 35 — Gym promoted to top + Exercise Order row added.
//
// Pre-session prompt placed on the Start Session overlay. Captures
// gym / energy / sleep / goal / exercise order. Readiness rows feed the
// recommender's aggressivenessMultiplier (energy + sleep → 0.85 / 1.00 /
// 1.15) and suggestedMode (goal → deload / maintain / push). Exercise
// order flows to BbLogger, which reorders the default exercise list by
// last session's completion timestamps within each section when the user
// picks "Last session".
//
// Defaults (Mid / Mid / Push / Default order) match pre-feature behavior so
// a user who ignores the rows and taps Start immediately gets no change.
// "Skip check-in" stores readiness=null but still honors gym + order.

import { useState, useRef, useEffect } from 'react'
import useStore from '../../store/useStore'

const ENERGY_OPTIONS = [
  { value: 'low',  label: 'Low'  },
  { value: 'ok',   label: 'Mid'  },
  { value: 'high', label: 'High' },
]
const SLEEP_OPTIONS = [
  { value: 'poor', label: 'Poor' },
  { value: 'ok',   label: 'Mid'  },
  { value: 'good', label: 'Good' },
]
const GOAL_OPTIONS = [
  { value: 'recover', label: 'Recover' },
  { value: 'match',   label: 'Match'   },
  { value: 'push',    label: 'Push'    },
]
const ORDER_OPTIONS = [
  { value: 'lastSession', label: 'Last session' },
  { value: 'default',     label: 'Default'      },
]

export default function ReadinessCheckIn({
  workoutName,
  workoutEmoji,
  theme,
  onStart,
  onCancel,
}) {
  const gyms          = useStore(s => s.settings.gyms        || [])
  const defaultGymId  = useStore(s => s.settings.defaultGymId || null)
  const addGym        = useStore(s => s.addGym)
  const setDefaultGymId = useStore(s => s.setDefaultGymId)

  const [energy,    setEnergy]    = useState('ok')
  const [sleep,     setSleep]     = useState('ok')
  const [goal,      setGoal]      = useState('push')
  const [orderMode, setOrderMode] = useState('default')
  const [gymId,     setGymId]     = useState(defaultGymId || null)

  // Gym picker popover
  const [pickerOpen, setPickerOpen] = useState(false)
  const [newGymDraft, setNewGymDraft] = useState('')
  const pickerRef = useRef(null)
  const chipRef   = useRef(null)

  useEffect(() => {
    if (!pickerOpen) return
    const onDoc = (e) => {
      if (pickerRef.current?.contains(e.target))  return
      if (chipRef.current?.contains(e.target))    return
      setPickerOpen(false)
    }
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onDoc)
      document.addEventListener('touchstart', onDoc)
    }, 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [pickerOpen])

  const handleAddGym = () => {
    const clean = newGymDraft.trim()
    if (!clean) return
    const id = addGym(clean)
    if (id) {
      setGymId(id)
      setDefaultGymId(id)
    }
    setNewGymDraft('')
    setPickerOpen(false)
  }

  const handleStart = () => {
    if (gymId) setDefaultGymId(gymId)
    onStart({ energy, sleep, goal, gymId: gymId || null, orderMode })
  }

  const handleSkip = () => {
    if (gymId) setDefaultGymId(gymId)
    onStart({ readiness: null, gymId: gymId || null, orderMode })
  }

  const selectedGym = gyms.find(g => g.id === gymId) || null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
      <div className="w-full max-w-sm px-6 text-center">

        {/* Emoji + workout name */}
        <div className="text-5xl mb-2">{workoutEmoji}</div>
        <h2 className="text-2xl font-bold text-white mb-1">{workoutName}</h2>
        <p className="text-xs text-white/50 mb-5">Timer starts when you begin</p>

        {/* Gym section — full-width, top of the form for prominence */}
        <div className="relative mb-4 text-left">
          <div className="text-[10px] uppercase tracking-wider text-white/50 mb-1.5 px-1">Gym</div>
          <button
            ref={chipRef}
            type="button"
            onClick={() => setPickerOpen(v => !v)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
              selectedGym
                ? 'bg-white/10 border-white/15 text-white hover:bg-white/15'
                : 'bg-white/5 border-white/20 border-dashed text-white/80 hover:bg-white/10'
            }`}
          >
            {selectedGym ? (
              <>
                <span className="text-base font-semibold truncate">{selectedGym.label}</span>
                <span className="text-xs text-white/50 shrink-0 ml-2">change</span>
              </>
            ) : (
              <>
                <span className="text-sm">Where are you lifting?</span>
                <span className="text-xs text-white/60 shrink-0 ml-2">pick</span>
              </>
            )}
          </button>

          {pickerOpen && (
            <div
              ref={pickerRef}
              className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-white/15 bg-card shadow-2xl p-2 text-left"
              style={{ zIndex: 60 }}
            >
              {gyms.length > 0 && (
                <div className="space-y-0.5 mb-2">
                  {gyms.map(g => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => { setGymId(g.id); setPickerOpen(false) }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                        g.id === gymId ? `${theme.bgSubtle} ${theme.text}` : 'text-c-secondary hover:bg-item'
                      }`}
                    >
                      <span className="truncate">{g.label}</span>
                      {g.id === gymId && <span className="shrink-0 ml-2">✓</span>}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newGymDraft}
                  onChange={e => setNewGymDraft(e.target.value.slice(0, 40))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); handleAddGym() }
                    if (e.key === 'Escape') { setNewGymDraft(''); setPickerOpen(false) }
                  }}
                  placeholder="Add gym name…"
                  maxLength={40}
                  className="flex-1 px-3 py-2 rounded-lg bg-item text-sm text-c-primary placeholder-c-faint outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddGym}
                  disabled={!newGymDraft.trim()}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                    newGymDraft.trim()
                      ? `${theme.bg} ${theme.textOnBg || ''}`
                      : 'bg-item text-c-faint cursor-not-allowed'
                  }`}
                  style={newGymDraft.trim() ? { color: theme.contrastText } : undefined}
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Readiness rows */}
        <div className="space-y-4 mb-5 text-left">
          <ReadinessRow
            label="Energy"
            options={ENERGY_OPTIONS}
            value={energy}
            onChange={setEnergy}
            theme={theme}
          />
          <ReadinessRow
            label="Sleep"
            options={SLEEP_OPTIONS}
            value={sleep}
            onChange={setSleep}
            theme={theme}
          />
          <ReadinessRow
            label="Today's goal"
            options={GOAL_OPTIONS}
            value={goal}
            onChange={setGoal}
            theme={theme}
          />
          <ReadinessRow
            label="Exercise order"
            options={ORDER_OPTIONS}
            value={orderMode}
            onChange={setOrderMode}
            theme={theme}
          />
        </div>

        {/* Actions */}
        <button
          type="button"
          onClick={handleStart}
          className={`${theme.bg} w-full px-8 py-3.5 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-transform`}
          style={{ color: theme.contrastText }}
        >
          Start Session
        </button>
        <div className="flex items-center justify-center gap-4 mt-3">
          <button
            onClick={handleSkip}
            className="text-xs text-white/40 underline underline-offset-2"
          >
            Skip check-in
          </button>
          <button
            onClick={onCancel}
            className="text-xs text-white/40 underline underline-offset-2"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Row primitive ──────────────────────────────────────────────────────────

function ReadinessRow({ label, options, value, onChange, theme }) {
  const cols = options.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/50 mb-1.5 px-1">{label}</div>
      <div className={`grid ${cols} gap-1.5`}>
        {options.map(opt => {
          const selected = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`py-2.5 rounded-xl text-sm font-semibold transition-colors border ${
                selected
                  ? `${theme.bg} border-transparent`
                  : 'bg-white/10 border-white/10 text-white/80 hover:bg-white/15'
              }`}
              style={selected ? { color: theme.contrastText } : undefined}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
