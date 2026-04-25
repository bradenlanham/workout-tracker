// hybrid-b41-sanity.mjs — Batch 41 HYROX section preview sanity.
//
// Validates:
//   1. getLastHyroxRoundSession against synthetic rounds[] data — total
//      time + round count + exerciseId vs name resolution.
//   2. formatDuration across ranges.
//   3. Section-detection predicate for the "HYROX" label match.

import { getLastHyroxRoundSession, formatDuration } from './src/utils/helpers.js'

let pass = 0
let fail = 0
function check(label, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`) }
}

// ── 1. getLastHyroxRoundSession ─────────────────────────────────────────────
console.log('\n[1] getLastHyroxRoundSession')

check('null sessions returns null', getLastHyroxRoundSession(null, 'foo') === null)
check('empty sessions returns null', getLastHyroxRoundSession([], 'foo') === null)
check('missing target returns null', getLastHyroxRoundSession([{}], null) === null)
check('non-bb sessions ignored', getLastHyroxRoundSession([{mode:'cardio',data:{exercises:[]}}], 'x') === null)
check('hyrox-round with no rounds[] ignored', getLastHyroxRoundSession([
  { mode: 'bb', date: '2026-04-20T00:00:00Z', data: { exercises: [{name:'Test Round',exerciseId:'ex_test_round'}] } }
], 'ex_test_round') === null)

// Synthetic session w/ a rounds[] log
const syntheticRoundsSession = {
  mode: 'bb',
  date: '2026-04-20T18:00:00Z',
  data: {
    exercises: [
      {
        name: 'HYROX Run + SkiErg Round',
        exerciseId: 'ex_hyrox_run_skierg',
        rounds: [
          {
            roundIndex: 1,
            legs: [
              { type: 'run', timeSec: 240, distanceMeters: 800 },
              { type: 'station', stationId: 'sta_skierg', timeSec: 142 },
            ],
            restAfterSec: 120,
          },
          {
            roundIndex: 2,
            legs: [
              { type: 'run', timeSec: 245, distanceMeters: 800 },
              { type: 'station', stationId: 'sta_skierg', timeSec: 138 },
            ],
            restAfterSec: 120,
          },
        ],
        completedAt: 1729440000000,
      },
    ],
  },
}

const r1 = getLastHyroxRoundSession([syntheticRoundsSession], 'ex_hyrox_run_skierg')
check('id match returns result', !!r1)
// totals: 240+142+120 + 245+138+120 = 1005
check('totalTimeSec sums all leg times + restAfter', r1?.totalTimeSec === 1005, `got ${r1?.totalTimeSec}`)
check('roundCount equals rounds.length', r1?.roundCount === 2)
check('returns matching loggedExercise', r1?.loggedExercise?.name === 'HYROX Run + SkiErg Round')

// Name fallback
const r2 = getLastHyroxRoundSession([syntheticRoundsSession], 'HYROX Run + SkiErg Round')
check('name fallback also matches', !!r2 && r2.totalTimeSec === 1005)

// Newest-first ordering
const olderSession = {
  ...syntheticRoundsSession,
  date: '2026-04-15T18:00:00Z',
  data: {
    exercises: [
      {
        ...syntheticRoundsSession.data.exercises[0],
        rounds: [{ roundIndex: 1, legs: [{ type: 'run', timeSec: 100 }], restAfterSec: 0 }],
      },
    ],
  },
}
const r3 = getLastHyroxRoundSession([olderSession, syntheticRoundsSession], 'ex_hyrox_run_skierg')
check('newest session wins ordering', r3?.totalTimeSec === 1005)

// ── 2. formatDuration ───────────────────────────────────────────────────────
console.log('\n[2] formatDuration')

check('0 seconds → 0:00', formatDuration(0) === '0:00')
check('45 seconds → 0:45', formatDuration(45) === '0:45')
check('60 seconds → 1:00', formatDuration(60) === '1:00')
check('1005 seconds → 16:45', formatDuration(1005) === '16:45')
check('3600 seconds → 1:00:00', formatDuration(3600) === '1:00:00')
check('null → empty string', formatDuration(null) === '')
check('NaN → empty string', formatDuration(NaN) === '')
check('negative → empty string', formatDuration(-1) === '')
check('rounds half-second up', formatDuration(45.5) === '0:46')

// ── 3. HYROX section detection predicate ────────────────────────────────────
console.log('\n[3] HYROX section detection predicate')

const isHyroxSection = (group) =>
  !group.isActiveSuperset &&
  !group.isCompleted &&
  typeof group.label === 'string' &&
  group.label.trim().toLowerCase() === 'hyrox'

check('label "HYROX" matches', isHyroxSection({ label: 'HYROX' }) === true)
check('label "hyrox" matches', isHyroxSection({ label: 'hyrox' }) === true)
check('label "  HYROX  " matches (trim)', isHyroxSection({ label: '  HYROX  ' }) === true)
check('label "Hyrox" matches', isHyroxSection({ label: 'Hyrox' }) === true)
check('label "Lift" does NOT match', isHyroxSection({ label: 'Lift' }) === false)
check('label "Primary" does NOT match', isHyroxSection({ label: 'Primary' }) === false)
check('label "HYROX Round" does NOT match (must be exact)', isHyroxSection({ label: 'HYROX Round' }) === false)
check('isCompleted blocks match', isHyroxSection({ label: 'HYROX', isCompleted: true }) === false)
check('isActiveSuperset blocks match', isHyroxSection({ label: 'HYROX', isActiveSuperset: true }) === false)
check('null label does NOT match', isHyroxSection({ label: null }) === false)
check('missing label does NOT match', isHyroxSection({}) === false)

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${pass}/${pass + fail} pass`)
if (fail > 0) {
  console.log(`${fail} FAIL`)
  process.exit(1)
}
