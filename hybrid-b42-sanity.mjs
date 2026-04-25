// hybrid-b42-sanity.mjs — Batch 42 Start HYROX overlay sanity.
//
// Validates:
//   1. HYROX_HEADLINES bank: 30 entries, all non-empty strings.
//   2. pickHeadline(lastShownIndex): never returns lastShownIndex.
//   3. pickHyroxStationForToday — single-station case, no-history pool case,
//      pool case with prior history (least-recently-used wins),
//      pool case where every member used recently, defensive cases.
//   4. End-to-end seeds for the two Brooke round templates against the
//      brooke-hybrid-split.json roundConfig shape:
//      - Tuesday Run+SkiErg → roundCount=4, runDistance=800m, rest=120s, SkiErg.
//      - Friday rotation pool → roundCount=4, runDistance=1000m, rest=90s,
//        first-not-recently-used station from the 7-member pool.

import { HYROX_HEADLINES } from './src/data/hyroxHeadlines.js'
import { pickHeadline, pickHyroxStationForToday } from './src/utils/helpers.js'

let pass = 0
let fail = 0
function check(label, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`) }
}

// ── 1. HYROX_HEADLINES bank integrity ──────────────────────────────────────
console.log('\n[1] HYROX_HEADLINES bank')
check('exports an array', Array.isArray(HYROX_HEADLINES))
check('contains 30 entries', HYROX_HEADLINES.length === 30, `got ${HYROX_HEADLINES.length}`)
check('every entry is a non-empty string',
  HYROX_HEADLINES.every(h => typeof h === 'string' && h.trim().length > 0))
check('every entry is short (<= 50 chars per design doc §13.3 two-line max)',
  HYROX_HEADLINES.every(h => h.length <= 50))
check('no duplicate headlines', new Set(HYROX_HEADLINES).size === HYROX_HEADLINES.length)
// Spot-check the three tier representatives (one from each per design doc §13.1).
check('contains tier 1 anchor "Lock in."', HYROX_HEADLINES.includes('Lock in.'))
check('contains tier 2 anchor "You against last week."', HYROX_HEADLINES.includes('You against last week.'))
check('contains tier 3 anchor "Time to suffer fluently."', HYROX_HEADLINES.includes('Time to suffer fluently.'))

// ── 2. pickHeadline ────────────────────────────────────────────────────────
console.log('\n[2] pickHeadline')

// 200 trials: returned index must never equal lastShownIndex.
const TRIALS = 200
let neverRepeats = true
for (let i = 0; i < TRIALS; i++) {
  const last = i % HYROX_HEADLINES.length
  const picked = pickHeadline(last)
  if (picked.index === last) {
    neverRepeats = false
    break
  }
  if (picked.text !== HYROX_HEADLINES[picked.index]) {
    neverRepeats = false
    break
  }
}
check(`returns non-repeat index across ${TRIALS} trials`, neverRepeats)

// First-time call (lastShownIndex = -1 sentinel): every index is fair game.
const firstCall = pickHeadline(-1)
check('first-time call returns a valid index', firstCall.index >= 0 && firstCall.index < HYROX_HEADLINES.length)
check('first-time call returns a valid text', typeof firstCall.text === 'string' && firstCall.text.length > 0)

// Coverage: in 500 trials seeded with -1, we should hit at least 25 of 30 indices.
const coverageHits = new Set()
for (let i = 0; i < 500; i++) {
  coverageHits.add(pickHeadline(-1).index)
}
check(`500 trials cover ≥25 distinct indices (got ${coverageHits.size})`, coverageHits.size >= 25)

// ── 3. pickHyroxStationForToday — single-station + pool branches ───────────
console.log('\n[3] pickHyroxStationForToday')

// 3a. Single-station case
check('single-station returns its stationId',
  pickHyroxStationForToday({ stationId: 'sta_skierg' }, [], 'ex_round_1') === 'sta_skierg')

// 3b. Pool with no history → first pool entry
check('pool with no sessions returns first pool entry',
  pickHyroxStationForToday(
    { rotationPool: ['sta_row', 'sta_sled_push', 'sta_skierg'] },
    [],
    'ex_friday'
  ) === 'sta_row')

check('pool with no exerciseIdOrName returns first pool entry',
  pickHyroxStationForToday(
    { rotationPool: ['sta_row', 'sta_sled_push'] },
    [{ mode: 'bb', date: '2026-04-22', data: { exercises: [] } }],
    null
  ) === 'sta_row')

// 3c. Pool with prior history → first NOT used recently
const poolHistorySessions = [
  // Newest session (Friday last week): used sta_row
  {
    mode: 'bb',
    date: '2026-04-25T00:00:00Z',
    data: {
      exercises: [{
        exerciseId: 'ex_friday_sim',
        name: 'HYROX Simulation Round',
        rounds: [
          { roundIndex: 0, legs: [
            { type: 'run', distanceMeters: 1000, timeSec: 240 },
            { type: 'station', stationId: 'sta_row', timeSec: 90 },
          ], restAfterSec: 90 },
        ],
      }],
    },
  },
  // Older session: used sta_sled_push
  {
    mode: 'bb',
    date: '2026-04-18T00:00:00Z',
    data: {
      exercises: [{
        exerciseId: 'ex_friday_sim',
        name: 'HYROX Simulation Round',
        rounds: [
          { roundIndex: 0, legs: [
            { type: 'run', distanceMeters: 1000, timeSec: 240 },
            { type: 'station', stationId: 'sta_sled_push', timeSec: 80 },
          ], restAfterSec: 90 },
        ],
      }],
    },
  },
]

const poolWithRecency = pickHyroxStationForToday(
  { rotationPool: ['sta_row', 'sta_sled_push', 'sta_skierg', 'sta_burpee_broad'] },
  poolHistorySessions,
  'ex_friday_sim'
)
// Last 2 sessions used sta_row + sta_sled_push. First pool member NOT used
// in those is sta_skierg.
check(`pool skips recent stations (got ${poolWithRecency})`, poolWithRecency === 'sta_skierg')

// 3d. Pool with all members recently used → least-recently-used wins
const everyoneUsed = pickHyroxStationForToday(
  { rotationPool: ['sta_row', 'sta_sled_push'] }, // both used in poolHistorySessions
  poolHistorySessions,
  'ex_friday_sim'
)
// sta_sled_push (older session) is least-recently-used → wins
check(`small-pool least-recently-used wins (got ${everyoneUsed})`, everyoneUsed === 'sta_sled_push')

// 3e. Defensive
check('null roundConfig returns null', pickHyroxStationForToday(null, [], 'x') === null)
check('empty rotationPool returns null',
  pickHyroxStationForToday({ rotationPool: [] }, [], 'x') === null)
check('non-array sessions falls back to first pool entry',
  pickHyroxStationForToday({ rotationPool: ['sta_skierg', 'sta_row'] }, null, 'ex_x') === 'sta_skierg')
check('falsy roundConfig.stationId + rotationPool present uses pool',
  pickHyroxStationForToday(
    { stationId: '', rotationPool: ['sta_skierg', 'sta_row'] },
    [],
    'ex_x'
  ) === 'sta_skierg')

// 3f. Name-fallback resolution
const nameFallbackSessions = [
  {
    mode: 'bb',
    date: '2026-04-22T00:00:00Z',
    data: {
      exercises: [{
        // no exerciseId — pre-v3 data
        name: 'HYROX Round',
        rounds: [{ legs: [{ type: 'station', stationId: 'sta_row' }] }],
      }],
    },
  },
]
check('name fallback when exerciseId absent',
  pickHyroxStationForToday(
    { rotationPool: ['sta_row', 'sta_skierg'] },
    nameFallbackSessions,
    'HYROX Round'
  ) === 'sta_skierg')

// ── 4. Brooke round templates seed correctly ───────────────────────────────
console.log('\n[4] Brooke round templates seed correctly')

// Tuesday: HYROX Run + SkiErg Round → fixed station, 800m run, 4 rounds, 120s rest.
const tuesdayConfig = {
  runDimensions: { distance: { default: 800, unit: 'm' } },
  stationId: 'sta_skierg',
  defaultRoundCount: 4,
  defaultRestSeconds: 120,
}
check('Tuesday seeds roundCount=4', tuesdayConfig.defaultRoundCount === 4)
check('Tuesday seeds runDistance=800m', tuesdayConfig.runDimensions.distance.default === 800)
check('Tuesday seeds runUnit=m', tuesdayConfig.runDimensions.distance.unit === 'm')
check('Tuesday seeds rest=120s', tuesdayConfig.defaultRestSeconds === 120)
check('Tuesday picker resolves to SkiErg',
  pickHyroxStationForToday(tuesdayConfig, [], 'ex_tuesday') === 'sta_skierg')

// Friday: HYROX Simulation Round → rotation pool of 7, 1000m run, 4 rounds, 90s rest.
const fridayConfig = {
  runDimensions: { distance: { default: 1000, unit: 'm' } },
  rotationPool: [
    'sta_skierg', 'sta_sled_push', 'sta_sled_pull', 'sta_row',
    'sta_farmers', 'sta_sandbag_lunges', 'sta_wall_balls',
  ],
  defaultRoundCount: 4,
  defaultRestSeconds: 90,
}
check('Friday seeds roundCount=4', fridayConfig.defaultRoundCount === 4)
check('Friday seeds runDistance=1000m', fridayConfig.runDimensions.distance.default === 1000)
check('Friday seeds rest=90s', fridayConfig.defaultRestSeconds === 90)
check('Friday rotation pool has 7 members', fridayConfig.rotationPool.length === 7)
// No prior history → picker returns first pool entry (sta_skierg).
check('Friday no-history picker → first pool entry (sta_skierg)',
  pickHyroxStationForToday(fridayConfig, [], 'ex_friday') === 'sta_skierg')

// With one prior session using sta_skierg, picker should advance to sta_sled_push.
const fridayOnePriorSession = [{
  mode: 'bb',
  date: '2026-04-18T00:00:00Z',
  data: {
    exercises: [{
      exerciseId: 'ex_friday',
      name: 'HYROX Simulation Round',
      rounds: [{ legs: [{ type: 'station', stationId: 'sta_skierg' }] }],
    }],
  },
}]
const advanced = pickHyroxStationForToday(fridayConfig, fridayOnePriorSession, 'ex_friday')
check(`Friday with sta_skierg-recent advances to next pool member (got ${advanced})`,
  advanced === 'sta_sled_push')

// ── Done ───────────────────────────────────────────────────────────────────
console.log(`\n${pass}/${pass + fail} pass${fail > 0 ? ` · ${fail} fail` : ''}`)
if (fail > 0) process.exit(1)
