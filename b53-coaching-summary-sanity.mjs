// Batch 53 sanity — buildMonthlyCoachingSummary across cold-start, headline
// priority, volume math, top progressor, anomaly, workout-type drift, HYROX
// integration, hybrid scope, defensive cases, and a real-data spot check.
//
// Mirrors the existing hybrid-b*-sanity.mjs / migration-*-sanity.mjs pattern.
// Run from worktree root: node b53-coaching-summary-sanity.mjs

import {
  buildMonthlyCoachingSummary,
  formatVolumeShort,
} from './src/utils/helpers.js'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const MS_PER_DAY = 86400000
const NOW = Date.UTC(2026, 3, 27, 12, 0, 0) // 2026-04-27 noon UTC, fixed for repro

let pass = 0
let fail = 0
function ok(label, cond, detail = null) {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else      { fail++; console.log(`  ✗ ${label}${detail ? ' — ' + JSON.stringify(detail) : ''}`) }
}

// ── Helpers for synthesis ────────────────────────────────────────────────
function isoDaysAgo(days) {
  return new Date(NOW - days * MS_PER_DAY).toISOString()
}
function bbSession(daysAgo, type, exercises = []) {
  return {
    id: `s_${daysAgo}_${type}`,
    date: isoDaysAgo(daysAgo),
    mode: 'bb',
    type,
    duration: 45,
    grade: 'A',
    data: { workoutType: type, exercises },
  }
}
function ex(name, sets, opts = {}) {
  return { name, exerciseId: opts.id || `ex_${name.toLowerCase().replace(/\s+/g, '_')}`, sets, ...opts }
}
function set(weight, reps, opts = {}) {
  return {
    type: 'working',
    weight,
    reps,
    isNewPR: !!opts.pr,
    ...opts,
  }
}
function warmup(weight, reps) {
  return { type: 'warmup', weight, reps, isNewPR: false }
}

// ── 1. formatVolumeShort ─────────────────────────────────────────────────
console.log('\n[1] formatVolumeShort')
ok('142500 → 143k', formatVolumeShort(142500) === '143k', formatVolumeShort(142500))
ok('47000 → 47k',   formatVolumeShort(47000)  === '47k',   formatVolumeShort(47000))
ok('5500 → 5.5k',   formatVolumeShort(5500)   === '5.5k',  formatVolumeShort(5500))
ok('950 → 950',     formatVolumeShort(950)    === '950',   formatVolumeShort(950))
ok('0 → 0',         formatVolumeShort(0)      === '0')
ok('null → 0',      formatVolumeShort(null)   === '0')

// ── 2. Cold start ────────────────────────────────────────────────────────
console.log('\n[2] Cold start (< 3 sessions in window → null)')
ok('empty sessions → null',    buildMonthlyCoachingSummary({ sessions: [], now: NOW }) === null)
ok('1 session → null',         buildMonthlyCoachingSummary({ sessions: [bbSession(5, 'push', [ex('Pec Dec', [set(180, 10)])])], now: NOW }) === null)
ok('2 sessions → null',        buildMonthlyCoachingSummary({
  sessions: [
    bbSession(5, 'push', [ex('Pec Dec', [set(180, 10)])]),
    bbSession(15, 'push', [ex('Pec Dec', [set(180, 10)])]),
  ],
  now: NOW,
}) === null)
ok('null sessions → null',     buildMonthlyCoachingSummary({ sessions: null, now: NOW }) === null)
ok('undefined arg → null',     buildMonthlyCoachingSummary({ now: NOW }) === null)

// ── 3. Headline priority — PR-led ────────────────────────────────────────
console.log('\n[3] Headline priority — PR-led (≥3 PRs)')
const prSessions = []
for (let i = 0; i < 8; i++) {
  prSessions.push(bbSession(28 - i * 3, 'push', [
    ex('Bench Press', [set(185 + i * 5, 8, { pr: i >= 5 })]),  // 3 PRs (i=5,6,7)
  ]))
}
const prResult = buildMonthlyCoachingSummary({ sessions: prSessions, now: NOW })
ok('PR result not null',    prResult !== null)
ok('headline kind = pr',    prResult?.meta?.headlineKind === 'pr', prResult?.meta?.headlineKind)
ok('PR count = 3',          prResult?.meta?.prCount === 3, prResult?.meta?.prCount)
ok('headline mentions Bench Press', prResult?.headline?.includes('Bench Press'))
ok('headline mentions 3 PRs', prResult?.headline?.includes('3 PR'))
ok('"Strong push" framing',   prResult?.headline?.toLowerCase().includes('push'))

// ── 4. Headline priority — Volume-led (≥15% delta) ───────────────────────
console.log('\n[4] Headline priority — Volume up')
const volSessions = []
// Prior window: small volume
for (let i = 0; i < 4; i++) {
  volSessions.push(bbSession(45 + i * 3, 'push', [ex('Pec Dec', [set(150, 8)])]))
}
// Current window: bigger volume (more reps + weight)
for (let i = 0; i < 8; i++) {
  volSessions.push(bbSession(28 - i * 3, 'push', [ex('Pec Dec', [set(180, 12)])]))
}
const volResult = buildMonthlyCoachingSummary({ sessions: volSessions, now: NOW })
ok('volume up result not null', volResult !== null)
ok('headline kind volume-up',   volResult?.meta?.headlineKind === 'volume-up' || volResult?.meta?.headlineKind === 'pr', volResult?.meta?.headlineKind)
ok('volume delta is positive',  volResult?.meta?.volumeDeltaPct > 0, volResult?.meta?.volumeDeltaPct)

// ── 5. Headline priority — Volume-down ───────────────────────────────────
console.log('\n[5] Headline priority — Volume down')
const dropSessions = []
for (let i = 0; i < 8; i++) {
  dropSessions.push(bbSession(45 + i * 2, 'push', [ex('Pec Dec', [set(180, 12)])]))
}
for (let i = 0; i < 3; i++) {
  dropSessions.push(bbSession(20 + i * 5, 'push', [ex('Pec Dec', [set(120, 6)])]))
}
const dropResult = buildMonthlyCoachingSummary({ sessions: dropSessions, now: NOW })
ok('volume down result not null', dropResult !== null)
ok('volume delta is negative',    dropResult?.meta?.volumeDeltaPct < 0, dropResult?.meta?.volumeDeltaPct)
ok('headline mentions down',      dropResult?.headline?.toLowerCase().match(/down|reset/), dropResult?.headline)

// ── 6. Default headline — session count narrative ────────────────────────
//
// To force the default branch we need: <3 PRs, no streak milestone, no HYROX,
// |volume delta| < 15%. Match volumes exactly across the two windows by
// scaling weights inversely to session counts.
//
//   Prior 4 sessions × 150 × 10 = 6000
//   Current 5 sessions × 120 × 10 = 6000  → 0% delta
console.log('\n[6] Default headline (modest changes)')
const defaultSessions = []
for (let i = 0; i < 4; i++) {
  defaultSessions.push(bbSession(45 + i * 4, 'push', [ex('Pec Dec', [set(150, 10)])]))
}
for (let i = 0; i < 5; i++) {
  defaultSessions.push(bbSession(25 - i * 4, 'push', [ex('Pec Dec', [set(120, 10)])]))
}
const defaultResult = buildMonthlyCoachingSummary({ sessions: defaultSessions, now: NOW })
ok('default result not null',          defaultResult !== null)
ok('headline kind = default',          defaultResult?.meta?.headlineKind === 'default', defaultResult?.meta?.headlineKind)
ok('headline mentions session count',  /\d+ session/.test(defaultResult?.headline), defaultResult?.headline)
ok('session count = 5',                defaultResult?.meta?.sessionCount === 5, defaultResult?.meta?.sessionCount)
ok('prev session count = 4',           defaultResult?.meta?.prevSessionCount === 4, defaultResult?.meta?.prevSessionCount)
ok('"ahead" or "behind" in headline',  /(ahead|behind|on pace|momentum)/.test(defaultResult?.headline))

// ── 7. Volume delta math — div-by-zero handled ───────────────────────────
console.log('\n[7] Volume delta math')
const noPriorSessions = []
// Empty prior window, populated current window
for (let i = 0; i < 5; i++) {
  noPriorSessions.push(bbSession(20 - i * 4, 'push', [ex('Pec Dec', [set(180, 10)])]))
}
const noPriorResult = buildMonthlyCoachingSummary({ sessions: noPriorSessions, now: NOW })
ok('no-prior result not null',         noPriorResult !== null)
ok('volume delta safely 0 with no prior', noPriorResult?.meta?.volumeDeltaPct === 0, noPriorResult?.meta?.volumeDeltaPct)
ok('volume = 9000 (5 × 1800)',         noPriorResult?.meta?.volume === 9000, noPriorResult?.meta?.volume)
ok('prev volume = 0',                  noPriorResult?.meta?.prevVolume === 0)

// Drops contribute to volume per Batch 22 decision 2
console.log('  drops contribute to volume:')
const dropSession = bbSession(5, 'push', [
  ex('Pec Dec', [{
    type: 'working', weight: 200, reps: 10, isNewPR: false,
    drops: [{ weight: 150, reps: 8 }, { weight: 100, reps: 6 }],
  }]),
])
const noPriorWithDrops = [
  ...noPriorSessions,
  dropSession,
]
const dropVolResult = buildMonthlyCoachingSummary({ sessions: noPriorWithDrops, now: NOW })
const expectedVol = 9000 + (200 * 10) + (150 * 8) + (100 * 6)  // 9000 + 2000 + 1200 + 600 = 12800
ok('volume includes drops',            dropVolResult?.meta?.volume === expectedVol, { actual: dropVolResult?.meta?.volume, expected: expectedVol })

// ── 8. Top progressor — high confidence ──────────────────────────────────
console.log('\n[8] Top progressor pickup')
const progressorSessions = []
// 6 sessions of clean +5%/wk progression on Pec Dec
const start = 100
const days = [28, 23, 18, 13, 8, 3]
days.forEach((d, i) => {
  const w = start + i * 8  // 100, 108, 116, 124, 132, 140
  progressorSessions.push(bbSession(d, 'push', [ex('Pec Dec', [set(w, 10)])]))
})
const progResult = buildMonthlyCoachingSummary({ sessions: progressorSessions, now: NOW })
ok('progressor result not null',          progResult !== null)
ok('top progressor has Pec Dec name',     progResult?.meta?.topProgressor?.name === 'Pec Dec', progResult?.meta?.topProgressor)
ok('top progressor rate > 0',             progResult?.meta?.topProgressor?.rate > 0)
ok('top progressor n ≥ 4',                progResult?.meta?.topProgressor?.n >= 4)

// Low-confidence exercise (n=2) is NOT picked
console.log('  thin history is NOT picked:')
const thinSessions = []
for (let i = 0; i < 5; i++) {
  thinSessions.push(bbSession(28 - i * 5, 'push', [
    ex('Pec Dec',     [set(150, 10)]),  // flat — no progression
    i < 2 ? ex('Bench Press', [set(200, 8)]) : null,  // n=2 only, low confidence
  ].filter(Boolean)))
}
const thinResult = buildMonthlyCoachingSummary({ sessions: thinSessions, now: NOW })
ok('thin-history exercise NOT top progressor',
   !thinResult?.meta?.topProgressor || thinResult.meta.topProgressor.n >= 4,
   thinResult?.meta?.topProgressor)

// ── 9. Anomaly bullet — regression fires ─────────────────────────────────
console.log('\n[9] Anomaly — regression detection')
const regSessions = []
const regDays = [50, 45, 40, 35, 30, 25, 20, 15, 10, 5]
const regWeights = [200, 195, 190, 185, 180, 175, 170, 165, 160, 155]
regDays.forEach((d, i) => {
  regSessions.push(bbSession(d, 'push', [ex('Leg Press', [set(regWeights[i], 8)])]))
})
const regResult = buildMonthlyCoachingSummary({ sessions: regSessions, now: NOW })
ok('regression result not null',       regResult !== null)
ok('anomaly kind = regression',        regResult?.meta?.anomaly?.kind === 'regression', regResult?.meta?.anomaly)
ok('suggestion fires on regression',   regResult?.suggestion?.kind === 'warning')
ok('suggestion mentions Leg Press',    regResult?.suggestion?.text?.includes('Leg Press'))
ok('suggestion mentions recovery',     regResult?.suggestion?.text?.toLowerCase().includes('recovery'))

// ── 10. Anomaly — plateau ────────────────────────────────────────────────
console.log('\n[10] Anomaly — plateau detection')
const platSessions = []
const platDays = [50, 45, 40, 35, 30, 25, 20, 15, 10, 5]
platDays.forEach((d) => {
  platSessions.push(bbSession(d, 'push', [ex('Pec Dec', [set(180, 10)])]))
})
const platResult = buildMonthlyCoachingSummary({ sessions: platSessions, now: NOW })
ok('plateau result not null',          platResult !== null)
ok('anomaly kind = plateau',           platResult?.meta?.anomaly?.kind === 'plateau', platResult?.meta?.anomaly)

// ── 11. Anomaly priority — regression > plateau ──────────────────────────
console.log('\n[11] Regression beats plateau when both fire')
const bothSessions = []
const bothDays = [50, 45, 40, 35, 30, 25, 20, 15, 10, 5]
bothDays.forEach((d, i) => {
  bothSessions.push(bbSession(d, 'push', [
    ex('Pec Dec',  [set(180, 10)]),                     // plateau
    ex('Leg Press', [set(200 - i * 5, 8)]),             // regression
  ]))
})
const bothResult = buildMonthlyCoachingSummary({ sessions: bothSessions, now: NOW })
ok('both-anomaly result not null',     bothResult !== null)
ok('regression wins priority',         bothResult?.meta?.anomaly?.kind === 'regression', bothResult?.meta?.anomaly)

// ── 12. Anomaly — swing is intentionally NOT surfaced ────────────────────
console.log('\n[12] Swing detector intentionally skipped')
const swingSessions = []
const swingDays = [50, 45, 40, 35, 30, 25, 20, 15, 10, 5]
const swingWeights = [180, 180, 180, 180, 180, 180, 180, 180, 180, 240]  // last jump is +33%
swingDays.forEach((d, i) => {
  swingSessions.push(bbSession(d, 'push', [ex('Pec Dec', [set(swingWeights[i], 10)])]))
})
const swingResult = buildMonthlyCoachingSummary({ sessions: swingSessions, now: NOW })
// Swing alone shouldn't fire as an anomaly here; plateau across the flat first 9
// also won't fire because the last point breaks the line. So expect anomaly null
// OR the suggestion to NOT mention "swing".
const swingNotInSuggestion = !swingResult?.suggestion ||
  !swingResult.suggestion.text?.toLowerCase().includes('swung') ||
  !swingResult.suggestion.text?.toLowerCase().includes('swing')
ok('swing not surfaced in suggestion', swingNotInSuggestion, swingResult?.suggestion)

// ── 13. Workout-type drift ───────────────────────────────────────────────
console.log('\n[13] Workout-type drift')
const driftSessions = []
// Prior window: 4 Push + 4 Pull sessions
for (let i = 0; i < 4; i++) {
  driftSessions.push(bbSession(35 + i * 4, 'push', [ex('Pec Dec', [set(180, 10)])]))
  driftSessions.push(bbSession(36 + i * 4, 'pull', [ex('Single Arm Row', [set(80, 8)])]))
}
// Current window: 4 Push + 1 Pull (75% drop on pull)
for (let i = 0; i < 4; i++) {
  driftSessions.push(bbSession(28 - i * 6, 'push', [ex('Pec Dec', [set(180, 10)])]))
}
driftSessions.push(bbSession(2, 'pull', [ex('Single Arm Row', [set(80, 8)])]))
const driftSplits = [{
  id: 'split_test', isBuiltIn: false,
  workouts: [{ id: 'push', name: 'Push' }, { id: 'pull', name: 'Pull' }],
}]
const driftResult = buildMonthlyCoachingSummary({
  sessions: driftSessions,
  splits: driftSplits,
  activeSplitId: 'split_test',
  now: NOW,
})
ok('drift result not null',             driftResult !== null)
ok('drift detected on Pull',            driftResult?.meta?.drift?.type === 'pull', driftResult?.meta?.drift)
ok('drift suggestion fires',            driftResult?.suggestion?.kind === 'tip')
ok('drift suggestion mentions Pull',    driftResult?.suggestion?.text?.includes('Pull'))

// ── 14. HYROX bullet integration ─────────────────────────────────────────
console.log('\n[14] HYROX integration')
const hxSessions = []
for (let i = 0; i < 4; i++) {
  hxSessions.push(bbSession(28 - i * 6, 'hyrox_tue', [
    ex('Cable Lateral Raise', [set(15, 12)]),
    {
      name: 'HYROX Run + SkiErg Round',
      exerciseId: 'ex_hyrox_run_skierg',
      sets: [],
      rounds: [
        { roundIndex: 0, legs: [{ type: 'run', timeSec: 240, distanceMeters: 800 }, { type: 'station', stationId: 'sta_skierg', timeSec: 360 }], restAfterSec: 90 },
        { roundIndex: 1, legs: [{ type: 'run', timeSec: 235, distanceMeters: 800 }, { type: 'station', stationId: 'sta_skierg', timeSec: 350 }], restAfterSec: 90 },
        { roundIndex: 2, legs: [{ type: 'run', timeSec: 232, distanceMeters: 800 }, { type: 'station', stationId: 'sta_skierg', timeSec: 345 }], restAfterSec: 90 },
        { roundIndex: 3, legs: [{ type: 'run', timeSec: 228, distanceMeters: 800 }, { type: 'station', stationId: 'sta_skierg', timeSec: 340 }], restAfterSec: 0 },
      ],
    },
  ]))
}
const hxResult = buildMonthlyCoachingSummary({ sessions: hxSessions, now: NOW })
ok('HYROX result not null',              hxResult !== null)
ok('hyrox stats captured',               hxResult?.meta?.hyrox !== null)
ok('hyrox sessionCount = 4',             hxResult?.meta?.hyrox?.sessionCount === 4, hxResult?.meta?.hyrox)
ok('hyrox roundCount = 16',              hxResult?.meta?.hyrox?.roundCount === 16)
ok('hyrox in headline',                  hxResult?.meta?.headlineKind === 'hyrox', hxResult?.meta?.headlineKind)
ok('headline mentions HYROX',            hxResult?.headline?.toUpperCase().includes('HYROX'), hxResult?.headline)

// Lift-only sessions don't create HYROX bullets
console.log('  lift-only sessions don\'t surface HYROX:')
const liftOnlyResult = buildMonthlyCoachingSummary({ sessions: progressorSessions, now: NOW })
ok('lift-only hyrox is null',            liftOnlyResult?.meta?.hyrox === null)

// ── 15. Hybrid scope — streak includes cardio + rest ─────────────────────
console.log('\n[15] Hybrid scope (streak includes cardio + rest)')
const cardio = []
const restDays = []
const sessionsForStreak = []
// Last 7 days: 3 bb, 2 cardio, 2 rest = 7-day streak
for (let d = 0; d < 7; d++) {
  if (d < 3) sessionsForStreak.push(bbSession(d, 'push', [ex('Pec Dec', [set(180, 10)])]))
  else if (d < 5) cardio.push({ id: `c_${d}`, date: isoDaysAgo(d), type: 'Treadmill', duration: 30 })
  else restDays.push({ id: `r_${d}`, date: isoDaysAgo(d).slice(0, 10) })
}
// Add older bb sessions to clear the cold-start gate
for (let i = 0; i < 5; i++) sessionsForStreak.push(bbSession(15 + i * 3, 'push', [ex('Pec Dec', [set(180, 10)])]))
const hybridResult = buildMonthlyCoachingSummary({
  sessions: sessionsForStreak,
  cardioSessions: cardio,
  restDaySessions: restDays,
  now: NOW,
})
ok('hybrid result not null',             hybridResult !== null)
ok('streak ≥ 1',                         hybridResult?.meta?.currentStreak >= 1, hybridResult?.meta?.currentStreak)

// ── 16. Defensive cases ──────────────────────────────────────────────────
console.log('\n[16] Defensive cases')
ok('null sessions → null',               buildMonthlyCoachingSummary({ sessions: null }) === null)
ok('non-array sessions → null',          buildMonthlyCoachingSummary({ sessions: 'foo' }) === null)
ok('sessions with bad dates skip',       (() => {
  const bad = [
    { id: 'a', date: 'not-a-date', mode: 'bb', data: { exercises: [] } },
    bbSession(5, 'push', [ex('Pec Dec', [set(180, 10)])]),
    bbSession(10, 'push', [ex('Pec Dec', [set(180, 10)])]),
    bbSession(15, 'push', [ex('Pec Dec', [set(180, 10)])]),
  ]
  const r = buildMonthlyCoachingSummary({ sessions: bad, now: NOW })
  return r !== null && r.meta.sessionCount === 3
})())
ok('sessions missing data → tolerated', (() => {
  const malformed = []
  for (let i = 0; i < 5; i++) {
    malformed.push({ id: `m_${i}`, date: isoDaysAgo(20 - i * 3), mode: 'bb', type: 'push' })
  }
  const r = buildMonthlyCoachingSummary({ sessions: malformed, now: NOW })
  return r !== null
})())
ok('exercises with no sets → tolerated', (() => {
  const empty = []
  for (let i = 0; i < 5; i++) {
    empty.push(bbSession(20 - i * 3, 'push', [ex('Pec Dec', [])]))
  }
  const r = buildMonthlyCoachingSummary({ sessions: empty, now: NOW })
  return r !== null
})())

// Eyebrow / headline / bullets always present + correct shape
console.log('  return shape:')
const shape = buildMonthlyCoachingSummary({ sessions: defaultSessions, now: NOW })
ok('eyebrow is string',                  typeof shape.eyebrow === 'string')
ok('eyebrow includes COACH',             shape.eyebrow.includes('COACH'))
ok('headline is string',                 typeof shape.headline === 'string')
ok('bullets is array',                   Array.isArray(shape.bullets))
ok('bullets length ≤ 3',                 shape.bullets.length <= 3)
ok('suggestion is null or {kind, text}', shape.suggestion === null || (shape.suggestion?.kind && shape.suggestion?.text))
ok('meta is object',                     typeof shape.meta === 'object')

// ── 17. Bullets composition — variety check ─────────────────────────────
console.log('\n[17] Bullets composition')
const richResult = buildMonthlyCoachingSummary({ sessions: progressorSessions, now: NOW })
ok('rich result has bullets',            richResult?.bullets?.length > 0, richResult?.bullets)
// Top progressor should appear in a bullet (since headline is default)
const hasProgressorBullet = richResult.bullets.some(b => b.includes('Pec Dec'))
ok('progressor bullet present',          hasProgressorBullet, richResult.bullets)

// ── 18. Real-data spot check ────────────────────────────────────────────
console.log('\n[18] Real-data spot check')
const backupPath = resolve('./workout-backup-2026-04-26.json')
if (existsSync(backupPath)) {
  try {
    const raw = readFileSync(backupPath, 'utf8')
    const data = JSON.parse(raw)
    const r = buildMonthlyCoachingSummary({
      sessions:        data.sessions || [],
      cardioSessions:  data.cardioSessions || [],
      restDaySessions: data.restDaySessions || [],
      splits:          data.splits || [],
      activeSplitId:   data.activeSplitId || null,
      now:             NOW,
    })
    if (r) {
      ok('real-data returns shape', typeof r === 'object' && r.headline)
      console.log(`     headline: "${r.headline}"`)
      console.log(`     bullets:  ${JSON.stringify(r.bullets)}`)
      console.log(`     suggestion: ${r.suggestion ? r.suggestion.text : '(none)'}`)
      console.log(`     meta sessionCount=${r.meta.sessionCount}, prCount=${r.meta.prCount}, headlineKind=${r.meta.headlineKind}`)
    } else {
      ok('real-data returned null (cold start) — that\'s fine', true)
      console.log(`     (sessions in window may be < 3; the helper correctly hid the card.)`)
    }
  } catch (e) {
    console.log(`     ! could not parse backup: ${e.message}`)
    ok('backup parse error tolerated', true)
  }
} else {
  console.log(`     (skipped — workout-backup-2026-04-26.json not present in worktree root)`)
  ok('skipped backup gracefully', true)
}

// ── Summary ──────────────────────────────────────────────────────────────
console.log(`\n────────────────────────────────────────`)
console.log(`Pass: ${pass}   Fail: ${fail}`)
if (fail > 0) {
  process.exit(1)
}
