import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import { getNextBbWorkout, formatDate, getWorkoutStreak } from '../utils/helpers'
import { BB_WORKOUT_NAMES, BB_WORKOUT_EMOJI, BB_WORKOUT_SEQUENCE } from '../data/exercises'

export default function Dashboard() {
  const navigate = useNavigate()
  const { sessions, settings, splits, activeSplitId } = useStore()
  const theme = getTheme(settings.accentColor)

  const streak        = getWorkoutStreak(sessions)
  const totalSessions = sessions.length

  const hour = new Date().getHours()
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // ── Active split helpers ───────────────────────────────────────────────────
  const activeSplit = splits?.find(s => s.id === activeSplitId) || splits?.[0] || null
  const rotation = activeSplit?.rotation || BB_WORKOUT_SEQUENCE

  const nextBb = getNextBbWorkout(sessions, rotation)

  const getWorkoutName = (wId) => {
    const w = activeSplit?.workouts?.find(w => w.id === wId)
    return w?.name || BB_WORKOUT_NAMES[wId] || wId
  }
  const getWorkoutEmoji = (wId) => {
    const w = activeSplit?.workouts?.find(w => w.id === wId)
    return w?.emoji || BB_WORKOUT_EMOJI[wId] || '🏋️'
  }

  const recentSessions = [...sessions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3)

  return (
    <div className="min-h-screen pb-12">

      {/* ── Greeting ──────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-16 pb-5">
        <p className="text-c-muted text-sm font-medium">{timeGreeting}{settings.userName ? `, ${settings.userName}` : ''} 👋</p>
        <h1 className="text-3xl font-bold mt-0.5">Ready to train?</h1>
      </div>

      {/* ── Stat badges ───────────────────────────────────────────────────────── */}
      <div className="px-4 flex gap-3 mb-5">
        <div className="flex-1 bg-card rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl">🔥</span>
          <div>
            <p className="text-xl font-bold leading-none">{streak}</p>
            <p className="text-xs text-c-muted mt-0.5">Day streak</p>
          </div>
        </div>
        <div className="flex-1 bg-card rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl">💪</span>
          <div>
            <p className={`text-xl font-bold leading-none ${theme.text}`}>{totalSessions}</p>
            <p className="text-xs text-c-muted mt-0.5">Sessions total</p>
          </div>
        </div>
      </div>

      {/* ── Active split label ────────────────────────────────────────────────── */}
      {activeSplit && (
        <div className="px-4 mb-3 flex items-center gap-2">
          <p className="text-xs text-c-muted">
            Training: <span className="font-semibold text-c-dim">{activeSplit.emoji} {activeSplit.name}</span>
          </p>
          {splits.length > 1 && (
            <button
              onClick={() => navigate('/splits')}
              className={`text-xs font-semibold ${theme.text} ml-1`}
            >
              Switch
            </button>
          )}
        </div>
      )}

      {/* ── Main CTA ──────────────────────────────────────────────────────────── */}
      <div className="px-4 mb-6">
        <div className={`${theme.bg} rounded-3xl p-6`}>
          <p className={`text-xs font-bold uppercase tracking-widest ${theme.textOnBgDim} mb-2`}>Next Up</p>
          <p className={`text-3xl font-bold ${theme.textOnBg} leading-tight`}>
            {getWorkoutEmoji(nextBb)} {getWorkoutName(nextBb)}
          </p>
          <p className={`text-sm ${theme.textOnBgDim} mt-1 mb-5`}>
            {streak > 0 ? `${streak}-day streak 🔥` : 'Start your streak today!'}
          </p>
          <button
            onClick={() => navigate(`/log/bb/${nextBb}`)}
            className={`w-full bg-black/20 hover:bg-black/30 active:bg-black/40 ${theme.textOnBg} font-bold text-lg py-4 rounded-2xl transition-colors`}
          >
            Start Session →
          </button>
        </div>
      </div>

      {/* ── Recent sessions ───────────────────────────────────────────────────── */}
      {recentSessions.length > 0 && (
        <div className="px-4">
          <p className="text-xs text-c-muted font-semibold uppercase tracking-widest mb-3">Recent</p>
          <div className="space-y-2">
            {recentSessions.map(s => {
              const sessionName = `${getWorkoutEmoji(s.type)} ${getWorkoutName(s.type)}`
              return (
                <div key={s.id} className="flex items-center justify-between bg-card rounded-xl px-4 py-3">
                  <div>
                    <p className="font-semibold text-sm">{sessionName}</p>
                    <p className="text-xs text-c-muted">{formatDate(s.date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.grade && (
                      <span className="text-xs font-bold bg-item px-2 py-0.5 rounded-lg">{s.grade}</span>
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
          <p className="text-c-muted">No sessions yet — log your first workout!</p>
        </div>
      )}

    </div>
  )
}
