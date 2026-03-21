import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import {
  getHyroxWeek, getHyroxPhase, getWeekKmTarget,
  getTodaysHyroxSession, getWeeklyKm,
  getNextBbWorkout, formatDate, getWorkoutStreak,
} from '../utils/helpers'
import { BB_WORKOUT_NAMES, BB_WORKOUT_EMOJI } from '../data/exercises'
import { SESSION_TYPE_INFO } from '../data/hyrox'

// ── Start Date Modal ───────────────────────────────────────────────────────────

function StartDateModal({ onSave, onCancel, theme }) {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  return (
    <div className="fixed inset-0 bg-black/70 flex items-end z-50" onClick={onCancel}>
      <div className="bg-gray-800 w-full max-w-lg mx-auto rounded-t-3xl p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-2">HYROX Start Date</h2>
        <p className="text-gray-400 text-sm mb-4">When did Week 1 of your 16-week plan begin?</p>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 text-base mb-4 border border-gray-600"
        />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 bg-gray-700 text-gray-300 py-3 rounded-xl font-semibold">
            Cancel
          </button>
          <button onClick={() => onSave(date)} className={`flex-1 ${theme.bg} text-white py-3 rounded-xl font-semibold`}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Train Screen ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const { sessions, settings, updateSettings } = useStore()
  const theme    = getTheme(settings.accentColor)
  const mode     = settings.activeMode || 'bb'
  const [showStartDate, setShowStartDate] = useState(false)

  // Stats
  const streak       = getWorkoutStreak(sessions)
  const totalSessions = sessions.length

  // Greeting
  const hour = new Date().getHours()
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // BB
  const nextBb = getNextBbWorkout(sessions)

  // HYROX
  const todayHyrox  = getTodaysHyroxSession()
  const hyroxWeek   = getHyroxWeek(settings.hyroxStartDate)
  const hyroxPhase  = hyroxWeek ? getHyroxPhase(hyroxWeek) : null
  const weeklyKm    = getWeeklyKm(sessions)
  const kmTarget    = hyroxWeek ? getWeekKmTarget(hyroxWeek) : 0
  const kmPct       = kmTarget > 0 ? Math.min(100, Math.round((weeklyKm / kmTarget) * 100)) : 0

  // Recent sessions (last 3, any mode)
  const recentSessions = [...sessions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3)

  return (
    <div className="min-h-screen pb-12">

      {/* ── Greeting ──────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-16 pb-5">
        <p className="text-gray-500 text-sm font-medium">{timeGreeting} 👋</p>
        <h1 className="text-3xl font-bold mt-0.5">Ready to train?</h1>
      </div>

      {/* ── Stat badges ───────────────────────────────────────────────────────── */}
      <div className="px-4 flex gap-3 mb-5">
        <div className="flex-1 bg-gray-800 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl">🔥</span>
          <div>
            <p className="text-xl font-bold leading-none">{streak}</p>
            <p className="text-xs text-gray-500 mt-0.5">Day streak</p>
          </div>
        </div>
        <div className="flex-1 bg-gray-800 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl">💪</span>
          <div>
            <p className={`text-xl font-bold leading-none ${theme.text}`}>{totalSessions}</p>
            <p className="text-xs text-gray-500 mt-0.5">Sessions total</p>
          </div>
        </div>
      </div>

      {/* ── Main CTA ──────────────────────────────────────────────────────────── */}
      <div className="px-4 mb-6">

        {/* BB mode */}
        {mode === 'bb' && (
          <div className={`${theme.bg} rounded-3xl p-6`}>
            <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-2">Next Up</p>
            <p className="text-3xl font-bold text-white leading-tight">
              {BB_WORKOUT_EMOJI[nextBb]} {BB_WORKOUT_NAMES[nextBb]}
            </p>
            <p className="text-sm text-white/60 mt-1 mb-5">
              {streak > 0 ? `${streak}-day streak 🔥` : 'Start your streak today!'}
            </p>
            <button
              onClick={() => navigate(`/log/bb/${nextBb}`)}
              className="w-full bg-black/20 hover:bg-black/30 active:bg-black/40 text-white font-bold text-lg py-4 rounded-2xl transition-colors"
            >
              Start Session →
            </button>
          </div>
        )}

        {/* HYROX — no start date yet */}
        {mode === 'hyrox' && !settings.hyroxStartDate && (
          <div className="bg-gray-800 border border-dashed border-gray-600 rounded-3xl p-6 text-center">
            <p className="text-4xl mb-3">🏁</p>
            <p className="font-bold text-lg mb-1">Set your HYROX start date</p>
            <p className="text-gray-400 text-sm mb-5">Enter when Week 1 of your 16-week plan began.</p>
            <button
              onClick={() => setShowStartDate(true)}
              className={`w-full ${theme.bg} text-white py-3.5 rounded-2xl font-semibold`}
            >
              Set Start Date
            </button>
          </div>
        )}

        {/* HYROX — active training day */}
        {mode === 'hyrox' && settings.hyroxStartDate && todayHyrox && todayHyrox.type !== 'rest' && (
          <div className="bg-gray-800 rounded-3xl p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
              Today — {todayHyrox.day}
            </p>
            <p className="text-3xl font-bold text-white leading-tight">
              {SESSION_TYPE_INFO[todayHyrox.type]?.emoji} {SESSION_TYPE_INFO[todayHyrox.type]?.name}
            </p>
            <p className="text-sm text-gray-400 mt-1 mb-5">
              Week {hyroxWeek} · {hyroxPhase?.name || 'HYROX Training'}
            </p>
            <button
              onClick={() => navigate(`/log/hyrox/${todayHyrox.type}`)}
              className={`w-full ${theme.bg} text-white font-bold text-lg py-4 rounded-2xl transition-colors`}
            >
              Start Session →
            </button>
            {kmTarget > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Weekly km</span>
                  <span className="font-semibold">{weeklyKm} / {kmTarget} km</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${kmPct}%`, backgroundColor: hyroxPhase?.color || theme.hex }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* HYROX — rest day */}
        {mode === 'hyrox' && settings.hyroxStartDate && todayHyrox?.type === 'rest' && (
          <div className="bg-gray-800 rounded-3xl p-6">
            <div className="text-center mb-5">
              <p className="text-5xl mb-2">😴</p>
              <p className="font-bold text-xl">Rest Day</p>
              <p className="text-sm text-gray-400 mt-1">
                Week {hyroxWeek} · {hyroxPhase?.name || 'HYROX Training'}
              </p>
            </div>
            <button
              onClick={() => navigate('/log')}
              className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-3.5 rounded-2xl transition-colors"
            >
              Log Anyway
            </button>
          </div>
        )}

      </div>

      {/* ── Recent sessions ───────────────────────────────────────────────────── */}
      {recentSessions.length > 0 && (
        <div className="px-4">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-3">Recent</p>
          <div className="space-y-2">
            {recentSessions.map(s => {
              const isBb = s.mode === 'bb' || !s.mode
              const sessionName = isBb
                ? `${BB_WORKOUT_EMOJI[s.type] || '🏋️'} ${BB_WORKOUT_NAMES[s.type] || s.type}`
                : `${SESSION_TYPE_INFO[s.type]?.emoji || '🏃'} ${SESSION_TYPE_INFO[s.type]?.name || s.type}`
              return (
                <div key={s.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                  <div>
                    <p className="font-semibold text-sm">{sessionName}</p>
                    <p className="text-xs text-gray-500">{formatDate(s.date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.grade && (
                      <span className="text-xs font-bold bg-gray-700 px-2 py-0.5 rounded-lg">{s.grade}</span>
                    )}
                    {s.data?.exercises?.some(e => e.sets?.some(st => st.isNewPR)) && (
                      <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">PR</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {recentSessions.length === 0 && (
        <div className="px-4 text-center py-10">
          <p className="text-5xl mb-3">🏋️</p>
          <p className="text-gray-500">No sessions yet — log your first workout!</p>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────────── */}
      {showStartDate && (
        <StartDateModal
          theme={theme}
          onSave={date => { updateSettings({ hyroxStartDate: date }); setShowStartDate(false) }}
          onCancel={() => setShowStartDate(false)}
        />
      )}

    </div>
  )
}
