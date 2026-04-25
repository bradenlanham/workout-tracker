// hybrid-b37-sanity.mjs — Batch 37 validation
//
// Validates classifyType, defaultDimensionsForType, predictExerciseMeta
// extension, migrateLibraryToV8, and the HYROX_STATIONS catalog integrity.
// Run from the worktree root:
//   node hybrid-b37-sanity.mjs
//
// Mirrors the existing rep-range-sanity / migration-* / anomaly-sanity /
// readiness-sanity / equipment-instance-sanity / gym-tags-sanity patterns.
// Loads workout-backup-2026-04-24.json from the repo root when available
// for real-data spot checks; skips that section gracefully if missing.

import { readFileSync, existsSync } from 'node:fs'
import {
  classifyType, defaultDimensionsForType, predictExerciseMeta,
  migrateLibraryToV6, migrateLibraryToV7, migrateLibraryToV8,
} from './src/utils/helpers.js'
import { HYROX_STATIONS, buildHyroxStationLibraryEntry } from './src/data/hyroxStations.js'

let pass = 0, fail = 0
function t(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) { pass++; console.log(`  ✓ ${label}`) }
  else    { fail++; console.log(`  ✗ ${label}\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`) }
}
function tOk(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else      { fail++; console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`) }
}

console.log('\n── classifyType ───────────────────────────────────────────')
// Weight-training defaults
t('Bench Press → weight-training', classifyType('Bench Press'), 'weight-training')
t('Pec Dec → weight-training', classifyType('Pec Dec'), 'weight-training')
t('Squat → weight-training', classifyType('Squat'), 'weight-training')
t('DB Lateral Raises → weight-training', classifyType('DB Lateral Raises'), 'weight-training')
t('Leg Press → weight-training', classifyType('Leg Press'), 'weight-training')
// Running
t('Easy Run → running', classifyType('Easy Run'), 'running')
t('Treadmill → running', classifyType('Treadmill'), 'running')
t('Incline Walk → running', classifyType('Incline Walk'), 'running')
t('Easy Bike → running', classifyType('Easy Bike'), 'running')
t('Outdoor Run → running', classifyType('Outdoor Run'), 'running')
// HYROX stations
t('SkiErg → hyrox-station', classifyType('SkiErg'), 'hyrox-station')
t('Sled Push → hyrox-station', classifyType('Sled Push'), 'hyrox-station')
t('Sled Pull → hyrox-station', classifyType('Sled Pull'), 'hyrox-station')
t('Burpee Broad Jump → hyrox-station', classifyType('Burpee Broad Jump'), 'hyrox-station')
t('Farmers Carry → hyrox-station', classifyType('Farmers Carry'), 'hyrox-station')
t('Sandbag Lunges → hyrox-station', classifyType('Sandbag Lunges'), 'hyrox-station')
t('Wall Balls → hyrox-station', classifyType('Wall Balls'), 'hyrox-station')
t('Rowing → hyrox-station', classifyType('Rowing'), 'hyrox-station')
// HYROX rounds
t('HYROX Round → hyrox-round', classifyType('HYROX Round'), 'hyrox-round')
t('HYROX Simulation Round → hyrox-round', classifyType('HYROX Simulation Round'), 'hyrox-round')
t('Run + SkiErg Round → hyrox-round', classifyType('Run + SkiErg Round'), 'hyrox-round')
// Edge cases
t('empty string → weight-training', classifyType(''), 'weight-training')
t('null → weight-training', classifyType(null), 'weight-training')
t('undefined → weight-training', classifyType(undefined), 'weight-training')
t('non-string → weight-training', classifyType(42), 'weight-training')

console.log('\n── defaultDimensionsForType ───────────────────────────────')
t('weight-training', defaultDimensionsForType('weight-training'), [
  { axis: 'weight', required: true, unit: 'lbs' },
  { axis: 'reps',   required: true             },
])
t('running', defaultDimensionsForType('running'), [
  { axis: 'distance',  required: true,  unit: 'mi' },
  { axis: 'time',      required: true,  unit: 's'  },
  { axis: 'intensity', required: false             },
])
t('hyrox-station fallback', defaultDimensionsForType('hyrox-station'), [
  { axis: 'time', required: true, unit: 's' },
])
t('hyrox-round (uses roundConfig, not dimensions)', defaultDimensionsForType('hyrox-round'), [])
t('unknown type defaults to weight-training shape', defaultDimensionsForType('garbage'), [
  { axis: 'weight', required: true, unit: 'lbs' },
  { axis: 'reps',   required: true             },
])

console.log('\n── predictExerciseMeta extension ──────────────────────────')
t('Bench Press → existing behavior + type', predictExerciseMeta('Bench Press'), {
  primaryMuscles: ['Chest'], equipment: 'Barbell', type: 'weight-training',
})
t('SkiErg → hyrox-station + Full Body + Other', predictExerciseMeta('SkiErg'), {
  primaryMuscles: ['Full Body'], equipment: 'Other', type: 'hyrox-station',
})
t('Sled Push → hyrox-station', predictExerciseMeta('Sled Push'), {
  primaryMuscles: ['Full Body'], equipment: 'Other', type: 'hyrox-station',
})
t('Wall Balls → hyrox-station', predictExerciseMeta('Wall Balls'), {
  primaryMuscles: ['Full Body'], equipment: 'Other', type: 'hyrox-station',
})
t('Easy Run → type-only fallback (no muscle keyword)', predictExerciseMeta('Easy Run'), {
  primaryMuscles: [], equipment: 'Other', type: 'running',
})
t('HYROX Simulation Round → type-only fallback', predictExerciseMeta('HYROX Simulation Round'), {
  primaryMuscles: [], equipment: 'Other', type: 'hyrox-round',
})
t('Totally Unknown → null (no match, weight-training default)', predictExerciseMeta('Totally Unknown'), null)
t('empty string → null', predictExerciseMeta(''), null)
t('null → null', predictExerciseMeta(null), null)
// Verify shrug Traps prediction still works (Batch 26 fix)
t('DB Shrug → Traps + type', predictExerciseMeta('DB Shrug'), {
  primaryMuscles: ['Traps'], equipment: 'Dumbbell', type: 'weight-training',
})

console.log('\n── HYROX_STATIONS catalog integrity ───────────────────────')
tOk('exactly 8 stations', HYROX_STATIONS.length === 8, `got ${HYROX_STATIONS.length}`)
const expectedIds = [
  'sta_skierg', 'sta_sled_push', 'sta_sled_pull', 'sta_burpee_broad',
  'sta_row', 'sta_farmers', 'sta_sandbag_lunges', 'sta_wall_balls',
]
for (const id of expectedIds) {
  const station = HYROX_STATIONS.find(s => s.id === id)
  tOk(`station ${id} present`, !!station)
  if (station) {
    tOk(`  ${id} has name`, typeof station.name === 'string' && station.name.length > 0)
    tOk(`  ${id} has dimensions[]`, Array.isArray(station.dimensions) && station.dimensions.length > 0)
    tOk(`  ${id} has raceStandard`, !!station.raceStandard && typeof station.raceStandard === 'object')
    tOk(`  ${id} id matches sta_* convention`, station.id.startsWith('sta_'))
  }
}
// Spot-check a couple of station dimension shapes
t('SkiErg dimensions = distance + time', HYROX_STATIONS.find(s => s.id === 'sta_skierg').dimensions, [
  { axis: 'distance', required: true, unit: 'm' },
  { axis: 'time',     required: true, unit: 's' },
])
t('Wall Balls dimensions = optional weight + required reps', HYROX_STATIONS.find(s => s.id === 'sta_wall_balls').dimensions, [
  { axis: 'weight', required: false, unit: 'lbs' },
  { axis: 'reps',   required: true              },
])
t('Sled Push dimensions = weight + distance + optional time', HYROX_STATIONS.find(s => s.id === 'sta_sled_push').dimensions, [
  { axis: 'weight',   required: true,  unit: 'lbs' },
  { axis: 'distance', required: true,  unit: 'm'   },
  { axis: 'time',     required: false, unit: 's'   },
])

console.log('\n── buildHyroxStationLibraryEntry ──────────────────────────')
const skierg = HYROX_STATIONS.find(s => s.id === 'sta_skierg')
const skiergEntry = buildHyroxStationLibraryEntry(skierg)
t('skierg entry id', skiergEntry.id, 'sta_skierg')
t('skierg entry name', skiergEntry.name, 'SkiErg')
t('skierg entry type', skiergEntry.type, 'hyrox-station')
t('skierg entry isBuiltIn', skiergEntry.isBuiltIn, true)
t('skierg entry primaryMuscles', skiergEntry.primaryMuscles, ['Full Body'])
t('skierg entry equipment', skiergEntry.equipment, 'Other')
t('skierg entry needsTagging', skiergEntry.needsTagging, false)
tOk('skierg entry dimensions is array', Array.isArray(skiergEntry.dimensions))
tOk('skierg entry has raceStandard', !!skiergEntry.raceStandard)

console.log('\n── migrateLibraryToV8 ─────────────────────────────────────')
// Synthetic v7 library (no type, no dimensions, no stations)
const v7Library = [
  { id: 'ex_bench_press', name: 'Bench Press', primaryMuscles: ['Chest'], equipment: 'Barbell', defaultRepRange: [5, 8], repRangeUserSet: false },
  { id: 'ex_pec_dec',     name: 'Pec Dec',     primaryMuscles: ['Chest'], equipment: 'Selectorized Machine', defaultRepRange: [6, 10], repRangeUserSet: false },
  { id: 'ex_squat',       name: 'Squat',       primaryMuscles: ['Quads'], equipment: 'Barbell', defaultRepRange: [5, 8], repRangeUserSet: false },
]
const v8Library = migrateLibraryToV8(v7Library)
tOk('output length = 3 + 8 stations = 11', v8Library.length === 11, `got ${v8Library.length}`)
// Original 3 entries gain type + dimensions
const benchPost = v8Library.find(e => e.id === 'ex_bench_press')
t('Bench Press type', benchPost.type, 'weight-training')
t('Bench Press dimensions', benchPost.dimensions, [
  { axis: 'weight', required: true, unit: 'lbs' },
  { axis: 'reps',   required: true             },
])
tOk('Bench Press preserves defaultRepRange', JSON.stringify(benchPost.defaultRepRange) === '[5,8]')
// All 8 stations resolvable post-migration
for (const id of expectedIds) {
  const station = v8Library.find(e => e.id === id)
  tOk(`post-v8: station ${id} resolvable`, !!station)
  if (station) {
    tOk(`  ${id} type = hyrox-station`, station.type === 'hyrox-station')
  }
}

console.log('\n── Idempotency ────────────────────────────────────────────')
// Re-run on v8 state should return same reference (no changes)
const v8AgainSameRef = migrateLibraryToV8(v8Library)
tOk('idempotency: re-run returns same reference', v8AgainSameRef === v8Library)

console.log('\n── User-collision: pre-existing sta_skierg preserved ──────')
const userLibrary = [
  { id: 'sta_skierg', name: 'My Custom SkiErg', primaryMuscles: ['Cardio'], equipment: 'Other', isBuiltIn: false, needsTagging: false },
  { id: 'ex_bench_press', name: 'Bench Press', primaryMuscles: ['Chest'], equipment: 'Barbell' },
]
const userPostV8 = migrateLibraryToV8(userLibrary)
const userSkierg = userPostV8.find(e => e.id === 'sta_skierg')
t('user sta_skierg name preserved', userSkierg.name, 'My Custom SkiErg')
t('user sta_skierg isBuiltIn preserved', userSkierg.isBuiltIn, false)
// User entry got type + dimensions added
t('user sta_skierg gets type', userSkierg.type, 'weight-training')
tOk('user sta_skierg gets dimensions', Array.isArray(userSkierg.dimensions))
// Only 7 NEW stations seeded (sta_skierg already present)
const stationCount = userPostV8.filter(e => e.id?.startsWith('sta_') && e.isBuiltIn === true).length
tOk('only 7 new stations seeded (user sta_skierg wins)', stationCount === 7, `got ${stationCount}`)
tOk('total length = 1 user + 1 lift + 7 new stations = 9', userPostV8.length === 9, `got ${userPostV8.length}`)

console.log('\n── Defensive: non-array / null / empty inputs ─────────────')
tOk('null returns null (no crash)', migrateLibraryToV8(null) === null)
tOk('undefined returns undefined', migrateLibraryToV8(undefined) === undefined)
tOk('non-array returns as-is', migrateLibraryToV8('not-array') === 'not-array')
const emptyResult = migrateLibraryToV8([])
tOk('empty array seeds 8 stations', Array.isArray(emptyResult) && emptyResult.length === 8)

console.log('\n── Real-data spot check (workout-backup-2026-04-24.json) ──')
const backupPath = './workout-backup-2026-04-24.json'
if (existsSync(backupPath)) {
  try {
    const backup = JSON.parse(readFileSync(backupPath, 'utf8'))
    const lib = Array.isArray(backup.exerciseLibrary) ? backup.exerciseLibrary : []
    console.log(`  source library has ${lib.length} entries`)
    // Run the v6 → v7 → v8 chain
    const v6 = migrateLibraryToV6(lib)
    const v7 = migrateLibraryToV7(v6)
    const v8 = migrateLibraryToV8(v7)
    tOk(`v8 length = source + 8 stations`, v8.length === lib.length + 8, `${v8.length} vs ${lib.length + 8}`)
    // All 8 stations resolvable
    for (const id of expectedIds) {
      tOk(`real-data: ${id} resolvable post-v8`, !!v8.find(e => e.id === id))
    }
    // All non-station entries get type='weight-training' + dimensions
    const lifts = v8.filter(e => !e.id?.startsWith('sta_'))
    const allTyped = lifts.every(e => typeof e.type === 'string')
    const allDimensioned = lifts.every(e => Array.isArray(e.dimensions))
    tOk(`real-data: all ${lifts.length} lifts have type field`, allTyped)
    tOk(`real-data: all ${lifts.length} lifts have dimensions array`, allDimensioned)
    const allWeightTraining = lifts.every(e => e.type === 'weight-training')
    tOk(`real-data: all lifts default to weight-training`, allWeightTraining)
  } catch (e) {
    console.log(`  (skipped — backup parse failed: ${e.message})`)
  }
} else {
  console.log(`  (skipped — ${backupPath} not found)`)
}

console.log(`\n── Result: ${pass} passed, ${fail} failed ─────────────────────\n`)
process.exit(fail > 0 ? 1 : 0)
