import { BB_WORKOUT_SEQUENCE } from '../data/exercises.js'
import { HYROX_STATIONS, buildHyroxStationLibraryEntry } from '../data/hyroxStations.js'
import { HYROX_HEADLINES } from '../data/hyroxHeadlines.js'

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

// Batch 18b — split-card date helpers.
//
// `formatRelativeDate` powers the SplitManager card's usage line
// ("47 sessions · last today" / "…last 3 weeks ago"). Uses local-timezone
// day boundaries, not UTC — Batch 16k learned this the hard way.
export function formatRelativeDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const dayOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.floor((dayOf(now) - dayOf(d)) / 86_400_000)
  if (days <= 0) return 'last today'
  if (days === 1) return 'yesterday'
  if (days < 7)   return `${days} days ago`
  if (days < 14)  return 'last week'
  if (days < 30)  return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return 'over a year ago'
}

// Batch 18b — formats a date for the SplitCard provenance line
// ("March 22, 2026"). Accepts either an ISO timestamp or a date-only
// string (`'2026-03-22'`). Date-only strings are parsed as local midnight
// (not UTC) so a US user doesn't see "March 21" the day after they
// created the split.
export function formatStartDate(isoOrDateStr) {
  if (!isoOrDateStr) return ''
  const s = String(isoOrDateStr)
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? new Date(s + 'T00:00:00')
    : new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

// Batch 18b — split usage helpers used by the SplitManager card.
// Pure, no store coupling; caller passes the store slice directly.
//
// `getSplitSessionCount` counts bb-mode sessions whose `type` matches any
// workout id belonging to the split. `getSplitLastUsedDate` returns the
// most recent such session's ISO date or null if never used.
export function getSplitSessionCount(sessions, split) {
  if (!Array.isArray(sessions) || !split?.workouts) return 0
  const workoutIds = new Set(split.workouts.map(w => w.id))
  let n = 0
  for (const s of sessions) {
    if (s?.mode === 'bb' && workoutIds.has(s.type)) n++
  }
  return n
}

export function getSplitLastUsedDate(sessions, split) {
  if (!Array.isArray(sessions) || !split?.workouts) return null
  const workoutIds = new Set(split.workouts.map(w => w.id))
  let latest = null
  for (const s of sessions) {
    if (s?.mode !== 'bb' || !workoutIds.has(s.type)) continue
    if (!latest || s.date > latest) latest = s.date
  }
  return latest
}

// Batch 17h — Rec (coach's prescription) formatting per Step 9.
// Exercise.rec can be any of:
//   - null / undefined
//   - '' (empty string — treat as null)
//   - legacy string like '3x20 (warmup)' or '4×10-10-10 drop'
//   - structured { sets?: number, reps?: string | number, note?: string }
//
// `formatRec` produces the canonical human-readable string for display, or
// null when there's nothing to render. The WorkoutEditSheet's RecEditor and
// BbLogger's RecInline both render via this helper so display stays
// consistent regardless of which shape happens to be stored.
export function formatRec(rec) {
  if (!rec) return null
  if (typeof rec === 'string') {
    const s = rec.trim()
    return s || null
  }
  if (typeof rec !== 'object') return null

  const sets = Number.isFinite(rec.sets) && rec.sets > 0 ? rec.sets : null
  const reps = typeof rec.reps === 'string'
    ? rec.reps.trim()
    : (Number.isFinite(rec.reps) ? String(rec.reps) : null)
  const note = typeof rec.note === 'string' ? rec.note.trim() : null

  let prefix = null
  if (sets && reps) prefix = `${sets}×${reps}`
  else if (sets)   prefix = `${sets} set${sets === 1 ? '' : 's'}`
  else if (reps)   prefix = `${reps} reps`

  if (prefix && note) return `${prefix} · ${note}`
  return prefix || note || null
}

// Batch 18a — lossless exercise-entry normalizer.
// Replaces the drop-on-unexpected-shape path that WorkoutEditSheet and
// SplitCanvas's normalizeWorkouts used to ship (Batch 17g). Accepts any
// legacy or current shape and returns either a string, a {name, rec}
// object, or null for truly nameless input. Dev-mode console.warn fires
// on any drop so a buggy migration can't hide behind silent filtering.
//
// Shape coverage:
//   - string with content            → string (trimmed)
//   - string "" / whitespace-only    → null  (no recoverable name)
//   - {name}                         → name (bare string)
//   - {name, rec}                    → {name, rec: ex.rec}   (preserves any shape)
//   - {name: '', rec}                → null  (nameless, no recovery target)
//   - {exercise, …}                  → exercise (fallback field)
//   - null / undefined / number      → null
//
// Callers .filter(Boolean) the result since null is the only drop signal.
export function normalizeExerciseEntry(ex) {
  if (typeof ex === 'string') {
    const s = ex.trim()
    return s || null
  }
  if (!ex || typeof ex !== 'object') return null

  // Prefer .name; fall back to .exercise (some legacy shapes), then any
  // leading string value if those are missing. Coerce numbers/booleans via
  // String() so a stored number doesn't trip the typeof check.
  const rawName = ex.name ?? ex.exercise ?? null
  const name = typeof rawName === 'string' ? rawName.trim() : (rawName != null ? String(rawName).trim() : '')

  if (!name) {
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[normalizeExerciseEntry] Dropping exercise entry with no recoverable name:', ex)
    }
    return null
  }

  // Build the smallest renderable shape, but preserve any HYROX-related
  // fields (`type`, `roundConfig`) so library-spawn paths like
  // collectLibraryAdditionsFromSplit can detect hyrox-round / running /
  // hyrox-station entries when SplitCanvas saves a template-derived split.
  // The UI surfaces (SplitCanvas / WorkoutEditSheet / formatRec) ignore
  // these fields — they only render name + rec — so they're zero-cost
  // metadata that rides along until the save path needs them.
  const hasRec = ex.rec !== null && ex.rec !== undefined && ex.rec !== ''
  const hasType = typeof ex.type === 'string' && ex.type.length > 0
  const hasRoundConfig = ex.roundConfig && typeof ex.roundConfig === 'object'
  if (!hasRec && !hasType && !hasRoundConfig) return name
  const out = { name }
  if (hasRec) out.rec = ex.rec
  if (hasType) out.type = ex.type
  if (hasRoundConfig) out.roundConfig = ex.roundConfig
  return out
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

// Batch 36 — Superset history lookup. Scans bb-mode sessions newest-first for
// the given exercise (by exerciseId first, name fallback for pre-v3 safety).
// Returns { partners: string[], date: isoString } for the most recent session
// where the exercise was part of a supersetGroupId with at least one other
// member. Null when no prior superset history exists. Drives the SS chip's
// illuminated state + the Re-pair shortcut in SupersetSheet.
export function getMostRecentSupersetPartners(sessions, exerciseIdOrName) {
  if (!sessions?.length || !exerciseIdOrName) return null
  const sorted = [...sessions]
    .filter(s => s.mode === 'bb' && s.data?.exercises?.length)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  for (const sess of sorted) {
    const exs = sess.data.exercises
    const match = exs.find(e =>
      (e.exerciseId && e.exerciseId === exerciseIdOrName) || e.name === exerciseIdOrName
    )
    if (!match?.supersetGroupId) continue
    const partners = exs
      .filter(e => e.supersetGroupId === match.supersetGroupId && e !== match)
      .map(e => e.name)
      .filter(Boolean)
    if (partners.length === 0) continue
    return { partners, date: sess.date }
  }
  return null
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
        // PRs are keyed off working primaries only (Batch 22 decision 3).
        // Warmups and (under the bundled shape) any non-working entry are
        // excluded; drop stages are nested inside set.drops[] and never
        // participate in PR tracking.
        if (set.type !== 'working') return
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
      const primary = (set.reps || 0) * (set.weight || 0)
      // Drop stages (Batch 22 decision 2): walk nested drops and add their
      // volume contribution. For pre-bundled data, set.drops is undefined
      // and the reducer returns 0, so the total matches flat-shape volume.
      const drops = Array.isArray(set.drops)
        ? set.drops.reduce((d, dst) => d + (dst.reps || 0) * (dst.weight || 0), 0)
        : 0
      return s + primary + drops
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

// Canonical "what local date is this?" helper. Returns YYYY-MM-DD using the
// BROWSER'S LOCAL timezone (via getFullYear/getMonth/getDate) — NOT UTC. Replaces
// the `.toISOString().split('T')[0]` anti-pattern that caused evening entries in
// western timezones to land on the next day (Batch 25 timezone-fix).
//
// Accepts: a Date object, an ISO string, a date-only 'YYYY-MM-DD' string, or
// `undefined` (defaults to right now). Returns null for unparseable input.
//
// Background: `new Date('2026-04-07')` parses as UTC midnight; in UTC-5 that's
// local Apr 6 at 19:00, so a naive getDate would return 6 instead of 7. Passing
// an ISO timestamp works correctly because Date's getters return local values.
// Date-only strings (like '2026-04-07' with no time) get normalized through
// 'T00:00:00' so they land as local midnight.
export function toLocalDateStr(input) {
  let d
  if (input === undefined || input === null) {
    d = new Date()
  } else if (input instanceof Date) {
    d = input
  } else if (typeof input === 'string') {
    // Date-only 'YYYY-MM-DD' → append T00:00:00 so it parses as local midnight.
    // Full ISO strings (with T) parse correctly on their own — .getDate etc.
    // return local-timezone values from any parsed Date.
    const s = /^\d{4}-\d{2}-\d{2}$/.test(input) ? `${input}T00:00:00` : input
    d = new Date(s)
  } else {
    return null
  }
  if (isNaN(d.getTime())) return null
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

// ── V4 → V5 persist migration (Batch 22) ────────────────────────────────────
// Drop-set bundling: drop entries in the flat ex.sets[] array are nested
// inside the preceding working set's new `drops[]` field. A working at 185×10
// followed by drops to 135×8 and 95×6 becomes ONE top-level entry with
// `drops: [{weight:135, reps:8, …}, {weight:95, reps:6, …}]` — not three.
//
// Decisions locked for this migration (see drop-set-bundling.md):
//   1. Drop stages stay in volume (calcSessionVolume walks working+drops).
//   2. Drops never qualify as PRs — only working primaries do.
//   3. Orphan drops (no preceding working in the same exercise) are promoted
//      to working and become their own parent. Warmups between sets break
//      the drop chain; a drop after a warmup with no prior working is
//      similarly promoted.
//
// Idempotency: re-running on already-bundled sets is a no-op. The walk sees
// only 'working' and 'warmup' entries at the top level; bundled drops live
// inside working.drops[] and never match the `type === 'drop'` branch.
export function migrateSessionsToV5(sessions) {
  if (!Array.isArray(sessions) || !sessions.length) return sessions

  // Pass 1 — bundle consecutive drops into their preceding working set.
  const bundled = sessions.map(s => {
    if (!s?.data?.exercises) return s
    return {
      ...s,
      data: {
        ...s.data,
        exercises: s.data.exercises.map(ex => {
          if (!Array.isArray(ex.sets) || !ex.sets.length) return ex
          const out = []
          let parentIdx = -1  // index in `out` of the most recent working set
          for (const set of ex.sets) {
            const t = set?.type
            if (t === 'drop') {
              // Strip fields drops don't carry in the bundled shape.
              const { type: _t, isNewPR: _p, ...dropShape } = set
              if (parentIdx >= 0) {
                const parent = out[parentIdx]
                const drops = Array.isArray(parent.drops)
                  ? [...parent.drops, dropShape]
                  : [dropShape]
                out[parentIdx] = { ...parent, drops }
              } else {
                // Orphan drop — promote to working and make it the parent.
                out.push({ ...set, type: 'working', isNewPR: false })
                parentIdx = out.length - 1
              }
            } else if (t === 'warmup') {
              out.push(set)
              parentIdx = -1  // warmup breaks the drop chain
            } else {
              // 'working' or any other non-drop type (defensive).
              out.push(set)
              parentIdx = out.length - 1
            }
          }
          return { ...ex, sets: out }
        }),
      },
    }
  })

  // Pass 2 — recompute isNewPR chronologically, keyed off working primaries
  // only. Drops no longer compete for PR status (decision 3). Warmups never
  // have did (defensive clear in case a pre-migration warmup carried one).
  const prTracker = new Map()
  const updatesIdx = new Map()
  const ordered = bundled
    .map((s, i) => ({ s, i, t: new Date(s.date).getTime() }))
    .filter(x => x.s?.mode === 'bb' && x.s?.data?.exercises && !isNaN(x.t))
    .sort((a, b) => a.t - b.t)

  for (const { s, i } of ordered) {
    const updatedExes = s.data.exercises.map(ex => {
      const key = ex.exerciseId || ex.name
      let run = prTracker.get(key) || { maxWeight: 0, maxRepsAtMaxWeight: 0 }
      const updatedSets = (ex.sets || []).map(set => {
        if (set?.type !== 'working') {
          // Warmups (and any defensive stragglers) never have isNewPR set.
          if (set?.isNewPR) return { ...set, isNewPR: false }
          return set
        }
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

  return bundled.map((s, i) =>
    updatesIdx.has(i)
      ? { ...s, data: { ...s.data, exercises: updatesIdx.get(i) } }
      : s
  )
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

// ── Gym tagging helpers (Batch 20, spec §3.5) ─────────────────────────────
//
// Exercise records carry two optional gym-related arrays:
//   sessionGymTags:   gymIds where this exercise IS available
//   skipGymTagPrompt: gymIds where the user chose "Always skip" in the
//                     auto-tag-on-use prompt
// Neither array is set on built-in or pre-Batch-20 entries; the helpers
// here normalize "missing / empty / populated" into the §3.5 rules.

// Returns true if the exercise is considered available at gymId per §3.5.3:
//   - No gymId passed (caller isn't scoping by gym) → true
//   - Exercise has no sessionGymTags, or the array is empty → true
//     (spec: "empty or missing = available everywhere / unspecified")
//   - Exercise explicitly tags this gym → true
//   - Otherwise (tagged elsewhere but not here) → false
export function isExerciseAvailableAtGym(exercise, gymId) {
  if (!gymId) return true
  if (!exercise || typeof exercise !== 'object') return true
  const tags = Array.isArray(exercise.sessionGymTags) ? exercise.sessionGymTags : null
  if (!tags || tags.length === 0) return true
  return tags.includes(gymId)
}

// Batch 28: is this exercise explicitly hidden at this gym? Written by the
// GymTagPrompt's "Hide for this gym" button. Unlike sessionGymTags (allow-list),
// this is a per-gym deny-list — used by BbLogger to filter out the exercise
// from the current session's exercise list entirely.
export function isExerciseHiddenAtGym(exercise, gymId) {
  if (!gymId || !exercise || typeof exercise !== 'object') return false
  const list = Array.isArray(exercise.hiddenAtGyms) ? exercise.hiddenAtGyms : null
  if (!list || list.length === 0) return false
  return list.includes(gymId)
}

// Returns true when the auto-tag-on-use prompt should stay silent for this
// (exercise, gym) pair. The "Always skip" branch of the prompt (§3.5.4)
// writes the gymId into exercise.skipGymTagPrompt; this helper just reads it.
export function shouldSkipGymTagPrompt(exercise, gymId) {
  if (!exercise || !gymId) return false
  const skip = Array.isArray(exercise.skipGymTagPrompt) ? exercise.skipGymTagPrompt : null
  return !!skip && skip.includes(gymId)
}

// Batch 28 item 4 follow-up: greedy plate packer for plate-mode "Use it".
// Given a target total weight, bar weight, and multiplier (1× or 2×), return
// a plate breakdown that gets as close as possible. Uses the standard
// Olympic plate set [45, 35, 25, 10, 5, 2.5]. If the target can't be hit
// exactly (e.g., gym doesn't have 2.5s for a 7.5-per-side need), it rounds
// DOWN to the nearest achievable total so the user doesn't accidentally
// overshoot the recommendation.
export function recommendPlatesForWeight(targetTotal, barWeight, multiplier) {
  const AVAILABLE = [45, 35, 25, 10, 5, 2.5]
  const target = Number(targetTotal) || 0
  const bar    = Number(barWeight)   || 0
  const mult   = multiplier === 1 ? 1 : 2
  const remaining = target - bar
  if (remaining <= 0) return { plates: {}, actualTotal: bar }
  const perSide = mult === 2 ? remaining / 2 : remaining
  const plates = {}
  let loaded = 0
  let toFill = perSide
  for (const p of AVAILABLE) {
    while (toFill >= p - 0.0001) {
      plates[p] = (plates[p] || 0) + 1
      toFill -= p
      loaded += p
    }
  }
  return { plates, actualTotal: bar + mult * loaded }
}

// True when the UI should surface the auto-tag-on-use prompt (§3.5.4):
// a gym is set on the session, the exercise isn't already tagged there,
// and the user hasn't opted out of prompts for this pair. Pure boolean,
// no side effects.
export function shouldPromptGymTag(exercise, gymId) {
  if (!gymId || !exercise) return false
  const tags = Array.isArray(exercise.sessionGymTags) ? exercise.sessionGymTags : null
  if (tags && tags.includes(gymId)) return false
  if (shouldSkipGymTagPrompt(exercise, gymId)) return false
  return true
}

// Batch 27: "is this equipment a machine?" test that covers both the
// specific types (Selectorized Machine / Plate-loaded Machine) AND the
// legacy 'Machine' value (for pre-v6 library entries that somehow slip
// through the migration, and for defensive use in any edge case).
// Used by BbLogger's Machine-chip visibility gate.
export function isMachineEquipment(equip) {
  return equip === 'Selectorized Machine'
    || equip === 'Plate-loaded Machine'
    || equip === 'Machine'
}

// Batch 27 v5 → v6 library migration: rewrite any legacy `equipment: 'Machine'`
// entries to `'Selectorized Machine'` as the safer default (selectorized is
// the more common machine type at commercial gyms). Plate-loaded specifics
// are caught on the built-in raw data side (see data/exerciseLibrary.js);
// this handles user-created entries + pre-Batch-27 built-in copies that
// persisted before the raw-data update. Idempotent — re-running on a v6
// library finds no 'Machine' values and returns the input unchanged.
export function migrateLibraryToV6(library) {
  if (!Array.isArray(library)) return library
  let changed = 0
  const out = library.map(e => {
    if (e && e.equipment === 'Machine') {
      changed++
      return { ...e, equipment: 'Selectorized Machine' }
    }
    return e
  })
  return changed > 0 ? out : library
}

// Batch 30 v6 → v7 library migration: re-seed `defaultRepRange` per exercise
// classification (pre-v7 had [8, 12] hardcoded across every built-in) and add
// `repRangeUserSet: false` on every entry so the recommender knows whether to
// infer from history vs honor a user override. Idempotent — entries already
// carrying `repRangeUserSet` keep their `defaultRepRange` untouched; the flag
// means "user has engaged with this range via ExerciseEditSheet or the Your
// range edit link in the Recommendation sheet."
export function migrateLibraryToV7(library) {
  if (!Array.isArray(library)) return library
  let changed = 0
  const out = library.map(e => {
    if (!e || typeof e !== 'object') return e
    const patch = {}
    // Re-classify defaultRepRange only when the user hasn't engaged with it.
    if (!e.repRangeUserSet) {
      const classified = classifyRepRange(e.name, e.equipment, e.primaryMuscles)
      const current = Array.isArray(e.defaultRepRange) ? e.defaultRepRange : null
      if (!current || current[0] !== classified[0] || current[1] !== classified[1]) {
        patch.defaultRepRange = classified
      }
    }
    // Ensure the flag exists with a sane default. Existing true values stay.
    if (typeof e.repRangeUserSet !== 'boolean') {
      patch.repRangeUserSet = false
    }
    if (Object.keys(patch).length > 0) {
      changed++
      return { ...e, ...patch }
    }
    return e
  })
  return changed > 0 ? out : library
}

// Batch 37 — Hybrid training v1 foundation.
//
// classifyType(name): keyword-based type prediction for the 4 type values
// (weight-training | running | hyrox-station | hyrox-round). Mirrors
// classifyRepRange's structure — ordered map, first match wins, default
// 'weight-training'. Order matters: composite-round terms (most specific)
// fire before station singletons, which fire before generic running keywords.
// "Run + SkiErg Round" must classify as hyrox-round even though "skierg"
// alone is hyrox-station — composites win.
const TYPE_KEYWORD_MAP = [
  // ── HYROX round composites (most specific — match before stations) ──
  { kw: 'hyrox round',      type: 'hyrox-round' },
  { kw: 'hyrox simulation', type: 'hyrox-round' },
  { kw: 'simulation round', type: 'hyrox-round' },
  { kw: 'run + skierg',     type: 'hyrox-round' },
  { kw: 'run + sled',       type: 'hyrox-round' },
  // ── HYROX stations (8 catalog) ──
  { kw: 'skierg',           type: 'hyrox-station' },
  { kw: 'ski erg',          type: 'hyrox-station' },
  { kw: 'sled push',        type: 'hyrox-station' },
  { kw: 'sled pull',        type: 'hyrox-station' },
  { kw: 'burpee broad',     type: 'hyrox-station' },
  { kw: 'farmers carry',    type: 'hyrox-station' },
  { kw: 'farmer carry',     type: 'hyrox-station' },
  { kw: 'sandbag lunge',    type: 'hyrox-station' },
  { kw: 'wall ball',        type: 'hyrox-station' },
  { kw: 'rowing',           type: 'hyrox-station' },
  // ── Running / cardio ──
  { kw: 'easy run',         type: 'running' },
  { kw: 'incline walk',     type: 'running' },
  { kw: 'easy bike',        type: 'running' },
  { kw: 'treadmill',        type: 'running' },
  { kw: 'outdoor run',      type: 'running' },
  { kw: 'walk',             type: 'running' },
  { kw: 'bike',             type: 'running' },
  { kw: 'jog',              type: 'running' },
  { kw: 'run',              type: 'running' },
]

export function classifyType(name) {
  if (typeof name !== 'string') return 'weight-training'
  const n = name.toLowerCase().trim()
  if (!n) return 'weight-training'
  for (const { kw, type } of TYPE_KEYWORD_MAP) {
    if (n.includes(kw)) return type
  }
  return 'weight-training'
}

// defaultDimensionsForType(type): returns the dimension preset for non-station
// types. Stations have locked per-station dimensions handled directly by
// buildHyroxStationLibraryEntry in src/data/hyroxStations.js; this fallback
// fires only if a hyrox-station entry is created without a catalog match
// (shouldn't happen in v1 since the 8 are locked).
//
// Five axes: weight | reps | distance | time | intensity. `required` gates
// set/round completion. `unit` is descriptive — canonical conversion via §11.
export function defaultDimensionsForType(type) {
  switch (type) {
    case 'running':
      return [
        { axis: 'distance',  required: true,  unit: 'mi' },
        { axis: 'time',      required: true,  unit: 's'  },
        { axis: 'intensity', required: false             },
      ]
    case 'hyrox-station':
      return [{ axis: 'time', required: true, unit: 's' }]
    case 'hyrox-round':
      // Round-template entries use roundConfig (B38), not dimensions[].
      return []
    case 'weight-training':
    default:
      return [
        { axis: 'weight', required: true, unit: 'lbs' },
        { axis: 'reps',   required: true             },
      ]
  }
}

// Batch 37 v7 → v8 library migration. Adds `type` + `dimensions` fields to
// every existing entry (defaulting to weight-training) and seeds the 8 HYROX
// station entries if not already present. Idempotent — re-running on a v8
// state with all stations present and all entries typed produces the same
// array (returns the same reference when nothing changes, matching the
// migrateLibraryToV6 / V7 pattern).
//
// Note on station seeding: if a user manually created an exercise with one
// of the canonical station ids (sta_skierg etc.) before v8 lands, it gets
// preserved — we only seed station entries whose id is missing from the
// current library. The user's custom entry wins.
export function migrateLibraryToV8(library) {
  if (!Array.isArray(library)) return library
  let changed = 0

  // Pass 1: type + dimensions on existing entries
  const patched = library.map(e => {
    if (!e || typeof e !== 'object') return e
    const patch = {}
    if (typeof e.type !== 'string') {
      patch.type = 'weight-training'
    }
    if (!Array.isArray(e.dimensions)) {
      patch.dimensions = defaultDimensionsForType(e.type || patch.type || 'weight-training')
    }
    if (Object.keys(patch).length > 0) {
      changed++
      return { ...e, ...patch }
    }
    return e
  })

  // Pass 2: seed missing stations
  const existingIds = new Set(patched.map(e => e?.id).filter(Boolean))
  const missing = HYROX_STATIONS
    .filter(st => !existingIds.has(st.id))
    .map(st => buildHyroxStationLibraryEntry(st))

  if (missing.length === 0 && changed === 0) return library
  return [...patched, ...missing]
}

// ── Unit conversions (Batch 38, design doc §11) ────────────────────────────
//
// User-facing input units stay imperial: lbs for weight (no kg-weighted
// plates at U.S. commercial gyms) + miles for runs. Metric values are
// derived alongside at save time so HYROX features (race-pace, race-weight
// rehearsal) and future unit-toggle UI can read them without reconversion.
// 3-decimal precision per §11.2.

export const LBS_TO_KG = 0.45359237
export const MILES_TO_METERS = 1609.344

// Round to 3 decimals to keep storage tidy (§11.2). Helper exists so all
// metric derivations land at the same precision.
function round3(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  return Math.round(n * 1000) / 1000
}

export function lbsToKg(lbs) {
  if (lbs == null) return null
  const n = Number(lbs)
  if (!Number.isFinite(n)) return null
  return round3(n * LBS_TO_KG)
}

export function kgToLbs(kg) {
  if (kg == null) return null
  const n = Number(kg)
  if (!Number.isFinite(n)) return null
  return round3(n / LBS_TO_KG)
}

export function milesToMeters(mi) {
  if (mi == null) return null
  const n = Number(mi)
  if (!Number.isFinite(n)) return null
  return Math.round(n * MILES_TO_METERS) // meters: integer per §11.2
}

export function metersToMiles(m) {
  if (m == null) return null
  const n = Number(m)
  if (!Number.isFinite(n)) return null
  return round3(n / MILES_TO_METERS)
}

// ── Session shapes (Batch 38, design doc §4 + §11) ─────────────────────────
//
// LoggedSet schema (additive on the existing weight-training shape):
//   {
//     type: 'warmup' | 'working',
//     reps: number,
//     weight: number,                // lbs (canonical for weight-training)
//     rawWeight: number,             // per-side load when unilateral
//     weightKg?: number,             // Batch 38: derived at save time
//     rawWeightKg?: number,          //   "         "        "
//     isNewPR: boolean,
//     plates?, barWeight?, plateMultiplier?,
//     drops?: LoggedSet[],           // Batch 22 nested drops
//     // Batch 38 — running / hyrox-station optional dimension fields:
//     distanceMiles?: number,
//     distanceMeters?: number,
//     timeSec?: number,
//     intensity?: 'easy'|'moderate'|'hard'|'allout',
//   }
//
// LoggedHyroxRound (new in Batch 38, lives inside LoggedExercise.rounds[]
// for type=hyrox-round library entries):
//   {
//     roundIndex: number,            // 1-based for display
//     legs: [
//       { type: 'run',     distanceMiles, distanceMeters, timeSec, completedAt },
//       { type: 'station', stationId, distanceMeters?, timeSec?, weight?, weightKg?, reps?, completedAt },
//     ],                              // v1: length 2 (run → station). §4.5 generalizes.
//     restAfterSec: number,
//     completedAt: number,
//   }
//
// LoggedExercise for type=hyrox-round carries `rounds: LoggedHyroxRound[]`
// + session-level prescription overrides (`prescribedRoundCount`,
// `prescribedStationId`, `prescribedRunDistanceMeters`). The B38 migration
// doesn't synthesize any of this — no HYROX data exists pre-v9 — but the
// shape is documented here so B41+ surfaces stay consistent.

// Batch 38 v8 → v9 session migration. Two passes — sessions, then cardio.
//
// Sessions pass: walks every weight-training set (top-level + nested drops)
// and adds derived `weightKg` / `rawWeightKg` alongside the existing lbs
// fields. Idempotent — sets that already carry weightKg are skipped, so
// re-running on v9 data is a no-op (returns the same array reference if no
// fields were added). Pre-Batch-22 flat-drops are no longer expected at the
// top level (v5 migration nested them), but we defensively check the parent
// type guard anyway.
//
// Doesn't touch HYROX rounds (`session.data.exercises[].rounds[]`) because
// no v8 data has them yet — those are written natively in v9-shape from B43
// onward.
export function migrateSessionsToV9(sessions) {
  if (!Array.isArray(sessions)) return sessions
  let changed = 0
  const out = sessions.map(s => {
    if (!s || typeof s !== 'object' || !s.data || !Array.isArray(s.data.exercises)) return s
    let sessionChanged = false
    const exercises = s.data.exercises.map(ex => {
      if (!ex || !Array.isArray(ex.sets)) return ex
      let exChanged = false
      const sets = ex.sets.map(set => {
        if (!set || typeof set !== 'object') return set
        const patch = {}
        if (typeof set.weight === 'number' && typeof set.weightKg !== 'number') {
          patch.weightKg = lbsToKg(set.weight)
        }
        if (typeof set.rawWeight === 'number' && typeof set.rawWeightKg !== 'number') {
          patch.rawWeightKg = lbsToKg(set.rawWeight)
        }
        // Nested drops (Batch 22 bundled shape)
        let dropsChanged = false
        const drops = Array.isArray(set.drops)
          ? set.drops.map(d => {
              if (!d || typeof d !== 'object') return d
              const dpatch = {}
              if (typeof d.weight === 'number' && typeof d.weightKg !== 'number') {
                dpatch.weightKg = lbsToKg(d.weight)
              }
              if (typeof d.rawWeight === 'number' && typeof d.rawWeightKg !== 'number') {
                dpatch.rawWeightKg = lbsToKg(d.rawWeight)
              }
              if (Object.keys(dpatch).length > 0) {
                dropsChanged = true
                return { ...d, ...dpatch }
              }
              return d
            })
          : set.drops
        if (Object.keys(patch).length > 0 || dropsChanged) {
          exChanged = true
          return dropsChanged
            ? { ...set, ...patch, drops }
            : { ...set, ...patch }
        }
        return set
      })
      if (exChanged) {
        sessionChanged = true
        return { ...ex, sets }
      }
      return ex
    })
    if (sessionChanged) {
      changed++
      return { ...s, data: { ...s.data, exercises } }
    }
    return s
  })
  return changed > 0 ? out : sessions
}

// Batch 38 v8 → v9 cardio migration. Adds `distanceMiles` + `distanceMeters`
// alongside the existing free-form `distance` + `distanceUnit` fields when
// the unit is 'miles' (Running / Walking / Treadmill per CardioLogger's
// getDistanceUnit). Other units ('floors' for Stairmaster; null for
// Stairmaster/Bike/custom types) are left as-is — they're not length axes.
// Idempotent.
export function migrateCardioSessionsToV9(cardioSessions) {
  if (!Array.isArray(cardioSessions)) return cardioSessions
  let changed = 0
  const out = cardioSessions.map(c => {
    if (!c || typeof c !== 'object') return c
    if (c.distanceUnit !== 'miles') return c
    if (typeof c.distance !== 'number') return c
    const patch = {}
    if (typeof c.distanceMiles !== 'number') {
      patch.distanceMiles = round3(c.distance)
    }
    if (typeof c.distanceMeters !== 'number') {
      patch.distanceMeters = milesToMeters(c.distance)
    }
    if (Object.keys(patch).length > 0) {
      changed++
      return { ...c, ...patch }
    }
    return c
  })
  return changed > 0 ? out : cardioSessions
}

// Per-session top set for an exercise — the working set with the highest
// e1RM. Skips warmups; drop sets count (same per-side load as the parent
// working set is fine for fit purposes). Returns chronological ascending.
// Prefers exerciseId when present; falls back to name match for pre-v3
// sessions that haven't been migrated through the live persist hook yet.
// rpe (1–10, optional) carried through when set so Layer 3's Δreps can
// factor in reps-in-reserve (§3.7).
// equipmentInstance (spec §3.4, Batch 19) — optional scoping. When a
// non-empty string is passed, only sessions whose matching LoggedExercise
// carries that same instance (case-insensitive) contribute; history items
// also echo the instance string for downstream detectors. When null/empty,
// all sessions contribute (pre-Batch-19 behavior).
// gymId (spec §3.5.6, Batch 20) — optional scoping. When passed, only
// sessions whose `session.gymId` matches contribute; history items also
// echo the session's gymId for downstream consumers. Sessions without a
// gymId are treated as "unspecified" and do NOT match a scoped query —
// callers that want to fall back to all history (§3.5.6 rule) should
// widen the scope themselves (same pattern as the equipmentInstance
// <3-session fallback BbLogger does for machines).
// instance + gym compose with AND — passing both restricts to sessions
// matching the specific machine AT the specific gym.
export function getExerciseHistory(sessions, exerciseId, exerciseName = null, equipmentInstance = null, gymId = null) {
  if (!Array.isArray(sessions) || !exerciseId) return []
  const instNeedle = typeof equipmentInstance === 'string' ? equipmentInstance.trim().toLowerCase() : ''
  const scopeByInstance = instNeedle.length > 0
  const gymNeedle = typeof gymId === 'string' ? gymId.trim() : ''
  const scopeByGym = gymNeedle.length > 0
  const out = []
  for (const s of sessions) {
    if (s?.mode !== 'bb' || !s?.data?.exercises) continue
    if (scopeByGym && s.gymId !== gymNeedle) continue
    const ex = s.data.exercises.find(e =>
      e.exerciseId === exerciseId ||
      (exerciseName && e.name === exerciseName)
    )
    if (!ex) continue
    const exInstRaw = typeof ex.equipmentInstance === 'string' ? ex.equipmentInstance.trim() : ''
    const exInstKey = exInstRaw.toLowerCase()
    if (scopeByInstance && exInstKey !== instNeedle) continue
    // Top-set selection walks working primaries only (Batch 22 decision 3).
    // Drop stages are nested inside set.drops[] under the bundled model and
    // never compete for top-e1RM — they're fatigue work, not strength data.
    const working = (ex.sets || []).filter(st =>
      st.type === 'working' &&
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
          equipmentInstance: exInstRaw || null,
          gymId:  typeof s.gymId === 'string' && s.gymId ? s.gymId : null,
        }
      }
    }
    if (top) out.push({ date: s.date, ...top })
  }
  return out.sort((a, b) => new Date(a.date) - new Date(b.date))
}

// getInstancesForExercise(sessions, exerciseId, exerciseName?, gymId?)
//
// Returns distinct non-empty equipmentInstance strings for this exercise
// across all bb sessions, most recent first, deduplicated case-insensitively
// while preserving the user's original casing of the first (most-recent)
// occurrence. Used by the Machine picker on the exercise card to show
// previously-used instances without forcing the user to retype them.
// gymId (Batch 20): when passed, only sessions at that gym contribute —
// so at VASA you see "Hoist", at TR you see "Cybex", without the two
// locations' machines getting confused for each other.
export function getInstancesForExercise(sessions, exerciseId, exerciseName = null, gymId = null) {
  if (!Array.isArray(sessions) || !exerciseId) return []
  const gymNeedle = typeof gymId === 'string' ? gymId.trim() : ''
  const scopeByGym = gymNeedle.length > 0
  const sorted = sessions
    .filter(s => s?.mode === 'bb' && s?.data?.exercises)
    .filter(s => !scopeByGym || s.gymId === gymNeedle)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  const seen = new Set()
  const out = []
  for (const s of sorted) {
    const ex = s.data.exercises.find(e =>
      e.exerciseId === exerciseId ||
      (exerciseName && e.name === exerciseName)
    )
    if (!ex) continue
    const inst = typeof ex.equipmentInstance === 'string' ? ex.equipmentInstance.trim() : ''
    if (!inst) continue
    const key = inst.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(inst)
  }
  return out
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

// ── Rep-range classification + inference (Batches 30 + 31) ─────────────────
//
// Rep ranges drive the recommender's "when to push" vs "when to back off"
// decision. Instead of a single hardcoded targetReps=10 (pre-Batch-30), each
// exercise now has a [min, max] range:
//   reps >= max          → push weight up next session
//   reps < min           → below-floor warning (2 consecutive → soft advisory)
//   min ≤ reps < max     → hold weight, keep training
//
// Effective range resolution order (inside BbLogger's recRepRange memo):
//   1. library.defaultRepRange if repRangeUserSet === true — user override
//   2. inferRepRange(history, classificationDefault) — derived from the user's
//      own last 6 top-set rep counts; reflects their actual training pattern
//   3. classifyRepRange(name, equipment, primaryMuscles) — cold-start default
//      when history has < 4 sessions.

// Keyword map for classifyRepRange. Order matters — specific terms before
// generic. Mirrors the EXERCISE_KEYWORD_MAP pattern used by predictExerciseMeta.
const REP_RANGE_KEYWORD_MAP = [
  // ── Higher-rep bodies first (calves, forearms, delts, core) ──
  { kw: 'calf raise',      range: [10, 15] },
  { kw: 'seated calf',     range: [10, 15] },
  { kw: 'standing calf',   range: [10, 15] },
  { kw: 'donkey calf',     range: [10, 15] },
  { kw: 'forearm',         range: [10, 15] },
  { kw: 'wrist curl',      range: [10, 15] },
  { kw: 'lateral raise',   range: [10, 15] },
  { kw: 'side raise',      range: [10, 15] },
  { kw: 'rear delt',       range: [10, 15] },
  { kw: 'reverse pec',     range: [10, 15] },
  { kw: 'face pull',       range: [10, 15] },
  { kw: 'crunch',          range: [10, 15] },
  { kw: 'sit-up',          range: [10, 15] },
  { kw: 'situp',           range: [10, 15] },
  { kw: 'leg raise',       range: [10, 15] },
  { kw: 'plank',           range: [10, 15] },
  { kw: 'russian twist',   range: [10, 15] },
  { kw: 'ab wheel',        range: [10, 15] },

  // ── Compound barbell lifts — strength-biased [5, 8] ──
  { kw: 'back squat',      range: [5, 8] },
  { kw: 'front squat',     range: [5, 8] },
  { kw: 'squat',           range: [5, 8] },
  { kw: 'romanian deadlift', range: [5, 8] },
  { kw: 'rdl',             range: [5, 8] },
  { kw: 'deadlift',        range: [5, 8] },
  { kw: 'bench press',     range: [5, 8] },
  { kw: 'barbell row',     range: [5, 8] },
  { kw: 'overhead press',  range: [5, 8] },
  { kw: 'military press',  range: [5, 8] },

  // ── DB / machine press + row + pulldown — medium [6, 10] ──
  { kw: 'db press',        range: [6, 10] },
  { kw: 'dumbbell press',  range: [6, 10] },
  { kw: 'incline db',      range: [6, 10] },
  { kw: 'incline dumbbell', range: [6, 10] },
  { kw: 'db row',          range: [6, 10] },
  { kw: 'dumbbell row',    range: [6, 10] },
  { kw: 'cable row',       range: [6, 10] },
  { kw: 'seated row',      range: [6, 10] },
  { kw: 'chest row',       range: [6, 10] },
  { kw: 'lat pulldown',    range: [6, 10] },
  { kw: 'pulldown',        range: [6, 10] },
  { kw: 'chest press',     range: [6, 10] },
  { kw: 'shoulder press',  range: [6, 10] },
  { kw: 'pec dec',         range: [6, 10] },
  { kw: 'pec deck',        range: [6, 10] },
  { kw: 'leg press',       range: [6, 10] },
  { kw: 'hack squat',      range: [6, 10] },
  { kw: 'pull-up',         range: [6, 10] },
  { kw: 'pullup',          range: [6, 10] },
  { kw: 'chin-up',         range: [6, 10] },
  { kw: 'chinup',          range: [6, 10] },
  { kw: 'dip',             range: [6, 10] },

  // ── Isolation / smaller moves — hypertrophy [8, 12] ──
  { kw: 'bicep curl',      range: [8, 12] },
  { kw: 'curl',            range: [8, 12] },
  { kw: 'tricep extension',range: [8, 12] },
  { kw: 'overhead extension', range: [8, 12] },
  { kw: 'extension',       range: [8, 12] },
  { kw: 'leg extension',   range: [8, 12] },
  { kw: 'leg curl',        range: [8, 12] },
  { kw: 'pushdown',        range: [8, 12] },
  { kw: 'shrug',           range: [8, 12] },
  { kw: 'pullover',        range: [8, 12] },
  { kw: 'fly',             range: [8, 12] },
  { kw: 'flye',            range: [8, 12] },
  { kw: 'hip thrust',      range: [8, 12] },
  { kw: 'glute bridge',    range: [8, 12] },
  { kw: 'adductor',        range: [8, 12] },
  { kw: 'abductor',        range: [8, 12] },
]

// classifyRepRange(name, equipment, primaryMuscles) → [min, max]
//
// Cold-start default used when the user has < 4 sessions of history on an
// exercise. Returns a NEW array each call so callers can safely mutate it.
export function classifyRepRange(name, equipment, primaryMuscles) {
  const n = String(name || '').toLowerCase()
  for (const { kw, range } of REP_RANGE_KEYWORD_MAP) {
    if (n.includes(kw)) return [range[0], range[1]]
  }
  // Equipment fallback: barbell → strength-biased.
  if (equipment === 'Barbell') return [5, 8]
  // Muscle fallback: calves + forearms → higher reps.
  const muscles = (primaryMuscles || []).map(m => String(m || '').toLowerCase())
  if (muscles.some(m => m === 'calves' || m === 'forearms')) return [10, 15]
  // Default hypertrophy range.
  return [8, 12]
}

// inferRepRange(history, classificationDefault) → [min, max]
//
// Pulls the rep range from the user's actual recent training pattern — last
// 6 top-set rep counts. Falls back to the classification default when history
// is too thin (< 4 sessions) to produce a stable inference.
//
//   min = worst rep count in the recent window (what they've bottomed out at)
//   max = best rep count + 1 (gives a ceiling to push toward)
//
// Clamped to [3, 25] for sanity. Returns a fresh array.
export function inferRepRange(history, classificationDefault) {
  const fallback = Array.isArray(classificationDefault) && classificationDefault.length === 2
    ? [classificationDefault[0], classificationDefault[1]]
    : [8, 12]
  if (!Array.isArray(history)) return fallback
  const reps = history
    .slice(-6)
    .map(h => Number(h?.reps) || 0)
    .filter(r => r > 0)
    .sort((a, b) => a - b)
  if (reps.length < 4) return fallback
  const min = Math.max(3, reps[0])
  const max = Math.min(25, reps[reps.length - 1] + 1)
  // Guard against pathological cases where min ≥ max (e.g. all sets at 3 reps
  // → min=3, max=4 after +1 = still OK; all sets at 25 → min=25, max=25 after
  // clamp. Nudge max up by 1 when the two collide so the range is never empty).
  return min < max ? [min, max] : [min, Math.min(25, min + 1)]
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
  // Batch 30 — per-exercise [min, max] rep range. Drives push/hold/back-off
  // decision. Callers resolve via library.defaultRepRange (user override) or
  // inferRepRange(history, classificationDefault). When unset → [8, 12].
  repRange         = null,
  // Legacy pre-Batch-30 API — single target rep count. When passed without a
  // repRange, a synthetic [max-2, max] range is derived so legacy callers
  // retain their approximate behavior. New callers should use repRange.
  targetReps       = null,
  mode             = 'push',
  progressionClass = 'isolation',
  loadIncrement    = 5,
  // Readiness modulation (spec §2.5, Batch 16n). 0.85 = low energy/sleep,
  // 1.00 = typical, 1.15 = great readiness. Scales push-mode aggressiveness
  // constant (base 1.15) so a tired day nudges less than a fresh day. No
  // effect in maintain/deload modes.
  aggressivenessMultiplier = 1,
  // Fatigue signals (spec §4, Batch 16o). All optional, all default to no-op.
  //   priorGrade:      'A+'|'A'|'B'|'C'|'D'|null — most recent bb session's grade
  //   cardioRecent:    { intensity, hoursAgo } | null — only "allout" <24h damps
  //   restedYesterday: bool — rest day logged within 36h
  fatigueSignals = {},
  now              = Date.now(),
} = {}) {
  // Resolve effective [min, max]. repRange wins; targetReps legacy path
  // synthesizes [max-2, max] with min floor of 3; neither → [8, 12].
  let rawMin, rawMax
  if (Array.isArray(repRange) && repRange.length === 2) {
    rawMin = Number(repRange[0]) || 0
    rawMax = Number(repRange[1]) || 0
  } else if (typeof targetReps === 'number' && targetReps > 0) {
    rawMax = targetReps
    rawMin = Math.max(3, targetReps - 2)
  } else {
    rawMin = 8
    rawMax = 12
  }
  const minReps = Math.max(1, Math.min(rawMin, rawMax))
  const maxReps = Math.max(minReps, rawMax)
  // Push-nudge + Layer 2 %1RM target uses the ceiling — that's when we push.
  const effectiveTarget = maxReps

  const h = Array.isArray(history) ? history : []
  const n = h.length

  if (n === 0) {
    return {
      mode,
      confidence: 'none',
      prescription: null,
      reasoning:  `No prior sessions logged — pick a weight you can do for ${minReps}–${maxReps} clean reps.`,
      meta: { n: 0, rSquared: 0, repRange: [minReps, maxReps] },
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
      meta: { n, rSquared: 0, daysSince: Math.max(0, Math.round((now - new Date(last.date).getTime()) / 86400000)), repRange: [minReps, maxReps] },
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

  const layer2Weight = currentE1RM * percent1RM(effectiveTarget)

  // Below-floor streak detection (Batch 30). Replaces the pre-Batch-30
  // auto-deload silent override. Detects 2 consecutive sessions where the
  // user came in below their own declared floor; feeds the soft advisory
  // banner rendered in Batch 31.3 — does NOT rewrite the push prescription.
  // RPE-aware via effectiveReps (reps + RIR) when available.
  const effReps = p => {
    const rir = p.rpe ? Math.max(0, 10 - p.rpe) : 0
    return p.reps + rir
  }
  const lastTwo = h.slice(-2)
  const belowFloorStreak = lastTwo.length >= 2 && lastTwo.every(p => effReps(p) < minReps) ? 2 : 0

  // Suggested soft-deload weight: one loadIncrement below last weight, floored
  // at one increment. Used by the advisory banner AND by the user-declared
  // `deload` mode (which previously returned 65% of e1RM — too aggressive for
  // most users; one-step-down is the softer option that respects the
  // exercise's own loadIncrement).
  const inc = Number(loadIncrement) > 0 ? Number(loadIncrement) : 5
  const suggestedDeloadWeight = Math.max(inc, Math.round((last.weight - inc) / inc) * inc)

  let prescriptionWeight
  let reasoning
  let effectiveMode = mode

  if (mode === 'deload') {
    // User explicitly picked Recover. One increment below last weight — soft,
    // respects loadIncrement per-exercise. No fatigue multipliers apply
    // (user already declared intent to back off).
    prescriptionWeight = suggestedDeloadWeight
    reasoning          = `Recovery day. One step below last session — aim for clean reps at ${suggestedDeloadWeight} today.`
  } else if (mode === 'maintain') {
    // Layer 2 only — no nudge, no fatigue, no gap adjustment. Match strength.
    prescriptionWeight = layer2Weight
    const layer2Round  = Math.round(layer2Weight)
    reasoning          = `Matching your current strength level: ${Math.round(currentE1RM)} lb e1RM projects to ${layer2Round} for ${maxReps} reps.`
  } else {
    // Push (default) — Layer 3 nudge with aggressiveness 1.15, clamped to
    // Layer 2 floor. Readiness + fatigue multipliers stack onto the
    // aggressiveness coefficient.
    const readinessMult = Number(aggressivenessMultiplier) || 1
    const gradeMult     = gradeMultiplier(fatigueSignals.priorGrade)
    const cardioMult    = cardioDamping(fatigueSignals.cardioRecent)
    const restMult      = fatigueSignals.restedYesterday ? 1.05 : 1.00
    const gap           = gapAdjustment(daysSince)
    const fatigueMult   = gradeMult * cardioMult * restMult
    const aggressiveness = 1.15 * readinessMult * fatigueMult
    const P             = Math.min(personalRate * aggressiveness, 0.03)
    const alpha         = Math.min(daysSince / 7, gap.alphaCap)

    // Range-aware decision (Batch 30):
    //   reps >= max    → push nudge
    //   min ≤ reps < max → hold weight, "in range"
    //   reps < min     → hold weight, "below floor" (advisory fires if 2x)
    const lastRIR          = last.rpe ? Math.max(0, 10 - last.rpe) : 0
    const effectiveRepsNow = last.reps + lastRIR
    const hitTarget        = last.reps >= maxReps || effectiveRepsNow >= maxReps
    const inRange          = !hitTarget && last.reps >= minReps
    const belowFloor       = !hitTarget && last.reps < minReps

    if (hitTarget) {
      const deltaReps    = effectiveRepsNow - maxReps
      const layer3Weight = last.weight * (1 + P * alpha) + 0.033 * last.weight * deltaReps
      prescriptionWeight = Math.max(layer3Weight, layer2Weight)
      const e1rmRounded  = Math.round(currentE1RM)
      const layer2Round  = Math.round(layer2Weight)
      if (layer2Weight >= layer3Weight) {
        // Floor-driven: user's strength projection exceeds last session's load.
        if (layer2Round > last.weight) {
          reasoning = `Your recent top sets put your estimated 1-rep max around ${e1rmRounded} lbs, which projects to ${layer2Round} for ${maxReps} reps (the top of your ${minReps}–${maxReps} range). Last session you went ${last.weight}×${last.reps}, lighter than your strength suggests, so today's weight catches you back up.`
        } else {
          reasoning = `Matching your current strength level: ${e1rmRounded} lb e1RM projects to ${layer2Round} for ${maxReps} reps, right around last session's ${last.weight}×${last.reps}.`
        }
      } else {
        // Nudge-driven: at the ceiling of the range, add load gradually.
        const bumpLbs = Math.max(0, Math.round(layer3Weight - last.weight))
        reasoning = `You hit ${last.weight}×${last.reps} last session, at the top of your ${minReps}–${maxReps} range. Bumping load by +${bumpLbs} lbs today based on your progression trend (capped at +3% per elapsed week).`
      }
    } else if (inRange) {
      prescriptionWeight = Math.max(last.weight, layer2Weight)
      reasoning          = `You hit ${last.weight}×${last.reps} last session, inside your ${minReps}–${maxReps} range. Same weight today — keep adding reps before adding load.`
    } else {
      // belowFloor branch. Holds weight either way; reasoning differs on streak.
      prescriptionWeight = Math.max(last.weight, layer2Weight)
      if (belowFloorStreak === 2) {
        // Reasoning stays neutral — the Batch 31.3 advisory banner carries
        // the "consider a lighter reset day" copy separately so we don't
        // duplicate that message here.
        reasoning = `You hit ${last.weight}×${last.reps} last session, below your ${minReps}-rep floor. Holding the weight — aim for ${minReps}+ clean reps today.`
      } else {
        reasoning = `You hit ${last.weight}×${last.reps} last session, below your ${minReps}-rep floor. One sub-floor session is fine: same weight today, aim for ${minReps}+.`
      }
    }

    // Gap adjustment — tempers the final prescription when away >10 days.
    if (gap.mult < 1.0) {
      prescriptionWeight = prescriptionWeight * gap.mult
    }

    // Fatigue prefix: one-sentence lead when a signal materially moved things.
    const prefix = buildFatigueReasoningPrefix({
      gradeMult, cardioMult, restMult, gap, daysSince,
      priorGrade: fatigueSignals.priorGrade,
      cardioRecent: fatigueSignals.cardioRecent,
    })
    if (prefix) reasoning = `${prefix} ${reasoning}`
  }

  const rounded = Math.round(prescriptionWeight / inc) * inc

  // This-session nudge pct for the Details pane. 0 in maintain/deload modes.
  const composedMult = (Number(aggressivenessMultiplier) || 1)
    * gradeMultiplier(fatigueSignals.priorGrade)
    * cardioDamping(fatigueSignals.cardioRecent)
    * (fatigueSignals.restedYesterday ? 1.05 : 1.00)
  const gapForMeta = gapAdjustment(daysSince)
  const thisSessionNudgePct = mode === 'push'
    ? Math.min(personalRate * 1.15 * composedMult, 0.03) * Math.min(daysSince / 7, gapForMeta.alphaCap) * 100
    : 0

  return {
    mode: effectiveMode,
    confidence,
    prescription: { weight: rounded, reps: maxReps },
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
      // Batch 30 additions — drive the Your-range row (31.1), advisory
      // banner (31.3), and future reasoning surfaces.
      repRange:              [minReps, maxReps],
      belowFloorStreak,
      suggestedDeloadWeight,
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

// ── Exercise metadata prediction (Step 11) ─────────────────────────────────

// Keyword-to-meta map for the CreateExerciseModal auto-fill. Order matters:
// the first rule whose keyword is found in the normalized name wins. Short
// generic keywords ("row", "press", "curl") go last so the more specific
// compound terms ("leg press", "bench press") fire first. Callers should
// treat the result as a suggestion: tapping any muscle/equipment chip should
// override the prediction and stop future auto-fills on the same edit.
const EXERCISE_KEYWORD_MAP = [
  // ── HYROX stations (B37) — must match before generic fallbacks like "row" ──
  { kw: 'skierg',             muscles: ['Full Body'],   equipment: 'Other',                type: 'hyrox-station' },
  { kw: 'ski erg',            muscles: ['Full Body'],   equipment: 'Other',                type: 'hyrox-station' },
  { kw: 'sled push',          muscles: ['Full Body'],   equipment: 'Other',                type: 'hyrox-station' },
  { kw: 'sled pull',          muscles: ['Full Body'],   equipment: 'Other',                type: 'hyrox-station' },
  { kw: 'burpee broad',       muscles: ['Full Body'],   equipment: 'Other',                type: 'hyrox-station' },
  { kw: 'farmers carry',      muscles: ['Full Body'],   equipment: 'Other',                type: 'hyrox-station' },
  { kw: 'farmer carry',       muscles: ['Full Body'],   equipment: 'Other',                type: 'hyrox-station' },
  { kw: 'sandbag lunge',      muscles: ['Full Body'],   equipment: 'Other',                type: 'hyrox-station' },
  { kw: 'wall ball',          muscles: ['Full Body'],   equipment: 'Other',                type: 'hyrox-station' },
  // ── Specific compound terms first ──
  { kw: 'leg press',          muscles: ['Quads'],       equipment: 'Plate-loaded Machine', type: 'weight-training' },
  { kw: 'hack squat',         muscles: ['Quads'],       equipment: 'Plate-loaded Machine', type: 'weight-training' },
  { kw: 'leg extension',      muscles: ['Quads'],       equipment: 'Selectorized Machine', type: 'weight-training' },
  { kw: 'leg curl',           muscles: ['Hamstrings'],  equipment: 'Selectorized Machine', type: 'weight-training' },
  { kw: 'romanian deadlift',  muscles: ['Hamstrings'],  equipment: 'Barbell',              type: 'weight-training' },
  { kw: 'rdl',                muscles: ['Hamstrings'],  equipment: 'Barbell',              type: 'weight-training' },
  { kw: 'deadlift',           muscles: ['Back'],        equipment: 'Barbell',              type: 'weight-training' },
  { kw: 'good morning',       muscles: ['Hamstrings'],  equipment: 'Barbell',              type: 'weight-training' },
  { kw: 'calf raise',         muscles: ['Calves'],      equipment: 'Selectorized Machine', type: 'weight-training' },
  { kw: 'hip thrust',         muscles: ['Glutes'],      equipment: 'Barbell',              type: 'weight-training' },
  { kw: 'glute bridge',       muscles: ['Glutes'],      equipment: 'Bodyweight',           type: 'weight-training' },
  { kw: 'bench press',        muscles: ['Chest'],       equipment: 'Barbell',              type: 'weight-training' },
  { kw: 'chest press',        muscles: ['Chest'],       equipment: 'Selectorized Machine', type: 'weight-training' },
  { kw: 'chest fly',          muscles: ['Chest'],       equipment: 'Cable',                type: 'weight-training' },
  { kw: 'pec dec',            muscles: ['Chest'],       equipment: 'Selectorized Machine', type: 'weight-training' },
  { kw: 'pec deck',           muscles: ['Chest'],       equipment: 'Selectorized Machine', type: 'weight-training' },
  { kw: 'dips',               muscles: ['Chest'],       equipment: 'Bodyweight',           type: 'weight-training' },
  { kw: 'push-up',            muscles: ['Chest'],       equipment: 'Bodyweight',           type: 'weight-training' },
  { kw: 'pushup',             muscles: ['Chest'],       equipment: 'Bodyweight',           type: 'weight-training' },
  { kw: 'push up',            muscles: ['Chest'],       equipment: 'Bodyweight',           type: 'weight-training' },
  { kw: 'lat pulldown',       muscles: ['Back'],        equipment: 'Cable',                type: 'weight-training' },
  { kw: 'pulldown',           muscles: ['Back'],        equipment: 'Cable',                type: 'weight-training' },
  { kw: 'pull-up',            muscles: ['Back'],        equipment: 'Bodyweight',           type: 'weight-training' },
  { kw: 'pullup',             muscles: ['Back'],        equipment: 'Bodyweight',           type: 'weight-training' },
  { kw: 'pull up',            muscles: ['Back'],        equipment: 'Bodyweight',           type: 'weight-training' },
  { kw: 'chin-up',            muscles: ['Back'],        equipment: 'Bodyweight',           type: 'weight-training' },
  { kw: 'chinup',             muscles: ['Back'],        equipment: 'Bodyweight',           type: 'weight-training' },
  { kw: 'face pull',          muscles: ['Shoulders'],   equipment: 'Cable',                type: 'weight-training' },
  { kw: 'lateral raise',      muscles: ['Shoulders'],   equipment: 'Dumbbell',             type: 'weight-training' },
  { kw: 'front raise',        muscles: ['Shoulders'],   equipment: 'Dumbbell',             type: 'weight-training' },
  { kw: 'rear delt',          muscles: ['Shoulders'],   equipment: 'Selectorized Machine', type: 'weight-training' },
  { kw: 'overhead press',     muscles: ['Shoulders'],   equipment: 'Barbell',              type: 'weight-training' },
  { kw: 'military press',     muscles: ['Shoulders'],   equipment: 'Barbell',              type: 'weight-training' },
  { kw: 'shoulder press',     muscles: ['Shoulders'],   equipment: 'Dumbbell',             type: 'weight-training' },
  { kw: 'shrug',              muscles: ['Traps'],       equipment: 'Dumbbell',             type: 'weight-training' },
  { kw: 'bicep curl',         muscles: ['Biceps'],      equipment: 'Dumbbell',             type: 'weight-training' },
  { kw: 'hammer curl',        muscles: ['Biceps'],      equipment: 'Dumbbell',             type: 'weight-training' },
  { kw: 'preacher curl',      muscles: ['Biceps'],      equipment: 'Barbell',              type: 'weight-training' },
  { kw: 'tricep pushdown',    muscles: ['Triceps'],     equipment: 'Cable',                type: 'weight-training' },
  { kw: 'tricep extension',   muscles: ['Triceps'],     equipment: 'Dumbbell',             type: 'weight-training' },
  { kw: 'skull crusher',      muscles: ['Triceps'],     equipment: 'Barbell',              type: 'weight-training' },
  { kw: 'close grip bench',   muscles: ['Triceps'],     equipment: 'Barbell',              type: 'weight-training' },
  { kw: 'plank',              muscles: ['Core'],        equipment: 'Bodyweight',           type: 'weight-training' },
  { kw: 'crunch',             muscles: ['Core'],        equipment: 'Bodyweight',           type: 'weight-training' },
  { kw: 'sit-up',             muscles: ['Core'],        equipment: 'Bodyweight',           type: 'weight-training' },
  { kw: 'situp',              muscles: ['Core'],        equipment: 'Bodyweight',           type: 'weight-training' },
  { kw: 'ab wheel',           muscles: ['Core'],        equipment: 'Other',                type: 'weight-training' },
  { kw: 'leg raise',          muscles: ['Core'],        equipment: 'Bodyweight',           type: 'weight-training' },
  { kw: 'russian twist',      muscles: ['Core'],        equipment: 'Bodyweight',           type: 'weight-training' },
  // ── Generic compound fallbacks ──
  { kw: 'squat',              muscles: ['Quads'],       equipment: 'Barbell',              type: 'weight-training' },
  { kw: 'lunge',              muscles: ['Quads'],       equipment: 'Dumbbell',             type: 'weight-training' },
  { kw: 'row',                muscles: ['Back'],        equipment: 'Cable',                type: 'weight-training' },
  { kw: 'press',              muscles: ['Chest'],       equipment: 'Barbell',              type: 'weight-training' },
  { kw: 'fly',                muscles: ['Chest'],       equipment: 'Cable',                type: 'weight-training' },
  { kw: 'curl',               muscles: ['Biceps'],      equipment: 'Dumbbell',             type: 'weight-training' },
]

// ── Batch 39: Type display + summary helpers (library list, edit sheet) ───
//
// Library entries get a 3-color stripe + tiny uppercase tag per type. UI
// surfaces import these through a single helper so the color → type map
// has one source of truth. Per design doc §12.4:
//   Lift  → #60A5FA (blue-400)
//   Run   → #34D399 (emerald-400)
//   HYROX → #EAB308 (yellow-500)

const TYPE_COLORS = {
  'weight-training': '#60A5FA',
  'running':         '#34D399',
  'hyrox-station':   '#EAB308',
  'hyrox-round':     '#EAB308',
}

const TYPE_LABELS = {
  'weight-training': 'WEIGHT TRAINING',
  'running':         'RUN',
  'hyrox-station':   'HYROX',
  'hyrox-round':     'HYROX',
}

const TYPE_FILTER_BUCKETS = {
  'weight-training': 'lift',
  'running':         'run',
  'hyrox-station':   'hyrox',
  'hyrox-round':     'hyrox',
}

// Returns the brand color for an exercise's type. Defaults to weight-training
// blue when the type is missing or unknown (legacy / pre-v8 entries).
export function getTypeColor(type) {
  return TYPE_COLORS[type] || TYPE_COLORS['weight-training']
}

// Returns the short uppercase label rendered next to the exercise name.
export function getTypeLabel(type) {
  return TYPE_LABELS[type] || TYPE_LABELS['weight-training']
}

// Returns the filter-axis bucket id for grouping in /exercises:
// 'lift' / 'run' / 'hyrox'. Both station + round map to 'hyrox'.
export function getTypeFilterBucket(type) {
  return TYPE_FILTER_BUCKETS[type] || 'lift'
}

// Format the most-recent-logged-set summary line for the library list.
// Type-aware: weight entries show `225 × 8`; running shows `1.2 mi · 12:30`;
// HYROX stations show distance/time/reps appropriately. Returns null when
// there's nothing renderable so the caller can pick a fallback string.
//
// HYROX rounds don't have a flat "last set" yet (B43 ships the writer);
// returns null and the caller surfaces the type-tag display instead.
export function formatLastSetSummary(set, type) {
  if (!set || typeof set !== 'object') return null
  const t = type || 'weight-training'

  if (t === 'running') {
    const mi = typeof set.distanceMiles === 'number' ? set.distanceMiles : null
    const time = typeof set.timeSec === 'number' ? set.timeSec : null
    if (mi != null && time != null) return `${mi.toFixed(1)} mi · ${formatSeconds(time)}`
    if (mi != null) return `${mi.toFixed(1)} mi`
    if (time != null) return formatSeconds(time)
    return null
  }

  if (t === 'hyrox-station') {
    const w  = typeof set.weight === 'number' ? set.weight : null
    const r  = typeof set.reps === 'number' ? set.reps : null
    const m  = typeof set.distanceMeters === 'number' ? set.distanceMeters : null
    const tm = typeof set.timeSec === 'number' ? set.timeSec : null
    const parts = []
    if (w  != null) parts.push(`${w} lb`)
    if (m  != null) parts.push(`${m}m`)
    if (r  != null) parts.push(`${r} reps`)
    if (tm != null) parts.push(formatSeconds(tm))
    return parts.length > 0 ? parts.join(' · ') : null
  }

  if (t === 'hyrox-round') return null

  // Weight-training (default). Use perSideLoad to honor unilateral entries.
  const w = perSideLoad(set)
  const r = typeof set.reps === 'number' ? set.reps : Number(set.reps) || 0
  if (w > 0 && r > 0) return `${w} × ${r}`
  if (w > 0) return `${w} lb`
  if (r > 0) return `${r} reps`
  return null
}

// Format seconds as M:SS (or H:MM:SS for ≥1 hour). Internal helper used by
// the type-aware summary above.
function formatSeconds(sec) {
  const total = Math.max(0, Math.floor(sec))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

// Returns { primaryMuscles: string[], equipment: string, type: string } with a
// best-effort guess. Returns null if no keyword matched AND classifyType also
// returned the default 'weight-training' (i.e. nothing in the name suggests a
// specific class). Batch 37: extended to carry `type` so the CreateExerciseModal
// type selector pre-fills alongside muscles + equipment.
//
// Type-only fallback: when the muscle/equipment map misses but classifyType
// hits a non-weight-training keyword (e.g. "Easy Run" — no muscle keyword,
// but classifyType returns 'running'), we return a partial result with
// empty muscles + 'Other' equipment so the caller still gets the type cue.
export function predictExerciseMeta(name) {
  if (typeof name !== 'string') return null
  const n = name.toLowerCase().trim()
  if (!n) return null
  for (const rule of EXERCISE_KEYWORD_MAP) {
    if (n.includes(rule.kw)) {
      return {
        primaryMuscles: [...rule.muscles],
        equipment:      rule.equipment,
        type:           rule.type || 'weight-training',
      }
    }
  }
  const t = classifyType(name)
  if (t === 'weight-training') return null
  return { primaryMuscles: [], equipment: 'Other', type: t }
}

// ── Batch 40: Split-import library extension ─────────────────────────────
//
// Imported splits (Brooke's JSON v3 + any future hybrid template) carry a
// `type` field on each exercise. The pre-Batch-40 import path silently
// dropped that information — every exercise resolved to weight-training
// at session-log time via name matching. With B40, every typed entry that
// doesn't already exist in the library spawns a library row at import
// time, so HYROX rounds carry their roundConfig + RUN entries carry their
// equipment hint into the running app.
//
// `importLibraryEntryFromSplit(exercise, library)` is a pure decision
// helper. Returns one of:
//   { create: ExerciseShape } — caller hands to addExerciseToLibrary
//   { existingId: string }    — already in the library, no-op
//   { skip: true }            — legacy weight-training entry without type
//   { error: string }         — malformed, log + skip
// Defensive against null/undefined/non-string name. Catalog-closed
// hyrox-station entries that don't match a seeded catalog name surface
// as `error` (per plan §B40 "validate against the catalog… reject
// malformed"); Brooke's JSON v3 uses canonical catalog names so this
// fires only on user-malformed imports.

export function importLibraryEntryFromSplit(exercise, library) {
  if (!exercise || typeof exercise !== 'object') return { skip: true }
  const name = typeof exercise.name === 'string' ? exercise.name.trim() : ''
  if (!name) return { skip: true }
  const type = typeof exercise.type === 'string' ? exercise.type : null
  if (!type) return { skip: true } // legacy weight-training, resolves at session-save time
  const norm = normalizeExerciseName(name)
  const existing = (library || []).find(e =>
    normalizeExerciseName(e.name) === norm ||
    (e.aliases || []).some(a => normalizeExerciseName(a) === norm)
  )
  if (existing) return { existingId: existing.id }

  if (type === 'hyrox-station') {
    return { error: `HYROX station "${name}" not found in catalog. The 8 catalog stations are auto-seeded; rename to match (e.g. "Farmers Carry") or change type.` }
  }
  if (type === 'hyrox-round') {
    if (!exercise.roundConfig || typeof exercise.roundConfig !== 'object') {
      return { error: `HYROX round "${name}" missing roundConfig.` }
    }
    const rc = exercise.roundConfig
    const hasStation = typeof rc.stationId === 'string' && rc.stationId
    const hasPool = Array.isArray(rc.rotationPool) && rc.rotationPool.length > 0
    if (!hasStation && !hasPool) {
      return { error: `HYROX round "${name}" roundConfig needs stationId or rotationPool.` }
    }
    return {
      create: {
        name,
        type: 'hyrox-round',
        roundConfig: rc,
        primaryMuscles: ['Full Body'],
        equipment: 'Other',
      },
    }
  }
  if (type === 'running') {
    return {
      create: {
        name,
        type: 'running',
        primaryMuscles: ['Full Body'],
        equipment: typeof exercise.equipment === 'string' && exercise.equipment ? exercise.equipment : 'Other',
      },
    }
  }
  if (type === 'weight-training') {
    return {
      create: {
        name,
        type: 'weight-training',
        primaryMuscles: [],
        equipment: 'Other',
        needsTagging: true,
      },
    }
  }
  return { error: `Unknown type "${type}" for exercise "${name}".` }
}

// `collectLibraryAdditionsFromSplit(splitData, library)` walks every
// exercise across every workout/section and aggregates the helper's
// per-entry decisions. Dedupes within the import payload by normalized
// name so two workouts that both reference "HYROX Run + SkiErg Round"
// don't try to create two library rows. Returns the full picture for
// a single store transaction:
//   { toCreate: ExerciseShape[], errors: string[] }
// Caller iterates `toCreate` through `addExerciseToLibrary` then
// optionally surfaces `errors` to the user.

export function collectLibraryAdditionsFromSplit(splitData, library) {
  const toCreate = []
  const errors = []
  const seen = new Set()
  if (!splitData || !Array.isArray(splitData.workouts)) {
    return { toCreate, errors }
  }
  for (const workout of splitData.workouts) {
    for (const section of (workout?.sections || [])) {
      for (const ex of (section?.exercises || [])) {
        if (typeof ex === 'string') continue
        const result = importLibraryEntryFromSplit(ex, library)
        if (result.error) errors.push(result.error)
        if (result.create) {
          const key = normalizeExerciseName(result.create.name)
          if (!seen.has(key)) {
            seen.add(key)
            toCreate.push(result.create)
          }
        }
      }
    }
  }
  return { toCreate, errors }
}

// ── Batch 41: HYROX round session lookup ─────────────────────────────────
//
// `getLastHyroxRoundSession(sessions, exerciseIdOrName)` walks completed
// bb-mode sessions newest-first, returns the most recent session that
// logged a hyrox-round exercise matching the given id (preferred) or
// name (fallback for pre-v3 safety). Returns the matched session +
// the LoggedExercise row's rounds[] data + a derived total time / round
// count for the section-preview card's "vs last session" line.
//
// Returns shape:
//   { session, loggedExercise, totalTimeSec, roundCount, completedAt } | null
//
// Pre-B43 (no rounds[] writer exists yet), this returns null for any
// real-world input — the helper is forward-compatible. Sanity script
// covers synthetic rounds[] data so B43 doesn't surprise downstream.

export function getLastHyroxRoundSession(sessions, exerciseIdOrName) {
  if (!Array.isArray(sessions) || !exerciseIdOrName) return null
  const target = String(exerciseIdOrName)
  // Newest first.
  const ordered = [...sessions]
    .filter(s => s?.mode === 'bb' && Array.isArray(s?.data?.exercises))
    .sort((a, b) => {
      const da = a?.date ? new Date(a.date).getTime() : 0
      const db = b?.date ? new Date(b.date).getTime() : 0
      return db - da
    })
  for (const session of ordered) {
    for (const ex of session.data.exercises) {
      const idMatch = ex?.exerciseId && ex.exerciseId === target
      const nameMatch = ex?.name && ex.name === target
      if (!idMatch && !nameMatch) continue
      if (!Array.isArray(ex.rounds) || ex.rounds.length === 0) continue
      let total = 0
      for (const round of ex.rounds) {
        if (!round || !Array.isArray(round.legs)) continue
        for (const leg of round.legs) {
          if (typeof leg?.timeSec === 'number') total += leg.timeSec
        }
        if (typeof round.restAfterSec === 'number') total += round.restAfterSec
      }
      return {
        session,
        loggedExercise: ex,
        totalTimeSec: total,
        roundCount: ex.rounds.length,
        completedAt: ex.completedAt || session.date || null,
      }
    }
  }
  return null
}

// ── Batch 43: Station-anchored history + intra-leg comparison ─────────────
//
// CRITICAL DESIGN PRIMITIVE (design doc §14.1, §6.5): the STATION is the
// comparison anchor, not the round position. A SkiErg leg's prior history
// is every prior SkiErg leg the user has logged, regardless of round
// template (Tuesday's intervals vs Friday's simulation) or round position.
// Cross-template aggregation by design.
//
// `getStationHistory(sessions, stationId, dimensions)` — newest-first array
// of every station leg matching stationId across all sessions. When
// `dimensions` filters are passed (`{distanceMeters, weight, reps}`), only
// legs matching every provided field contribute. Empty / null filter
// short-circuits to "all legs at this station". Each leg-result echoes the
// originating session info (date, sessionId, exerciseId, roundIndex) so
// downstream callers can build "vs your last SkiErg at 500m on Tuesday"
// strings if needed.

export function getStationHistory(sessions, stationId, dimensions = {}) {
  if (!Array.isArray(sessions) || !stationId) return []
  const matchDistance = typeof dimensions?.distanceMeters === 'number'
  const matchWeight = typeof dimensions?.weight === 'number'
  const matchReps = typeof dimensions?.reps === 'number'

  const out = []
  for (const session of sessions) {
    if (session?.mode !== 'bb' || !Array.isArray(session?.data?.exercises)) continue
    for (const ex of session.data.exercises) {
      if (!Array.isArray(ex?.rounds) || ex.rounds.length === 0) continue
      for (const round of ex.rounds) {
        if (!round || !Array.isArray(round.legs)) continue
        for (const leg of round.legs) {
          if (leg?.type !== 'station') continue
          if (leg?.stationId !== stationId) continue
          if (typeof leg?.timeSec !== 'number') continue
          if (matchDistance && leg.distanceMeters !== dimensions.distanceMeters) continue
          if (matchWeight && leg.weight !== dimensions.weight) continue
          if (matchReps && leg.reps !== dimensions.reps) continue
          out.push({
            ...leg,
            sessionId: session.id,
            sessionDate: session.date,
            exerciseId: ex.exerciseId || null,
            exerciseName: ex.name || null,
            roundIndex: round.roundIndex,
          })
        }
      }
    }
  }
  // Sort newest-first by sessionDate; within the same session, later rounds
  // happened more recently than earlier rounds, so descending roundIndex is
  // the right tiebreaker (R4 appears before R1 of the same session).
  out.sort((a, b) => {
    const da = a.sessionDate ? new Date(a.sessionDate).getTime() : 0
    const db = b.sessionDate ? new Date(b.sessionDate).getTime() : 0
    if (db !== da) return db - da
    return (b.roundIndex ?? 0) - (a.roundIndex ?? 0)
  })
  return out
}

// `getRunLegHistory(sessions, distanceMeters)` — same shape, run legs only.
// Cross-template aggregation: a 1000m run leg in Friday's simulation is
// comparable to a 1000m run leg in Tuesday's intervals.
export function getRunLegHistory(sessions, distanceMeters) {
  if (!Array.isArray(sessions)) return []
  const matchDistance = typeof distanceMeters === 'number'

  const out = []
  for (const session of sessions) {
    if (session?.mode !== 'bb' || !Array.isArray(session?.data?.exercises)) continue
    for (const ex of session.data.exercises) {
      if (!Array.isArray(ex?.rounds) || ex.rounds.length === 0) continue
      for (const round of ex.rounds) {
        if (!round || !Array.isArray(round.legs)) continue
        for (const leg of round.legs) {
          if (leg?.type !== 'run') continue
          if (typeof leg?.timeSec !== 'number') continue
          if (matchDistance && leg.distanceMeters !== distanceMeters) continue
          out.push({
            ...leg,
            sessionId: session.id,
            sessionDate: session.date,
            exerciseId: ex.exerciseId || null,
            exerciseName: ex.name || null,
            roundIndex: round.roundIndex,
          })
        }
      }
    }
  }
  out.sort((a, b) => {
    const da = a.sessionDate ? new Date(a.sessionDate).getTime() : 0
    const db = b.sessionDate ? new Date(b.sessionDate).getTime() : 0
    if (db !== da) return db - da
    return (a.roundIndex ?? 0) - (b.roundIndex ?? 0)
  })
  return out
}

// `computePaceFromHistory(history)` — average seconds per 100 meters across
// every prior leg with both timeSec and distanceMeters. Dimension-agnostic
// pace fallback for the intra-leg band when today's exact distance has no
// prior occurrence (design doc §6.5). Returns a number rounded to 0.1s/100m
// or null when history doesn't carry distance (e.g. wall-balls reps-only).
export function computePaceFromHistory(history) {
  if (!Array.isArray(history) || history.length === 0) return null
  let totalSec = 0
  let totalMeters = 0
  for (const leg of history) {
    if (typeof leg?.timeSec !== 'number') continue
    if (typeof leg?.distanceMeters !== 'number' || leg.distanceMeters <= 0) continue
    totalSec += leg.timeSec
    totalMeters += leg.distanceMeters
  }
  if (totalMeters === 0) return null
  const pacePer100m = (totalSec / totalMeters) * 100
  return Math.round(pacePer100m * 10) / 10
}

// `buildIntraLegComparison({ legType, stationId, distanceMeters, weight,
// reps, currentTimeSec, sessions })` — composes the comparison band data
// the round logger displays beneath the gym clock per design doc §14.1.
//
// Returns null on cold start (no matching prior history AND no pace
// fallback) so the band hides per §14.4.
//
// Otherwise returns { mode, status, label, lastTimeSec, deltaSec,
// paceSecPer100m, paceProjectedTimeSec } where:
// - `mode` = 'exact' (matched dimensions, lastTimeSec valid) | 'pace' (pace
//   fallback, paceProjectedTimeSec is the implied target).
// - `status` = 'ahead' (currentTimeSec < target) | 'behind' (>) | 'neutral'
//   (no current time yet, e.g. clock just started).
// - `label` = "your last SkiErg at 500m" | "your average SkiErg pace" — the
//   "vs X" framing per §14.1, rendered by the band.
//
// Caller passes `currentTimeSec` (live clock seconds) and re-renders on
// every tick; this fn is pure and stateless so it can run inside an
// existing useMemo / useEffect on the parent.

export function buildIntraLegComparison(opts) {
  const {
    legType,                // 'run' | 'station'
    stationId = null,
    stationName = null,     // for label rendering ("SkiErg" not "sta_skierg")
    distanceMeters = null,
    weight = null,
    reps = null,
    currentTimeSec = 0,
    sessions = [],
  } = opts || {}

  if (!Array.isArray(sessions) || sessions.length === 0) return null
  if (legType !== 'run' && legType !== 'station') return null

  // 1. Look for an EXACT match — same dimensions as today's leg.
  let history = []
  if (legType === 'run' && typeof distanceMeters === 'number') {
    history = getRunLegHistory(sessions, distanceMeters)
  } else if (legType === 'station' && stationId) {
    const dims = {}
    if (typeof distanceMeters === 'number') dims.distanceMeters = distanceMeters
    if (typeof weight === 'number') dims.weight = weight
    if (typeof reps === 'number') dims.reps = reps
    history = getStationHistory(sessions, stationId, dims)
  }

  if (history.length > 0) {
    const mostRecent = history[0]
    const lastTimeSec = mostRecent.timeSec
    const labelTarget = legType === 'run'
      ? `your last ${distanceMeters}m run`
      : `your last ${stationName || 'station'}${typeof distanceMeters === 'number' ? ` at ${distanceMeters}m` : ''}`
    let status = 'neutral'
    let deltaSec = 0
    if (typeof currentTimeSec === 'number' && currentTimeSec > 0) {
      deltaSec = currentTimeSec - lastTimeSec
      status = currentTimeSec < lastTimeSec ? 'ahead' : (currentTimeSec > lastTimeSec ? 'behind' : 'neutral')
    }
    return {
      mode: 'exact',
      status,
      label: labelTarget,
      lastTimeSec,
      deltaSec,
      paceSecPer100m: null,
      paceProjectedTimeSec: null,
    }
  }

  // 2. Pace fallback — same station OR any-distance run, dimension-agnostic.
  if (legType === 'station' && stationId) {
    const allStation = getStationHistory(sessions, stationId, {})
    const pace = computePaceFromHistory(allStation)
    if (pace !== null && typeof distanceMeters === 'number' && distanceMeters > 0) {
      const projected = (pace * distanceMeters) / 100
      const labelTarget = `your avg ${stationName || 'station'} pace`
      let status = 'neutral'
      let deltaSec = 0
      if (typeof currentTimeSec === 'number' && currentTimeSec > 0) {
        deltaSec = currentTimeSec - projected
        status = currentTimeSec < projected ? 'ahead' : (currentTimeSec > projected ? 'behind' : 'neutral')
      }
      return {
        mode: 'pace',
        status,
        label: labelTarget,
        lastTimeSec: null,
        deltaSec,
        paceSecPer100m: pace,
        paceProjectedTimeSec: projected,
      }
    }
  }
  if (legType === 'run' && typeof distanceMeters === 'number' && distanceMeters > 0) {
    const allRuns = getRunLegHistory(sessions, undefined)
    const pace = computePaceFromHistory(allRuns)
    if (pace !== null) {
      const projected = (pace * distanceMeters) / 100
      const labelTarget = 'your avg run pace'
      let status = 'neutral'
      let deltaSec = 0
      if (typeof currentTimeSec === 'number' && currentTimeSec > 0) {
        deltaSec = currentTimeSec - projected
        status = currentTimeSec < projected ? 'ahead' : (currentTimeSec > projected ? 'behind' : 'neutral')
      }
      return {
        mode: 'pace',
        status,
        label: labelTarget,
        lastTimeSec: null,
        deltaSec,
        paceSecPer100m: pace,
        paceProjectedTimeSec: projected,
      }
    }
  }

  // 3. Cold start — band hides.
  return null
}

// ── Batch 44: Post-round delta for the flash overlay ──────────────────────
//
// `computeRoundDelta(roundIndex, completedLegs, sessions, prescription)` —
// composes the headline + subheadline rendered on PostRoundFlash after a
// non-final round's station leg is stamped Done. Three branching modes per
// design doc §14.2 + plan B44:
//
//   1. 'round-position' — same exerciseId (round template) + same stationId
//      at the same roundIndex in a prior session. Headline reads "Round N
//      done · M:SS" with subheadline "X faster than last week" (round-total
//      delta — sum of run + station for the round).
//
//   2. 'station-anchored' — fallback when branch 1 doesn't match (rotation
//      pool, different round position, different template). Honors the
//      headline B43 invariant: stations are the comparison primitive.
//      Headline "Round N done · {Station} M:SS" with subheadline "X faster
//      than your last {Station}" (station-leg delta against most-recent
//      prior leg of same station, dimensions matching when possible).
//
//   3. 'cold' — station has no prior history at all. Headline "Round N
//      done · M:SS", subheadline null (no delta to report).
//
// Returns `{ headline, subheadline, mode, deltaSec }`. Pure — caller passes
// the just-stamped legs from `activeSession.hyrox.completedLegs` plus the
// store's `sessions[]`. The prescription contains exerciseId + stationId so
// branch 1 / branch 2 lookups don't need to re-derive them.

export function computeRoundDelta(roundIndex, completedLegs, sessions, prescription) {
  if (typeof roundIndex !== 'number' || roundIndex < 0) return null
  if (!Array.isArray(completedLegs) || completedLegs.length === 0) return null

  // Filter to JUST the legs from the round we just finished.
  const thisRoundLegs = completedLegs.filter(l => l?.roundIndex === roundIndex)
  if (thisRoundLegs.length === 0) return null

  const thisRunLeg = thisRoundLegs.find(l => l?.type === 'run')
  const thisStationLeg = thisRoundLegs.find(l => l?.type === 'station')
  const thisRoundTotalSec = thisRoundLegs.reduce(
    (sum, l) => sum + (typeof l?.timeSec === 'number' ? l.timeSec : 0),
    0
  )

  const stationId = prescription?.stationId || thisStationLeg?.stationId || null
  const stationName = stationId
    ? (HYROX_STATIONS.find(s => s.id === stationId)?.name || null)
    : null
  const exerciseId = prescription?.exerciseId || null

  // ── Branch 1: same template + same station + same round position ─────
  if (exerciseId && stationId && thisStationLeg && Array.isArray(sessions)) {
    const priorMeta = getLastHyroxRoundSession(sessions, exerciseId)
    if (priorMeta?.loggedExercise?.rounds) {
      const priorRound = priorMeta.loggedExercise.rounds.find(
        r => r?.roundIndex === roundIndex
      )
      if (priorRound?.legs) {
        const priorStation = priorRound.legs.find(l => l?.type === 'station')
        if (
          priorStation?.stationId === stationId &&
          typeof priorStation.timeSec === 'number'
        ) {
          const priorRoundTotal = priorRound.legs.reduce(
            (sum, l) => sum + (typeof l?.timeSec === 'number' ? l.timeSec : 0),
            0
          )
          if (priorRoundTotal > 0) {
            const deltaSec = thisRoundTotalSec - priorRoundTotal
            const headline = `Round ${roundIndex + 1} done · ${formatDuration(thisRoundTotalSec)}`
            let subheadline
            if (deltaSec === 0) {
              subheadline = 'Matched last time'
            } else if (deltaSec < 0) {
              subheadline = `${formatDuration(Math.abs(deltaSec))} faster than last time`
            } else {
              subheadline = `${formatDuration(deltaSec)} slower than last time`
            }
            return {
              mode: 'round-position',
              headline,
              subheadline,
              deltaSec,
            }
          }
        }
      }
    }
  }

  // ── Branch 2: station-anchored — most recent prior leg of this station ─
  if (
    stationId &&
    thisStationLeg &&
    typeof thisStationLeg.timeSec === 'number' &&
    Array.isArray(sessions)
  ) {
    // Try exact-dimension match first; fall back to all this station.
    const stationDims = {}
    if (typeof thisStationLeg.distanceMeters === 'number') {
      stationDims.distanceMeters = thisStationLeg.distanceMeters
    }
    if (typeof thisStationLeg.weight === 'number') {
      stationDims.weight = thisStationLeg.weight
    }
    if (typeof thisStationLeg.reps === 'number') {
      stationDims.reps = thisStationLeg.reps
    }
    let priorHistory = getStationHistory(sessions, stationId, stationDims)
    if (priorHistory.length === 0) {
      priorHistory = getStationHistory(sessions, stationId, {})
    }
    if (priorHistory.length > 0) {
      const mostRecent = priorHistory[0]
      const deltaSec = thisStationLeg.timeSec - mostRecent.timeSec
      const stationLabel = stationName || 'station'
      const headline = `Round ${roundIndex + 1} done · ${stationLabel} ${formatDuration(thisStationLeg.timeSec)}`
      let subheadline
      if (deltaSec === 0) {
        subheadline = `Matched your last ${stationLabel}`
      } else if (deltaSec < 0) {
        subheadline = `${formatDuration(Math.abs(deltaSec))} faster than your last ${stationLabel}`
      } else {
        subheadline = `${formatDuration(deltaSec)} slower than your last ${stationLabel}`
      }
      return {
        mode: 'station-anchored',
        headline,
        subheadline,
        deltaSec,
      }
    }
  }

  // ── Branch 3: cold start — round total only, no comparison ───────────
  return {
    mode: 'cold',
    headline: `Round ${roundIndex + 1} done · ${formatDuration(thisRoundTotalSec)}`,
    subheadline: null,
    deltaSec: null,
  }
}

// `formatDuration(sec)` — `M:SS` or `H:MM:SS` for the HYROX preview card's
// last-session total time line. Defensive; returns empty string for null /
// non-numeric / negative.
export function formatDuration(sec) {
  if (typeof sec !== 'number' || !Number.isFinite(sec) || sec < 0) return ''
  const total = Math.round(sec)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

// ── Batch 45: HYROX session summary helpers ────────────────────────────────
//
// Five pure helpers for the post-final-round summary screen
// (`HyroxSessionSummary.jsx` mockup 4). All defensive against null/non-array
// inputs; each returns a stable shape so the summary's render branches can
// guard on null/empty without exception.
//
// Design contract (design doc §14.3, §14.4, §16.1):
//   - Comparisons are STATION-ANCHORED, not round-position-anchored. Today's
//     R3 SkiErg compares against this user's most-recent prior SkiErg leg
//     across ALL sessions/templates, not the prior session's R3.
//   - Cold-start: when ALL today's stations are first-time, summary collapses
//     the chart legend to "today" only and surfaces a sidebar of bests
//     (fastest round / fastest run leg / fastest station leg).
//   - Mixed-history: partial dashed series — only round positions with
//     resolvable prior data render the dashed point. Today's R4 with a
//     never-before-seen station gets `priorTotalSec: null`.
//   - Pace fallback: if today's exact dimensions don't match any prior at the
//     same station, derive a pace-projected target from the station's prior
//     history at OTHER distances. Marked `priorPaceFallback: true` so the
//     chart can render hollow vs filled circles per §14.4.
//   - Branching CTA: walk workout's non-HYROX sections; any uncompleted lift
//     means "Back to lift →"; all complete or HYROX-only means
//     "Finish workout →" per §16.1.

// `composeHyroxRoundsForSave(completedLegs, prescription)` — groups the flat
// `activeSession.hyrox.completedLegs[]` array by `roundIndex` into the nested
// `LoggedHyroxRound[]` shape per the B38 schema docblock:
//   { roundIndex, legs: [{type:'run',...}, {type:'station',...}], restAfterSec, completedAt }
//
// `restAfterSec` for round N = the gap (in seconds) between this round's
// station-leg `completedAt` and the next round's run-leg `completedAt`. That
// includes the time spent in the post-round flash overlay + the actual rest
// + any +30s extensions the user added. The final round has restAfterSec = 0
// (no following round).
//
// Defensive:
//   - missing legs (e.g. a skipped run-Done) → still produces a round entry
//     with whatever legs ARE present.
//   - non-array completedLegs → returns [].
//   - prescription unused for shape — only consulted by the caller. Reserved
//     here for future use (e.g. legs[].dimensions stamping).
export function composeHyroxRoundsForSave(completedLegs, _prescription) {
  if (!Array.isArray(completedLegs) || completedLegs.length === 0) return []

  // Group legs by roundIndex.
  const byRound = new Map()
  for (const leg of completedLegs) {
    if (!leg || typeof leg.roundIndex !== 'number' || leg.roundIndex < 0) continue
    const idx = leg.roundIndex
    if (!byRound.has(idx)) byRound.set(idx, [])
    byRound.get(idx).push(leg)
  }
  if (byRound.size === 0) return []

  // Sorted ascending by roundIndex.
  const roundIndexes = [...byRound.keys()].sort((a, b) => a - b)
  const rounds = []
  for (let i = 0; i < roundIndexes.length; i++) {
    const idx = roundIndexes[i]
    const legs = byRound.get(idx)
    // Drop the roundIndex from each leg before persisting (the wrapping round
    // already carries it); strip the key while preserving everything else.
    const cleanedLegs = legs.map(({ roundIndex: _ri, ...rest }) => rest)
    const stationLeg = cleanedLegs.find(l => l?.type === 'station')

    // restAfterSec: actual rest taken between this round's station finishing
    // and the next round's run leg STARTING. We don't track run-started time
    // directly — the flat completedLegs[] only carries completedAt (when each
    // leg's Done was tapped). So we derive: gap = next_run.completedAt -
    // this_station.completedAt, then SUBTRACT next_run.timeSec to back out the
    // run leg's own duration. The remainder is the time the user spent in the
    // post-round flash + rest countdown + any +30s extensions. Final round →
    // 0 (no following round).
    let restAfterSec = 0
    const nextIdx = roundIndexes[i + 1]
    if (typeof nextIdx === 'number') {
      const stationDoneAt = stationLeg?.completedAt
      const nextLegs = byRound.get(nextIdx) || []
      // The earliest leg in the next round is typically its run leg (legs go
      // run→station). Use that completedAt as the gap endpoint.
      let earliestLeg = null
      let earliestT = null
      for (const leg of nextLegs) {
        if (!leg?.completedAt) continue
        const t = new Date(leg.completedAt).getTime()
        if (!Number.isFinite(t)) continue
        if (earliestT === null || t < earliestT) {
          earliestT = t
          earliestLeg = leg
        }
      }
      if (stationDoneAt && earliestT !== null) {
        const stationT = new Date(stationDoneAt).getTime()
        if (Number.isFinite(stationT) && earliestT > stationT) {
          const gapSec = (earliestT - stationT) / 1000
          // Subtract the next leg's own timeSec — the gap covers
          // rest + that leg, so restAfterSec = gap - leg time.
          const legSec = typeof earliestLeg.timeSec === 'number' ? earliestLeg.timeSec : 0
          restAfterSec = Math.max(0, Math.round(gapSec - legSec))
        }
      }
    }

    rounds.push({
      roundIndex: idx,
      legs: cleanedLegs,
      restAfterSec,
      completedAt: stationLeg?.completedAt
        || cleanedLegs[cleanedLegs.length - 1]?.completedAt
        || null,
    })
  }
  return rounds
}

// `getHyroxSessionTotalTime(rounds)` — sum of every leg's `timeSec` + every
// round's `restAfterSec`. Mirrors `HyroxSectionPreview`'s done-state walker
// so the summary's hero total matches the section preview's "✓ done" stat.
// Returns 0 on null / empty / malformed.
export function getHyroxSessionTotalTime(rounds) {
  if (!Array.isArray(rounds) || rounds.length === 0) return 0
  let total = 0
  for (const r of rounds) {
    if (!r || !Array.isArray(r.legs)) continue
    for (const leg of r.legs) {
      if (typeof leg?.timeSec === 'number') total += leg.timeSec
    }
    if (typeof r.restAfterSec === 'number') total += r.restAfterSec
  }
  return total
}

// `buildSyntheticPriorSeries(todayRounds, sessions, prescription, currentSessionId)`
// — per-round synthetic prior, station-anchored per §14.3. For each round in
// `todayRounds`, look up the most-recent prior run leg matching the run
// distance + the most-recent prior station leg matching the station's
// dimensions. Sum the two for the round's "synthetic prior total."
//
// Self-exclusion: filters legs whose `sessionId === currentSessionId` so the
// summary doesn't compare today against itself if the active session has
// already been committed to `sessions[]`. Pre-commit (the typical path) the
// active session isn't in `sessions[]` and self-exclusion is a no-op.
//
// Pace fallback (§14.4): if exact-distance match for the run leg or
// exact-dimension match for the station leg returns nothing, fall through
// to pace-projection — `pace × today's distance`. Flagged via
// `priorPaceFallback: true` on the returned entry so the chart can render
// hollow circles vs filled.
//
// Returns: `Array<{
//   roundIndex,
//   todayTotalSec,           // sum of today's run + station for this round
//   priorTotalSec | null,    // null when no matching history
//   priorPaceFallback,       // true when at least one leg used pace fallback
//   status                   // 'ahead' | 'behind' | 'neutral' | null
// }>`. status is 'ahead' when today < prior, 'behind' when today > prior.
export function buildSyntheticPriorSeries(todayRounds, sessions, prescription, currentSessionId = null) {
  if (!Array.isArray(todayRounds) || todayRounds.length === 0) return []
  const sessionsArr = Array.isArray(sessions) ? sessions : []
  const filteredSessions = currentSessionId
    ? sessionsArr.filter(s => s?.id !== currentSessionId)
    : sessionsArr

  const series = []
  for (const round of todayRounds) {
    if (!round || !Array.isArray(round.legs)) continue
    const roundIndex = typeof round.roundIndex === 'number' ? round.roundIndex : series.length
    const runLeg = round.legs.find(l => l?.type === 'run')
    const stationLeg = round.legs.find(l => l?.type === 'station')

    const todayRunSec = typeof runLeg?.timeSec === 'number' ? runLeg.timeSec : 0
    const todayStationSec = typeof stationLeg?.timeSec === 'number' ? stationLeg.timeSec : 0
    const todayTotalSec = todayRunSec + todayStationSec

    // Prior run leg — exact distance match first, then pace fallback.
    let priorRunSec = null
    let runPaceFallback = false
    const runDistance = runLeg?.distanceMeters
      ?? prescription?.runDistanceMeters
      ?? null
    if (typeof runDistance === 'number' && runDistance > 0) {
      const exactRunHistory = getRunLegHistory(filteredSessions, runDistance)
      if (exactRunHistory.length > 0) {
        priorRunSec = exactRunHistory[0].timeSec
      } else {
        // Pace fallback — any-distance run pace × today's distance.
        const allRuns = getRunLegHistory(filteredSessions)
        const pace = computePaceFromHistory(allRuns)
        if (pace !== null) {
          priorRunSec = (pace * runDistance) / 100
          runPaceFallback = true
        }
      }
    }

    // Prior station leg — exact dims first, then station-only, then pace.
    let priorStationSec = null
    let stationPaceFallback = false
    const stationId = stationLeg?.stationId || prescription?.stationId || null
    if (stationId) {
      const stationDims = {}
      if (typeof stationLeg?.distanceMeters === 'number') {
        stationDims.distanceMeters = stationLeg.distanceMeters
      }
      if (typeof stationLeg?.weight === 'number') {
        stationDims.weight = stationLeg.weight
      }
      if (typeof stationLeg?.reps === 'number') {
        stationDims.reps = stationLeg.reps
      }
      const exactStation = getStationHistory(filteredSessions, stationId, stationDims)
      if (exactStation.length > 0) {
        priorStationSec = exactStation[0].timeSec
      } else {
        // No exact-dim match — try station-only history.
        const allStation = getStationHistory(filteredSessions, stationId, {})
        if (allStation.length > 0) {
          // If today's station has distanceMeters AND prior history has it
          // (different distance), pace-project. Otherwise fall back to most
          // recent regardless.
          const stationDistance = stationLeg?.distanceMeters ?? null
          if (typeof stationDistance === 'number' && stationDistance > 0) {
            const pace = computePaceFromHistory(allStation)
            if (pace !== null) {
              priorStationSec = (pace * stationDistance) / 100
              stationPaceFallback = true
            } else {
              priorStationSec = allStation[0].timeSec
            }
          } else {
            // No distance dimension on today's station (e.g. wall-balls reps-only).
            // Use the most-recent prior leg's time as a flat reference — same as
            // intra-leg comparison's pace-less fallback.
            priorStationSec = allStation[0].timeSec
          }
        }
      }
    }

    let priorTotalSec = null
    if (priorRunSec !== null && priorStationSec !== null) {
      priorTotalSec = priorRunSec + priorStationSec
    } else if (priorRunSec !== null && stationLeg && stationId === null) {
      // No station leg in today's round (data quality) — run-only series point.
      priorTotalSec = priorRunSec
    } else if (priorStationSec !== null && runLeg && (typeof runDistance !== 'number' || runDistance === 0)) {
      // No run leg in today's round — station-only series point.
      priorTotalSec = priorStationSec
    }

    let status = null
    if (priorTotalSec !== null && todayTotalSec > 0) {
      if (todayTotalSec < priorTotalSec) status = 'ahead'
      else if (todayTotalSec > priorTotalSec) status = 'behind'
      else status = 'neutral'
    }

    series.push({
      roundIndex,
      todayTotalSec,
      priorTotalSec: priorTotalSec === null ? null : Math.round(priorTotalSec),
      priorPaceFallback: runPaceFallback || stationPaceFallback,
      status,
    })
  }
  return series
}

// `getHyroxBests(rounds, prescription)` — cold-start sidebar data per §14.4.
// Returns `{ fastestRound, fastestRunLeg, fastestStationLeg }` where each is
// `{ timeSec, label } | null`. Label describes the round/leg position so
// "Fastest round: R2 (5:42)" reads cleanly. For mixed-history sessions this
// is unused — only the cold-start variant renders the sidebar.
export function getHyroxBests(rounds, _prescription) {
  if (!Array.isArray(rounds) || rounds.length === 0) {
    return { fastestRound: null, fastestRunLeg: null, fastestStationLeg: null }
  }

  let fastestRound = null
  let fastestRunLeg = null
  let fastestStationLeg = null

  for (const r of rounds) {
    if (!r || !Array.isArray(r.legs)) continue
    const roundIndex = typeof r.roundIndex === 'number' ? r.roundIndex : null
    const roundLabel = roundIndex !== null ? `R${roundIndex + 1}` : 'Round'

    let roundTotal = 0
    for (const leg of r.legs) {
      if (typeof leg?.timeSec !== 'number') continue
      roundTotal += leg.timeSec
      if (leg.type === 'run') {
        const distLabel = typeof leg.distanceMeters === 'number'
          ? ` ${leg.distanceMeters}m`
          : ''
        if (fastestRunLeg === null || leg.timeSec < fastestRunLeg.timeSec) {
          fastestRunLeg = {
            timeSec: leg.timeSec,
            label: `${roundLabel}${distLabel}`,
          }
        }
      } else if (leg.type === 'station') {
        const stationName = leg.stationId
          ? (HYROX_STATIONS.find(s => s.id === leg.stationId)?.name || 'Station')
          : 'Station'
        if (fastestStationLeg === null || leg.timeSec < fastestStationLeg.timeSec) {
          fastestStationLeg = {
            timeSec: leg.timeSec,
            label: `${roundLabel} ${stationName}`,
          }
        }
      }
    }

    if (roundTotal > 0 && (fastestRound === null || roundTotal < fastestRound.timeSec)) {
      fastestRound = {
        timeSec: roundTotal,
        label: roundLabel,
      }
    }
  }

  return { fastestRound, fastestRunLeg, fastestStationLeg }
}

// `computeBranchingCta(workout, activeSessionExercises)` — branching CTA per
// §16.1. Walks the current workout's sections; any non-HYROX section with an
// uncompleted exercise → 'Back to lift →'. All lift work complete OR
// HYROX-only workout → 'Finish workout →'.
//
// "Lift section" = any section whose label trimmed-lowercased ≠ 'hyrox'
// (mirrors B41's predicate). "Uncompleted exercise" = the matching entry in
// `activeSessionExercises` lacks a truthy `completedAt`. An exercise present
// in the section template but missing from `activeSessionExercises` entirely
// counts as uncompleted (template-only, never logged).
//
// Returns `{ label, action }` where action is 'lift' | 'finish'.
export function computeBranchingCta(workout, activeSessionExercises) {
  const exerciseList = Array.isArray(activeSessionExercises) ? activeSessionExercises : []
  if (!workout || !Array.isArray(workout.sections) || workout.sections.length === 0) {
    return { label: 'Finish workout →', action: 'finish' }
  }

  for (const section of workout.sections) {
    const labelNorm = String(section?.label || '').trim().toLowerCase()
    if (labelNorm === 'hyrox') continue
    const sectionExes = Array.isArray(section?.exercises) ? section.exercises : []
    for (const sectionEx of sectionExes) {
      const name = typeof sectionEx === 'string'
        ? sectionEx
        : (sectionEx?.name || sectionEx?.exercise || null)
      if (!name) continue
      const match = exerciseList.find(ex => ex?.name === name)
      if (!match || !match.completedAt) {
        return { label: 'Back to lift →', action: 'lift' }
      }
    }
  }
  return { label: 'Finish workout →', action: 'finish' }
}

// ── Batch 42: Start HYROX overlay helpers ──────────────────────────────────

// `pickHeadline(lastShownIndex)` — picks one of the 30 cycling headlines per
// design doc §13.2. Avoids back-to-back repeats by re-rolling when the random
// index matches `lastShownIndex`. Persistence of the returned index is the
// caller's responsibility (writes to `settings.lastHyroxHeadlineIndex` so the
// chosen line stays stable across re-renders + the back/forward dance until a
// NEW Start HYROX event fires). Returns `{ text, index }`.
export function pickHeadline(lastShownIndex) {
  const bank = HYROX_HEADLINES
  if (!Array.isArray(bank) || bank.length === 0) {
    return { text: '', index: -1 }
  }
  if (bank.length === 1) {
    return { text: bank[0], index: 0 }
  }
  let idx
  do {
    idx = Math.floor(Math.random() * bank.length)
  } while (idx === lastShownIndex)
  return { text: bank[idx], index: idx }
}

// `pickHyroxStationForToday(roundConfig, sessions)` — picks the prescribed
// station for today's HYROX round per design doc §5.3 (Option A: rotation-pool
// with light freshness bias). Used by the Start HYROX overlay to pre-populate
// the station chip when the round template uses a rotation pool.
//
// Behavior:
// - Single-station rounds (`roundConfig.stationId`): returns that station id
//   directly. The pool path doesn't apply.
// - Pool rounds (`roundConfig.rotationPool: string[]`): scans recent sessions
//   for the same round template, finds which pool members were used in the
//   last 2 sessions, and returns the FIRST pool member NOT used recently. If
//   the user has used every pool member in the last 2 sessions (small pool
//   case), falls back to the least-recently-used member. If no prior history,
//   returns the first pool entry.
// - Defensive: returns null when both `stationId` and `rotationPool` are
//   absent/empty/malformed.
//
// `sessions` is optional — when omitted or empty the freshness bias short-
// circuits to the pool's first entry. `exerciseIdOrName` is the round-template
// library id (or fallback name) used to filter prior session history.
export function pickHyroxStationForToday(roundConfig, sessions, exerciseIdOrName = null) {
  if (!roundConfig || typeof roundConfig !== 'object') return null

  // Single-station case wins immediately.
  if (typeof roundConfig.stationId === 'string' && roundConfig.stationId) {
    return roundConfig.stationId
  }

  const pool = Array.isArray(roundConfig.rotationPool)
    ? roundConfig.rotationPool.filter(s => typeof s === 'string' && s)
    : []
  if (pool.length === 0) return null

  // No history → first pool entry wins.
  if (!Array.isArray(sessions) || sessions.length === 0 || !exerciseIdOrName) {
    return pool[0]
  }

  const target = String(exerciseIdOrName)
  // Walk newest-first, look at the last 2 sessions of this round template.
  const ordered = [...sessions]
    .filter(s => s?.mode === 'bb' && Array.isArray(s?.data?.exercises))
    .sort((a, b) => {
      const da = a?.date ? new Date(a.date).getTime() : 0
      const db = b?.date ? new Date(b.date).getTime() : 0
      return db - da
    })

  // Map from stationId → most-recent timestamp it was used in this round.
  const lastSeen = new Map()
  let templateSessionsHit = 0
  for (const session of ordered) {
    if (templateSessionsHit >= 2) break
    let matched = false
    for (const ex of session.data.exercises) {
      const idMatch = ex?.exerciseId && ex.exerciseId === target
      const nameMatch = ex?.name && ex.name === target
      if (!idMatch && !nameMatch) continue
      if (!Array.isArray(ex.rounds)) continue
      matched = true
      for (const round of ex.rounds) {
        if (!round || !Array.isArray(round.legs)) continue
        for (const leg of round.legs) {
          if (leg?.type === 'station' && typeof leg.stationId === 'string') {
            if (pool.includes(leg.stationId)) {
              const ts = session.date ? new Date(session.date).getTime() : 0
              const prev = lastSeen.get(leg.stationId) || 0
              if (ts > prev) lastSeen.set(leg.stationId, ts)
            }
          }
        }
      }
    }
    if (matched) templateSessionsHit += 1
  }

  // No template history found → first pool entry.
  if (lastSeen.size === 0) return pool[0]

  // Prefer first pool member NOT used in the recent window.
  for (const stationId of pool) {
    if (!lastSeen.has(stationId)) return stationId
  }

  // Every pool member used recently → least-recently-used wins.
  let best = pool[0]
  let bestTs = lastSeen.get(best) ?? Infinity
  for (const stationId of pool) {
    const ts = lastSeen.get(stationId) ?? 0
    if (ts < bestTs) {
      best = stationId
      bestTs = ts
    }
  }
  return best
}

// ── Misc ───────────────────────────────────────────────────────────────────

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
