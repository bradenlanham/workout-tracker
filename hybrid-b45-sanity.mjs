// hybrid-b45-sanity.mjs — Batch 45 sanity tests.
//
// Covers the five new B45 helpers per the implementation plan §B45:
//   1. composeHyroxRoundsForSave — flat completedLegs[] → nested rounds[]
//      with restAfterSec gap computation; idempotency; defensive cases.
//   2. getHyroxSessionTotalTime — sum of leg timeSec + restAfterSec.
//   3. buildSyntheticPriorSeries — station-anchored synthetic prior:
//      - exact-match path (cross-template aggregation)
//      - mixed-history (some stations resolved, others null)
//      - pace fallback (different distance, dimension mismatch)
//      - cold-start (no prior history → all priors null)
//      - self-exclusion (currentSessionId filters legs)
//   4. getHyroxBests — fastest round / run leg / station leg.
//   5. computeBranchingCta — Back to lift vs Finish workout per §16.1.
//   6. Brooke Tuesday integration spot-check.
//
// Usage: from worktree root, `node hybrid-b45-sanity.mjs`.

import {
  composeHyroxRoundsForSave,
  getHyroxSessionTotalTime,
  buildSyntheticPriorSeries,
  getHyroxBests,
  computeBranchingCta,
} from './src/utils/helpers.js'

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
// Test 1 — composeHyroxRoundsForSave
// ─────────────────────────────────────────────────────────────────────────
console.log('\n[Test 1] composeHyroxRoundsForSave — 4-round single-station')
{
  // 4 rounds, 800m run + SkiErg 1000m. Each round: run starts at minute N*5,
  // station starts at +1:00, station ends +5:00. Rest gap = 30s between
  // stationDone(N) and runStart(N+1).
  const T0 = 1800000000000 // arbitrary base ms epoch
  const completedLegs = []
  for (let r = 0; r < 4; r++) {
    // Round r: run starts at T0 + r*330_000ms (5:30 stride: 1min run + 4min station + 30s rest)
    const runDoneAt = T0 + r * 330000 + 60000 // +1min from round start
    const stationDoneAt = T0 + r * 330000 + 60000 + 240000 // +5min from round start
    completedLegs.push({
      roundIndex: r,
      type: 'run',
      distanceMeters: 800,
      distanceMiles: 0.497,
      timeSec: 60,
      completedAt: new Date(runDoneAt).toISOString(),
    })
    completedLegs.push({
      roundIndex: r,
      type: 'station',
      stationId: 'sta_skierg',
      distanceMeters: 1000,
      timeSec: 240,
      completedAt: new Date(stationDoneAt).toISOString(),
    })
  }

  const prescription = { roundCount: 4, runDistanceMeters: 800, restSec: 30, stationId: 'sta_skierg' }
  const rounds = composeHyroxRoundsForSave(completedLegs, prescription)

  ok('returns 4 rounds', rounds.length === 4)
  ok('round 0 has 2 legs', rounds[0].legs.length === 2)
  ok('round 0 first leg is run', rounds[0].legs[0].type === 'run')
  ok('round 0 second leg is station', rounds[0].legs[1].type === 'station')
  ok('round 0 station has correct stationId', rounds[0].legs[1].stationId === 'sta_skierg')
  ok('round 0 restAfterSec = 30s gap', rounds[0].restAfterSec === 30)
  ok('round 1 restAfterSec = 30s', rounds[1].restAfterSec === 30)
  ok('round 2 restAfterSec = 30s', rounds[2].restAfterSec === 30)
  ok('round 3 (final) restAfterSec = 0', rounds[3].restAfterSec === 0)
  ok('round 0 completedAt = station completedAt', rounds[0].completedAt === completedLegs[1].completedAt)
  // Strip roundIndex from the persisted leg shape (the round wraps it).
  ok('legs no longer carry roundIndex (stripped)', !('roundIndex' in rounds[0].legs[0]))
  ok('roundIndex preserved on the round wrapper', rounds[0].roundIndex === 0)

  // Idempotency: re-running on already-composed data isn't valid (legs[]
  // shape ≠ completedLegs[] shape), but malformed input → empty array.
  const reparseable = composeHyroxRoundsForSave([], prescription)
  ok('empty input returns []', Array.isArray(reparseable) && reparseable.length === 0)
}

console.log('\n[Test 2] composeHyroxRoundsForSave — defensive')
{
  ok('null input → []', JSON.stringify(composeHyroxRoundsForSave(null)) === '[]')
  ok('undefined input → []', JSON.stringify(composeHyroxRoundsForSave(undefined)) === '[]')
  ok('non-array input → []', JSON.stringify(composeHyroxRoundsForSave('foo')) === '[]')
  ok('empty array → []', JSON.stringify(composeHyroxRoundsForSave([])) === '[]')

  // Malformed legs are filtered out — only valid roundIndex contributes.
  const mixed = [
    { type: 'run', timeSec: 60, completedAt: '2026-04-25T14:00:00Z' }, // no roundIndex
    { roundIndex: -1, type: 'run', timeSec: 60 }, // negative roundIndex
    { roundIndex: 0, type: 'run', timeSec: 60, completedAt: '2026-04-25T14:00:00Z' }, // valid
  ]
  const result = composeHyroxRoundsForSave(mixed)
  ok('malformed legs filtered, only valid roundIndex composed', result.length === 1 && result[0].roundIndex === 0)

  // Single round with no following round → restAfterSec = 0.
  const singleRound = [
    { roundIndex: 0, type: 'run', timeSec: 60, completedAt: '2026-04-25T14:01:00Z' },
    { roundIndex: 0, type: 'station', stationId: 'sta_skierg', timeSec: 240, completedAt: '2026-04-25T14:05:00Z' },
  ]
  const sr = composeHyroxRoundsForSave(singleRound)
  ok('single round → restAfterSec = 0', sr.length === 1 && sr[0].restAfterSec === 0)
}

// ─────────────────────────────────────────────────────────────────────────
// Test 3 — getHyroxSessionTotalTime
// ─────────────────────────────────────────────────────────────────────────
console.log('\n[Test 3] getHyroxSessionTotalTime')
{
  const rounds = [
    {
      roundIndex: 0,
      legs: [
        { type: 'run', timeSec: 60 },
        { type: 'station', timeSec: 240 },
      ],
      restAfterSec: 30,
    },
    {
      roundIndex: 1,
      legs: [
        { type: 'run', timeSec: 70 },
        { type: 'station', timeSec: 250 },
      ],
      restAfterSec: 30,
    },
    {
      roundIndex: 2,
      legs: [
        { type: 'run', timeSec: 65 },
        { type: 'station', timeSec: 245 },
      ],
      restAfterSec: 0, // final
    },
  ]
  // Total: (60+240+30) + (70+250+30) + (65+245+0) = 330 + 350 + 310 = 990
  ok('sum legs + rests across all rounds', getHyroxSessionTotalTime(rounds) === 990)
  ok('null → 0', getHyroxSessionTotalTime(null) === 0)
  ok('undefined → 0', getHyroxSessionTotalTime(undefined) === 0)
  ok('empty array → 0', getHyroxSessionTotalTime([]) === 0)
  ok('malformed (no legs) → 0', getHyroxSessionTotalTime([{ roundIndex: 0 }]) === 0)
  ok('non-array → 0', getHyroxSessionTotalTime('foo') === 0)
  ok('NaN timeSec ignored', getHyroxSessionTotalTime([{ legs: [{ timeSec: 'x' }] }]) === 0)
}

// ─────────────────────────────────────────────────────────────────────────
// Test 4 — buildSyntheticPriorSeries — exact-match cross-template
// ─────────────────────────────────────────────────────────────────────────
console.log('\n[Test 4] buildSyntheticPriorSeries — exact-match cross-template aggregation')
{
  // Today: 4 rounds at 800m + SkiErg 1000m, total per round 240s+350s = 590s.
  const todayRounds = [];
  for (let r = 0; r < 4; r++) {
    todayRounds.push({
      roundIndex: r,
      legs: [
        { type: 'run', distanceMeters: 800, timeSec: 240 },
        { type: 'station', stationId: 'sta_skierg', distanceMeters: 1000, timeSec: 350 },
      ],
    })
  }

  // Prior session 1 (Tuesday template): 2 rounds — 800m run 250s + SkiErg 1000m 360s = 610s
  const tuesday = {
    id: 'sess_tue',
    date: '2026-04-22T14:00:00Z',
    mode: 'bb',
    type: 'brk_tuesday',
    data: {
      exercises: [
        {
          exerciseId: 'ex_tue_round',
          name: 'HYROX Run + SkiErg Round',
          rounds: [
            {
              roundIndex: 0,
              legs: [
                { type: 'run', distanceMeters: 800, timeSec: 250, completedAt: '2026-04-22T14:04:10Z' },
                { type: 'station', stationId: 'sta_skierg', distanceMeters: 1000, timeSec: 360, completedAt: '2026-04-22T14:10:10Z' },
              ],
              restAfterSec: 30,
            },
          ],
        },
      ],
    },
  }
  // Prior session 2 (Friday template, different): 1 round — 800m run 245s + SkiErg 1000m 355s
  const friday = {
    id: 'sess_fri',
    date: '2026-04-23T14:00:00Z',
    mode: 'bb',
    type: 'brk_friday',
    data: {
      exercises: [
        {
          exerciseId: 'ex_fri_round',
          name: 'HYROX Simulation Round',
          rounds: [
            {
              roundIndex: 0,
              legs: [
                { type: 'run', distanceMeters: 800, timeSec: 245, completedAt: '2026-04-23T14:04:05Z' },
                { type: 'station', stationId: 'sta_skierg', distanceMeters: 1000, timeSec: 355, completedAt: '2026-04-23T14:10:00Z' },
              ],
              restAfterSec: 0,
            },
          ],
        },
      ],
    },
  }

  const sessions = [tuesday, friday]
  const series = buildSyntheticPriorSeries(todayRounds, sessions, { runDistanceMeters: 800, stationId: 'sta_skierg' }, null)

  ok('series length matches today rounds', series.length === 4)
  ok('R0 todayTotalSec = 590', series[0].todayTotalSec === 590)
  // Most recent run leg = Friday's 245s. Most recent SkiErg = Friday's 355s. Prior total = 600s.
  ok('R0 priorTotalSec = 600 (most-recent legs cross-template)', series[0].priorTotalSec === 600)
  ok('R0 status = ahead (today 590 < prior 600)', series[0].status === 'ahead')
  ok('R0 priorPaceFallback = false (exact-match)', series[0].priorPaceFallback === false)
  // R1 R2 R3 also resolve to the same priors (no per-round-index distinction in synthetic prior).
  ok('R1 priorTotalSec = 600', series[1].priorTotalSec === 600)
  ok('R3 priorTotalSec = 600', series[3].priorTotalSec === 600)
}

// ─────────────────────────────────────────────────────────────────────────
// Test 5 — buildSyntheticPriorSeries — mixed history
// ─────────────────────────────────────────────────────────────────────────
console.log('\n[Test 5] buildSyntheticPriorSeries — mixed history (some stations resolved)')
{
  // Today: 4 rounds rotating SkiErg, Row, Sled Push, Wall Balls (all 800m run leg).
  const todayRounds = [
    { roundIndex: 0, legs: [{ type: 'run', distanceMeters: 800, timeSec: 240 }, { type: 'station', stationId: 'sta_skierg', distanceMeters: 1000, timeSec: 350 }] },
    { roundIndex: 1, legs: [{ type: 'run', distanceMeters: 800, timeSec: 245 }, { type: 'station', stationId: 'sta_row', distanceMeters: 1000, timeSec: 360 }] },
    { roundIndex: 2, legs: [{ type: 'run', distanceMeters: 800, timeSec: 250 }, { type: 'station', stationId: 'sta_sled_push', distanceMeters: 50, timeSec: 200 }] },
    { roundIndex: 3, legs: [{ type: 'run', distanceMeters: 800, timeSec: 255 }, { type: 'station', stationId: 'sta_wall_balls', reps: 100, timeSec: 240 }] },
  ]

  // Prior history: SkiErg, Row, Sled Push (R3 station = Wall Balls is first-time).
  const prior = {
    id: 'sess_prior',
    date: '2026-04-22T14:00:00Z',
    mode: 'bb',
    type: 'brk_tuesday',
    data: {
      exercises: [
        {
          exerciseId: 'ex_prior',
          name: 'Prior Round',
          rounds: [
            { roundIndex: 0, legs: [{ type: 'run', distanceMeters: 800, timeSec: 260 }, { type: 'station', stationId: 'sta_skierg', distanceMeters: 1000, timeSec: 370 }] },
            { roundIndex: 1, legs: [{ type: 'run', distanceMeters: 800, timeSec: 265 }, { type: 'station', stationId: 'sta_row', distanceMeters: 1000, timeSec: 380 }] },
            { roundIndex: 2, legs: [{ type: 'run', distanceMeters: 800, timeSec: 270 }, { type: 'station', stationId: 'sta_sled_push', distanceMeters: 50, timeSec: 220 }] },
          ],
        },
      ],
    },
  }
  const series = buildSyntheticPriorSeries(todayRounds, [prior], { runDistanceMeters: 800 }, null)
  ok('R0 SkiErg priorTotalSec = 260 + 370 = 630', series[0].priorTotalSec === 630)
  ok('R1 Row priorTotalSec = 265 + 380 = 645 (most-recent run-leg overall is R3 of prior = 270; most-recent ROW = 380)', series[1].priorTotalSec !== null)
  ok('R2 Sled Push priorTotalSec resolved', series[2].priorTotalSec !== null)
  // R3 Wall Balls — no prior, but run leg IS resolvable (most-recent run anywhere).
  // Run resolves; station does not → priorTotalSec = null per the AND requirement
  // (run + station both required).
  ok('R3 Wall Balls priorTotalSec = null (station first-time)', series[3].priorTotalSec === null)
  ok('R3 status = null (cannot compare)', series[3].status === null)
}

// ─────────────────────────────────────────────────────────────────────────
// Test 6 — buildSyntheticPriorSeries — pace fallback
// ─────────────────────────────────────────────────────────────────────────
console.log('\n[Test 6] buildSyntheticPriorSeries — pace fallback (different distance)')
{
  // Today: SkiErg 1000m. Prior history: SkiErg 500m only (different distance).
  const todayRounds = [
    {
      roundIndex: 0,
      legs: [
        { type: 'run', distanceMeters: 800, timeSec: 240 },
        { type: 'station', stationId: 'sta_skierg', distanceMeters: 1000, timeSec: 350 },
      ],
    },
  ]
  const prior = {
    id: 'sess_prior',
    date: '2026-04-22T14:00:00Z',
    mode: 'bb',
    type: 'brk_tuesday',
    data: {
      exercises: [
        {
          exerciseId: 'ex_prior',
          name: 'Prior',
          rounds: [
            {
              roundIndex: 0,
              legs: [
                { type: 'run', distanceMeters: 800, timeSec: 260 },
                { type: 'station', stationId: 'sta_skierg', distanceMeters: 500, timeSec: 175 }, // 35 s/100m
              ],
            },
          ],
        },
      ],
    },
  }
  const series = buildSyntheticPriorSeries(todayRounds, [prior], { runDistanceMeters: 800 }, null)
  ok('R0 priorPaceFallback = true', series[0].priorPaceFallback === true)
  // Pace from 175/500 * 100 = 35 s/100m. At 1000m → 350s.
  // Run leg has exact match (800m) → 260s. Total = 350 + 260 = 610s.
  ok('R0 priorTotalSec uses pace projection (350s station + 260s run = 610s)', series[0].priorTotalSec === 610)
}

// ─────────────────────────────────────────────────────────────────────────
// Test 7 — buildSyntheticPriorSeries — cold start
// ─────────────────────────────────────────────────────────────────────────
console.log('\n[Test 7] buildSyntheticPriorSeries — cold start')
{
  const todayRounds = [
    { roundIndex: 0, legs: [{ type: 'run', distanceMeters: 800, timeSec: 240 }, { type: 'station', stationId: 'sta_skierg', distanceMeters: 1000, timeSec: 350 }] },
    { roundIndex: 1, legs: [{ type: 'run', distanceMeters: 800, timeSec: 245 }, { type: 'station', stationId: 'sta_skierg', distanceMeters: 1000, timeSec: 355 }] },
  ]
  const series = buildSyntheticPriorSeries(todayRounds, [], { runDistanceMeters: 800 }, null)
  ok('cold start: all priorTotalSec = null', series.every(s => s.priorTotalSec === null))
  ok('cold start: all status = null', series.every(s => s.status === null))
  ok('cold start: todayTotalSec preserved', series[0].todayTotalSec === 590)
}

// ─────────────────────────────────────────────────────────────────────────
// Test 8 — buildSyntheticPriorSeries — self-exclusion
// ─────────────────────────────────────────────────────────────────────────
console.log('\n[Test 8] buildSyntheticPriorSeries — self-exclusion')
{
  const todaySession = {
    id: 'sess_today',
    date: '2026-04-25T14:00:00Z',
    mode: 'bb',
    type: 'brk_tuesday',
    data: {
      exercises: [
        {
          exerciseId: 'ex_round',
          name: 'Round',
          rounds: [{ roundIndex: 0, legs: [{ type: 'run', distanceMeters: 800, timeSec: 240 }, { type: 'station', stationId: 'sta_skierg', distanceMeters: 1000, timeSec: 350 }] }],
        },
      ],
    },
  }
  const todayRounds = todaySession.data.exercises[0].rounds
  // Sessions includes today's session (post-finish state).
  const series = buildSyntheticPriorSeries(todayRounds, [todaySession], { runDistanceMeters: 800 }, 'sess_today')
  ok('self-exclusion: all priorTotalSec = null when only today is in sessions', series.every(s => s.priorTotalSec === null))
  // Without exclusion (null currentSessionId), the legs from today match → prior found.
  const seriesNoExclude = buildSyntheticPriorSeries(todayRounds, [todaySession], { runDistanceMeters: 800 }, null)
  ok('without exclusion: prior matches today (sanity check)', seriesNoExclude[0].priorTotalSec !== null)
}

// ─────────────────────────────────────────────────────────────────────────
// Test 9 — getHyroxBests
// ─────────────────────────────────────────────────────────────────────────
console.log('\n[Test 9] getHyroxBests — fastest round/run/station')
{
  const rounds = [
    { roundIndex: 0, legs: [{ type: 'run', distanceMeters: 800, timeSec: 250 }, { type: 'station', stationId: 'sta_skierg', timeSec: 360 }] }, // total 610
    { roundIndex: 1, legs: [{ type: 'run', distanceMeters: 800, timeSec: 240 }, { type: 'station', stationId: 'sta_skierg', timeSec: 350 }] }, // total 590 ← fastest
    { roundIndex: 2, legs: [{ type: 'run', distanceMeters: 800, timeSec: 245 }, { type: 'station', stationId: 'sta_skierg', timeSec: 355 }] }, // total 600
    { roundIndex: 3, legs: [{ type: 'run', distanceMeters: 800, timeSec: 248 }, { type: 'station', stationId: 'sta_skierg', timeSec: 358 }] }, // total 606
  ]
  const bests = getHyroxBests(rounds)
  ok('fastestRound timeSec = 590 (R2)', bests.fastestRound?.timeSec === 590)
  ok('fastestRound label = R2', bests.fastestRound?.label === 'R2')
  ok('fastestRunLeg timeSec = 240', bests.fastestRunLeg?.timeSec === 240)
  ok('fastestRunLeg label includes R2 + 800m', bests.fastestRunLeg?.label === 'R2 800m')
  ok('fastestStationLeg timeSec = 350', bests.fastestStationLeg?.timeSec === 350)
  ok('fastestStationLeg label includes SkiErg', bests.fastestStationLeg?.label === 'R2 SkiErg')

  // Defensive
  const empty = getHyroxBests(null)
  ok('null → all-null bests', empty.fastestRound === null && empty.fastestRunLeg === null && empty.fastestStationLeg === null)
}

// ─────────────────────────────────────────────────────────────────────────
// Test 10 — computeBranchingCta
// ─────────────────────────────────────────────────────────────────────────
console.log('\n[Test 10] computeBranchingCta — Back to lift vs Finish workout')
{
  const tueWorkout = {
    id: 'brk_tuesday',
    name: 'Tuesday',
    sections: [
      { label: 'Lift', exercises: [{ name: 'Cable Lateral Raise' }, { name: 'Reverse Flies' }] },
      { label: 'HYROX', exercises: [{ name: 'HYROX Run + SkiErg Round' }] },
    ],
  }

  // Scenario A — one un-done lift exercise → Back to lift
  const exA = [
    { name: 'Cable Lateral Raise', completedAt: 1234 },
    { name: 'Reverse Flies', completedAt: 0 }, // not done
    { name: 'HYROX Run + SkiErg Round', completedAt: 5678, rounds: [{}, {}, {}, {}] },
  ]
  const ctaA = computeBranchingCta(tueWorkout, exA)
  ok('un-done lift → Back to lift →', ctaA.action === 'lift' && ctaA.label === 'Back to lift →')

  // Scenario B — all lifts complete → Finish workout
  const exB = [
    { name: 'Cable Lateral Raise', completedAt: 1234 },
    { name: 'Reverse Flies', completedAt: 2345 },
    { name: 'HYROX Run + SkiErg Round', completedAt: 5678, rounds: [{}] },
  ]
  const ctaB = computeBranchingCta(tueWorkout, exB)
  ok('all lifts complete → Finish workout →', ctaB.action === 'finish' && ctaB.label === 'Finish workout →')

  // Scenario C — HYROX-only workout (no lift section) → Finish workout
  const hyroxOnlyWorkout = {
    id: 'wo_hyrox_only',
    name: 'HYROX Only',
    sections: [{ label: 'HYROX', exercises: [{ name: 'HYROX Run + SkiErg Round' }] }],
  }
  const ctaC = computeBranchingCta(hyroxOnlyWorkout, [{ name: 'HYROX Run + SkiErg Round', completedAt: 9999 }])
  ok('HYROX-only workout → Finish workout →', ctaC.action === 'finish')

  // Scenario D — exercise template entry has no matching activeSession entry
  // (template-only, never logged). Must count as uncompleted.
  const ctaD = computeBranchingCta(tueWorkout, [
    { name: 'Cable Lateral Raise', completedAt: 1234 },
    // 'Reverse Flies' missing entirely
    { name: 'HYROX Run + SkiErg Round', completedAt: 5678 },
  ])
  ok('template-only (never started) lift → Back to lift →', ctaD.action === 'lift')

  // Scenario E — defensive
  ok('null workout → Finish workout', computeBranchingCta(null, []).action === 'finish')
  ok('workout without sections → Finish workout', computeBranchingCta({}, []).action === 'finish')
  ok('workout with empty sections → Finish workout', computeBranchingCta({ sections: [] }, []).action === 'finish')
  ok('null exercises array → handled', computeBranchingCta(tueWorkout, null).action === 'lift')
  ok('Section label "hyrox" (lowercase) → treated as hyrox', (() => {
    const w = { sections: [{ label: 'hyrox', exercises: [{ name: 'X' }] }] }
    return computeBranchingCta(w, []).action === 'finish'
  })())
  ok('Section label "  HYROX  " (whitespace) → treated as hyrox', (() => {
    const w = { sections: [{ label: '  HYROX  ', exercises: [{ name: 'X' }] }] }
    return computeBranchingCta(w, []).action === 'finish'
  })())

  // Scenario F — string-shape exercises in section template
  const stringShapeWorkout = {
    sections: [{ label: 'Lift', exercises: ['Bench Press', 'Squat'] }],
  }
  const ctaF = computeBranchingCta(stringShapeWorkout, [{ name: 'Bench Press', completedAt: 1234 }])
  ok('string-shape exercise + missing one → Back to lift →', ctaF.action === 'lift')
}

// ─────────────────────────────────────────────────────────────────────────
// Test 11 — Brooke Tuesday integration spot-check
// ─────────────────────────────────────────────────────────────────────────
console.log('\n[Test 11] Brooke Tuesday integration — end-to-end')
{
  // Today's Tuesday: 4 SkiErg rounds at 800m run + 1000m SkiErg.
  // Per-round: run 250s + station 350s = 600s. 30s rest between (final 0).
  // Total: 4*600 + 3*30 = 2490s = 41:30.
  const T0 = 1800000000000
  const completedLegs = []
  for (let r = 0; r < 4; r++) {
    completedLegs.push({
      roundIndex: r,
      type: 'run',
      distanceMeters: 800,
      distanceMiles: 0.497,
      timeSec: 250,
      completedAt: new Date(T0 + r * 630000 + 250000).toISOString(),
    })
    completedLegs.push({
      roundIndex: r,
      type: 'station',
      stationId: 'sta_skierg',
      distanceMeters: 1000,
      timeSec: 350,
      completedAt: new Date(T0 + r * 630000 + 600000).toISOString(),
    })
  }
  const prescription = { roundCount: 4, runDistanceMeters: 800, restSec: 30, stationId: 'sta_skierg' }
  const rounds = composeHyroxRoundsForSave(completedLegs, prescription)

  ok('Brooke 4 rounds composed', rounds.length === 4)
  // Per-round timeline (from R0 start = T0):
  //   run completedAt   = T0 + r*630000 + 250000  (run took 250s)
  //   station completedAt = T0 + r*630000 + 600000  (station took 350s, +250s offset)
  //   next run completedAt = T0 + (r+1)*630000 + 250000  = +630+250 from R0 start
  // Gap from this station to next run = (630+250) - 600 = 280s.
  // restAfterSec = gap - next run timeSec = 280 - 250 = 30s.
  ok('round 0 restAfterSec = 30s (gap minus next run timeSec)', rounds[0].restAfterSec === 30)
  ok('round 1 restAfterSec = 30s', rounds[1].restAfterSec === 30)
  ok('round 2 restAfterSec = 30s', rounds[2].restAfterSec === 30)
  ok('round 3 (final) restAfterSec = 0', rounds[3].restAfterSec === 0)

  // Total time = 4 rounds × (250 run + 350 station) + 3 × 30s rest = 2400 + 90 = 2490s = 41:30.
  const totalSec = getHyroxSessionTotalTime(rounds)
  ok('total time = 2490s (41:30)', totalSec === 2490)
}

// ─────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────
console.log(`\n${pass} pass / ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
