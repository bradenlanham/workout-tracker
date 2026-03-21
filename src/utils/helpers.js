import { BB_WORKOUT_SEQUENCE } from '../data/exercises'

// ── Time helpers ─────────────────────────────────────────────────────────────

export function timeToSeconds(mm, ss) {
  return (parseInt(mm) || 0) * 60 + (parseInt(ss) || 0)
}

export function secondsToMmSs(totalSeconds) {
  const s = Math.round(totalSeconds)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export function calcPace(distanceKm, totalSeconds) {
  if (!distanceKm || !totalSeconds) return null
  const secPerKm = totalSeconds / distanceKm
  return secondsToMmSs(secPerKm)
}

// ── Date helpers ─────────────────────────────────────────────────────────────

export function formatDate(isoString) {
  const d = new Date(isoString)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatTime(isoString) {
  const d = new Date(isoString)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function isToday(isoString) {
  const d = new Date(isoString)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

// ── BB helpers ───────────────────────────────────────────────────────────────

export function getNextBbWorkout(sessions, customSequence) {
  const full = (customSequence && customSequence.length) ? customSequence : BB_WORKOUT_SEQUENCE
  const sequence = full.filter(t => t !== 'rest') // skip rest days — they're rotation markers only
  const bbSessions = sessions.filter(s => s.mode === 'bb' && s.type !== 'custom' && !s.type?.startsWith('tpl_'))
  if (!bbSessions.length) return sequence[0]
  const sorted = [...bbSessions].sort((a, b) => new Date(b.date) - new Date(a.date))
  const lastType = sorted[0].type
  const idx = sequence.indexOf(lastType)
  if (idx === -1) return sequence[0]
  return sequence[(idx + 1) % sequence.length]
}

export function getLastBbSession(sessions, workoutType) {
  const matching = sessions
    .filter(s => s.mode === 'bb' && s.type === workoutType)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  return matching[0] || null
}

export function getExercisePRs(sessions, exerciseName) {
  let maxWeight = 0
  let maxReps = 0

  sessions
    .filter(s => s.mode === 'bb')
    .forEach(s => {
      const ex = s.data?.exercises?.find(e => e.name === exerciseName)
      if (!ex) return
      ex.sets.forEach(set => {
        if ((set.weight || 0) > maxWeight) maxWeight = set.weight
        if ((set.reps || 0) > maxReps) maxReps = set.reps
      })
    })

  return { maxWeight, maxReps }
}

export function isPR(sessions, exerciseName, weight, reps) {
  const { maxWeight, maxReps } = getExercisePRs(sessions, exerciseName)
  return (weight > maxWeight) || (reps > maxReps && weight >= maxWeight)
}

export function calcSessionVolume(exercises) {
  return exercises.reduce((total, ex) => {
    return total + ex.sets.reduce((s, set) => {
      return s + (set.reps || 0) * (set.weight || 0)
    }, 0)
  }, 0)
}

// ── Sound ──────────────────────────────────────────────────────────────────

export function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.6, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.8)
  } catch (e) {
    // AudioContext not available
  }
}

// ── Streaks ─────────────────────────────────────────────────────────────────
// Counts consecutive calendar days that had at least one logged session.

export function getWorkoutStreak(sessions) {
  if (!sessions.length) return 0

  const uniqueDays = [
    ...new Set(sessions.map(s => new Date(s.date).toDateString()))
  ].sort((a, b) => new Date(b) - new Date(a))

  if (!uniqueDays.length) return 0

  // Streak is live only if the most recent session is today or yesterday
  const today     = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  if (uniqueDays[0] !== today && uniqueDays[0] !== yesterday) return 0

  let streak = 1
  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(uniqueDays[i - 1])
    const curr = new Date(uniqueDays[i])
    if (Math.round((prev - curr) / 86400000) === 1) streak++
    else break
  }
  return streak
}

// ── Achievements ─────────────────────────────────────────────────────────────

export function getAchievements(sessions) {
  const bbSessions = sessions.filter(s => s.mode === 'bb')
  const total      = bbSessions.length
  const streak     = getWorkoutStreak(sessions)
  const totalPRs   = bbSessions.flatMap(s =>
    (s.data?.exercises || []).flatMap(ex => ex.sets.filter(set => set.isNewPR))
  ).length
  const gradeAs = bbSessions.filter(s => s.grade === 'A+' || s.grade === 'A').length

  const badges = []
  if (total   >= 1)  badges.push({ id: 'first', icon: '🏋️', label: 'First Session',   sub: 'Journey begins'          })
  if (total   >= 10) badges.push({ id: 's10',   icon: '💪', label: '10 Sessions',     sub: 'Getting consistent'      })
  if (total   >= 25) badges.push({ id: 's25',   icon: '🔥', label: '25 Sessions',     sub: 'On a roll'               })
  if (total   >= 50) badges.push({ id: 's50',   icon: '⚡', label: '50 Sessions',     sub: 'Dedicated athlete'       })
  if (total   >= 100)badges.push({ id: 's100',  icon: '🏆', label: '100 Sessions',    sub: 'Elite status'            })
  if (totalPRs >= 1) badges.push({ id: 'pr1',   icon: '🥇', label: 'First PR',        sub: 'New personal record!'    })
  if (totalPRs >= 10)badges.push({ id: 'pr10',  icon: '🥈', label: '10 PRs',          sub: 'Getting stronger'        })
  if (totalPRs >= 25)badges.push({ id: 'pr25',  icon: '🥉', label: '25 PRs',          sub: 'Beast mode'              })
  if (streak   >= 3) badges.push({ id: 'str3',  icon: '🔥', label: '3-Day Streak',    sub: `${streak} days in a row` })
  if (streak   >= 7) badges.push({ id: 'str7',  icon: '🌟', label: 'Week Streak',     sub: '7 days straight!'        })
  if (gradeAs  >= 5) badges.push({ id: 'grade', icon: '⭐', label: 'Excellence',      sub: '5 A-grade sessions'      })
  return badges
}

// ── Misc ───────────────────────────────────────────────────────────────────

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
