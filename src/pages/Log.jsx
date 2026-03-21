import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import { getNextBbWorkout, getTodaysHyroxSession } from '../utils/helpers'
import { BB_WORKOUT_NAMES, BB_WORKOUT_EMOJI, BB_WORKOUT_SEQUENCE } from '../data/exercises'
import { ALL_SESSION_TYPES, SESSION_TYPE_INFO } from '../data/hyrox'

function SectionHeader({ children }) {
  return <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">{children}</p>
}

// ── Split reorder modal ────────────────────────────────────────────────────────

function SplitModal({ sequence, onSave, onClose, theme }) {
  const [order, setOrder] = useState([...sequence])

  const move = (idx, direction) => {
    const next = [...order]
    const target = idx + (direction === 'up' ? -1 : 1)
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setOrder(next)
  }

  const reset = () => setOrder([...BB_WORKOUT_SEQUENCE])

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={onClose}>
      <div className="bg-gray-800 w-full max-w-lg mx-auto rounded-t-3xl p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Split Order</h3>
          <button onClick={reset} className="text-xs text-gray-400 underline">Reset to default</button>
        </div>
        <p className="text-xs text-gray-500 mb-3">Drag or use arrows to set the rotation order.</p>
        <div className="space-y-2 mb-4">
          {order.map((type, idx) => (
            <div key={type} className="flex items-center gap-3 bg-gray-700 rounded-xl px-4 py-3">
              <span className="text-lg">{BB_WORKOUT_EMOJI[type]}</span>
              <span className="flex-1 font-medium text-sm">{BB_WORKOUT_NAMES[type]}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => move(idx, 'up')}
                  disabled={idx === 0}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 ${
                    idx === 0 ? 'opacity-20' : 'bg-gray-600'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => move(idx, 'down')}
                  disabled={idx === order.length - 1}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 ${
                    idx === order.length - 1 ? 'opacity-20' : 'bg-gray-600'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-gray-700 text-gray-300 py-3 rounded-xl font-semibold">
            Cancel
          </button>
          <button
            onClick={() => { onSave(order); onClose() }}
            className={`flex-1 ${theme.bg} text-white py-3 rounded-xl font-semibold`}
          >
            Save Order
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Log screen ────────────────────────────────────────────────────────────

export default function Log() {
  const navigate = useNavigate()
  const { sessions, settings, updateSettings, customTemplates, workoutSequence, updateWorkoutSequence } = useStore()
  const theme = getTheme(settings.accentColor)
  const [mode, setMode]           = useState(settings.activeMode || 'bb')
  const [showSplit, setShowSplit] = useState(false)

  const switchMode = (m) => {
    setMode(m)
    updateSettings({ activeMode: m })
  }

  const effectiveSequence = (workoutSequence && workoutSequence.length)
    ? workoutSequence
    : BB_WORKOUT_SEQUENCE

  const nextBb     = getNextBbWorkout(sessions, effectiveSequence)
  const todayHyrox = getTodaysHyroxSession()

  return (
    <div className="pb-nav min-h-screen">
      <div className="sticky top-0 bg-gray-900 z-30 px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold mb-4">Log Session</h1>
        <div className="flex bg-gray-800 rounded-xl p-1">
          <button
            onClick={() => switchMode('bb')}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
              mode === 'bb' ? `${theme.bg} text-white` : 'text-gray-400'
            }`}
          >
            🏋️ Bodybuilding
          </button>
          <button
            onClick={() => switchMode('hyrox')}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
              mode === 'hyrox' ? `${theme.bg} text-white` : 'text-gray-400'
            }`}
          >
            🏃 HYROX
          </button>
        </div>
      </div>

      <div className="px-4 space-y-5">
        {mode === 'bb' ? (
          <>
            {/* Quick start */}
            <div>
              <SectionHeader>Quick Start</SectionHeader>
              <button
                onClick={() => navigate(`/log/bb/${nextBb}`)}
                className={`w-full ${theme.bg} ${theme.bgHover} text-white rounded-2xl p-5 flex items-center justify-between transition-colors`}
              >
                <div className="text-left">
                  <p className="text-xs font-semibold opacity-80 mb-0.5">NEXT WORKOUT</p>
                  <p className="text-2xl font-bold">{BB_WORKOUT_EMOJI[nextBb]} {BB_WORKOUT_NAMES[nextBb]}</p>
                </div>
                <svg className="w-7 h-7 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Built-in workouts + split reorder */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <SectionHeader>All Workouts</SectionHeader>
                <button
                  onClick={() => setShowSplit(true)}
                  className="text-xs text-gray-500 underline"
                >
                  Edit split order
                </button>
              </div>
              <div className="space-y-2">
                {effectiveSequence.map(type => (
                  <button
                    key={type}
                    onClick={() => navigate(`/log/bb/${type}`)}
                    className={`w-full flex items-center justify-between bg-gray-800 rounded-xl p-4 transition-colors ${
                      type === nextBb ? `ring-1 ${theme.ring}` : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{BB_WORKOUT_EMOJI[type]}</span>
                      <div className="text-left">
                        <p className="font-semibold">{BB_WORKOUT_NAMES[type]}</p>
                        {type === nextBb && (
                          <p className={`text-xs ${theme.text}`}>Suggested next</p>
                        )}
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
                {/* Custom workout */}
                <button
                  onClick={() => navigate('/log/bb/custom')}
                  className="w-full flex items-center justify-between bg-gray-800 rounded-xl p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">✏️</span>
                    <p className="font-semibold">{BB_WORKOUT_NAMES.custom}</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Custom templates */}
            {customTemplates.length > 0 && (
              <div>
                <SectionHeader>My Templates</SectionHeader>
                <div className="space-y-2">
                  {customTemplates.map(tpl => (
                    <div key={tpl.id} className="flex gap-2">
                      <button
                        onClick={() => navigate(`/log/bb/tpl_${tpl.id}`)}
                        className="flex-1 flex items-center justify-between bg-gray-800 rounded-xl p-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{tpl.emoji}</span>
                          <p className="font-semibold">{tpl.name}</p>
                        </div>
                        <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => navigate(`/templates/${tpl.id}`)}
                        className="w-12 flex items-center justify-center bg-gray-800 rounded-xl text-gray-500"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Create template button */}
            <button
              onClick={() => navigate('/templates/new')}
              className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-700 text-gray-500 font-semibold flex items-center justify-center gap-2"
            >
              <span className="text-xl">+</span> Create Template
            </button>
          </>
        ) : (
          <>
            {/* Today's HYROX session */}
            {todayHyrox && todayHyrox.type !== 'rest' && (
              <div>
                <SectionHeader>Today — {todayHyrox.day}</SectionHeader>
                <button
                  onClick={() => navigate(`/log/hyrox/${todayHyrox.type}`)}
                  className={`w-full ${theme.bg} ${theme.bgHover} text-white rounded-2xl p-5 flex items-center justify-between transition-colors`}
                >
                  <div className="text-left">
                    <p className="text-xs font-semibold opacity-80 mb-0.5">SCHEDULED</p>
                    <p className="text-2xl font-bold">
                      {SESSION_TYPE_INFO[todayHyrox.type]?.emoji} {SESSION_TYPE_INFO[todayHyrox.type]?.name || todayHyrox.name}
                    </p>
                  </div>
                  <svg className="w-7 h-7 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}

            {todayHyrox?.type === 'rest' && (
              <div className="bg-gray-800 rounded-2xl p-5 text-center">
                <p className="text-3xl mb-2">😴</p>
                <p className="font-semibold text-gray-300">Rest Day</p>
                <p className="text-sm text-gray-500 mt-1">But you can still log a session below</p>
              </div>
            )}

            {/* All HYROX session types */}
            <div>
              <SectionHeader>All Session Types</SectionHeader>
              <div className="space-y-2">
                {ALL_SESSION_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => navigate(`/log/hyrox/${type.id}`)}
                    className="w-full flex items-center justify-between bg-gray-800 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                        style={{ backgroundColor: `${type.color}22`, border: `1px solid ${type.color}44` }}
                      >
                        {type.emoji}
                      </span>
                      <p className="font-semibold">{type.name}</p>
                    </div>
                    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Split order modal */}
      {showSplit && (
        <SplitModal
          sequence={effectiveSequence}
          onSave={updateWorkoutSequence}
          onClose={() => setShowSplit(false)}
          theme={theme}
        />
      )}
    </div>
  )
}
