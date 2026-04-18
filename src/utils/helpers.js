import { BB_WORKOUT_SEQUENCE } from '../data/exercises.js'

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

// Returns the next item in the FULL rotation (including 'rest') after the last session.
// Use this to detect whether today is a rest day.
export function getNextRotationItem(sessions, customSequence) {
  const full = (customSequence && customSequence.length) ? customSequence : BB_WORKOUT_SEQUENCE
  const bbSessions = sessions.filter(s => s.mode === 'bb' && s.type !== 'custom' && !s.type?.startsWith('tpl_'))
  if (!bbSessions.length) return full[0]
  const sorted = [...bbSessions].sort((a, b) => new Date(b.date) - new Date(a.date))
  const lastType = sorted[0].type
  const lastPosInFull = full.indexOf(lastType)
  if (lastPosInFull === -1) return full[0]
  return full[(lastPosInFull + 1) % full.length]
}

export function getLastBbSession(sessions, workoutType) {
  const matching = sessions
    .filter(s => s.mode === 'bb' && s.type === workoutType)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  return matching[0] || null
}

// Canonical per-side load accessor. For unilateral sets, `weight` holds the
// doubled volume value and `rawWeight` preserves the actual per-side input.
// Always read through this so phantom PRs and doubled "Last:" hints never
// surface. For non-unilateral sets, rawWeight is undefined and weight IS the
// per-side (a.k.a. actual bar) load, so the fallback is correct.
export function perSideLoad(set) {
  return set?.rawWeight ?? set?.weight ?? 0
}

// Weight-anchored PR model.
//
// A PR is defined as either:
//   1. A new max weight (any rep count beats the previous max weight), OR
//   2. Matching the current max weight with MORE reps than any prior set
//      at that same max weight.
//
// maxWeight              = heaviest weight ever lifted on this exercise
// maxRepsAtMaxWeight     = best rep count achieved at that max weight
export function getExercisePRs(sessions, exerciseName) {
  let maxWeight          = 0
  let maxRepsAtMaxWeight = 0

  sessions
    .filter(s => s.mode === 'bb')
    .forEach(s => {
      const ex = s.data?.exercises?.find(e => e.name === exerciseName)
      if (!ex) return
      ex.sets.forEach(set => {
        const w = Number(perSideLoad(set)) || 0
        const r = Number(set.reps)         || 0
        if (w <= 0 || r <= 0) return
        if (w > maxWeight) {
          maxWeight          = w
          maxRepsAtMaxWeight = r
        } else if (w === maxWeight && r > maxRepsAtMaxWeight) {
          maxRepsAtMaxWeight = r
        }
      })
    })

  return { maxWeight, maxRepsAtMaxWeight }
}

// Single source of truth for whether a (weight, reps) pair represents a new PR
// for a given exercise, relative to the provided sessions list.
// Reps alone — no matter how many — at a weight BELOW the current max are never
// a PR. Only higher weight (any reps) or same top weight with more reps.
export function isSetPR(sessions, exerciseName, weight, reps) {
  const w = parseFloat(weight) || 0
  const r = parseInt(reps)     || 0
  if (w <= 0 || r <= 0) return false
  const { maxWeight, maxRepsAtMaxWeight } = getExercisePRs(sessions, exerciseName)
  if (maxWeight === 0) return true                       // first logged set for this exercise
  if (w > maxWeight) return true                         // new weight PR
  if (w === maxWeight && r > maxRepsAtMaxWeight) return true  // new rep PR at top weight
  return false
}

// Back-compat alias — same semantics as isSetPR.
export function isPR(sessions, exerciseName, weight, reps) {
  return isSetPR(sessions, exerciseName, weight, reps)
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
    ;[0, 0.15, 0.3].forEach(delay => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      osc.type = 'square'
      gain.gain.value = 1.0
      osc.start(ctx.currentTime + delay)
      osc.stop(ctx.currentTime + delay + 0.12)
    })
  } catch (e) {
    // AudioContext not available
  }
}

// ── Streaks ─────────────────────────────────────────────────────────────────
// An "active day" is any calendar day with at least one of:
//   • a weight session
//   • a cardio session (any type)
//   • an explicitly-logged rest day
// A streak is an unbroken run of active days. Rotation rest slots do NOT
// count — if nothing was logged, the day is a gap and breaks the streak.

export function getRotationItemOnDate(dateStr, sessions, rotation) {
  if (!rotation || !rotation.length) return null
  const nonRest = rotation.filter(t => t !== 'rest')
  if (!nonRest.length) return 'rest'
  const anchors = sessions
    .filter(s => nonRest.includes(s.type))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  if (!anchors.length) return null
  const anchor    = anchors[0]
  const anchorIdx = rotation.indexOf(anchor.type)
  const daysDiff  = Math.round((new Date(dateStr) - new Date(anchor.date.split('T')[0])) / 86400000)
  return rotation[((anchorIdx + daysDiff) % rotation.length + rotation.length) % rotation.length]
}

// Use LOCAL date methods to avoid UTC-midnight vs local-midnight mismatch.
// new Date('2026-04-07') parses as UTC midnight; in UTC-5 that's local Apr 6 19:00,
// so .getDate() would return 6 instead of 7. Using 'T00:00:00' forces local midnight.
function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Build the Set of active-day strings ('YYYY-MM-DD') from all three activity sources.
function buildActiveDaySet(sessions, cardioSessions, restDaySessions) {
  return new Set([
    ...(sessions         || []).map(s => toLocalDateStr(new Date(s.date))),
    ...(cardioSessions   || []).map(c => toLocalDateStr(new Date(c.date))),
    ...(restDaySessions  || []).map(r => toLocalDateStr(new Date(r.date))),
  ])
}

// Current streak — unbroken run of active days ending at (or just before) today.
// Today is exempt from breaking the streak so the count doesn't zero out
// before the user logs today's activity.
export function getWorkoutStreak(sessions, cardioSessions = [], restDaySessions = []) {
  const activeSet = buildActiveDaySet(sessions, cardioSessions, restDaySessions)
  if (!activeSet.size) return 0

  const todayStr = toLocalDateStr(new Date())

  // Find the most recent active day
  const mostRecent = [...activeSet].sort().pop()
  const msrDate    = new Date(mostRecent + 'T00:00:00')
  const todayMid   = new Date(todayStr    + 'T00:00:00')

  // Any gap day between mostRecent and today (exclusive of today) kills the streak.
  const daysToToday = Math.round((todayMid - msrDate) / 86400000)
  for (let d = 1; d <= daysToToday; d++) {
    const checkD = new Date(msrDate)
    checkD.setDate(msrDate.getDate() + d)
    const checkStr = toLocalDateStr(checkD)
    if (checkStr === todayStr) continue      // don't penalise today
    if (!activeSet.has(checkStr)) return 0
  }

  // Count backwards from the most recent active day.
  let streak  = 0
  let cursor  = new Date(mostRecent + 'T00:00:00')
  for (let i = 0; i < 730; i++) {
    const dStr = toLocalDateStr(cursor)
    if (!activeSet.has(dStr)) break
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

// Best streak — longest consecutive-active-day run anywhere in the user's history.
// Uses the same active-day definition as getWorkoutStreak, so the two numbers
// are guaranteed to be consistent (best >= current, always).
export function getBestStreak(sessions, cardioSessions = [], restDaySessions = []) {
  const activeSet = buildActiveDaySet(sessions, cardioSessions, restDaySessions)
  if (!activeSet.size) return 0

  const sorted = [...activeSet].sort()
  let best = 1
  let cur  = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T00:00:00')
    const curr = new Date(sorted[i]     + 'T00:00:00')
    const diff = Math.round((curr - prev) / 86400000)
    if (diff === 1) {
      cur++
      if (cur > best) best = cur
    } else {
      cur = 1
    }
  }
  return best
}

// ── Achievements ─────────────────────────────────────────────────────────────

export function getAchievements(sessions, cardioSessions = [], restDaySessions = []) {
  const bbSessions = sessions.filter(s => s.mode === 'bb')
  const total      = bbSessions.length
  const streak     = getWorkoutStreak(sessions, cardioSessions, restDaySessions)
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

// ── V1 → V2 persist migration ───────────────────────────────────────────────
// Backfills rawWeight on every historical set and recomputes isNewPR
// chronologically per exercise name using the weight-anchored rule against
// per-side load. Deployed by the Zustand persist `migrate` hook when the
// stored version is < 2. Safe to run multiple times — idempotent because the
// fallback `set.rawWeight ?? set.weight` returns the same value second time.

export function migrateSessionsToV2(sessions) {
  if (!Array.isArray(sessions) || !sessions.length) return sessions

  // Pass 1 — backfill rawWeight. For pre-batch-2 (pre-unilateral) sets the
  // rawWeight field never existed; for post-cutover non-unilateral sets it
  // was also omitted. Defaulting to weight is correct in both cases because
  // weight == per-side load whenever there's no unilateral doubling.
  const backfilled = sessions.map(s => {
    if (!s?.data?.exercises) return s
    return {
      ...s,
      data: {
        ...s.data,
        exercises: s.data.exercises.map(ex => ({
          ...ex,
          sets: (ex.sets || []).map(set => ({
            ...set,
            rawWeight: set.rawWeight ?? set.weight,
          })),
        })),
      },
    }
  })

  // Pass 2 — recompute isNewPR chronologically per exercise name.
  const prTracker    = new Map()  // exerciseName -> { maxWeight, maxRepsAtMaxWeight }
  const updatesByIdx = new Map()  // original index -> rewritten exercises[]

  const chronological = backfilled
    .map((s, i) => ({ s, i, t: new Date(s.date).getTime() }))
    .filter(x => x.s?.mode === 'bb' && x.s?.data?.exercises && !isNaN(x.t))
    .sort((a, b) => a.t - b.t)

  for (const { s, i } of chronological) {
    const updatedExercises = s.data.exercises.map(ex => {
      let running = prTracker.get(ex.name) || { maxWeight: 0, maxRepsAtMaxWeight: 0 }
      const updatedSets = (ex.sets || []).map(set => {
        const w = Number(perSideLoad(set)) || 0
        const r = Number(set.reps)         || 0
        if (w <= 0 || r <= 0) return { ...set, isNewPR: false }
        let isNewPR = false
        if (running.maxWeight === 0 || w > running.maxWeight) {
          isNewPR = true
          running = { maxWeight: w, maxRepsAtMaxWeight: r }
        } else if (w === running.maxWeight && r > running.maxRepsAtMaxWeight) {
          isNewPR = true
          running = { ...running, maxRepsAtMaxWeight: r }
        }
        return { ...set, isNewPR }
      })
      prTracker.set(ex.name, running)
      return { ...ex, sets: updatedSets }
    })
    updatesByIdx.set(i, updatedExercises)
  }

  return backfilled.map((s, i) =>
    updatesByIdx.has(i)
      ? { ...s, data: { ...s.data, exercises: updatesByIdx.get(i) } }
      : s
  )
}

// ── V2 → V3 persist migration ───────────────────────────────────────────────
// Assigns stable exerciseIds to every LoggedExercise, canonicalizes display
// names against the library, and recomputes isNewPR keyed by exerciseId so
// post-canonicalization duplicates ("Seated Cable Row" / "seated cable row")
// share a single PR progression instead of silently splitting history.
//
// Input: { sessions, library } — library must be pre-seeded (built-ins or
// persisted). Unresolved session names are added as new library entries with
// needsTagging: true so the backfill UI (step 2c) can collect muscle/equipment
// data from the user later.
//
// Output: { sessions, library } — both may be modified. Idempotent.

export function normalizeExerciseName(name) {
  return (name || '').toLowerCase().trim().replace(/\s+/g, ' ')
}

// Token-sort form: tokenize, sort tokens alphabetically, rejoin. Makes
// "DB Lateral Raises" and "Lateral DB Raises" hash to the same key so
// fuzzy match catches word-order variants.
function tokenSort(name) {
  return normalizeExerciseName(name).split(' ').filter(Boolean).sort().join(' ')
}

// Trigram-based Jaccard similarity — fast, robust against typos and
// word-order variants, 0.0–1.0. Works well for exercise-name dedup:
// - "Seated Cable Row" vs "Seated cable row" → 1.0 (identical after
//   normalization)
// - "DB Lateral Raises" vs "Lateral DB Raises" → ~0.55 on bigrams
//   but 1.0 on token-sort, so we max them together.
// - "Bench Press" vs "Incline Bench Press" → ~0.6 (partial match).
function trigramSet(s) {
  const padded = `  ${s}  `
  const grams = new Set()
  for (let i = 0; i < padded.length - 2; i++) grams.add(padded.slice(i, i + 3))
  return grams
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const g of a) if (b.has(g)) inter++
  return inter / (a.size + b.size - inter)
}

export function similarExerciseScore(queryName, candidateName) {
  const q = normalizeExerciseName(queryName)
  const c = normalizeExerciseName(candidateName)
  if (!q || !c) return 0
  if (q === c) return 1
  if (tokenSort(q) === tokenSort(c)) return 0.95
  return jaccard(trigramSet(q), trigramSet(c))
}

// Returns up to `max` library entries whose names score >= suggestThreshold
// against `query`, sorted by score desc. Scans every alias too so an entry
// with "Seated Cable Row" canonical and "seated cable row" alias hits either.
// See spec §3.3 — auto-suggest threshold 0.85, prompt threshold 0.7.
export function findSimilarExercises(query, library, {
  suggestThreshold = 0.7,
  max             = 3,
} = {}) {
  if (!query || !Array.isArray(library)) return []
  const scored = []
  for (const ex of library) {
    const names = [ex.name, ...(ex.aliases || [])]
    let best = 0
    for (const n of names) {
      const s = similarExerciseScore(query, n)
      if (s > best) best = s
    }
    if (best >= suggestThreshold) scored.push({ exercise: ex, score: best })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, max)
}

export function migrateSessionsToV3({ sessions, library } = {}) {
  const sessionsIn = Array.isArray(sessions) ? sessions : []
  const libraryIn  = Array.isArray(library)  ? library  : []
  if (!sessionsIn.length && !libraryIn.length) {
    return { sessions: sessionsIn, library: libraryIn }
  }

  // Clone library entries so we can extend aliases and append needsTagging
  // records without mutating the caller's references.
  const libOut = libraryIn.map(e => ({ ...e, aliases: [...(e.aliases || [])] }))

  // Lookup: normalized name → library entry. Includes canonical names + aliases.
  const lookup = new Map()
  const registerLookup = (key, entry) => {
    const k = normalizeExerciseName(key)
    if (k && !lookup.has(k)) lookup.set(k, entry)
  }
  for (const ex of libOut) {
    registerLookup(ex.name, ex)
    for (const alias of ex.aliases) registerLookup(alias, ex)
  }

  // Resolve every distinct session-exercise name to a library entry, creating
  // needsTagging records for any names that don't already resolve.
  //
  // Pre-sort the distinct names by descending capital-letter count so Title
  // Case variants are seen before lowercase ones. When two variants normalize
  // to the same key (e.g. "Seated Cable Row" and "Seated cable row"), the
  // first-seen wins the canonical slot — pre-sorting makes sure that's the
  // prettier one. Second-pass resolutions pick up the already-canonical match.
  const capsScore = s => (s.match(/[A-Z]/g) || []).length
  const distinctNames = [...new Set(
    sessionsIn.flatMap(s => (s?.data?.exercises || []).map(e => e?.name).filter(Boolean))
  )].sort((a, b) => capsScore(b) - capsScore(a) || a.localeCompare(b))

  const resolutions = new Map()  // originalName → { id, canonicalName }
  for (const name of distinctNames) {
    const match = lookup.get(normalizeExerciseName(name))
    if (match) {
      if (match.name !== name && !match.aliases.includes(name)) {
        match.aliases.push(name)
      }
      resolutions.set(name, { id: match.id, canonicalName: match.name })
      continue
    }
    const newEntry = {
      id:                `ex_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      aliases:           [],
      primaryMuscles:    [],       // empty — prompts backfill
      equipment:         'Other',  // placeholder until tagged
      isBuiltIn:         false,
      defaultUnilateral: false,
      loadIncrement:     5,
      defaultRepRange:   [8, 12],
      progressionClass:  'isolation',
      needsTagging:      true,
      createdAt:         new Date().toISOString(),
    }
    libOut.push(newEntry)
    registerLookup(newEntry.name, newEntry)
    resolutions.set(name, { id: newEntry.id, canonicalName: newEntry.name })
  }

  // Rewrite every LoggedExercise with canonical name + exerciseId. Skip
  // exercises that already have an exerciseId (idempotent re-run safety).
  const canonicalized = sessionsIn.map(s => {
    if (!s?.data?.exercises) return s
    return {
      ...s,
      data: {
        ...s.data,
        exercises: s.data.exercises.map(ex => {
          if (ex?.exerciseId) return ex
          const res = resolutions.get(ex?.name)
          if (!res) return ex
          return { ...ex, name: res.canonicalName, exerciseId: res.id }
        }),
      },
    }
  })

  // Recompute isNewPR chronologically keyed by exerciseId. Collision keys
  // ("Seated Cable Row" in push vs "seated cable row" in pull) now share a
  // running maxWeight tracker.
  const prTracker  = new Map()
  const updatesIdx = new Map()
  const ordered = canonicalized
    .map((s, i) => ({ s, i, t: new Date(s.date).getTime() }))
    .filter(x => x.s?.mode === 'bb' && x.s?.data?.exercises && !isNaN(x.t))
    .sort((a, b) => a.t - b.t)

  for (const { s, i } of ordered) {
    const updatedExes = s.data.exercises.map(ex => {
      const key = ex.exerciseId || ex.name
      let run = prTracker.get(key) || { maxWeight: 0, maxRepsAtMaxWeight: 0 }
      const updatedSets = (ex.sets || []).map(set => {
        const w = Number(perSideLoad(set)) || 0
        const r = Number(set.reps)         || 0
        if (w <= 0 || r <= 0) return { ...set, isNewPR: false }
        let isNewPR = false
        if (run.maxWeight === 0 || w > run.maxWeight) {
          isNewPR = true
          run = { maxWeight: w, maxRepsAtMaxWeight: r }
        } else if (w === run.maxWeight && r > run.maxRepsAtMaxWeight) {
          isNewPR = true
          run = { ...run, maxRepsAtMaxWeight: r }
        }
        return { ...set, isNewPR }
      })
      prTracker.set(key, run)
      return { ...ex, sets: updatedSets }
    })
    updatesIdx.set(i, updatedExes)
  }

  const finalSessions = canonicalized.map((s, i) =>
    updatesIdx.has(i)
      ? { ...s, data: { ...s.data, exercises: updatesIdx.get(i) } }
      : s
  )

  return { sessions: finalSessions, library: libOut }
}

// ── Misc ───────────────────────────────────────────────────────────────────

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
