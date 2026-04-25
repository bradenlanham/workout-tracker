// hybrid-b44-sanity.mjs — Batch 44 sanity tests.
//
// Covers:
//   1. computeRoundDelta correctness across all three branches:
//      - 'round-position' (same template + station + roundIndex)
//      - 'station-anchored' (same station, different position OR template)
//      - 'cold' (no prior station history)
//   2. computeRoundDelta defensive cases (null/empty/malformed inputs).
//   3. Rest countdown decrement math (remaining = end - now).
//   4. Add-30s math (newEnd = oldEnd + 30000).
//   5. Skip-rest immediacy (skip handler maps to advanceToNextRound — pure
//      state-transition logic; we exercise the state shape here, the live
//      preview verifies the React wiring).
//   6. Final-round detection (currentRoundIdx + 1 >= roundCount → no flash,
//      no rest, route to summary).
//
// Usage: from worktree root, `node hybrid-b44-sanity.mjs`.

import { computeRoundDelta } from './src/utils/helpers.js'

let pass = 0
let fail = 0

function ok(label, cond) {
  if (cond) {
    pass++
    console.log(`  ✓ ${label}`)
  } else {
    fail++
    console.log(`  ✗ ${label}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers — synthesize sessions / legs in the LoggedHyroxRound shape
// (cf. helpers.js block comment near migrateSessionsToV9).
// ─────────────────────────────────────────────────────────────────────────

function makeSession({ id, date, exerciseId, name, rounds }) {
  return {
    id,
    date,
    mode: 'bb',
    type: 'brk_tuesday',
    grade: null,
    completedCardio: false,
    duration: 30,
    data: {
      workoutType: 'brk_tuesday',
      exercises: [
        {
          exerciseId,
          name,
          rounds,
        },
      ],
    },
  }
}

function makeRound(roundIndex, runTimeSec, stationId, stationTimeSec, stationDims = {}) {
  return {
    roundIndex,
    legs: [
      {
        roundIndex,
        type: 'run',
        distanceMeters: 800,
        timeSec: runTimeSec,
        completedAt: '2026-04-22T14:00:00Z',
      },
      {
        roundIndex,
        type: 'station',
        stationId,
        ...stationDims,
        timeSec: stationTimeSec,
        completedAt: '2026-04-22T14:05:00Z',
      },
    ],
    restAfterSec: 120,
    completedAt: '2026-04-22T14:05:00Z',
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Test 1 — Branch 1: 'round-position' (same template + station + position)
// ─────────────────────────────────────────────────────────────────────────

console.log('\nTest 1 — Branch 1: round-position (same template + station + roundIndex)')

const tueSessionPrior = makeSession({
  id: 'sess_prior',
  date: '2026-04-22T14:00:00Z',
  exerciseId: 'ex_brk_tuesday_round',
  name: 'HYROX Run + SkiErg Round',
  rounds: [
    makeRound(0, 240, 'sta_skierg', 350, { distanceMeters: 1000 }),
    makeRound(1, 248, 'sta_skierg', 360, { distanceMeters: 1000 }),
  ],
})

// Today: same template, same station, same round 0. Run 230s + station 340s = 570s.
// Prior R0: run 240 + station 350 = 590s. Today is 20s faster.
const todayCompletedLegs = [
  { roundIndex: 0, type: 'run', distanceMeters: 800, timeSec: 230, completedAt: 'now' },
  { roundIndex: 0, type: 'station', stationId: 'sta_skierg', distanceMeters: 1000, timeSec: 340, completedAt: 'now' },
]
const prescriptionTuesday = { exerciseId: 'ex_brk_tuesday_round', stationId: 'sta_skierg', roundCount: 4 }
const delta1 = computeRoundDelta(0, todayCompletedLegs, [tueSessionPrior], prescriptionTuesday)

ok('returns non-null', !!delta1)
ok("mode === 'round-position'", delta1?.mode === 'round-position')
ok('headline includes round number', delta1?.headline?.includes('Round 1 done'))
ok('headline includes today total time', delta1?.headline?.includes('9:30'))
ok('subheadline says "faster than last time"', delta1?.subheadline?.includes('faster than last time'))
ok('deltaSec is negative (today is faster)', delta1?.deltaSec === -20)
ok('subheadline includes 20s formatted', delta1?.subheadline?.startsWith('0:20'))

// Same scenario but today is SLOWER — verify "slower" copy fires.
const todayLegsSlower = [
  { roundIndex: 0, type: 'run', distanceMeters: 800, timeSec: 260, completedAt: 'now' },
  { roundIndex: 0, type: 'station', stationId: 'sta_skierg', distanceMeters: 1000, timeSec: 380, completedAt: 'now' },
]
const delta1b = computeRoundDelta(0, todayLegsSlower, [tueSessionPrior], prescriptionTuesday)
ok("slower path: mode === 'round-position'", delta1b?.mode === 'round-position')
ok('slower path: deltaSec is positive', delta1b?.deltaSec === 50)
ok('slower path: subheadline says "slower"', delta1b?.subheadline?.includes('slower'))

// Match exactly — "Matched last time"
const todayLegsMatch = [
  { roundIndex: 0, type: 'run', distanceMeters: 800, timeSec: 240, completedAt: 'now' },
  { roundIndex: 0, type: 'station', stationId: 'sta_skierg', distanceMeters: 1000, timeSec: 350, completedAt: 'now' },
]
const delta1c = computeRoundDelta(0, todayLegsMatch, [tueSessionPrior], prescriptionTuesday)
ok('match path: deltaSec === 0', delta1c?.deltaSec === 0)
ok("match path: subheadline === 'Matched last time'", delta1c?.subheadline === 'Matched last time')

// ─────────────────────────────────────────────────────────────────────────
// Test 2 — Branch 2: 'station-anchored' (same station, DIFFERENT round template)
// ─────────────────────────────────────────────────────────────────────────

console.log("\nTest 2 — Branch 2: station-anchored (same station, different template)")

// Friday template: SkiErg appeared in R2 of last Friday. Today's R0 is SkiErg.
// We fire branch 1 first — Tuesday's R0 has SkiErg too — but if we use a DIFFERENT
// exerciseId (Saturday's wall balls round) and search across templates, branch 1
// fails, branch 2 should fire.

const fridaySessionPrior = makeSession({
  id: 'sess_friday_prior',
  date: '2026-04-25T15:00:00Z',
  exerciseId: 'ex_brk_friday_round',
  name: 'HYROX Simulation Round',
  rounds: [
    makeRound(0, 300, 'sta_row', 400),
    makeRound(1, 310, 'sta_skierg', 320, { distanceMeters: 1000 }),  // SkiErg at R1
  ],
})

// Today's "Saturday" template prescribes SkiErg at R0. No prior SAT session.
// Branch 1 looks up by exerciseId='ex_brk_saturday_round' → no prior → fail.
// Branch 2 looks up SkiErg history → finds Friday R1 (most recent SkiErg leg).
// Today's SkiErg time is 290s. Friday R1's SkiErg was 320s. Delta = -30s (faster).

const todaySatLegs = [
  { roundIndex: 0, type: 'run', distanceMeters: 800, timeSec: 240, completedAt: 'now' },
  { roundIndex: 0, type: 'station', stationId: 'sta_skierg', distanceMeters: 1000, timeSec: 290, completedAt: 'now' },
]
const prescriptionSaturday = { exerciseId: 'ex_brk_saturday_round', stationId: 'sta_skierg', roundCount: 3 }
const delta2 = computeRoundDelta(0, todaySatLegs, [fridaySessionPrior], prescriptionSaturday)

ok('returns non-null', !!delta2)
ok("mode === 'station-anchored'", delta2?.mode === 'station-anchored')
ok("headline includes 'SkiErg'", delta2?.headline?.includes('SkiErg'))
ok('headline includes station leg time (4:50)', delta2?.headline?.includes('4:50'))
ok('subheadline references "your last SkiErg"', delta2?.subheadline?.includes('your last SkiErg'))
ok('deltaSec === -30 (today faster)', delta2?.deltaSec === -30)

// ─────────────────────────────────────────────────────────────────────────
// Test 3 — Branch 2 also fires when SAME template but DIFFERENT round position
// ─────────────────────────────────────────────────────────────────────────

console.log('\nTest 3 — Branch 2 fallback: same template, different round position')

// Today's R2 of Friday template hits SkiErg. Prior Friday R1 had SkiErg.
// Branch 1 looks at prior R2 — but prior had Sled Push at R2 (not SkiErg). Fail.
// Branch 2 looks at SkiErg history → finds R1 SkiErg. Branch 2 fires.

const fridayPriorMixed = makeSession({
  id: 'sess_fri_mixed',
  date: '2026-04-25T15:00:00Z',
  exerciseId: 'ex_brk_friday_round',
  name: 'HYROX Simulation Round',
  rounds: [
    makeRound(0, 300, 'sta_row', 400),
    makeRound(1, 310, 'sta_skierg', 320, { distanceMeters: 1000 }),  // SkiErg at R1
    makeRound(2, 320, 'sta_sled_push', 280, { distanceMeters: 50 }), // Sled Push at R2
  ],
})

const todayR2SkiErg = [
  { roundIndex: 2, type: 'run', distanceMeters: 1000, timeSec: 270, completedAt: 'now' },
  { roundIndex: 2, type: 'station', stationId: 'sta_skierg', distanceMeters: 1000, timeSec: 305, completedAt: 'now' },
]
const prescriptionFridayR2 = { exerciseId: 'ex_brk_friday_round', stationId: 'sta_skierg', roundCount: 4 }
const delta3 = computeRoundDelta(2, todayR2SkiErg, [fridayPriorMixed], prescriptionFridayR2)

ok('returns non-null', !!delta3)
ok("mode === 'station-anchored' (not round-position)", delta3?.mode === 'station-anchored')
ok("headline references 'SkiErg' from station-anchored framing", delta3?.headline?.includes('SkiErg'))
ok('deltaSec === -15 (305 today vs 320 prior R1)', delta3?.deltaSec === -15)

// ─────────────────────────────────────────────────────────────────────────
// Test 4 — Branch 3: cold start (no prior history of this station)
// ─────────────────────────────────────────────────────────────────────────

console.log('\nTest 4 — Branch 3: cold start (no prior station history)')

// User's first-ever HYROX session, no prior history at all.
const todayLegsCold = [
  { roundIndex: 0, type: 'run', distanceMeters: 800, timeSec: 240, completedAt: 'now' },
  { roundIndex: 0, type: 'station', stationId: 'sta_skierg', distanceMeters: 1000, timeSec: 350, completedAt: 'now' },
]
const prescriptionCold = { exerciseId: 'ex_brk_tuesday_round', stationId: 'sta_skierg', roundCount: 4 }
const delta4 = computeRoundDelta(0, todayLegsCold, [], prescriptionCold)

ok('returns non-null', !!delta4)
ok("mode === 'cold'", delta4?.mode === 'cold')
ok('subheadline === null (no comparison)', delta4?.subheadline === null)
ok('deltaSec === null', delta4?.deltaSec === null)
ok('headline shows round-total time (590s = 9:50)', delta4?.headline?.includes('9:50'))

// Cold start with prior NON-HYROX sessions in the array — still cold for HYROX.
const liftOnly = {
  id: 'sess_lift',
  date: '2026-04-22T14:00:00Z',
  mode: 'bb',
  type: 'push',
  data: { workoutType: 'push', exercises: [{ exerciseId: 'ex_pec_dec', name: 'Pec Dec', sets: [] }] },
}
const delta4b = computeRoundDelta(0, todayLegsCold, [liftOnly], prescriptionCold)
ok('cold even with lift-only prior sessions', delta4b?.mode === 'cold')

// ─────────────────────────────────────────────────────────────────────────
// Test 5 — Defensive: null / empty / malformed inputs
// ─────────────────────────────────────────────────────────────────────────

console.log('\nTest 5 — Defensive edge cases')

ok('null roundIndex → null', computeRoundDelta(null, [], [], {}) === null)
ok('negative roundIndex → null', computeRoundDelta(-1, [], [], {}) === null)
ok('non-number roundIndex → null', computeRoundDelta('0', [], [], {}) === null)
ok('null completedLegs → null', computeRoundDelta(0, null, [], {}) === null)
ok('non-array completedLegs → null', computeRoundDelta(0, 'foo', [], {}) === null)
ok('empty completedLegs → null', computeRoundDelta(0, [], [], {}) === null)
ok('completedLegs without matching roundIndex → null', computeRoundDelta(5, todayLegsCold, [], {}) === null)
ok(
  'null sessions → cold result (still composes round-total)',
  computeRoundDelta(0, todayLegsCold, null, prescriptionCold)?.mode === 'cold'
)
ok(
  'null prescription → still works (no exerciseId/stationId for branch 1/2)',
  computeRoundDelta(0, todayLegsCold, [], null)?.mode === 'cold'
)

// ─────────────────────────────────────────────────────────────────────────
// Test 6 — Rest countdown decrement math
// ─────────────────────────────────────────────────────────────────────────

console.log('\nTest 6 — Rest countdown math')

const restSec = 90
const baseTime = 1700000000000  // arbitrary epoch
const restEnd = baseTime + restSec * 1000

// Helper that mirrors RestBetweenRoundsTimer's per-tick math.
const remainingAt = (now) => Math.max(0, (restEnd - now) / 1000)

ok('at t=0, remaining === 90s', remainingAt(baseTime) === 90)
ok('at t=30s, remaining === 60s', remainingAt(baseTime + 30000) === 60)
ok('at t=89.5s, remaining === 0.5s', Math.abs(remainingAt(baseTime + 89500) - 0.5) < 0.001)
ok('at t=90s exact, remaining === 0', remainingAt(baseTime + 90000) === 0)
ok('at t=120s (past end), remaining === 0 (clamped)', remainingAt(baseTime + 120000) === 0)
ok('at t=-5s (before start, defensive), remaining === 95s', remainingAt(baseTime - 5000) === 95)

// ─────────────────────────────────────────────────────────────────────────
// Test 7 — Add 30s math
// ─────────────────────────────────────────────────────────────────────────

console.log('\nTest 7 — Add 30s shifts restEndTimestamp')

// Mirrors handleAddRestSeconds' state mutation.
const addSeconds = (oldEnd, deltaSec) => oldEnd + deltaSec * 1000

ok('oldEnd 90s + 30 = 120s offset', (addSeconds(restEnd, 30) - baseTime) / 1000 === 120)
ok('two adds of 30 stack to 60s extra', (addSeconds(addSeconds(restEnd, 30), 30) - baseTime) / 1000 === 150)
ok(
  'remaining bumps by 30 after add',
  Math.max(0, (addSeconds(restEnd, 30) - baseTime) / 1000) -
    Math.max(0, (restEnd - baseTime) / 1000) ===
    30
)

// ─────────────────────────────────────────────────────────────────────────
// Test 8 — Final round detection (no flash, no rest, → summary)
// ─────────────────────────────────────────────────────────────────────────

console.log('\nTest 8 — Final round detection: no flash, no rest, → summary')

// Mirrors handleDone's `isFinalRound = currentRoundIdx >= roundCount - 1`.
const isFinalRound = (currentRoundIdx, roundCount) => currentRoundIdx >= roundCount - 1

ok('R3 of 4 rounds → final', isFinalRound(3, 4) === true)
ok('R2 of 4 rounds → not final', isFinalRound(2, 4) === false)
ok('R0 of 1 round → final', isFinalRound(0, 1) === true)
ok('R3 of 5 rounds → not final', isFinalRound(3, 5) === false)
ok('R5 of 6 rounds → final', isFinalRound(5, 6) === true)

// ─────────────────────────────────────────────────────────────────────────
// Test 9 — Phase state-transition shapes (verifies we mutate correctly)
// ─────────────────────────────────────────────────────────────────────────

console.log("\nTest 9 — Phase state-transition shapes")

// State after non-final station Done: enters 'flash' with timestamp,
// completedLegs has the freshly stamped leg, clocks not yet reset.
const stationDoneTransition = (prev, newLeg, now) => ({
  ...prev,
  completedLegs: [...prev.completedLegs, newLeg],
  phase: 'flash',
  flashStartTimestamp: now,
  restStartTimestamp: null,
  restEndTimestamp: null,
})

// Flash → rest: phase='rest', restStartTimestamp set, restEndTimestamp = now + restSec*1000.
const flashToRestTransition = (prev, restSecLocal, now) => ({
  ...prev,
  phase: 'rest',
  flashStartTimestamp: null,
  restStartTimestamp: now,
  restEndTimestamp: now + restSecLocal * 1000,
})

// Rest → next round: phase='logging', clocks reset, currentRoundIdx + 1, leg = 'run'.
const restToNextRound = (prev, now) => ({
  ...prev,
  currentRoundIdx: prev.currentRoundIdx + 1,
  currentLeg: 'run',
  roundStartTimestamp: now,
  legStartTimestamp: now,
  totalPausedMs: 0,
  isPaused: false,
  pauseStartedAt: null,
  phase: 'logging',
  flashStartTimestamp: null,
  restStartTimestamp: null,
  restEndTimestamp: null,
})

const initial = {
  exerciseId: 'ex_brk_tuesday_round',
  prescription: { roundCount: 4, restSec: 90, stationId: 'sta_skierg', runDistanceMeters: 800 },
  currentRoundIdx: 0,
  currentLeg: 'station',
  roundStartTimestamp: baseTime,
  legStartTimestamp: baseTime + 240000,
  totalPausedMs: 0,
  isPaused: false,
  pauseStartedAt: null,
  completedLegs: [
    { roundIndex: 0, type: 'run', distanceMeters: 800, timeSec: 240, completedAt: 'now' },
  ],
  phase: 'logging',
  flashStartTimestamp: null,
  restStartTimestamp: null,
  restEndTimestamp: null,
}

const stationDoneTime = baseTime + 590000
const afterStation = stationDoneTransition(
  initial,
  { roundIndex: 0, type: 'station', stationId: 'sta_skierg', timeSec: 350, completedAt: 'now' },
  stationDoneTime
)
ok("after station done: phase === 'flash'", afterStation.phase === 'flash')
ok('after station done: flashStartTimestamp set', afterStation.flashStartTimestamp === stationDoneTime)
ok('after station done: completedLegs grew by 1', afterStation.completedLegs.length === 2)
ok('after station done: currentRoundIdx unchanged', afterStation.currentRoundIdx === 0)
ok('after station done: legStartTimestamp NOT reset (clocks freeze during flash/rest)', afterStation.legStartTimestamp === initial.legStartTimestamp)

const flashEndTime = stationDoneTime + 2500
const afterFlash = flashToRestTransition(afterStation, 90, flashEndTime)
ok("after flash: phase === 'rest'", afterFlash.phase === 'rest')
ok('after flash: flashStartTimestamp cleared', afterFlash.flashStartTimestamp === null)
ok('after flash: restStartTimestamp set', afterFlash.restStartTimestamp === flashEndTime)
ok(
  'after flash: restEndTimestamp = restStart + 90s',
  afterFlash.restEndTimestamp === flashEndTime + 90000
)

const restEndTime = flashEndTime + 90000
const afterRest = restToNextRound(afterFlash, restEndTime)
ok("after rest: phase === 'logging'", afterRest.phase === 'logging')
ok('after rest: currentRoundIdx advanced to 1', afterRest.currentRoundIdx === 1)
ok("after rest: currentLeg === 'run'", afterRest.currentLeg === 'run')
ok('after rest: roundStartTimestamp reset to now', afterRest.roundStartTimestamp === restEndTime)
ok('after rest: legStartTimestamp reset to now', afterRest.legStartTimestamp === restEndTime)
ok('after rest: rest fields all cleared', afterRest.flashStartTimestamp === null && afterRest.restStartTimestamp === null && afterRest.restEndTimestamp === null)
ok('after rest: completedLegs preserved', afterRest.completedLegs.length === 2)

// ─────────────────────────────────────────────────────────────────────────
// Test 10 — Skip rest mirrors rest-complete (idempotent advance)
// ─────────────────────────────────────────────────────────────────────────

console.log('\nTest 10 — Skip rest = rest-complete (immediate advance)')

// Skip rest fires regardless of countdown remaining; both call advanceToNextRound.
const skipMidCountdown = restToNextRound(afterFlash, flashEndTime + 12000)  // 12s into rest
ok('skip mid-rest: phase === logging', skipMidCountdown.phase === 'logging')
ok('skip mid-rest: currentRoundIdx === 1', skipMidCountdown.currentRoundIdx === 1)
ok('skip mid-rest: clocks reset to skip time', skipMidCountdown.roundStartTimestamp === flashEndTime + 12000)

// ─────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────

console.log(`\n──────\n${pass} pass · ${fail} fail`)
if (fail > 0) process.exit(1)
