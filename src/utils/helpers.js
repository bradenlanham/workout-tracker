import { HYROX_PHASES, WEEKLY_SCHEDULE } from '../data/hyrox'
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

export function getHyroxWeek(startDate) {
  if (!startDate) return null
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24))
  const week = Math.floor(diffDays / 7) + 1
  return Math.max(1, Math.min(16, week))
}

export function getHyroxPhase(week) {
  if (!week) return null
  return HYROX_PHASES.find(p => week >= p.startWeek && week <= p.endWeek) || null
}

export function getWeekKmTarget(week) {
  const phase = getHyroxPhase(week)
  return phase ? phase.kmTarget : 0
}

export function getTodaysHyroxSession() {
  const dow = new Date().getDay()
  return WEEKLY_SCHEDULE[dow] || null
}

export function getWeekDateRange() {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}

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

export function isThisWeek(isoString) {
  const { start, end } = getWeekDateRange()
  const d = new Date(isoString)
  return d >= start && d <= end
}

// ── BB helpers ───────────────────────────────────────────────────────────────

export function getNextBbWorkout(sessions, customSequence) {
  const sequence = (customSequence && customSequence.length) ? customSequence : BB_WORKOUT_SEQUENCE
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

// ── HYROX helpers ─────────────────────────────────────────────────────────────

export function getWeeklyKm(sessions) {
  let total = 0

  sessions
    .filter(s => s.mode === 'hyrox' && isThisWeek(s.date))
    .forEach(s => {
      const d = s.data
      if (!d) return
      if (d.distance) total += parseFloat(d.distance) || 0
      if (d.totalRunDistance) total += parseFloat(d.totalRunDistance) || 0
    })

  return Math.round(total * 10) / 10
}

export function getWeeklyHyroxSessions(sessions) {
  return sessions.filter(s => s.mode === 'hyrox' && isThisWeek(s.date))
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

// ── Progressive overload ────────────────────────────────────────────────────
// Hypertrophy target: 8–12 rep range. Suggest weight increase when top of range hit.

export function getProgressiveOverloadSuggestion(lastSessionEx) {
  if (!lastSessionEx) return { weight: '', hint: null }

  const lastWorkingSets = (lastSessionEx.sets || [])
    .filter(s => s.type !== 'warmup' && ((s.reps || 0) > 0 || (s.weight || 0) > 0))

  if (!lastWorkingSets.length) return { weight: '', hint: null }

  // Use heaviest working set as reference
  const bestSet = lastWorkingSets.reduce((best, s) =>
    (parseFloat(s.weight) || 0) >= (parseFloat(best.weight) || 0) ? s : best
  , lastWorkingSets[0])

  const lastWeight = parseFloat(bestSet.weight) || 0
  const lastReps   = parseInt(bestSet.reps)   || 0

  if (!lastWeight) return { weight: '', hint: null }

  let suggestedWeight = lastWeight
  let hint = null

  if (lastReps >= 12) {
    suggestedWeight = lastWeight + 5
    hint = `↑ +5 lbs — you hit ${lastReps} reps last time`
  } else if (lastReps >= 10) {
    suggestedWeight = lastWeight + 2.5
    hint = `↑ +2.5 lbs — you hit ${lastReps} reps last time`
  } else if (lastReps > 0) {
    hint = `Same weight — aim for ${lastReps + 1}+ reps (8–12 range)`
  }

  return { weight: String(suggestedWeight), hint }
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
