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

// Batch 17a — human-readable relative time for the split-draft resume banner.
// Accepts a ms epoch (Date.now()) or an ISO string. Returns "just now",
// "5m ago", "2h ago", "yesterday", or a localized date for anything older.
export function formatTimeAgo(tsOrIso) {
  if (tsOrIso === null || tsOrIso === undefined) return ''
  const ts = typeof tsOrIso === 'number' ? tsOrIso : new Date(tsOrIso).getTime()
  if (!Number.isFinite(ts)) return ''
  const diffMs = Date.now() - ts
  if (diffMs < 0) return 'just now'
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1)  return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay === 1) return 'yesterday'
  if (diffDay < 7)   return `${diffDay}d ago`
  return formatDate(new Date(ts).toISOString())
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

// ── Recommendation engine ──────────────────────────────────────────────────
//
// Per-exercise, per-session load recommender. The spec (§2 of
// coaching-recommender-spec-v3.pdf) defines three layers:
//
//   Layer 1 — e1RM:          Epley  w × (1 + reps/30)
//   Layer 2 — target load:   currentE1RM × %1RM(targetReps)
//   Layer 3 — progressive nudge:
//     nextWeight = w_last × (1 + P·α) + 0.033 · w_last · Δreps
//       where P = min(personalWeeklyGain, 0.03), α = daysSince/7,
//             Δreps = repsHitLastSession − targetReps
//
// Decision rule (spec §2.2): hit target → Layer 3; missed by 1 → hold weight;
// missed by 2+ twice in a row → auto 10% deload; never below Layer 2.
//
// Modes (spec §2.5): push (full formula, aggressiveness 1.15), maintain
// (Layer 2 only), deload (65% of e1RM). Readiness UI (§2.5 proper) lives in
// a later batch; the engine already accepts the `mode` parameter so it can
// slot in without an API change.

// Epley — per-side load required. Returns 0 for empty / invalid input.
export function e1RM(weight, reps) {
  const w = Number(weight) || 0
  const r = Number(reps)   || 0
  if (w <= 0 || r <= 0) return 0
  return w * (1 + r / 30)
}

// Linear interpolation between spec §2.2 Layer 2 anchors. Clamped at the
// table endpoints so a weird targetReps (1 or 30) still returns a sane number.
const PERCENT_1RM_TABLE = [
  { reps: 3,  pct: 0.93 },
  { reps: 5,  pct: 0.86 },
  { reps: 6,  pct: 0.83 },
  { reps: 8,  pct: 0.78 },
  { reps: 10, pct: 0.73 },
  { reps: 12, pct: 0.69 },
  { reps: 15, pct: 0.63 },
]

export function percent1RM(targetReps) {
  const r = Number(targetReps) || 0
  if (r <= PERCENT_1RM_TABLE[0].reps)                             return PERCENT_1RM_TABLE[0].pct
  if (r >= PERCENT_1RM_TABLE[PERCENT_1RM_TABLE.length - 1].reps)  return PERCENT_1RM_TABLE[PERCENT_1RM_TABLE.length - 1].pct
  for (let i = 0; i < PERCENT_1RM_TABLE.length - 1; i++) {
    const lo = PERCENT_1RM_TABLE[i]
    const hi = PERCENT_1RM_TABLE[i + 1]
    if (r >= lo.reps && r <= hi.reps) {
      const t = (r - lo.reps) / (hi.reps - lo.reps)
      return lo.pct + t * (hi.pct - lo.pct)
    }
  }
  return 0.73
}

// Per-session top set for an exercise — the working set with the highest
// e1RM. Skips warmups; drop sets count (same per-side load as the parent
// working set is fine for fit purposes). Returns chronological ascending.
// Prefers exerciseId when present; falls back to name match for pre-v3
// sessions that haven't been migrated through the live persist hook yet.
// rpe (1–10, optional) carried through when set so Layer 3's Δreps can
// factor in reps-in-reserve (§3.7).
export function getExerciseHistory(sessions, exerciseId, exerciseName = null) {
  if (!Array.isArray(sessions) || !exerciseId) return []
  const out = []
  for (const s of sessions) {
    if (s?.mode !== 'bb' || !s?.data?.exercises) continue
    const ex = s.data.exercises.find(e =>
      e.exerciseId === exerciseId ||
      (exerciseName && e.name === exerciseName)
    )
    if (!ex) continue
    const working = (ex.sets || []).filter(st =>
      (st.type === 'working' || st.type === 'drop') &&
      (perSideLoad(st) > 0) &&
      (Number(st.reps) > 0)
    )
    if (!working.length) continue
    let top = null
    let topE = 0
    for (const st of working) {
      const w = perSideLoad(st)
      const r = Number(st.reps) || 0
      const e = e1RM(w, r)
      if (e > topE) {
        topE = e
        const rpe = Number(st.rpe)
        top = {
          weight: w,
          reps:   r,
          e1RM:   e,
          rpe:    Number.isFinite(rpe) && rpe >= 1 && rpe <= 10 ? rpe : null,
        }
      }
    }
    if (top) out.push({ date: s.date, ...top })
  }
  return out.sort((a, b) => new Date(a.date) - new Date(b.date))
}

// Layer 1 — current e1RM as the max of the last two sessions' top sets.
// Using the max filters out a single low day (illness, fatigue, etc.).
export function getCurrentE1RM(history) {
  if (!Array.isArray(history) || !history.length) return 0
  const last2 = history.slice(-2)
  return Math.max(...last2.map(h => h.e1RM || 0))
}

// §2.3 — linear regression of e1RM on days, sliding window of the last 6
// sessions. Returns fractional weekly gain (e.g. 0.015 = 1.5% /wk), plus
// the R² and n so the caller can gate usability (n ≥ 4 and R² ≥ 0.4 per
// spec) and pick a confidence label (§2.4).
export function getProgressionRate(history) {
  const h = Array.isArray(history) ? history : []
  const window = h.slice(-6)
  const n = window.length
  if (n < 2) return { rate: 0, rSquared: 0, n, slope: 0, meanE1RM: 0 }

  const x0 = new Date(window[0].date).getTime()
  const xs = window.map(p => (new Date(p.date).getTime() - x0) / 86400000) // days
  const ys = window.map(p => p.e1RM || 0)

  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let ssxy = 0, ssxx = 0, ssyy = 0
  for (let i = 0; i < n; i++) {
    ssxy += (xs[i] - meanX) * (ys[i] - meanY)
    ssxx += (xs[i] - meanX) ** 2
    ssyy += (ys[i] - meanY) ** 2
  }
  if (ssxx === 0) return { rate: 0, rSquared: 0, n, slope: 0, meanE1RM: meanY }

  const slope    = ssxy / ssxx                                 // e1RM per day
  const rSquared = ssyy === 0 ? 0 : (ssxy ** 2) / (ssxx * ssyy)
  const rate     = meanY > 0 ? (slope * 7) / meanY : 0         // fractional /wk

  return { rate, rSquared, n, slope, meanE1RM: meanY }
}

// §2.4 confidence labels. `none` means the caller should show "Last:" only.
export function getRecommendationConfidence(n, rSquared) {
  const nn = Number(n) || 0
  const rr = Number(rSquared) || 0
  if (nn < 3)                     return 'none'
  if (nn >= 6 && rr >= 0.9)       return 'high'
  if (nn >= 4 && rr >= 0.6)       return 'moderate'
  return 'building'
}

// Top-level — takes per-exercise history (chronological, from
// getExerciseHistory) plus the exercise's defaults and mode. Caller rounds
// the returned prescription to `loadIncrement` already; we return numbers.
//
// Returns:
//   { mode, confidence, prescription: { weight, reps } | null, reasoning,
//     meta: { currentE1RM, progressionRate, rSquared, n, daysSince, usedFit, layer2Weight } }
//
// If history has <3 sessions we return prescription = last set (or null) and
// confidence = 'none', matching spec §2.4: "No prescription — show last
// session only."
export function recommendNextLoad({
  history,
  targetReps       = 10,
  mode             = 'push',
  progressionClass = 'isolation',
  loadIncrement    = 5,
  // Readiness modulation (spec §2.5, Batch 16n). 0.85 = low energy/sleep,
  // 1.00 = typical, 1.15 = great readiness. Scales the push-mode aggressiveness
  // constant (base 1.15) so a tired day nudges less aggressively than a
  // fresh day. No effect in maintain/deload modes. Defaults to 1 so callers
  // without a readiness signal get identical behavior to pre-16n.
  aggressivenessMultiplier = 1,
  // Fatigue signals (spec §4, Batch 16o). All optional, all default to
  // no-op so pre-16o callers get identical output.
  //   priorGrade:      'A+'|'A'|'B'|'C'|'D'|null — most recent bb session's grade
  //   cardioRecent:    { intensity, hoursAgo } | null — most recent cardio
  //                    session; only "allout" within 24h dampens (user said
  //                    routine cardio should not factor)
  //   restedYesterday: bool — a rest day was logged within the last 36h
  fatigueSignals = {},
  now              = Date.now(),
} = {}) {
  const h = Array.isArray(history) ? history : []
  const n = h.length

  if (n === 0) {
    return {
      mode,
      confidence: 'none',
      prescription: null,
      reasoning:  'No prior sessions logged — pick a weight you can do for ' + targetReps + ' clean reps.',
      meta: { n: 0, rSquared: 0 },
    }
  }
  if (n < 3) {
    const last = h[n - 1]
    const remaining = 3 - n
    return {
      mode,
      confidence: 'none',
      prescription: { weight: last.weight, reps: last.reps },
      reasoning:  `Log ${remaining} more ${remaining === 1 ? 'session' : 'sessions'} and I'll start prescribing weights.`,
      meta: { n, rSquared: 0, daysSince: Math.max(0, Math.round((now - new Date(last.date).getTime()) / 86400000)) },
    }
  }

  const currentE1RM = getCurrentE1RM(h)
  const last        = h[n - 1]
  const daysSince   = Math.max(0, (now - new Date(last.date).getTime()) / 86400000)

  const fit          = getProgressionRate(h)
  const fallbackRate = progressionClass === 'compound' ? 0.01 : 0.005
  const usedFit      = fit.n >= 4 && fit.rSquared >= 0.4
  const personalRate = usedFit ? fit.rate : fallbackRate
  const confidence   = getRecommendationConfidence(fit.n, fit.rSquared)

  const layer2Weight = currentE1RM * percent1RM(targetReps)

  // Auto-deload trigger (spec §2.2 rule 3): missed by 2+ reps in the last
  // two consecutive sessions. Only applies when the user hasn't already
  // explicitly declared maintain/deload — otherwise mode wins. When RPE
  // is logged, "miss" is evaluated against effective reps (reps + RIR);
  // a set at RPE 8 with 2 RIR counts as hitting target even if raw reps
  // fell short (§3.7).
  const effReps = p => {
    const rir = p.rpe ? Math.max(0, 10 - p.rpe) : 0
    return p.reps + rir
  }
  const lastTwo    = h.slice(-2)
  const autoDeload = mode === 'push' && lastTwo.length >= 2 &&
                     lastTwo.every(p => (targetReps - effReps(p)) >= 2)

  let prescriptionWeight
  let reasoning
  let effectiveMode = mode

  if (mode === 'deload') {
    // User-declared deload. 65% of current e1RM (midpoint of 60-70%).
    prescriptionWeight = currentE1RM * 0.65
    reasoning          = `Recovery day. 65% of your e1RM for an easier session.`
  } else if (autoDeload) {
    // 10% off the last working weight, per the decision rule.
    prescriptionWeight = last.weight * 0.90
    reasoning          = `You've missed the rep target two sessions in a row. Backing off 10% today to reset before pushing again.`
    effectiveMode      = 'deload'
  } else if (mode === 'maintain') {
    // Layer 2 only: match the e1RM at the target reps, no nudge.
    prescriptionWeight = layer2Weight
    reasoning          = `Matching your e1RM at ${targetReps} reps. A solid maintenance day.`
  } else {
    // Push (default) — full Layer 3 with aggressiveness 1.15, clamped to Layer 2.
    // Readiness multiplier (§2.5) scales the aggressiveness coefficient so a
    // low-energy/low-sleep day nudges more conservatively. No effect when
    // callers don't provide readiness — multiplier defaults to 1.
    // Fatigue signals (§4, Batch 16o) stack additional multipliers on top.
    const readinessMult = Number(aggressivenessMultiplier) || 1
    const gradeMult  = gradeMultiplier(fatigueSignals.priorGrade)
    const cardioMult = cardioDamping(fatigueSignals.cardioRecent)
    const restMult   = fatigueSignals.restedYesterday ? 1.05 : 1.00
    const gap        = gapAdjustment(daysSince)
    const fatigueMult = gradeMult * cardioMult * restMult
    const aggressiveness = 1.15 * readinessMult * fatigueMult
    const P              = Math.min(personalRate * aggressiveness, 0.03)
    const alpha          = Math.min(daysSince / 7, gap.alphaCap)
    const hitTarget      = last.reps >= targetReps
    const missedByOne    = (targetReps - last.reps) === 1

    // Effective-reps: factor in RIR when the user logged an RPE on last top
    // set. RIR = Math.max(0, 10 − RPE). E.g. 10 reps @ RPE 8 = 12 effective.
    // Spec §3.7: "effectiveRepsBeaten = repsHit + estimatedRIR − targetReps".
    // No RPE → RIR 0, behavior identical to pre-16c.
    const lastRIR          = last.rpe ? Math.max(0, 10 - last.rpe) : 0
    const effectiveReps    = last.reps + lastRIR
    const hitEffective     = effectiveReps >= targetReps
    const effectiveMissBy1 = (targetReps - effectiveReps) === 1

    if (hitTarget || hitEffective) {
      const deltaReps    = effectiveReps - targetReps
      const layer3Weight = last.weight * (1 + P * alpha) + 0.033 * last.weight * deltaReps
      prescriptionWeight = Math.max(layer3Weight, layer2Weight)
      const e1rmRounded  = Math.round(currentE1RM)
      const layer2Round  = Math.round(layer2Weight)
      if (layer2Weight >= layer3Weight) {
        // Floor driven: user's recent top sets imply a strength level above
        // what they loaded last time. Today the prescription pulls them
        // back up to that projected level.
        if (layer2Round > last.weight) {
          reasoning = `Your recent top sets put your estimated 1-rep max around ${e1rmRounded} lbs, which projects to ${layer2Round} for ${targetReps} reps. Last session you went ${last.weight}×${last.reps}, lighter than your strength suggests, so today's weight catches you back up to your actual level.`
        } else {
          reasoning = `Matching your current strength level: ${e1rmRounded} lb e1RM projects to ${layer2Round} for ${targetReps} reps, right around last session's ${last.weight}×${last.reps}.`
        }
      } else {
        // Nudge driven: user is already at their strength ceiling. Layer 3
        // adds a gradual load bump based on their progression rate.
        const bumpLbs = Math.max(0, Math.round(layer3Weight - last.weight))
        reasoning = `You hit ${last.weight}×${last.reps} last session, right at your current strength level. Bumping load by +${bumpLbs} lbs today based on your progression trend (capped at +3% per elapsed week to keep it sustainable).`
      }
    } else if (missedByOne || effectiveMissBy1) {
      prescriptionWeight = Math.max(last.weight, layer2Weight)
      reasoning          = `You got ${last.reps} reps at ${last.weight} last time (target was ${targetReps}). Same weight. Go for all ${targetReps} this session.`
    } else {
      prescriptionWeight = Math.max(last.weight, layer2Weight)
      reasoning          = `You got ${last.reps} reps at ${last.weight} last time (target was ${targetReps}). Holding the weight. Push for the reps before adding load.`
    }

    // Gap adjustment — tempers the final prescription when the user has been
    // away longer than ~10 days. Protects against the alpha=3 (21-day) case
    // that would otherwise triple the nudge, risking injury on a detrained
    // lifter. Applies after the mode-specific math so the Floor is tempered
    // too when necessary.
    if (gap.mult < 1.0) {
      prescriptionWeight = prescriptionWeight * gap.mult
    }

    // Compose fatigue prefix: only mention signals that actually moved the
    // aggressiveness meaningfully (±5% or more). Keep the reasoning terse —
    // one short sentence prefix before the existing body.
    const prefix = buildFatigueReasoningPrefix({
      gradeMult, cardioMult, restMult, gap, daysSince,
      priorGrade: fatigueSignals.priorGrade,
      cardioRecent: fatigueSignals.cardioRecent,
    })
    if (prefix) reasoning = `${prefix} ${reasoning}`
  }

  const inc     = Number(loadIncrement) > 0 ? Number(loadIncrement) : 5
  const rounded = Math.round(prescriptionWeight / inc) * inc

  // Actual this-session nudge percentage (P × α × 100). May be 0 in
  // maintain/deload modes. Displayed in the Details section of the sheet
  // for the curious.
  // Effective aggressiveness = base × readiness × grade × cardio × rest,
  // clamped via the standard 3%/wk P cap. Alpha is capped by the gap
  // adjustment for long-gap safety.
  const composedMult = (Number(aggressivenessMultiplier) || 1)
    * gradeMultiplier(fatigueSignals.priorGrade)
    * cardioDamping(fatigueSignals.cardioRecent)
    * (fatigueSignals.restedYesterday ? 1.05 : 1.00)
  const gapForMeta = gapAdjustment(daysSince)
  const thisSessionNudgePct = mode === 'push' && !autoDeload
    ? Math.min(personalRate * 1.15 * composedMult, 0.03) * Math.min(daysSince / 7, gapForMeta.alphaCap) * 100
    : 0

  return {
    mode: effectiveMode,
    confidence,
    prescription: { weight: rounded, reps: targetReps },
    reasoning,
    meta: {
      currentE1RM:        Math.round(currentE1RM),
      progressionRate:    Number(personalRate.toFixed(4)),
      rSquared:           Number(fit.rSquared.toFixed(3)),
      n:                  fit.n,
      daysSince:          Math.round(daysSince),
      usedFit,
      layer2Weight:       Math.round(layer2Weight),
      thisSessionNudgePct: Number(thisSessionNudgePct.toFixed(2)),
    },
  }
}

// ── Readiness check-in (spec §2.5, Batch 16n) ──────────────────────────────
//
// Three-tap pre-session prompt: Energy (low/ok/high), Sleep (poor/ok/good),
// Goal (recover/match/push). Goal maps 1:1 to recommender mode. Energy+Sleep
// combine into a discrete aggressivenessMultiplier (0.85 / 1.00 / 1.15) that
// scales push-mode aggressiveness.
//
// Defaults (when user skips or takes no action): ok/ok/push → multiplier 1.00,
// suggestedMode 'push'. Identical to pre-16n recommender behavior.

export const READINESS_GOAL_TO_MODE = {
  recover: 'deload',
  match:   'maintain',
  push:    'push',
}

// Score each axis −1/0/+1 then sum for a 3-way bucket.
export function readinessMultiplier(energy, sleep) {
  const e = energy === 'low'  ? -1 : energy === 'high' ? 1 : 0
  const s = sleep  === 'poor' ? -1 : sleep  === 'good' ? 1 : 0
  const total = e + s
  if (total <= -1) return 0.85
  if (total >=  1) return 1.15
  return 1.00
}

export function buildReadiness({ energy, sleep, goal, now = Date.now() } = {}) {
  const e = energy === 'low' || energy === 'high' ? energy : 'ok'
  const s = sleep  === 'poor' || sleep  === 'good' ? sleep  : 'ok'
  const g = goal   === 'recover' || goal === 'match' ? goal : 'push'
  return {
    energy: e,
    sleep:  s,
    goal:   g,
    aggressivenessMultiplier: readinessMultiplier(e, s),
    suggestedMode:            READINESS_GOAL_TO_MODE[g],
    timestamp: new Date(now).toISOString(),
  }
}

// ── Fatigue signals (spec §4, Batch 16o) ───────────────────────────────────
//
// Four observed signals that modulate the push-mode aggressiveness alongside
// the self-reported readiness multiplier:
//
//   1. Grade multiplier — previous bb session's grade (A+ to D) scales
//      aggressiveness 1.10× to 0.90×. A strong prior session means the user
//      is clearly progressing; a D means they're struggling.
//   2. Cardio damping — only triggers on 'allout' intensity within 24h.
//      2% reduction. Routine cardio has no effect (per user preference:
//      "cardio within 48h should not really weigh in, or do so in the
//      slightest manner").
//   3. Rest-day boost — coming off a logged rest day (within ~36h) grants
//      a 5% aggressiveness boost (user is fresher).
//   4. Inter-session gap — `daysSince > 10` tempers the final prescription
//      and caps the weekly-rate alpha at 2, so a 3-week gap doesn't triple
//      the nudge on a detrained lifter.
//
// All four default to no-op when the caller doesn't supply data.

export function gradeMultiplier(grade) {
  switch (grade) {
    case 'A+': return 1.10
    case 'A':  return 1.05
    case 'B':  return 1.00
    case 'C':  return 0.95
    case 'D':  return 0.90
    default:   return 1.00
  }
}

// Conservative per user feedback: only 'allout' within 24h counts; everything
// else is a no-op. 2% damping is "slightest manner".
export function cardioDamping(cardioRecent) {
  if (!cardioRecent) return 1.00
  const { intensity, hoursAgo } = cardioRecent
  if (intensity === 'allout' && Number.isFinite(hoursAgo) && hoursAgo < 24) {
    return 0.98
  }
  return 1.00
}

// Long-gap tempering. Beyond ~10 days we start getting conservative; beyond
// 14 days more so. alphaCap prevents the nudge from exploding when
// `daysSince/7` is large.
export function gapAdjustment(daysSince) {
  const d = Number(daysSince) || 0
  if (d > 14) return { mult: 0.85, alphaCap: 2 }
  if (d > 10) return { mult: 0.95, alphaCap: 2 }
  return { mult: 1.00, alphaCap: Infinity }
}

// Helper for callers — resolves the fatigue signals from raw store slices.
// BbLogger computes these once per session open and passes the result to
// `recommendNextLoad`. Returns `{priorGrade, cardioRecent, restedYesterday}`.
export function buildFatigueSignals({
  sessions = [],
  cardioSessions = [],
  restDaySessions = [],
  now = Date.now(),
} = {}) {
  // Most recent bb session's grade, across any workout type. Null when
  // nothing has been graded.
  const gradedSessions = sessions
    .filter(s => s?.mode === 'bb' && s?.grade)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  const priorGrade = gradedSessions[0]?.grade || null

  // Most recent cardio session; only returned when within 24h (otherwise
  // the damping function returns 1.0 anyway, but we skip to keep the meta
  // payload clean).
  const lastCardio = [...cardioSessions]
    .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))[0]
  let cardioRecent = null
  if (lastCardio) {
    const ts = new Date(lastCardio.createdAt || lastCardio.date).getTime()
    const hoursAgo = (now - ts) / 3600000
    if (hoursAgo >= 0 && hoursAgo < 48) {
      cardioRecent = { intensity: lastCardio.intensity || null, hoursAgo }
    }
  }

  // Rest day within 36h — captures "yesterday" without timezone gymnastics.
  const lastRest = [...restDaySessions]
    .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))[0]
  let restedYesterday = false
  if (lastRest) {
    const ts = new Date(lastRest.date || lastRest.createdAt).getTime()
    const hoursAgo = (now - ts) / 3600000
    restedYesterday = hoursAgo >= 0 && hoursAgo < 36
  }

  return { priorGrade, cardioRecent, restedYesterday }
}

// Composes a one-sentence reasoning prefix mentioning the dominant fatigue
// signal, when it materially affected aggressiveness (>= 5% shift) or when
// the gap is long. Returns '' when nothing is worth surfacing. Ordering:
// deload-ish signals (low grade, hard cardio, long gap) take priority over
// boost signals (A+, rest day), because they warn the user.
function buildFatigueReasoningPrefix({
  gradeMult, cardioMult, restMult, gap, daysSince,
  priorGrade, cardioRecent,
}) {
  if (gradeMult <= 0.95) {
    return `Last session graded ${priorGrade}, so holding back a touch.`
  }
  if (cardioMult < 1.0) {
    return `Taking it a touch easier after your all-out cardio session.`
  }
  if (gap.mult < 1.0) {
    const days = Math.round(Number(daysSince) || 0)
    return `It's been ${days} days — ramping back up gradually, not catching up.`
  }
  if (gradeMult >= 1.05) {
    return `Last session graded ${priorGrade} — pushing a touch more today.`
  }
  if (restMult > 1.0 && cardioRecent?.intensity !== 'allout') {
    return `Coming off a rest day, giving you a little more room.`
  }
  return ''
}

// ── Anomaly detectors (spec §4.5, Batch 16q, step 9) ───────────────────────
//
// Three detectors scan the per-exercise e1RM history returned by
// `getExerciseHistory` and surface contextual banners when something looks
// off. Pure functions — no store access, no time dependency beyond the input
// history, so they're safe inside a useMemo that reruns on render.
//
//   plateau     — flat trend over the last 6+ sessions. "Try dropping 10%
//                 and chasing reps to break through."
//   regression  — clear downtrend over the last 3+ sessions. "Consider a
//                 lighter recovery week, then push back up."
//   swing       — >30% per-side e1RM delta session-over-session. Usually
//                 signals a different machine or range of motion.
//
// `detectAnomalies` returns the highest-priority hit or null:
//   regression > swing > plateau (warning first, then data-quality, then
//   passive observation).

export function detectPlateau(history, { minSessions = 6 } = {}) {
  const h = Array.isArray(history) ? history : []
  if (h.length < minSessions) return null
  const fit = getProgressionRate(h)
  // No rSquared gate — a perfectly flat line gives rSquared=0 in our code
  // (the ssyy===0 branch in getProgressionRate), which would falsely block
  // the detector if gated. Rate threshold alone captures "stuck."
  if (Math.abs(fit.rate) < 0.005) {
    return { triggered: true, kind: 'plateau', severity: 'info', rate: fit.rate, n: fit.n }
  }
  return null
}

export function detectRegression(history, { minSessions = 3, rateThreshold = -0.01 } = {})  {
  const h = Array.isArray(history) ? history : []
  if (h.length < minSessions) return null
  const fit = getProgressionRate(h)
  // R² gate matches the recommender's `usedFit` cutoff — a clear downtrend
  // needs the line to actually fit. Noisy scatter around a negative mean
  // should not trigger a warning.
  if (fit.rate < rateThreshold && fit.rSquared >= 0.4) {
    return { triggered: true, kind: 'regression', severity: 'warn', rate: fit.rate, rSquared: fit.rSquared, n: fit.n }
  }
  return null
}

export function detectSwing(history, { threshold = 0.30 } = {}) {
  const h = Array.isArray(history) ? history : []
  if (h.length < 2) return null
  const last = Number(h[h.length - 1]?.e1RM) || 0
  const prev = Number(h[h.length - 2]?.e1RM) || 0
  if (prev <= 0) return null
  const delta = (last - prev) / prev
  if (Math.abs(delta) > threshold) {
    return {
      triggered: true,
      kind: 'swing',
      severity: 'info',
      delta,
      direction: delta > 0 ? 'up' : 'down',
    }
  }
  return null
}

// Priority: regression > swing > plateau. First non-null wins.
export function detectAnomalies(history) {
  return (
    detectRegression(history) ||
    detectSwing(history)      ||
    detectPlateau(history)    ||
    null
  )
}

// ── Misc ───────────────────────────────────────────────────────────────────

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
