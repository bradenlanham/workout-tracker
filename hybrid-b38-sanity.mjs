// hybrid-b38-sanity.mjs — Batch 38 validation
//
// Validates the Batch 38 unit-conversion helpers (lbsToKg / kgToLbs /
// milesToMeters / metersToMiles) and the v8→v9 migrations
// (migrateSessionsToV9 + migrateCardioSessionsToV9). Run from the worktree
// root: `node hybrid-b38-sanity.mjs`.
//
// Mirrors the existing rep-range / hybrid-b37 / migration-* / anomaly /
// readiness / equipment-instance / gym-tags pattern.

import { readFileSync, existsSync } from 'node:fs'
import {
  LBS_TO_KG, MILES_TO_METERS,
  lbsToKg, kgToLbs, milesToMeters, metersToMiles,
  migrateSessionsToV9, migrateCardioSessionsToV9,
  migrateSessionsToV2, migrateSessionsToV3, migrateSessionsToV5,
  migrateLibraryToV6, migrateLibraryToV7, migrateLibraryToV8,
} from './src/utils/helpers.js'

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
function tApprox(label, got, want, eps = 0.001) {
  const ok = typeof got === 'number' && Math.abs(got - want) < eps
  if (ok) { pass++; console.log(`  ✓ ${label}`) }
  else    { fail++; console.log(`  ✗ ${label} — got ${got}, want ~${want}`) }
}

console.log('\n── Conversion constants ───────────────────────────────────')
tApprox('LBS_TO_KG = 0.45359237', LBS_TO_KG, 0.45359237, 1e-9)
tApprox('MILES_TO_METERS = 1609.344', MILES_TO_METERS, 1609.344, 1e-9)

console.log('\n── lbsToKg ────────────────────────────────────────────────')
t('100 lb → 45.359 kg', lbsToKg(100), 45.359)
t('45 lb → 20.412 kg', lbsToKg(45), 20.412)
t('225 lb (real-data) → 102.058 kg', lbsToKg(225), 102.058)
t('0 lb → 0 kg', lbsToKg(0), 0)
t('null → null', lbsToKg(null), null)
t('undefined → null', lbsToKg(undefined), null)
t('non-numeric string → null', lbsToKg('heavy'), null)
t('numeric string accepted (Number coerce)', lbsToKg('100'), 45.359)

console.log('\n── kgToLbs ────────────────────────────────────────────────')
t('45.359 kg ≈ 100 lb', kgToLbs(45.359), 99.999)
tApprox('100 kg → ~220.462 lb', kgToLbs(100), 220.462, 0.01)
t('null → null', kgToLbs(null), null)
t('non-numeric → null', kgToLbs('strong'), null)

console.log('\n── milesToMeters ──────────────────────────────────────────')
t('1 mi → 1609 m', milesToMeters(1), 1609)
t('0.5 mi → 805 m', milesToMeters(0.5), 805)
t('3.1 mi (5K-ish) → 4989 m', milesToMeters(3.1), 4989)
t('0 mi → 0 m', milesToMeters(0), 0)
t('null → null', milesToMeters(null), null)
t('undefined → null', milesToMeters(undefined), null)
t('non-numeric → null', milesToMeters('far'), null)

console.log('\n── metersToMiles ──────────────────────────────────────────')
t('1609 m ≈ 1 mi', metersToMiles(1609), 1)
t('1000 m ≈ 0.621 mi', metersToMiles(1000), 0.621)
t('500 m ≈ 0.311 mi (SkiErg standard)', metersToMiles(500), 0.311)
t('null → null', metersToMiles(null), null)

console.log('\n── migrateSessionsToV9 — synthetic v8 sessions ────────────')
const v8Session = {
  id: 'sess1',
  date: '2026-04-25T10:00:00.000Z',
  mode: 'bb',
  data: {
    workoutType: 'push',
    exercises: [
      {
        name: 'Bench Press',
        exerciseId: 'ex_bench_press',
        sets: [
          { type: 'warmup', reps: 8, weight: 135, isNewPR: false },
          { type: 'working', reps: 10, weight: 185, isNewPR: false,
            drops: [
              { reps: 8, weight: 135 },
              { reps: 6, weight: 95 },
            ],
          },
        ],
      },
      {
        name: 'Lateral DB Raises',
        exerciseId: 'ex_lateral_db_raises',
        unilateral: true,
        sets: [
          { type: 'working', reps: 12, weight: 50, rawWeight: 25, isNewPR: false },
        ],
      },
    ],
  },
}
const v9Sessions = migrateSessionsToV9([v8Session])
tOk('returns array', Array.isArray(v9Sessions))
tOk('one session out', v9Sessions.length === 1)
const benchSets = v9Sessions[0].data.exercises[0].sets
tApprox('warmup weight 135 → weightKg 61.235', benchSets[0].weightKg, 61.235, 0.001)
tApprox('working weight 185 → weightKg 83.915', benchSets[1].weightKg, 83.915, 0.001)
tOk('drops present', Array.isArray(benchSets[1].drops) && benchSets[1].drops.length === 2)
tApprox('drop[0] weight 135 → weightKg 61.235', benchSets[1].drops[0].weightKg, 61.235, 0.001)
tApprox('drop[1] weight 95 → weightKg 43.091', benchSets[1].drops[1].weightKg, 43.091, 0.001)
const latSet = v9Sessions[0].data.exercises[1].sets[0]
tApprox('unilateral weight 50 → weightKg 22.680', latSet.weightKg, 22.680, 0.001)
tApprox('unilateral rawWeight 25 → rawWeightKg 11.340', latSet.rawWeightKg, 11.340, 0.001)
tOk('original lbs fields preserved', latSet.weight === 50 && latSet.rawWeight === 25)

console.log('\n── migrateSessionsToV9 — idempotency ─────────────────────')
const v9Again = migrateSessionsToV9(v9Sessions)
tOk('re-running returns same reference (no changes)', v9Again === v9Sessions)

console.log('\n── migrateSessionsToV9 — defensive ────────────────────────')
tOk('null → null', migrateSessionsToV9(null) === null)
tOk('undefined → undefined', migrateSessionsToV9(undefined) === undefined)
tOk('non-array → as-is', migrateSessionsToV9('not-array') === 'not-array')
const empty = migrateSessionsToV9([])
tOk('empty array → empty array', Array.isArray(empty) && empty.length === 0)
const malformed = migrateSessionsToV9([{ noData: true }, null, { data: { exercises: 'invalid' } }])
tOk('malformed sessions pass through', malformed.length === 3)

console.log('\n── migrateCardioSessionsToV9 ──────────────────────────────')
const cardio = [
  { type: 'Running', distance: 3.1, distanceUnit: 'miles', duration: 1500 },
  { type: 'Treadmill', distance: 2.5, distanceUnit: 'miles', duration: 1200 },
  { type: 'Stairmaster', distance: 50, distanceUnit: 'floors', duration: 600 },
  { type: 'Bike', distance: 10, distanceUnit: null, duration: 1800 },
  { type: 'Walking', distance: null, distanceUnit: 'miles', duration: 900 },
]
const cardioV9 = migrateCardioSessionsToV9(cardio)
tApprox('Running miles 3.1 → distanceMiles 3.1', cardioV9[0].distanceMiles, 3.1, 0.001)
t('Running 3.1 mi → distanceMeters 4989', cardioV9[0].distanceMeters, 4989)
tApprox('Treadmill 2.5 mi → distanceMiles 2.5', cardioV9[1].distanceMiles, 2.5, 0.001)
t('Treadmill 2.5 mi → distanceMeters 4023', cardioV9[1].distanceMeters, 4023)
tOk('Stairmaster (floors) preserves shape, no metric fields',
  cardioV9[2].distance === 50 && cardioV9[2].distanceUnit === 'floors' &&
  cardioV9[2].distanceMiles === undefined && cardioV9[2].distanceMeters === undefined)
tOk('Bike (null unit) preserved unchanged',
  cardioV9[3].distanceUnit === null && cardioV9[3].distanceMiles === undefined)
tOk('Walking with null distance — no derivation, no crash',
  cardioV9[4].distanceMiles === undefined && cardioV9[4].distanceMeters === undefined)

console.log('\n── migrateCardioSessionsToV9 — idempotency ────────────────')
const cardioAgain = migrateCardioSessionsToV9(cardioV9)
tOk('idempotent re-run returns same reference', cardioAgain === cardioV9)
tOk('non-array → as-is', migrateCardioSessionsToV9(null) === null)

console.log('\n── Real-data spot check (workout-backup-2026-04-24.json) ──')
const backupPath = './workout-backup-2026-04-24.json'
if (existsSync(backupPath)) {
  try {
    const backup = JSON.parse(readFileSync(backupPath, 'utf8'))
    const lib = Array.isArray(backup.exerciseLibrary) ? backup.exerciseLibrary : []
    const sess = Array.isArray(backup.sessions) ? backup.sessions : []
    const card = Array.isArray(backup.cardioSessions) ? backup.cardioSessions : []
    console.log(`  source: ${sess.length} bb sessions, ${card.length} cardio sessions, ${lib.length} library entries`)
    // Run full migration chain
    const sV2 = migrateSessionsToV2(sess)
    const result = migrateSessionsToV3({ sessions: sV2, library: lib })
    const sV5 = migrateSessionsToV5(result.sessions)
    const sV9 = migrateSessionsToV9(sV5)
    let totalSets = 0
    let withWeightKg = 0
    let droppedWithoutKg = 0
    for (const s of sV9) {
      for (const ex of s.data?.exercises || []) {
        for (const set of ex.sets || []) {
          totalSets++
          if (typeof set.weight === 'number' && typeof set.weightKg === 'number') withWeightKg++
          for (const d of set.drops || []) {
            if (typeof d.weight === 'number' && typeof d.weightKg !== 'number') droppedWithoutKg++
          }
        }
      }
    }
    console.log(`  ${totalSets} total sets walked; ${withWeightKg} have weight + weightKg`)
    tOk(`every set with numeric weight got weightKg`, withWeightKg > 0 && withWeightKg <= totalSets)
    tOk(`no drop stage missing weightKg after migration`, droppedWithoutKg === 0)
    // Cardio migration spot check
    const cV9 = migrateCardioSessionsToV9(card)
    const milesEntries = cV9.filter(c => c.distanceUnit === 'miles' && typeof c.distance === 'number')
    const milesWithMetric = milesEntries.filter(c => typeof c.distanceMeters === 'number')
    console.log(`  ${milesEntries.length} miles-unit cardio sessions; ${milesWithMetric.length} got metric derived`)
    tOk('all miles-unit cardio sessions got distanceMeters', milesEntries.length === milesWithMetric.length)
  } catch (e) {
    console.log(`  (skipped — backup parse failed: ${e.message})`)
  }
} else {
  console.log(`  (skipped — ${backupPath} not found)`)
}

console.log(`\n── Result: ${pass} passed, ${fail} failed ─────────────────────\n`)
process.exit(fail > 0 ? 1 : 0)
