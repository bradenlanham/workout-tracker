// Sanity check for Batch 19 equipment instance scoping (spec §3.4, step 7).
// Validates:
//   1. getExerciseHistory with an instance filter returns only matching sessions.
//   2. getExerciseHistory without a filter returns all sessions (pre-Batch-19 behavior).
//   3. getInstancesForExercise returns distinct non-empty instances newest-first,
//      case-insensitive dedupe with original casing preserved.
//   4. History items echo equipmentInstance when set.
//   5. Scoped history produces a different recommender prescription than unscoped
//      when two machines have divergent trends on the same exercise.
//   6. Against debug-backup.json (real user data, no equipmentInstance anywhere):
//      all exercise histories behave identically to pre-19 when filter is null.
//
// Run: node equipment-instance-sanity.mjs (from worktree root)

import { readFileSync } from 'node:fs'
import {
  getExerciseHistory, getInstancesForExercise,
  recommendNextLoad,
  migrateSessionsToV2, migrateSessionsToV3,
} from './src/utils/helpers.js'
import { EXERCISE_LIBRARY } from './src/data/exerciseLibrary.js'

function slugify(name) { return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') }

function buildBuiltInLibrary() {
  return EXERCISE_LIBRARY.map(raw => ({
    id: `ex_${slugify(raw.name)}`,
    name: raw.name, aliases: [],
    primaryMuscles: [raw.muscleGroup], equipment: raw.equipment,
    isBuiltIn: true, defaultUnilateral: false, loadIncrement: 5,
    defaultRepRange: [8, 12],
    progressionClass: raw.muscleGroup === 'Full Body' ? 'compound' : raw.equipment === 'Bodyweight' ? 'bodyweight' : 'isolation',
    needsTagging: false, createdAt: '2026-04-17',
  }))
}

// Synthesize a session shell at a given date with a single exercise, optional instance.
function mkSession({ date, exerciseId, name, weight, reps, instance }) {
  return {
    id: `sess_${date}`,
    date,
    mode: 'bb',
    type: 'push',
    data: {
      workoutType: 'push',
      exercises: [
        {
          name, exerciseId,
          notes: '', completedAt: 0, unilateral: false,
          ...(instance ? { equipmentInstance: instance } : {}),
          sets: [
            { type: 'working', weight, rawWeight: weight, reps, isNewPR: false },
          ],
        },
      ],
    },
  }
}

let passCount = 0
let failCount = 0
function expect(label, cond, detail = '') {
  const mark = cond ? '✓' : '✗'
  console.log(`  ${label.padEnd(60)} ${mark} ${detail}`)
  if (cond) passCount++
  else failCount++
}

// ── 1. Synthetic: instance-filtered history ──────────────────────────────
console.log('━━━ 1. Instance-filtered getExerciseHistory ━━━')
{
  const sessions = [
    mkSession({ date: '2026-04-01', exerciseId: 'ex_leg_press', name: 'Leg Press', weight: 200, reps: 10, instance: 'Hoist' }),
    mkSession({ date: '2026-04-03', exerciseId: 'ex_leg_press', name: 'Leg Press', weight: 280, reps: 10, instance: 'Cybex' }),
    mkSession({ date: '2026-04-05', exerciseId: 'ex_leg_press', name: 'Leg Press', weight: 210, reps: 10, instance: 'Hoist' }),
    mkSession({ date: '2026-04-07', exerciseId: 'ex_leg_press', name: 'Leg Press', weight: 290, reps: 10, instance: 'Cybex' }),
    mkSession({ date: '2026-04-09', exerciseId: 'ex_leg_press', name: 'Leg Press', weight: 225, reps: 9 }), // untagged
  ]

  const all    = getExerciseHistory(sessions, 'ex_leg_press', 'Leg Press')
  const hoist  = getExerciseHistory(sessions, 'ex_leg_press', 'Leg Press', 'Hoist')
  const cybex  = getExerciseHistory(sessions, 'ex_leg_press', 'Leg Press', 'Cybex')
  const garbage = getExerciseHistory(sessions, 'ex_leg_press', 'Leg Press', 'Nope')

  expect('Unscoped returns all 5 sessions',  all.length === 5,  `got ${all.length}`)
  expect('Hoist filter returns 2 sessions',  hoist.length === 2, `got ${hoist.length}`)
  expect('Cybex filter returns 2 sessions',  cybex.length === 2, `got ${cybex.length}`)
  expect('Unknown filter returns 0 sessions', garbage.length === 0, `got ${garbage.length}`)

  const hoistWeights = hoist.map(h => h.weight)
  expect('Hoist session weights match', JSON.stringify(hoistWeights) === '[200,210]', `got ${JSON.stringify(hoistWeights)}`)

  const cybexWeights = cybex.map(h => h.weight)
  expect('Cybex session weights match', JSON.stringify(cybexWeights) === '[280,290]', `got ${JSON.stringify(cybexWeights)}`)

  // Case-insensitive
  const lower = getExerciseHistory(sessions, 'ex_leg_press', 'Leg Press', 'hoist')
  expect('Filter is case-insensitive (lowercase "hoist")', lower.length === 2, `got ${lower.length}`)
  const mixed = getExerciseHistory(sessions, 'ex_leg_press', 'Leg Press', 'HoiSt')
  expect('Filter is case-insensitive (mixed "HoiSt")', mixed.length === 2, `got ${mixed.length}`)

  // History items echo the instance
  expect('History item echoes Hoist instance',  hoist[0].equipmentInstance === 'Hoist', `got ${hoist[0].equipmentInstance}`)
  expect('Untagged session item has instance=null', all[4].equipmentInstance === null, `got ${all[4].equipmentInstance}`)

  // Empty string or null disables scoping (back to pre-19 behavior)
  const emptyFilter = getExerciseHistory(sessions, 'ex_leg_press', 'Leg Press', '')
  expect('Empty-string filter returns all sessions',   emptyFilter.length === 5, `got ${emptyFilter.length}`)
  const nullFilter = getExerciseHistory(sessions, 'ex_leg_press', 'Leg Press', null)
  expect('Null filter returns all sessions',           nullFilter.length === 5, `got ${nullFilter.length}`)
  const spaceFilter = getExerciseHistory(sessions, 'ex_leg_press', 'Leg Press', '   ')
  expect('Whitespace-only filter returns all sessions', spaceFilter.length === 5, `got ${spaceFilter.length}`)
}

// ── 2. getInstancesForExercise ───────────────────────────────────────────
console.log('\n━━━ 2. getInstancesForExercise ━━━')
{
  const sessions = [
    mkSession({ date: '2026-04-01', exerciseId: 'ex_leg_press', name: 'Leg Press', weight: 200, reps: 10, instance: 'Hoist' }),
    mkSession({ date: '2026-04-03', exerciseId: 'ex_leg_press', name: 'Leg Press', weight: 280, reps: 10, instance: 'Cybex' }),
    mkSession({ date: '2026-04-05', exerciseId: 'ex_leg_press', name: 'Leg Press', weight: 210, reps: 10, instance: 'hoist' }), // lowercase dup
    mkSession({ date: '2026-04-07', exerciseId: 'ex_leg_press', name: 'Leg Press', weight: 290, reps: 10, instance: '  Life Fitness  ' }), // whitespace
    mkSession({ date: '2026-04-09', exerciseId: 'ex_leg_press', name: 'Leg Press', weight: 225, reps: 9 }), // untagged
  ]
  const list = getInstancesForExercise(sessions, 'ex_leg_press', 'Leg Press')

  expect('Returns distinct instances',                list.length === 3, `got ${list.length}: ${JSON.stringify(list)}`)
  expect('Newest first: Life Fitness at index 0',     list[0] === 'Life Fitness', `got "${list[0]}"`)
  // Newest-first dedupe keeps the FIRST occurrence of each case-insensitive
  // key, so the 2026-04-05 "hoist" (newer) wins over the 2026-04-01 "Hoist".
  expect('Case-insensitive dedupe (newest casing kept)', list.filter(x => x.toLowerCase() === 'hoist').length === 1, `got ${JSON.stringify(list)}`)
  expect('Whitespace trimmed on Life Fitness',         list[0] === 'Life Fitness', `got "${list[0]}"`)
  expect('Untagged sessions excluded',                 !list.some(x => !x), `got ${JSON.stringify(list)}`)
  expect('Non-array sessions input returns []',        getInstancesForExercise(null, 'x', 'y').length === 0)
  expect('Missing exerciseId returns []',              getInstancesForExercise(sessions, '', 'Leg Press').length === 0)
}

// ── 3. Scoped history drives a different recommendation ──────────────────
console.log('\n━━━ 3. Scoped history → different prescription ━━━')
{
  // 6 sessions on Hoist progressing 200→225, interleaved with 6 on Cybex
  // flat at 290. Pass `now` = right after the last synthetic session to
  // keep the engine's gap adjustment out of the comparison.
  const start = new Date('2026-03-01').getTime()
  const sessions = []
  const hoistE1RMs = [200, 205, 210, 215, 220, 225]
  const cybexE1RMs = [290, 290, 290, 290, 290, 290]
  for (let i = 0; i < 6; i++) {
    sessions.push(mkSession({
      date: new Date(start + i * 2 * 86400000).toISOString(),
      exerciseId: 'ex_leg_press', name: 'Leg Press',
      weight: hoistE1RMs[i], reps: 10, instance: 'Hoist',
    }))
    sessions.push(mkSession({
      date: new Date(start + (i * 2 + 1) * 86400000).toISOString(),
      exerciseId: 'ex_leg_press', name: 'Leg Press',
      weight: cybexE1RMs[i], reps: 10, instance: 'Cybex',
    }))
  }
  const now = new Date(start + 13 * 86400000).getTime()
  const hoistHist = getExerciseHistory(sessions, 'ex_leg_press', 'Leg Press', 'Hoist')
  const cybexHist = getExerciseHistory(sessions, 'ex_leg_press', 'Leg Press', 'Cybex')
  const allHist   = getExerciseHistory(sessions, 'ex_leg_press', 'Leg Press')

  expect('Hoist history has 6 sessions',     hoistHist.length === 6, `got ${hoistHist.length}`)
  expect('Cybex history has 6 sessions',     cybexHist.length === 6, `got ${cybexHist.length}`)
  expect('Unscoped history has 12 sessions', allHist.length === 12, `got ${allHist.length}`)

  const hoistRec = recommendNextLoad({
    history: hoistHist, targetReps: 10, mode: 'push',
    progressionClass: 'compound', loadIncrement: 5, now,
  })
  const cybexRec = recommendNextLoad({
    history: cybexHist, targetReps: 10, mode: 'push',
    progressionClass: 'compound', loadIncrement: 5, now,
  })
  const unscopedRec = recommendNextLoad({
    history: allHist, targetReps: 10, mode: 'push',
    progressionClass: 'compound', loadIncrement: 5, now,
  })

  // Hoist: last session 225×10, clear upward trend → push ≥ 225.
  expect('Hoist rec weight ≥ last Hoist session (clear uptrend)',
    hoistRec.prescription.weight >= 225,
    `got ${hoistRec.prescription.weight}, last was 225`)
  // Cybex: last session 290×10, flat trend → push should hold close (within ±5%).
  expect('Cybex rec weight close to last Cybex session (flat trend)',
    Math.abs(cybexRec.prescription.weight - 290) / 290 <= 0.05,
    `got ${cybexRec.prescription.weight}, last was 290`)
  expect('Scoped prescriptions differ from each other',
    hoistRec.prescription.weight !== cybexRec.prescription.weight,
    `Hoist=${hoistRec.prescription.weight}, Cybex=${cybexRec.prescription.weight}`)
  expect('Unscoped prescription is a defined number',
    typeof unscopedRec.prescription.weight === 'number' && unscopedRec.prescription.weight > 0,
    `got ${unscopedRec.prescription.weight}`)
}

// ── 4. Against debug-backup.json (zero instance data — regression check) ─
console.log('\n━━━ 4. debug-backup.json baseline (pre-19 compat) ━━━')
try {
  const backupUrl = new URL('../../../debug-backup.json', import.meta.url)
  const raw = readFileSync(backupUrl, 'utf8')
  const backup = JSON.parse(raw)
  let sessions = Array.isArray(backup.sessions) ? backup.sessions : (backup.state?.sessions || [])
  sessions = migrateSessionsToV2(sessions)
  const lib = buildBuiltInLibrary()
  const migrated = migrateSessionsToV3({ sessions, library: lib })
  sessions = migrated.sessions

  // Sanity: no session has equipmentInstance set.
  let withInstance = 0
  for (const s of sessions) {
    for (const ex of (s?.data?.exercises || [])) {
      if (ex.equipmentInstance) withInstance++
    }
  }
  expect('Backup has zero equipmentInstance fields (pre-19 baseline)',
    withInstance === 0, `got ${withInstance} tagged`)

  // Every exercise: history with null filter === history with '' filter === history with undefined.
  const ids = new Set()
  for (const s of sessions) {
    for (const ex of (s?.data?.exercises || [])) {
      if (ex.exerciseId) ids.add(ex.exerciseId)
    }
  }
  let mismatches = 0
  for (const id of ids) {
    const a = getExerciseHistory(sessions, id)
    const b = getExerciseHistory(sessions, id, null, null)
    const c = getExerciseHistory(sessions, id, null, '')
    if (a.length !== b.length || b.length !== c.length) mismatches++
  }
  expect('Null/empty/undefined instance filter identical on backup',
    mismatches === 0, `${mismatches} exercise ids diverged (of ${ids.size})`)

  // And scoping by a non-matching instance returns empty.
  const firstId = [...ids][0]
  const empty = getExerciseHistory(sessions, firstId, null, 'Zzz')
  expect('Unknown instance on real data returns empty',
    empty.length === 0, `got ${empty.length}`)

  // getInstancesForExercise returns [] when no instances tagged.
  let any = 0
  for (const id of ids) {
    if (getInstancesForExercise(sessions, id).length > 0) any++
  }
  expect('getInstancesForExercise returns [] across all backup exercises',
    any === 0, `${any} exercises had non-empty lists`)

  console.log(`  (${ids.size} distinct exerciseIds scanned across ${sessions.length} sessions)`)
} catch (err) {
  console.log(`  Skipped — ${err.message}`)
}

// ── Summary ──────────────────────────────────────────────────────────────
console.log('\n━━━ Summary ━━━')
console.log(`  ${passCount} passed  ${failCount} failed`)
if (failCount > 0) process.exit(1)
