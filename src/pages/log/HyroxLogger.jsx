import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useStore from '../../store/useStore'
import { SESSION_TYPE_INFO, HYROX_STATIONS } from '../../data/hyrox'
import { timeToSeconds, secondsToMmSs, calcPace } from '../../utils/helpers'

// ── Shared UI atoms ───────────────────────────────────────────────────────────

function Label({ children }) {
  return <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">{children}</p>
}

function Field({ label, children }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, inputMode = 'decimal', ...rest }) {
  return (
    <input
      type="number"
      inputMode={inputMode}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 text-base font-semibold placeholder-gray-600"
      min={0}
      {...rest}
    />
  )
}

function TextInput({ value, onChange, placeholder, ...rest }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 text-base placeholder-gray-600"
      {...rest}
    />
  )
}

function TimeInput({ label, minutes, seconds, onMinutes, onSeconds }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={minutes}
          onChange={e => onMinutes(e.target.value)}
          placeholder="mm"
          className="flex-1 bg-gray-700 text-white rounded-xl px-3 py-3 text-center text-base font-semibold"
          min={0}
        />
        <span className="text-gray-400 font-bold text-lg">:</span>
        <input
          type="number"
          inputMode="numeric"
          value={seconds}
          onChange={e => onSeconds(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)).toString())}
          placeholder="ss"
          className="flex-1 bg-gray-700 text-white rounded-xl px-3 py-3 text-center text-base font-semibold"
          min={0}
          max={59}
        />
      </div>
    </div>
  )
}

function Card({ children, className = '' }) {
  return <div className={`bg-gray-800 rounded-2xl p-4 space-y-3 ${className}`}>{children}</div>
}

function NoteField({ value, onChange }) {
  return (
    <div>
      <Label>Notes</Label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Any notes…"
        rows={2}
        className="w-full bg-gray-700 text-gray-200 rounded-xl px-4 py-3 text-sm placeholder-gray-600 resize-none"
      />
    </div>
  )
}

// ── Run Logger ─────────────────────────────────────────────────────────────────

function RunForm({ data, onChange }) {
  const { distanceKm = '', minutes = '', seconds = '', notes = '' } = data

  const totalSec = timeToSeconds(minutes, seconds)
  const pace = calcPace(parseFloat(distanceKm), totalSec)

  return (
    <Card>
      <Field label="Distance (km)">
        <Input value={distanceKm} onChange={v => onChange({ ...data, distanceKm: v })} placeholder="e.g. 10.5" />
      </Field>
      <TimeInput
        label="Time"
        minutes={minutes}
        seconds={seconds}
        onMinutes={v => onChange({ ...data, minutes: v })}
        onSeconds={v => onChange({ ...data, seconds: v })}
      />
      {pace && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-400">Pace</span>
          <span className="text-xl font-bold text-blue-400">{pace} min/km</span>
        </div>
      )}
      <NoteField value={notes} onChange={v => onChange({ ...data, notes: v })} />
    </Card>
  )
}

// ── Interval Logger ────────────────────────────────────────────────────────────

function IntervalForm({ data, onChange }) {
  const { reps = '', repDistanceM = '', repMinutes = '', repSeconds = '', notes = '' } = data

  const repSec = timeToSeconds(repMinutes, repSeconds)
  const splitStr = (repSec && repDistanceM)
    ? secondsToMmSs(repSec / (parseInt(repDistanceM) / 1000)) + ' /km'
    : null

  return (
    <Card>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Number of Reps">
          <Input value={reps} onChange={v => onChange({ ...data, reps: v })} placeholder="e.g. 8" inputMode="numeric" />
        </Field>
        <Field label="Distance / Rep (m)">
          <Input value={repDistanceM} onChange={v => onChange({ ...data, repDistanceM: v })} placeholder="e.g. 1000" inputMode="numeric" />
        </Field>
      </div>
      <TimeInput
        label="Time per Rep"
        minutes={repMinutes}
        seconds={repSeconds}
        onMinutes={v => onChange({ ...data, repMinutes: v })}
        onSeconds={v => onChange({ ...data, repSeconds: v })}
      />
      {splitStr && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-400">Average Split</span>
          <span className="text-xl font-bold text-orange-400">{splitStr}</span>
        </div>
      )}
      <NoteField value={notes} onChange={v => onChange({ ...data, notes: v })} />
    </Card>
  )
}

// ── Station Logger ─────────────────────────────────────────────────────────────

function StationItem({ station, stationData, onChange }) {
  // Merge with defaults so inputs are always controlled (never undefined)
  const d = { selected: false, sets: '', value: '', weight: '', notes: '', ...stationData }
  const [expanded, setExpanded] = useState(d.selected)

  const toggleSelected = (sel) => {
    setExpanded(sel)
    onChange({ ...d, selected: sel })
  }

  return (
    <div className={`rounded-2xl overflow-hidden border transition-colors ${d.selected ? 'bg-gray-800 border-blue-500/40' : 'bg-gray-800/50 border-gray-700'}`}>
      <button
        type="button"
        onClick={() => toggleSelected(!d.selected)}
        className="w-full flex items-center gap-3 p-4"
      >
        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
          d.selected ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
        }`}>
          {d.selected && (
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span className="font-semibold text-base">{station.name}</span>
      </button>

      {d.selected && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Sets">
              <Input value={d.sets} onChange={v => onChange({ ...d, sets: v })} placeholder="3" inputMode="numeric" />
            </Field>
            <Field label={station.unit === 'reps' ? 'Reps' : 'Distance (m)'}>
              <Input value={d.value} onChange={v => onChange({ ...d, value: v })} placeholder={station.unit === 'reps' ? '20' : '50'} />
            </Field>
            <Field label="Weight (kg)">
              <Input value={d.weight} onChange={v => onChange({ ...d, weight: v })} placeholder="0" />
            </Field>
          </div>
          <NoteField value={d.notes} onChange={v => onChange({ ...d, notes: v })} />
        </div>
      )}
    </div>
  )
}

function StationForm({ data, onChange }) {
  const stations = data.stations || HYROX_STATIONS.map(s => ({ id: s.id, selected: false }))

  const updateStation = (id, stationData) => {
    const updated = stations.map(s => s.id === id ? { ...stationData, id } : s)
    onChange({ ...data, stations: updated })
  }

  const getStation = (id) => stations.find(s => s.id === id)

  return (
    <div className="space-y-2">
      {HYROX_STATIONS.map(station => (
        <StationItem
          key={station.id}
          station={station}
          stationData={getStation(station.id)}
          onChange={d => updateStation(station.id, d)}
        />
      ))}
      <Card>
        <NoteField value={data.notes || ''} onChange={v => onChange({ ...data, notes: v })} />
      </Card>
    </div>
  )
}

// ── Combo Logger ───────────────────────────────────────────────────────────────

function ComboForm({ data, onChange }) {
  const { rounds = '', totalRunDistanceKm = '', totalMinutes = '', totalSeconds = '', notes = '' } = data
  const stations = data.stations || HYROX_STATIONS.map(s => ({ id: s.id, selected: false }))

  const updateStation = (id, stationData) => {
    const updated = stations.map(s => s.id === id ? { ...stationData, id } : s)
    onChange({ ...data, stations: updated })
  }

  const getStation = (id) => stations.find(s => s.id === id)

  return (
    <div className="space-y-3">
      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rounds Completed">
            <Input value={rounds} onChange={v => onChange({ ...data, rounds: v })} placeholder="e.g. 3" inputMode="numeric" />
          </Field>
          <Field label="Total Run (km)">
            <Input value={totalRunDistanceKm} onChange={v => onChange({ ...data, totalRunDistanceKm: v })} placeholder="e.g. 8" />
          </Field>
        </div>
        <TimeInput
          label="Total Time"
          minutes={totalMinutes}
          seconds={totalSeconds}
          onMinutes={v => onChange({ ...data, totalMinutes: v })}
          onSeconds={v => onChange({ ...data, totalSeconds: v })}
        />
      </Card>

      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide px-1">Stations Included</p>
      {HYROX_STATIONS.map(station => (
        <StationItem
          key={station.id}
          station={station}
          stationData={getStation(station.id)}
          onChange={d => updateStation(station.id, d)}
        />
      ))}

      <Card>
        <NoteField value={notes} onChange={v => onChange({ ...data, notes: v })} />
      </Card>
    </div>
  )
}

// ── Sled + Strength Logger ─────────────────────────────────────────────────────

function SledException({ data, onChange }) {
  const sled = data.sled || { pushSets: '', pushDistance: '', pushWeight: '', pullSets: '', pullDistance: '', pullWeight: '' }
  const exercises = data.exercises || []

  const updateSled = (updates) => onChange({ ...data, sled: { ...sled, ...updates } })

  const addExercise = () => {
    onChange({
      ...data,
      exercises: [...exercises, { name: '', sets: [{ type: 'working', reps: '', weight: '' }] }]
    })
  }

  const updateExercise = (i, ex) => {
    const updated = exercises.map((e, idx) => idx === i ? ex : e)
    onChange({ ...data, exercises: updated })
  }

  const addSet = (i) => {
    const ex = exercises[i]
    const newSets = [...ex.sets, { type: 'working', reps: '', weight: '' }]
    updateExercise(i, { ...ex, sets: newSets })
  }

  const updateSet = (exI, setI, set) => {
    const ex = exercises[exI]
    const sets = ex.sets.map((s, i) => i === setI ? set : s)
    updateExercise(exI, { ...ex, sets })
  }

  return (
    <div className="space-y-3">
      {/* Sled push */}
      <Card>
        <p className="text-sm font-bold text-gray-300">🛷 Sled Push</p>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Sets">
            <Input value={sled.pushSets} onChange={v => updateSled({ pushSets: v })} placeholder="4" inputMode="numeric" />
          </Field>
          <Field label="Distance (m)">
            <Input value={sled.pushDistance} onChange={v => updateSled({ pushDistance: v })} placeholder="25" />
          </Field>
          <Field label="Weight (kg)">
            <Input value={sled.pushWeight} onChange={v => updateSled({ pushWeight: v })} placeholder="50" />
          </Field>
        </div>
      </Card>

      {/* Sled pull */}
      <Card>
        <p className="text-sm font-bold text-gray-300">🧲 Sled Pull</p>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Sets">
            <Input value={sled.pullSets} onChange={v => updateSled({ pullSets: v })} placeholder="4" inputMode="numeric" />
          </Field>
          <Field label="Distance (m)">
            <Input value={sled.pullDistance} onChange={v => updateSled({ pullDistance: v })} placeholder="25" />
          </Field>
          <Field label="Weight (kg)">
            <Input value={sled.pullWeight} onChange={v => updateSled({ pullWeight: v })} placeholder="50" />
          </Field>
        </div>
      </Card>

      {/* Strength exercises */}
      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide px-1">Strength Exercises</p>
      {exercises.map((ex, i) => (
        <Card key={i}>
          <TextInput
            value={ex.name}
            onChange={v => updateExercise(i, { ...ex, name: v })}
            placeholder="Exercise name…"
          />
          {/* Column headers */}
          <div className="flex gap-2 text-xs text-gray-500 px-1">
            <div className="w-14 text-center">Type</div>
            <div className="flex-1 text-center">Reps</div>
            <div className="flex-1 text-center">kg</div>
          </div>
          {ex.sets.map((set, si) => (
            <div key={si} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const types = ['working', 'warmup']
                  const next = types[(types.indexOf(set.type) + 1) % types.length]
                  updateSet(i, si, { ...set, type: next })
                }}
                className={`w-14 h-10 rounded-lg text-xs font-bold shrink-0 ${
                  set.type === 'warmup' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'
                }`}
              >
                {set.type === 'warmup' ? 'Warm' : 'Work'}
              </button>
              <input
                type="number"
                inputMode="numeric"
                value={set.reps}
                onChange={e => updateSet(i, si, { ...set, reps: e.target.value })}
                placeholder="Reps"
                className="flex-1 bg-gray-700 text-white rounded-lg px-2 py-2 text-center text-base font-semibold h-10"
                min={0}
              />
              <input
                type="number"
                inputMode="decimal"
                value={set.weight}
                onChange={e => updateSet(i, si, { ...set, weight: e.target.value })}
                placeholder="kg"
                className="flex-1 bg-gray-700 text-white rounded-lg px-2 py-2 text-center text-base font-semibold h-10"
                min={0}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => addSet(i)}
            className="w-full py-2 rounded-xl bg-gray-700 text-gray-300 text-sm font-semibold"
          >
            + Add Set
          </button>
        </Card>
      ))}

      <button
        onClick={addExercise}
        className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-700 text-gray-500 font-semibold flex items-center justify-center gap-2"
      >
        <span className="text-xl">+</span> Add Strength Exercise
      </button>

      <Card>
        <NoteField value={data.notes || ''} onChange={v => onChange({ ...data, notes: v })} />
      </Card>
    </div>
  )
}

// ── Main HyroxLogger ──────────────────────────────────────────────────────────

export default function HyroxLogger() {
  const { type } = useParams()
  const navigate = useNavigate()
  const { addSession } = useStore()

  const info = SESSION_TYPE_INFO[type] || { name: type, emoji: '🏃', color: '#3B82F6' }
  const [formData, setFormData] = useState({})
  const [showConfirm, setShowConfirm] = useState(false)
  const startTime = useRef(Date.now())

  const isRun = ['long_run', 'steady_run', 'tempo_run', '5k_time_trial'].includes(type)
  const isInterval = type === 'intervals'
  const isStation = ['station_skills', 'station_endurance'].includes(type)
  const isCombo = type === 'combo'
  const isSledStrength = type === 'sled_strength'

  const hasData = () => {
    if (isRun) return formData.distanceKm || formData.minutes
    if (isInterval) return formData.reps || formData.repDistanceM
    if (isStation) return formData.stations?.some(s => s.selected)
    if (isCombo) return formData.rounds || formData.stations?.some(s => s.selected)
    if (isSledStrength) return formData.sled?.pushSets || formData.exercises?.length > 0
    return false
  }

  const buildSessionData = () => {
    if (isRun) {
      const totalSec = timeToSeconds(formData.minutes, formData.seconds)
      const dist = parseFloat(formData.distanceKm) || 0
      return {
        distance: dist,
        time: secondsToMmSs(totalSec),
        pace: calcPace(dist, totalSec),
        notes: formData.notes,
      }
    }
    if (isInterval) {
      const repSec = timeToSeconds(formData.repMinutes, formData.repSeconds)
      const repDist = parseInt(formData.repDistanceM) || 0
      const avgSplit = repDist ? secondsToMmSs(repSec / (repDist / 1000)) : null
      return {
        reps: parseInt(formData.reps) || 0,
        repDistanceM: repDist,
        repTime: secondsToMmSs(repSec),
        avgSplit,
        notes: formData.notes,
      }
    }
    if (isStation) {
      return {
        stations: formData.stations?.filter(s => s.selected) || [],
        notes: formData.notes,
      }
    }
    if (isCombo) {
      const totalSec = timeToSeconds(formData.totalMinutes, formData.totalSeconds)
      return {
        rounds: parseInt(formData.rounds) || 0,
        totalRunDistance: parseFloat(formData.totalRunDistanceKm) || 0,
        totalTime: secondsToMmSs(totalSec),
        stations: formData.stations?.filter(s => s.selected) || [],
        notes: formData.notes,
      }
    }
    if (isSledStrength) {
      return {
        sled: formData.sled || {},
        exercises: (formData.exercises || []).filter(e => e.name),
        notes: formData.notes,
      }
    }
    return {}
  }

  const saveSession = () => {
    const duration = Math.round((Date.now() - startTime.current) / 60000)
    addSession({
      date: new Date().toISOString(),
      mode: 'hyrox',
      type,
      duration,
      data: buildSessionData(),
    })
    navigate('/dashboard')
  }

  return (
    <div className="pb-32 min-h-screen">
      {/* Header */}
      <div className="sticky top-0 bg-gray-900 z-30 px-4 pt-10 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-800"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold">
              <span style={{ color: info.color }}>{info.emoji}</span> {info.name}
            </h1>
            <p className="text-xs text-gray-500">HYROX Training</p>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-3">
        {isRun && <RunForm data={formData} onChange={setFormData} />}
        {isInterval && <IntervalForm data={formData} onChange={setFormData} />}
        {isStation && <StationForm data={formData} onChange={setFormData} />}
        {isCombo && <ComboForm data={formData} onChange={setFormData} />}
        {isSledStrength && <SledException data={formData} onChange={setFormData} />}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-gray-900/95 backdrop-blur border-t border-gray-800 px-4 py-4 safe-bottom z-40">
        <button
          onClick={() => hasData() ? setShowConfirm(true) : null}
          className={`w-full py-4 rounded-2xl font-bold text-lg transition-colors ${
            hasData()
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Save Session
        </button>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-6">
          <div className="bg-gray-800 rounded-3xl p-6 w-full max-w-sm">
            <h3 className="text-xl font-bold mb-2">Save Session?</h3>
            <p className="text-gray-400 text-sm mb-6">
              Log this {info.name} session to your history.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-gray-700 text-gray-300 py-3.5 rounded-2xl font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={saveSession}
                className="flex-1 bg-blue-500 text-white py-3.5 rounded-2xl font-bold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
