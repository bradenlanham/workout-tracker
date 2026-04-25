// hybrid-b43-sanity.mjs — Batch 43 round logger sanity.
//
// Validates:
//   1. getStationHistory station-anchored aggregation across templates.
//   2. getRunLegHistory exact-distance match.
//   3. computePaceFromHistory s/100m calculation + null-on-no-distance.
//   4. buildIntraLegComparison across exact-match / pace-fallback / cold-start
//      / cross-station rotation cases per implementation plan B43.
//   5. Comparison-band delta direction (current < last → ahead, current > last
//      → behind).
//   6. Round-template prescription stamping (run-leg → station-leg advance,
//      station-leg of non-final → next-round-run-leg, station-leg of final →
//      summary). Logic reproduced inline since handleDone is part of a React
//      component.

import {
  getStationHistory,
  getRunLegHistory,
  computePaceFromHistory,
  buildIntraLegComparison,
} from './src/utils/helpers.js'

let pass = 0
let fail = 0
function check(label, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`) }
}

// ── Synthetic data ──────────────────────────────────────────────────────────
//
// Two prior sessions: Tuesday (interval template, SkiErg single-station) +
// Friday (simulation template, rotation pool — round 2 was Row last week,
// round 3 was SkiErg). This shape covers the cross-template aggregation
// case that's the headline B43 invariant.

const tuesdayPrior = {
  id: 'sess_tue1',
  date: '2026-04-21T14:00:00Z',
  mode: 'bb',
  type: 'brk_tuesday',
  data: {
    workoutType: 'brk_tuesday',
    exercises: [
      {
        exerciseId: 'ex_brk_tuesday_round',
        name: 'HYROX Run + SkiErg Round',
        rounds: [
          { roundIndex: 0, legs: [
            { type: 'run', distanceMeters: 800, distanceMiles: 0.497, timeSec: 240 },
            { type: 'station', stationId: 'sta_skierg', distanceMeters: 1000, timeSec: 350 },
          ], restAfterSec: 120 },
          { roundIndex: 1, legs: [
            { type: 'run', distanceMeters: 800, distanceMiles: 0.497, timeSec: 248 },
            { type: 'station', stationId: 'sta_skierg', distanceMeters: 1000, timeSec: 360 },
          ], restAfterSec: 120 },
        ],
      },
    ],
  },
}

const fridayPrior = {
  id: 'sess_fri1',
  date: '2026-04-18T14:00:00Z',
  mode: 'bb',
  type: 'brk_friday',
  data: {
    workoutType: 'brk_friday',
    exercises: [
      {
        exerciseId: 'ex_brk_friday_round',
        name: 'HYROX Simulation Round',
        rounds: [
          { roundIndex: 0, legs: [
            { type: 'run', distanceMeters: 1000, distanceMiles: 0.621, timeSec: 320 },
            { type: 'station', stationId: 'sta_row', distanceMeters: 1000, timeSec: 360 },
          ], restAfterSec: 90 },
          { roundIndex: 1, legs: [
            { type: 'run', distanceMeters: 1000, distanceMiles: 0.621, timeSec: 325 },
            { type: 'station', stationId: 'sta_skierg', distanceMeters: 1000, timeSec: 355 },
          ], restAfterSec: 90 },
          { roundIndex: 2, legs: [
            { type: 'run', distanceMeters: 1000, distanceMiles: 0.621, timeSec: 330 },
            { type: 'station', stationId: 'sta_sled_push', distanceMeters: 50, weight: 100, timeSec: 80 },
          ], restAfterSec: 90 },
        ],
      },
    ],
  },
}

const liftOnlyPrior = {
  id: 'sess_lift1',
  date: '2026-04-20T14:00:00Z',
  mode: 'bb',
  type: 'push',
  data: {
    workoutType: 'push',
    exercises: [{ exerciseId: 'ex_pec_dec', name: 'Pec Dec', sets: [{ type: 'working', weight: 180, reps: 10 }] }],
  },
}

const synth = [tuesdayPrior, fridayPrior, liftOnlyPrior]

// ── 1. getStationHistory ────────────────────────────────────────────────────
console.log('\n[1] getStationHistory')

check('null/empty inputs return []',
  Array.isArray(getStationHistory(null, 'sta_skierg', {})) &&
  getStationHistory(null, 'sta_skierg', {}).length === 0)
check('missing stationId returns []',
  getStationHistory(synth, null, {}).length === 0)

const skiergAll = getStationHistory(synth, 'sta_skierg', {})
check(`SkiErg unscoped returns 3 legs (2 Tue + 1 Fri R2): got ${skiergAll.length}`,
  skiergAll.length === 3)
check('cross-template aggregation: includes both Tuesday + Friday SkiErg',
  skiergAll.some(l => l.exerciseId === 'ex_brk_tuesday_round') &&
  skiergAll.some(l => l.exerciseId === 'ex_brk_friday_round'))
check('newest-first sorted (Tuesday Apr 21 before Friday Apr 18)',
  skiergAll[0].sessionDate.startsWith('2026-04-21'))

const skiergAt1000m = getStationHistory(synth, 'sta_skierg', { distanceMeters: 1000 })
check(`SkiErg at 1000m exact-match: got ${skiergAt1000m.length}`,
  skiergAt1000m.length === 3)

const skiergAt500m = getStationHistory(synth, 'sta_skierg', { distanceMeters: 500 })
check('SkiErg at 500m (no prior): empty array',
  skiergAt500m.length === 0)

const sledPushAll = getStationHistory(synth, 'sta_sled_push', {})
check(`Sled Push: 1 leg from Friday R3: got ${sledPushAll.length}`,
  sledPushAll.length === 1 && sledPushAll[0].weight === 100 && sledPushAll[0].distanceMeters === 50)

const burpeesAll = getStationHistory(synth, 'sta_burpee_broad', {})
check('Burpee Broad cold-start: empty array',
  burpeesAll.length === 0)

// Lift-only sessions are correctly ignored (no rounds[] = no contribution).
const allSta = ['sta_skierg', 'sta_sled_push', 'sta_row', 'sta_sled_pull', 'sta_burpee_broad', 'sta_farmers', 'sta_sandbag_lunges', 'sta_wall_balls']
let total = 0
for (const sId of allSta) total += getStationHistory(synth, sId, {}).length
check(`Total station legs across catalog = 5 (3 SkiErg + 1 Row + 1 Sled): got ${total}`,
  total === 5)

// ── 2. getRunLegHistory ─────────────────────────────────────────────────────
console.log('\n[2] getRunLegHistory')

check('null/empty inputs return []',
  Array.isArray(getRunLegHistory(null, 800)) && getRunLegHistory(null, 800).length === 0)

const run800 = getRunLegHistory(synth, 800)
check(`800m runs (Tuesday only): got ${run800.length}`,
  run800.length === 2 && run800.every(l => l.distanceMeters === 800))

const run1000 = getRunLegHistory(synth, 1000)
check(`1000m runs (Friday only): got ${run1000.length}`,
  run1000.length === 3 && run1000.every(l => l.distanceMeters === 1000))

const runAll = getRunLegHistory(synth) // no distanceMeters → all
check(`All runs unscoped: got ${runAll.length}`, runAll.length === 5)

// ── 3. computePaceFromHistory ───────────────────────────────────────────────
console.log('\n[3] computePaceFromHistory')

check('empty/null returns null',
  computePaceFromHistory(null) === null && computePaceFromHistory([]) === null)

// Tuesday SkiErg: 2 legs at 1000m, 350s + 360s. Pace: 710s / 2000m × 100 = 35.5 s/100m.
const skiergPace = computePaceFromHistory(skiergAt1000m)
// All 3 SkiErg legs: 350+360+355 = 1065s / 3000m × 100 = 35.5 s/100m.
check(`SkiErg pace ≈ 35.5 s/100m: got ${skiergPace}`, skiergPace === 35.5)

// Mixed-distance pace: SkiErg 3000m / 1065s + 800m runs (240+248)/1600m + 1000m runs (320+325+330)/3000m.
// Total: 7600m / (1065+488+975) = 7600m / 2528s × 100 = 33.27 s/100m.
const allPace = computePaceFromHistory([...skiergAll, ...runAll])
check(`Mixed pace ≈ 33.3 s/100m: got ${allPace}`,
  allPace >= 33 && allPace <= 34)

// History without distance returns null (e.g. wall-balls reps-only).
const wallBalls = [{ type: 'station', stationId: 'sta_wall_balls', timeSec: 120, reps: 100, weight: 14 }]
check('Reps-only (no distance) returns null',
  computePaceFromHistory(wallBalls) === null)

// ── 4. buildIntraLegComparison — exact match ────────────────────────────────
console.log('\n[4] buildIntraLegComparison — exact match')

// Today: SkiErg @ 1000m, current clock 340s. Most-recent prior is Tuesday's
// round 2 (apr 21, 360s — within Tuesday newest-first). 340 < 360 → ahead.
const c1 = buildIntraLegComparison({
  legType: 'station',
  stationId: 'sta_skierg',
  stationName: 'SkiErg',
  distanceMeters: 1000,
  currentTimeSec: 340,
  sessions: synth,
})
check(`exact match returns mode='exact': ${c1?.mode}`, c1?.mode === 'exact')
check(`status='ahead' when current(340) < last(${c1?.lastTimeSec})`, c1?.status === 'ahead')
check(`label uses station-anchored framing: ${c1?.label}`,
  typeof c1?.label === 'string' && c1.label.includes('SkiErg'))

// 380s → behind.
const c2 = buildIntraLegComparison({
  legType: 'station',
  stationId: 'sta_skierg',
  stationName: 'SkiErg',
  distanceMeters: 1000,
  currentTimeSec: 380,
  sessions: synth,
})
check(`status='behind' when current(380) > last`, c2?.status === 'behind')
check(`positive deltaSec: ${c2?.deltaSec}`, c2?.deltaSec > 0)

// 0s (clock just started) → neutral.
const c3 = buildIntraLegComparison({
  legType: 'station',
  stationId: 'sta_skierg',
  stationName: 'SkiErg',
  distanceMeters: 1000,
  currentTimeSec: 0,
  sessions: synth,
})
check('status=neutral when current=0', c3?.status === 'neutral')

// ── 5. Cross-station rotation case ──────────────────────────────────────────
console.log('\n[5] Cross-station rotation (Friday R2 was Row last week, today is SkiErg)')

// Today's leg: SkiErg @ 1000m. The framing should be "vs your last SkiErg",
// NOT "vs last Friday R2 (Row)." This is the headline invariant per §14.1.
const cRotation = buildIntraLegComparison({
  legType: 'station',
  stationId: 'sta_skierg',
  stationName: 'SkiErg',
  distanceMeters: 1000,
  currentTimeSec: 350,
  sessions: synth,
})
check('cross-station rotation anchors to SkiErg history',
  cRotation?.mode === 'exact' && cRotation.label.includes('SkiErg'))
check('comparison ignores Row (different station, even if at same round position)',
  // Most recent SkiErg leg in synth is Tuesday R2 (apr 21, 360s) NOT
  // Friday R2 (apr 18) which was Row. So lastTimeSec should be Tuesday's.
  cRotation?.lastTimeSec === 360)

// ── 6. Pace fallback ────────────────────────────────────────────────────────
console.log('\n[6] Pace fallback (distance mismatch but station has prior history)')

// Today: SkiErg @ 1200m (no exact prior). All prior is at 1000m. Should
// fall back to pace and compute target = pace × 1200m / 100.
const cPace = buildIntraLegComparison({
  legType: 'station',
  stationId: 'sta_skierg',
  stationName: 'SkiErg',
  distanceMeters: 1200,
  currentTimeSec: 0,
  sessions: synth,
})
check(`pace fallback fires: mode=${cPace?.mode}`, cPace?.mode === 'pace')
check(`pace ≈ 35.5 s/100m: ${cPace?.paceSecPer100m}`, cPace?.paceSecPer100m === 35.5)
check(`projected time ≈ 426s for 1200m: ${cPace?.paceProjectedTimeSec}`,
  cPace?.paceProjectedTimeSec >= 425 && cPace?.paceProjectedTimeSec <= 427)

// ── 7. Cold start (band hides) ──────────────────────────────────────────────
console.log('\n[7] Cold start')

// Burpee Broad never logged + no distance match anywhere → null.
const cCold = buildIntraLegComparison({
  legType: 'station',
  stationId: 'sta_burpee_broad',
  stationName: 'Burpee Broad Jump',
  distanceMeters: 80,
  currentTimeSec: 30,
  sessions: synth,
})
check('cold-start returns null (band hides)', cCold === null)

// Empty sessions array → null.
const cEmpty = buildIntraLegComparison({
  legType: 'station',
  stationId: 'sta_skierg',
  distanceMeters: 1000,
  currentTimeSec: 30,
  sessions: [],
})
check('empty sessions returns null', cEmpty === null)

// ── 8. Run leg comparison ───────────────────────────────────────────────────
console.log('\n[8] Run leg comparison')

// Today: 800m run, 230s. Prior exact: Tuesday R1 240s + R2 248s. Most-recent
// = R2 248. 230 < 248 → ahead.
const cRun = buildIntraLegComparison({
  legType: 'run',
  distanceMeters: 800,
  currentTimeSec: 230,
  sessions: synth,
})
check(`run exact match: mode=${cRun?.mode}`, cRun?.mode === 'exact')
check(`run status=ahead: ${cRun?.status}`, cRun?.status === 'ahead')

// Run leg at 1500m (no exact prior) → pace fallback over all runs.
const cRunPace = buildIntraLegComparison({
  legType: 'run',
  distanceMeters: 1500,
  currentTimeSec: 0,
  sessions: synth,
})
check(`run pace fallback: mode=${cRunPace?.mode}`, cRunPace?.mode === 'pace')
check(`run pace projected > 0: ${cRunPace?.paceProjectedTimeSec}`,
  cRunPace?.paceProjectedTimeSec > 0)

// ── 9. Round-template prescription stamping logic (validates the Done-flow
// state-transition rules that handleDone in HyroxRoundLogger applies) ────────
console.log('\n[9] Done-flow state-transition rules')

// Helper: simulate the next-state computation handleDone runs.
function nextState(hyrox, finalElapsed = 60) {
  const isRunLeg = hyrox.currentLeg === 'run'
  const isFinalRound = hyrox.currentRoundIdx >= (hyrox.prescription.roundCount - 1)
  if (isRunLeg) {
    return { advance: 'station-same-round', clockReset: false, complete: false }
  }
  if (isFinalRound) {
    return { advance: 'summary', clockReset: false, complete: true }
  }
  return { advance: 'next-round-run-leg', clockReset: true, complete: false }
}

const tueState = { prescription: { roundCount: 4 }, currentRoundIdx: 0, currentLeg: 'run' }
check('Done on R1 run → advance to R1 station, no clock reset',
  nextState(tueState).advance === 'station-same-round' && !nextState(tueState).clockReset)

const tueR1Station = { prescription: { roundCount: 4 }, currentRoundIdx: 0, currentLeg: 'station' }
check('Done on R1 station of 4-round template → next R run leg + reset',
  nextState(tueR1Station).advance === 'next-round-run-leg' && nextState(tueR1Station).clockReset)

const tueR4Station = { prescription: { roundCount: 4 }, currentRoundIdx: 3, currentLeg: 'station' }
check('Done on R4 station of 4-round template → summary + complete',
  nextState(tueR4Station).advance === 'summary' && nextState(tueR4Station).complete)

const single = { prescription: { roundCount: 1 }, currentRoundIdx: 0, currentLeg: 'station' }
check('Done on R1 station of 1-round template → summary',
  nextState(single).advance === 'summary' && nextState(single).complete)

// ── 10. Run+SkiErg cross-template integration ──────────────────────────────
console.log('\n[10] Brooke Tuesday + Friday integration spot-check')

// Brooke's Tuesday Run+SkiErg: today is round 1 SkiErg @ 1000m, current
// clock 350s. Prior: 2 Tuesday SkiErg legs + 1 Friday R2 SkiErg leg, all
// at 1000m. Most recent is Tuesday R2 (Apr 21, 360s).
const brookeTueIntra = buildIntraLegComparison({
  legType: 'station',
  stationId: 'sta_skierg',
  stationName: 'SkiErg',
  distanceMeters: 1000,
  currentTimeSec: 350,
  sessions: synth,
})
check('Brooke Tuesday R1 SkiErg compares against most-recent SkiErg (any template)',
  brookeTueIntra?.mode === 'exact' && brookeTueIntra.lastTimeSec === 360)
check('Brooke Tuesday R1 SkiErg ahead by ~10s',
  brookeTueIntra?.status === 'ahead' && brookeTueIntra.deltaSec === -10)

// ── Done ────────────────────────────────────────────────────────────────────
console.log(`\n${pass}/${pass + fail} pass${fail > 0 ? ` · ${fail} fail` : ''}`)
if (fail > 0) process.exit(1)
